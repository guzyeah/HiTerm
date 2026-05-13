/**
 * Terminal 文件浏览侧信道。
 * 文件读取运行在 worker 中，避免目录扫描阻塞主进程或影响 PTY 交互。
 */

import { app, ipcMain, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { getTerminalSessionMetadata } from './terminalSession'
import { LOCAL_FILES_WORKER_SOURCE } from './localFilesWorkerSource'
import type {
  TerminalFileEntry,
  TerminalFilesDirectoryEvent,
  TerminalFilesErrorEvent,
  TerminalFilesReadDirectoryRequest,
  TerminalFilesSetRootPathRequest,
  TerminalFilesSessionRequest,
  TerminalFilesSnapshot,
  TerminalFilesSnapshotEvent,
} from '../src/shared/terminalFilesTypes'

interface TerminalFilesSubscription {
  sessionId: string
  webContents: WebContents
  rootPath: string
  homeDir: string
}

interface WorkerSnapshotResponse {
  type: 'snapshot'
  requestId: string
  snapshot: TerminalFilesSnapshot
}

interface WorkerDirectoryResponse {
  type: 'directory'
  requestId: string
  parentPath: string
  entries: TerminalFileEntry[]
}

interface WorkerErrorResponse {
  type: 'error'
  requestId?: string
  message: string
}

type LocalFilesWorkerMessage =
  | WorkerSnapshotResponse
  | WorkerDirectoryResponse
  | WorkerErrorResponse

interface PendingSnapshotWorkerRequest {
  subscriptionKey: string
  type: 'snapshot'
  publishError: boolean
  resolve: (snapshot: TerminalFilesSnapshot) => void
  reject: (error: Error) => void
}

interface PendingDirectoryWorkerRequest {
  subscriptionKey: string
  type: 'directory'
  publishError: boolean
  resolve: (payload: { parentPath: string; entries: TerminalFileEntry[] }) => void
  reject: (error: Error) => void
}

type PendingWorkerRequest = PendingSnapshotWorkerRequest | PendingDirectoryWorkerRequest

const subscriptions = new Map<string, TerminalFilesSubscription>()
const webContentsSubscriptions = new Map<number, Set<string>>()
const trackedWebContentsIds = new Set<number>()
const pendingWorkerRequests = new Map<string, PendingWorkerRequest>()

let localFilesWorker: Worker | null = null

function getSubscriptionKey(webContents: WebContents, sessionId: string): string {
  return `${webContents.id}:${sessionId}`
}

function normalizeComparablePath(targetPath: string): string {
  const resolvedPath = path.resolve(targetPath)
  return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath
}

function isPathWithinRoot(rootPath: string, candidatePath: string): boolean {
  const normalizedRootPath = normalizeComparablePath(rootPath)
  const normalizedCandidatePath = normalizeComparablePath(candidatePath)
  if (normalizedRootPath === normalizedCandidatePath) return true

  const relativePath = path.relative(normalizedRootPath, normalizedCandidatePath)
  return relativePath !== ''
    && !relativePath.startsWith('..')
    && !path.isAbsolute(relativePath)
}

function trackWebContentsSubscription(webContents: WebContents, sessionId: string): void {
  let sessionIds = webContentsSubscriptions.get(webContents.id)
  if (!sessionIds) {
    sessionIds = new Set()
    webContentsSubscriptions.set(webContents.id, sessionIds)
  }

  sessionIds.add(sessionId)

  if (trackedWebContentsIds.has(webContents.id)) return

  trackedWebContentsIds.add(webContents.id)
  webContents.once('destroyed', () => {
    const nextSessionIds = webContentsSubscriptions.get(webContents.id)
    webContentsSubscriptions.delete(webContents.id)
    trackedWebContentsIds.delete(webContents.id)
    nextSessionIds?.forEach(sessionId => unsubscribeTerminalFiles(webContents, sessionId))
  })
}

function untrackWebContentsSubscription(webContents: WebContents, sessionId: string): void {
  webContentsSubscriptions.get(webContents.id)?.delete(sessionId)
}

function ensureLocalFilesWorker(): Worker {
  if (localFilesWorker) return localFilesWorker

  const worker = new Worker(LOCAL_FILES_WORKER_SOURCE, { eval: true })
  localFilesWorker = worker

  worker.on('message', (message: LocalFilesWorkerMessage) => {
    if (message.type === 'snapshot') {
      resolveWorkerSnapshot(message.requestId, message.snapshot)
      return
    }

    if (message.type === 'directory') {
      resolveWorkerDirectory(message.requestId, message.parentPath, message.entries)
      return
    }

    publishWorkerError(message.requestId, message.message)
  })
  worker.on('error', error => {
    publishWorkerError(undefined, error.message)
  })
  worker.on('exit', () => {
    if (localFilesWorker === worker) {
      localFilesWorker = null
    }

    if (pendingWorkerRequests.size > 0) {
      const requestIds = [...pendingWorkerRequests.keys()]
      requestIds.forEach(requestId => publishWorkerError(requestId, 'Files worker exited unexpectedly'))
    }

    if (subscriptions.size > 0) {
      ensureLocalFilesWorker()
    }
  })

  return localFilesWorker
}

function stopLocalFilesWorkerIfIdle(): void {
  if (subscriptions.size > 0 || pendingWorkerRequests.size > 0 || !localFilesWorker) return

  const worker = localFilesWorker
  localFilesWorker = null
  worker.postMessage({ type: 'stop' })
}

function sendTerminalFilesError(webContents: WebContents, payload: TerminalFilesErrorEvent): void {
  if (!webContents.isDestroyed()) {
    webContents.send('terminalFiles:error', payload)
  }
}

function sendTerminalFilesSnapshot(subscriptionKey: string, snapshot: TerminalFilesSnapshot): void {
  const subscription = subscriptions.get(subscriptionKey)
  if (!subscription || subscription.webContents.isDestroyed()) {
    stopLocalFilesWorkerIfIdle()
    return
  }

  subscription.rootPath = snapshot.cwd
  subscription.homeDir = snapshot.homeDir

  const event: TerminalFilesSnapshotEvent = {
    sessionId: subscription.sessionId,
    snapshot,
  }
  subscription.webContents.send('terminalFiles:snapshot', event)
}

function sendTerminalFilesDirectory(
  subscriptionKey: string,
  parentPath: string,
  entries: TerminalFileEntry[],
): void {
  const subscription = subscriptions.get(subscriptionKey)
  if (!subscription || subscription.webContents.isDestroyed()) {
    stopLocalFilesWorkerIfIdle()
    return
  }

  const event: TerminalFilesDirectoryEvent = {
    sessionId: subscription.sessionId,
    parentPath,
    entries,
  }
  subscription.webContents.send('terminalFiles:directory', event)
}

function publishSubscriptionError(subscriptionKey: string, message: string): void {
  const subscription = subscriptions.get(subscriptionKey)
  if (!subscription) return

  sendTerminalFilesError(subscription.webContents, {
    sessionId: subscription.sessionId,
    message,
  })
}

function resolveWorkerSnapshot(requestId: string, snapshot: TerminalFilesSnapshot): void {
  const pendingRequest = pendingWorkerRequests.get(requestId)
  if (!pendingRequest || pendingRequest.type !== 'snapshot') return

  pendingWorkerRequests.delete(requestId)
  pendingRequest.resolve(snapshot)
  stopLocalFilesWorkerIfIdle()
}

function resolveWorkerDirectory(
  requestId: string,
  parentPath: string,
  entries: TerminalFileEntry[],
): void {
  const pendingRequest = pendingWorkerRequests.get(requestId)
  if (!pendingRequest || pendingRequest.type !== 'directory') return

  pendingWorkerRequests.delete(requestId)
  pendingRequest.resolve({
    parentPath,
    entries,
  })
  stopLocalFilesWorkerIfIdle()
}

function rejectWorkerRequest(requestId: string, message: string, shouldPublishError = true): void {
  const pendingRequest = pendingWorkerRequests.get(requestId)
  if (!pendingRequest) return

  pendingWorkerRequests.delete(requestId)
  if (shouldPublishError && pendingRequest.publishError) {
    publishSubscriptionError(pendingRequest.subscriptionKey, message)
  }
  pendingRequest.reject(new Error(message))
  stopLocalFilesWorkerIfIdle()
}

function publishWorkerError(requestId: string | undefined, message: string): void {
  if (requestId) {
    rejectWorkerRequest(requestId, message)
    stopLocalFilesWorkerIfIdle()
    return
  }

  const pendingRequestIds = [...pendingWorkerRequests.keys()]
  pendingRequestIds.forEach(pendingRequestId => {
    rejectWorkerRequest(pendingRequestId, message, false)
  })

  subscriptions.forEach(subscription => {
    sendTerminalFilesError(subscription.webContents, {
      sessionId: subscription.sessionId,
      message,
    })
  })
  stopLocalFilesWorkerIfIdle()
}

function requestWorkerSnapshot(
  subscriptionKey: string,
  cwd: string,
  homeDir: string,
  publishError = true,
): Promise<TerminalFilesSnapshot> {
  const worker = ensureLocalFilesWorker()
  const requestId = randomUUID()
  return new Promise((resolve, reject) => {
    pendingWorkerRequests.set(requestId, {
      subscriptionKey,
      type: 'snapshot',
      publishError,
      resolve,
      reject,
    })
    worker.postMessage({
      type: 'snapshot',
      requestId,
      cwd,
      homeDir,
    })
  })
}

function requestWorkerDirectory(
  subscriptionKey: string,
  targetPath: string,
  publishError = true,
): Promise<{ parentPath: string; entries: TerminalFileEntry[] }> {
  const worker = ensureLocalFilesWorker()
  const requestId = randomUUID()
  return new Promise((resolve, reject) => {
    pendingWorkerRequests.set(requestId, {
      subscriptionKey,
      type: 'directory',
      publishError,
      resolve,
      reject,
    })
    worker.postMessage({
      type: 'directory',
      requestId,
      path: targetPath,
    })
  })
}

function queueSnapshotRequest(subscriptionKey: string, cwd: string, homeDir: string): void {
  void requestWorkerSnapshot(subscriptionKey, cwd, homeDir).then(snapshot => {
    sendTerminalFilesSnapshot(subscriptionKey, snapshot)
  }).catch(() => undefined)
}

function queueDirectoryRequest(subscriptionKey: string, targetPath: string): void {
  void requestWorkerDirectory(subscriptionKey, targetPath).then(({ parentPath, entries }) => {
    sendTerminalFilesDirectory(subscriptionKey, parentPath, entries)
  }).catch(() => undefined)
}

function getSubscriptionForSender(sessionId: string, webContents: WebContents): TerminalFilesSubscription {
  const subscription = subscriptions.get(getSubscriptionKey(webContents, sessionId))
  if (!subscription) {
    throw new Error('Terminal files subscription not found')
  }

  return subscription
}

function subscribeTerminalFiles(webContents: WebContents, sessionId: string): void {
  const metadata = getTerminalSessionMetadata(sessionId, webContents)
  if (!metadata || metadata.protocol !== 'local') {
    throw new Error('Only local terminal files are supported')
  }

  const subscriptionKey = getSubscriptionKey(webContents, sessionId)
  subscriptions.set(subscriptionKey, {
    sessionId,
    webContents,
    rootPath: metadata.cwd,
    homeDir: metadata.homeDir,
  })
  trackWebContentsSubscription(webContents, sessionId)
  queueSnapshotRequest(subscriptionKey, metadata.cwd, metadata.homeDir)
}

function unsubscribeTerminalFiles(webContents: WebContents, sessionId: string): void {
  subscriptions.delete(getSubscriptionKey(webContents, sessionId))
  untrackWebContentsSubscription(webContents, sessionId)
  stopLocalFilesWorkerIfIdle()
}

function refreshTerminalFiles(webContents: WebContents, sessionId: string): void {
  const metadata = getTerminalSessionMetadata(sessionId, webContents)
  if (!metadata || metadata.protocol !== 'local') {
    unsubscribeTerminalFiles(webContents, sessionId)
    throw new Error('Only local terminal files are supported')
  }

  const subscriptionKey = getSubscriptionKey(webContents, sessionId)
  const subscription = getSubscriptionForSender(sessionId, webContents)
  queueSnapshotRequest(subscriptionKey, subscription.rootPath, metadata.homeDir)
}

function goHomeTerminalFiles(webContents: WebContents, sessionId: string): void {
  const metadata = getTerminalSessionMetadata(sessionId, webContents)
  if (!metadata || metadata.protocol !== 'local') {
    unsubscribeTerminalFiles(webContents, sessionId)
    throw new Error('Only local terminal files are supported')
  }

  const subscriptionKey = getSubscriptionKey(webContents, sessionId)
  queueSnapshotRequest(subscriptionKey, metadata.homeDir, metadata.homeDir)
}

function resolveNextRootPath(subscription: TerminalFilesSubscription, requestedPath: string): string {
  const trimmedPath = requestedPath.trim()
  if (!trimmedPath) {
    throw new Error('Directory path is required')
  }

  if (trimmedPath === '~') {
    return subscription.homeDir
  }

  if (trimmedPath.startsWith('~/') || trimmedPath.startsWith('~\\')) {
    return path.resolve(subscription.homeDir, trimmedPath.slice(2))
  }

  if (path.isAbsolute(trimmedPath)) {
    return path.resolve(trimmedPath)
  }

  return path.resolve(subscription.rootPath, trimmedPath)
}

async function setRootPathTerminalFiles(
  webContents: WebContents,
  request: TerminalFilesSetRootPathRequest,
): Promise<void> {
  const metadata = getTerminalSessionMetadata(request.sessionId, webContents)
  if (!metadata || metadata.protocol !== 'local') {
    unsubscribeTerminalFiles(webContents, request.sessionId)
    throw new Error('Only local terminal files are supported')
  }

  const subscription = getSubscriptionForSender(request.sessionId, webContents)
  const nextRootPath = resolveNextRootPath(subscription, request.path)
  const subscriptionKey = getSubscriptionKey(webContents, request.sessionId)
  const snapshot = await requestWorkerSnapshot(
    subscriptionKey,
    nextRootPath,
    subscription.homeDir,
    false,
  )

  sendTerminalFilesSnapshot(subscriptionKey, snapshot)
}

function readTerminalDirectory(
  webContents: WebContents,
  request: TerminalFilesReadDirectoryRequest,
): void {
  const metadata = getTerminalSessionMetadata(request.sessionId, webContents)
  if (!metadata || metadata.protocol !== 'local') {
    unsubscribeTerminalFiles(webContents, request.sessionId)
    throw new Error('Only local terminal files are supported')
  }

  const subscription = getSubscriptionForSender(request.sessionId, webContents)
  if (!isPathWithinRoot(subscription.rootPath, request.path)) {
    throw new Error('Directory is outside the current root path')
  }

  queueDirectoryRequest(getSubscriptionKey(webContents, request.sessionId), request.path)
}

export function registerTerminalFilesIpcHandlers(): void {
  ipcMain.handle('terminalFiles:subscribe', (event, request: TerminalFilesSessionRequest) => {
    subscribeTerminalFiles(event.sender, request.sessionId)
  })

  ipcMain.handle('terminalFiles:unsubscribe', (event, request: TerminalFilesSessionRequest) => {
    unsubscribeTerminalFiles(event.sender, request.sessionId)
  })

  ipcMain.handle('terminalFiles:refresh', (event, request: TerminalFilesSessionRequest) => {
    refreshTerminalFiles(event.sender, request.sessionId)
  })

  ipcMain.handle('terminalFiles:goHome', (event, request: TerminalFilesSessionRequest) => {
    goHomeTerminalFiles(event.sender, request.sessionId)
  })

  ipcMain.handle('terminalFiles:readDirectory', (event, request: TerminalFilesReadDirectoryRequest) => {
    readTerminalDirectory(event.sender, request)
  })

  ipcMain.handle('terminalFiles:setRootPath', (event, request: TerminalFilesSetRootPathRequest) => {
    return setRootPathTerminalFiles(event.sender, request)
  })

  app.once('before-quit', () => {
    subscriptions.clear()
    pendingWorkerRequests.clear()
    localFilesWorker?.postMessage({ type: 'stop' })
    localFilesWorker = null
  })
}
