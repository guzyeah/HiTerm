/**
 * Terminal 文件浏览侧信道。
 * Local 文件扫描/复制使用 worker，SSH 文件能力通过 SFTP 侧信道提供。
 */

import electron, { type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { LOCAL_FILES_TRANSFER_WORKER_SOURCE } from './localFilesTransferWorkerSource'
import { LOCAL_FILES_WORKER_SOURCE } from './localFilesWorkerSource'
import { getTerminalSessionMetadata } from './terminalSession'
import {
  createSshDirectory,
  createSshFile,
  createSshSnapshot,
  deleteSshEntries,
  downloadSshFiles,
  isRemotePathWithinRoot,
  normalizeRemotePath,
  readSshDirectory,
  resolveSshRootPath,
  uploadSshFiles,
} from './sshFileSystem'
import type {
  TerminalFileEntry,
  TerminalFilesCreateDirectoryRequest,
  TerminalFilesCreateEntryResult,
  TerminalFilesCreateFileRequest,
  TerminalFilesDeleteEntriesRequest,
  TerminalFilesDeleteEntriesResult,
  TerminalFilesDirectoryEvent,
  TerminalFilesDownloadRequest,
  TerminalFilesErrorEvent,
  TerminalFilesReadDirectoryRequest,
  TerminalFilesSessionRequest,
  TerminalFilesSetRootPathRequest,
  TerminalFilesSnapshot,
  TerminalFilesSnapshotEvent,
  TerminalFilesTransferDirection,
  TerminalFilesTransferState,
  TerminalFilesTransferStateEvent,
  TerminalFilesUploadRequest,
} from '../src/shared/terminalFilesTypes'

const { app, ipcMain } = electron

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

interface TransferWorkerStateMessage {
  type: 'transferState'
  state: TerminalFilesTransferState
}

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

interface TransferTask {
  kind: 'local-worker' | 'ssh'
  sessionId: string
  webContentsId: number
  worker: Worker | null
  state: TerminalFilesTransferState
}

const subscriptions = new Map<string, TerminalFilesSubscription>()
const webContentsSubscriptions = new Map<number, Set<string>>()
const trackedWebContentsIds = new Set<number>()
const pendingWorkerRequests = new Map<string, PendingWorkerRequest>()
const transferTasks = new Map<string, TransferTask>()

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

function isSamePath(leftPath: string, rightPath: string): boolean {
  return normalizeComparablePath(leftPath) === normalizeComparablePath(rightPath)
}

function validateEntryName(name: string): string {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error('Name is required')
  }

  if (trimmedName === '.' || trimmedName === '..') {
    throw new Error('Invalid name')
  }

  if (trimmedName.includes('/') || trimmedName.includes('\\')) {
    throw new Error('Name cannot include path separators')
  }

  return trimmedName
}

async function ensureExistingDirectory(targetPath: string): Promise<void> {
  const directoryStats = await fsPromises.stat(targetPath).catch(() => null)
  if (!directoryStats?.isDirectory()) {
    throw new Error('Directory does not exist')
  }
}

function collapseNestedPaths(targetPaths: string[]): string[] {
  const sortedPaths = [...targetPaths].sort((leftPath, rightPath) => {
    const lengthDifference = leftPath.length - rightPath.length
    if (lengthDifference !== 0) {
      return lengthDifference
    }

    return leftPath.localeCompare(rightPath)
  })

  return sortedPaths.filter((targetPath, index) => {
    return !sortedPaths.slice(0, index).some(previousPath => isPathWithinRoot(previousPath, targetPath))
  })
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
    nextSessionIds?.forEach(nextSessionId => unsubscribeTerminalFiles(webContents, nextSessionId))
    stopTransferTasksForWebContents(webContents.id)
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

function sendTerminalFilesTransferState(
  subscriptionKey: string,
  state: TerminalFilesTransferState,
): void {
  const subscription = subscriptions.get(subscriptionKey)
  if (!subscription || subscription.webContents.isDestroyed()) return

  const event: TerminalFilesTransferStateEvent = {
    sessionId: subscription.sessionId,
    state,
  }
  subscription.webContents.send('terminalFiles:transferState', event)
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

function queueSshSnapshotRequest(
  subscriptionKey: string,
  sessionId: string,
  rootPath: string,
  homeDir: string,
): void {
  void createSshSnapshot(sessionId, rootPath, homeDir).then(snapshot => {
    sendTerminalFilesSnapshot(subscriptionKey, snapshot)
  }).catch(error => {
    publishSubscriptionError(
      subscriptionKey,
      error instanceof Error ? error.message : String(error),
    )
  })
}

function queueSshDirectoryRequest(
  subscriptionKey: string,
  sessionId: string,
  targetPath: string,
): void {
  void readSshDirectory(sessionId, targetPath).then(({ parentPath, entries }) => {
    sendTerminalFilesDirectory(subscriptionKey, parentPath, entries)
  }).catch(error => {
    publishSubscriptionError(
      subscriptionKey,
      error instanceof Error ? error.message : String(error),
    )
  })
}

function stopTransferTask(subscriptionKey: string): void {
  const transferTask = transferTasks.get(subscriptionKey)
  if (!transferTask) return

  transferTasks.delete(subscriptionKey)

  if (!transferTask.worker) return

  try {
    transferTask.worker.postMessage({ type: 'stop' })
  } catch {
    // worker 已退出时忽略停止异常
  }
}

function stopTransferTasksForWebContents(webContentsId: number): void {
  const subscriptionKeys = [...transferTasks.keys()].filter(
    subscriptionKey => subscriptionKey.startsWith(`${webContentsId}:`),
  )

  subscriptionKeys.forEach(stopTransferTask)
}

function publishActiveTransferState(subscriptionKey: string): void {
  const transferTask = transferTasks.get(subscriptionKey)
  if (!transferTask) return

  sendTerminalFilesTransferState(subscriptionKey, transferTask.state)
}

function handleTransferWorkerStateMessage(
  subscriptionKey: string,
  message: TransferWorkerStateMessage,
): void {
  const transferTask = transferTasks.get(subscriptionKey)
  if (!transferTask) return

  transferTask.state = message.state
  sendTerminalFilesTransferState(subscriptionKey, message.state)

  if (message.state.status === 'completed' || message.state.status === 'failed') {
    stopTransferTask(subscriptionKey)
  }
}

function createTransferWorker(
  subscriptionKey: string,
  direction: TerminalFilesTransferDirection,
): Worker {
  const worker = new Worker(LOCAL_FILES_TRANSFER_WORKER_SOURCE, { eval: true })

  worker.on('message', (message: TransferWorkerStateMessage) => {
    if (!message || typeof message !== 'object' || message.type !== 'transferState') return
    handleTransferWorkerStateMessage(subscriptionKey, message)
  })
  worker.on('error', error => {
    const transferTask = transferTasks.get(subscriptionKey)
    handleTransferWorkerStateMessage(subscriptionKey, {
      type: 'transferState',
      state: {
        ...(transferTask?.state ?? {
          taskId: randomUUID(),
          direction,
          destinationPath: '',
          currentItemName: null,
          completedItems: 0,
          totalItems: 0,
          copiedBytes: 0,
          totalBytes: null,
          percent: null,
        }),
        status: 'failed',
        errorMessage: error.message,
      },
    })
  })
  worker.on('exit', code => {
    const transferTask = transferTasks.get(subscriptionKey)
    if (!transferTask) return

    if (code !== 0 && transferTask.state.status !== 'completed' && transferTask.state.status !== 'failed') {
      handleTransferWorkerStateMessage(subscriptionKey, {
        type: 'transferState',
        state: {
          ...transferTask.state,
          status: 'failed',
          errorMessage: 'Transfer worker exited unexpectedly',
        },
      })
    }
  })

  return worker
}

function getSubscriptionForSender(sessionId: string, webContents: WebContents): TerminalFilesSubscription {
  const subscription = subscriptions.get(getSubscriptionKey(webContents, sessionId))
  if (!subscription) {
    throw new Error('Terminal files subscription not found')
  }

  return subscription
}

function ensureSessionMetadata(sessionId: string, webContents: WebContents) {
  const metadata = getTerminalSessionMetadata(sessionId, webContents)
  if (!metadata || (metadata.protocol !== 'local' && metadata.protocol !== 'ssh')) {
    unsubscribeTerminalFiles(webContents, sessionId)
    throw new Error('Unsupported terminal files session')
  }

  return metadata
}

function subscribeTerminalFiles(webContents: WebContents, sessionId: string): void {
  const metadata = ensureSessionMetadata(sessionId, webContents)

  const subscriptionKey = getSubscriptionKey(webContents, sessionId)
  subscriptions.set(subscriptionKey, {
    sessionId,
    webContents,
    rootPath: metadata.cwd,
    homeDir: metadata.homeDir,
  })
  trackWebContentsSubscription(webContents, sessionId)

  if (metadata.protocol === 'local') {
    queueSnapshotRequest(subscriptionKey, metadata.cwd, metadata.homeDir)
  } else {
    queueSshSnapshotRequest(subscriptionKey, sessionId, metadata.cwd, metadata.homeDir)
  }

  publishActiveTransferState(subscriptionKey)
}

function unsubscribeTerminalFiles(webContents: WebContents, sessionId: string): void {
  subscriptions.delete(getSubscriptionKey(webContents, sessionId))
  untrackWebContentsSubscription(webContents, sessionId)
  stopLocalFilesWorkerIfIdle()
}

function refreshTerminalFiles(webContents: WebContents, sessionId: string): void {
  const metadata = ensureSessionMetadata(sessionId, webContents)
  const subscriptionKey = getSubscriptionKey(webContents, sessionId)
  const subscription = getSubscriptionForSender(sessionId, webContents)

  if (metadata.protocol === 'local') {
    queueSnapshotRequest(subscriptionKey, subscription.rootPath, metadata.homeDir)
  } else {
    queueSshSnapshotRequest(subscriptionKey, sessionId, subscription.rootPath, metadata.homeDir)
  }
}

function goHomeTerminalFiles(webContents: WebContents, sessionId: string): void {
  const metadata = ensureSessionMetadata(sessionId, webContents)
  const subscriptionKey = getSubscriptionKey(webContents, sessionId)

  if (metadata.protocol === 'local') {
    queueSnapshotRequest(subscriptionKey, metadata.homeDir, metadata.homeDir)
  } else {
    queueSshSnapshotRequest(subscriptionKey, sessionId, metadata.homeDir, metadata.homeDir)
  }
}

function resolveNextLocalRootPath(subscription: TerminalFilesSubscription, requestedPath: string): string {
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
  const metadata = ensureSessionMetadata(request.sessionId, webContents)
  const subscription = getSubscriptionForSender(request.sessionId, webContents)
  const subscriptionKey = getSubscriptionKey(webContents, request.sessionId)

  if (metadata.protocol === 'local') {
    const nextRootPath = resolveNextLocalRootPath(subscription, request.path)
    const snapshot = await requestWorkerSnapshot(
      subscriptionKey,
      nextRootPath,
      subscription.homeDir,
      false,
    )

    sendTerminalFilesSnapshot(subscriptionKey, snapshot)
    return
  }

  const nextRootPath = await resolveSshRootPath({
    sessionId: request.sessionId,
    rootPath: subscription.rootPath,
    homeDir: subscription.homeDir,
  }, request.path)
  const snapshot = await createSshSnapshot(request.sessionId, nextRootPath, subscription.homeDir)
  sendTerminalFilesSnapshot(subscriptionKey, snapshot)
}

function readTerminalDirectory(
  webContents: WebContents,
  request: TerminalFilesReadDirectoryRequest,
): void {
  const metadata = ensureSessionMetadata(request.sessionId, webContents)
  const subscription = getSubscriptionForSender(request.sessionId, webContents)
  const subscriptionKey = getSubscriptionKey(webContents, request.sessionId)

  if (metadata.protocol === 'local') {
    if (!isPathWithinRoot(subscription.rootPath, request.path)) {
      throw new Error('Directory is outside the current root path')
    }

    queueDirectoryRequest(subscriptionKey, request.path)
    return
  }

  const normalizedPath = normalizeRemotePath(request.path)
  if (!isRemotePathWithinRoot(subscription.rootPath, normalizedPath)) {
    throw new Error('Directory is outside the current root path')
  }

  queueSshDirectoryRequest(subscriptionKey, request.sessionId, normalizedPath)
}

async function createTerminalFileEntry(
  webContents: WebContents,
  request: TerminalFilesCreateFileRequest | TerminalFilesCreateDirectoryRequest,
  kind: 'file' | 'directory',
): Promise<TerminalFilesCreateEntryResult> {
  const metadata = ensureSessionMetadata(request.sessionId, webContents)
  const subscription = getSubscriptionForSender(request.sessionId, webContents)

  if (metadata.protocol === 'ssh') {
    if (kind === 'directory') {
      return createSshDirectory(
        request.sessionId,
        subscription.rootPath,
        request.parentPath,
        request.name,
      )
    }

    return createSshFile(
      request.sessionId,
      subscription.rootPath,
      request.parentPath,
      request.name,
    )
  }

  const parentPath = path.resolve(request.parentPath)
  if (!isPathWithinRoot(subscription.rootPath, parentPath)) {
    throw new Error('Target directory is outside the current root path')
  }

  const entryName = validateEntryName(request.name)
  await ensureExistingDirectory(parentPath)

  const createdPath = path.resolve(parentPath, entryName)
  if (!isPathWithinRoot(subscription.rootPath, createdPath)) {
    throw new Error('Target path is outside the current root path')
  }

  if (kind === 'directory') {
    await fsPromises.mkdir(createdPath)
  } else {
    await fsPromises.writeFile(createdPath, '', { flag: 'wx' })
  }

  return { createdPath }
}

async function createTerminalFile(
  webContents: WebContents,
  request: TerminalFilesCreateFileRequest,
): Promise<TerminalFilesCreateEntryResult> {
  return createTerminalFileEntry(webContents, request, 'file')
}

async function createTerminalDirectory(
  webContents: WebContents,
  request: TerminalFilesCreateDirectoryRequest,
): Promise<TerminalFilesCreateEntryResult> {
  return createTerminalFileEntry(webContents, request, 'directory')
}

async function deleteTerminalEntries(
  webContents: WebContents,
  request: TerminalFilesDeleteEntriesRequest,
): Promise<TerminalFilesDeleteEntriesResult> {
  const metadata = ensureSessionMetadata(request.sessionId, webContents)
  const subscription = getSubscriptionForSender(request.sessionId, webContents)

  if (metadata.protocol === 'ssh') {
    return deleteSshEntries(request.sessionId, subscription.rootPath, request.targetPaths)
  }

  const normalizedTargetPaths = normalizeTransferSourcePaths(request.targetPaths)
  if (normalizedTargetPaths.length === 0) {
    throw new Error('No files or directories were selected for deletion')
  }

  const collapsedTargetPaths = collapseNestedPaths(normalizedTargetPaths)
  for (const targetPath of collapsedTargetPaths) {
    if (!isPathWithinRoot(subscription.rootPath, targetPath)) {
      throw new Error('Delete target is outside the current root path')
    }
    if (isSamePath(subscription.rootPath, targetPath)) {
      throw new Error('The current root directory cannot be deleted')
    }
  }

  for (const targetPath of collapsedTargetPaths) {
    const targetStats = await fsPromises.lstat(targetPath)
    if (targetStats.isDirectory()) {
      await fsPromises.rm(targetPath, { recursive: true, force: false })
      continue
    }

    await fsPromises.rm(targetPath, { force: false })
  }

  return {
    deletedPaths: collapsedTargetPaths,
  }
}

function normalizeTransferSourcePaths(sourcePaths: string[]): string[] {
  const seenPaths = new Set<string>()
  const normalizedPaths: string[] = []

  sourcePaths.forEach(sourcePath => {
    const resolvedPath = path.resolve(sourcePath)
    const comparablePath = normalizeComparablePath(resolvedPath)
    if (seenPaths.has(comparablePath)) return

    seenPaths.add(comparablePath)
    normalizedPaths.push(resolvedPath)
  })

  return normalizedPaths
}

function createTransferInProgressMessage(direction: TerminalFilesTransferDirection): string {
  return direction === 'upload'
    ? 'An upload is already in progress'
    : 'A download is already in progress'
}

function createMissingTransferSourcesMessage(direction: TerminalFilesTransferDirection): string {
  return direction === 'upload'
    ? 'No upload sources were provided'
    : 'No download sources were provided'
}

async function startTerminalFilesTransfer(
  webContents: WebContents,
  request: TerminalFilesUploadRequest | TerminalFilesDownloadRequest,
  direction: TerminalFilesTransferDirection,
): Promise<void> {
  const metadata = ensureSessionMetadata(request.sessionId, webContents)
  const subscription = getSubscriptionForSender(request.sessionId, webContents)
  const subscriptionKey = getSubscriptionKey(webContents, request.sessionId)
  const activeTransferTask = transferTasks.get(subscriptionKey)
  if (activeTransferTask && (
    activeTransferTask.state.status === 'scanning'
    || activeTransferTask.state.status === 'transferring'
  )) {
    throw new Error(createTransferInProgressMessage(direction))
  }

  stopTransferTask(subscriptionKey)

  if (metadata.protocol === 'ssh') {
    const destinationPath = direction === 'upload'
      ? normalizeRemotePath(request.destinationPath)
      : path.resolve(request.destinationPath)
    const taskId = randomUUID()
    const sourcePaths = direction === 'upload'
      ? request.sourcePaths
      : request.sourcePaths.map(normalizeRemotePath)

    if (sourcePaths.length === 0) {
      throw new Error(createMissingTransferSourcesMessage(direction))
    }

    const initialState: TerminalFilesTransferState = {
      taskId,
      direction,
      destinationPath,
      currentItemName: null,
      completedItems: 0,
      totalItems: sourcePaths.length,
      copiedBytes: 0,
      totalBytes: null,
      percent: null,
      status: 'scanning',
    }

    transferTasks.set(subscriptionKey, {
      kind: 'ssh',
      sessionId: request.sessionId,
      webContentsId: webContents.id,
      worker: null,
      state: initialState,
    })

    publishActiveTransferState(subscriptionKey)

    const publishState = (state: TerminalFilesTransferState) => {
      const transferTask = transferTasks.get(subscriptionKey)
      if (!transferTask) return

      transferTask.state = state
      sendTerminalFilesTransferState(subscriptionKey, state)

      if (state.status === 'completed' || state.status === 'failed') {
        stopTransferTask(subscriptionKey)
      }
    }

    try {
      if (direction === 'upload') {
        await uploadSshFiles(
          request.sessionId,
          subscription.rootPath,
          destinationPath,
          request.sourcePaths,
          taskId,
          publishState,
        )
      } else {
        await downloadSshFiles(
          request.sessionId,
          subscription.rootPath,
          destinationPath,
          request.sourcePaths,
          taskId,
          publishState,
        )
      }
    } catch (error) {
      publishState({
        ...initialState,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      throw error
    }

    return
  }

  const destinationPath = path.resolve(request.destinationPath)
  const sourcePaths = normalizeTransferSourcePaths(request.sourcePaths)

  if (direction === 'upload' && !isPathWithinRoot(subscription.rootPath, destinationPath)) {
    throw new Error('Upload target is outside the current root path')
  }

  if (sourcePaths.length === 0) {
    throw new Error(createMissingTransferSourcesMessage(direction))
  }

  if (direction === 'download') {
    const hasOutOfRootSource = sourcePaths.some(sourcePath => !isPathWithinRoot(subscription.rootPath, sourcePath))
    if (hasOutOfRootSource) {
      throw new Error('Download source is outside the current root path')
    }
  }

  const taskId = randomUUID()
  const worker = createTransferWorker(subscriptionKey, direction)
  transferTasks.set(subscriptionKey, {
    kind: 'local-worker',
    sessionId: request.sessionId,
    webContentsId: webContents.id,
    worker,
    state: {
      taskId,
      direction,
      destinationPath,
      currentItemName: null,
      completedItems: 0,
      totalItems: sourcePaths.length,
      copiedBytes: 0,
      totalBytes: null,
      percent: null,
      status: 'scanning',
    },
  })

  publishActiveTransferState(subscriptionKey)
  worker.postMessage({
    type: 'transfer',
    taskId,
    direction,
    destinationPath,
    sourcePaths,
  })
}

function uploadTerminalFiles(
  webContents: WebContents,
  request: TerminalFilesUploadRequest,
): Promise<void> {
  return startTerminalFilesTransfer(webContents, request, 'upload')
}

function downloadTerminalFiles(
  webContents: WebContents,
  request: TerminalFilesDownloadRequest,
): Promise<void> {
  return startTerminalFilesTransfer(webContents, request, 'download')
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

  ipcMain.handle('terminalFiles:createFile', (event, request: TerminalFilesCreateFileRequest) => {
    return createTerminalFile(event.sender, request)
  })

  ipcMain.handle('terminalFiles:createDirectory', (event, request: TerminalFilesCreateDirectoryRequest) => {
    return createTerminalDirectory(event.sender, request)
  })

  ipcMain.handle('terminalFiles:deleteEntries', (event, request: TerminalFilesDeleteEntriesRequest) => {
    return deleteTerminalEntries(event.sender, request)
  })

  ipcMain.handle('terminalFiles:upload', (event, request: TerminalFilesUploadRequest) => {
    return uploadTerminalFiles(event.sender, request)
  })

  ipcMain.handle('terminalFiles:download', (event, request: TerminalFilesDownloadRequest) => {
    return downloadTerminalFiles(event.sender, request)
  })

  app.once('before-quit', () => {
    subscriptions.clear()
    pendingWorkerRequests.clear()
    transferTasks.forEach(transferTask => {
      transferTask.worker?.postMessage({ type: 'stop' })
    })
    transferTasks.clear()
    localFilesWorker?.postMessage({ type: 'stop' })
    localFilesWorker = null
  })
}
