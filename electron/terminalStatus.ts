/**
 * Terminal 状态采样通道。
 * 状态采样运行在 worker 中，避免和 PTY 字符流争用主进程事件循环。
 */

import { app, ipcMain, type WebContents } from 'electron'
import { Worker } from 'node:worker_threads'
import { getTerminalSessionMetadata } from './terminalSession'
import { LOCAL_STATUS_WORKER_SOURCE } from './localStatusWorkerSource'
import type {
  TerminalStatusErrorEvent,
  TerminalStatusSample,
  TerminalStatusSampleEvent,
  TerminalStatusSubscribeRequest,
} from '../src/shared/terminalStatusTypes'

interface TerminalStatusSubscription {
  sessionId: string
  webContents: WebContents
}

type LocalStatusWorkerMessage =
  | { type: 'sample'; sample: TerminalStatusSample }
  | { type: 'error'; message: string }

const subscriptions = new Map<string, TerminalStatusSubscription>()
const webContentsSubscriptions = new Map<number, Set<string>>()
const trackedWebContentsIds = new Set<number>()

let localStatusWorker: Worker | null = null

function getSubscriptionKey(webContents: WebContents, sessionId: string): string {
  return `${webContents.id}:${sessionId}`
}

function sendStatusError(webContents: WebContents, payload: TerminalStatusErrorEvent): void {
  if (!webContents.isDestroyed()) {
    webContents.send('terminalStatus:error', payload)
  }
}

function ensureLocalStatusWorker(): Worker {
  if (localStatusWorker) return localStatusWorker

  const worker = new Worker(LOCAL_STATUS_WORKER_SOURCE, { eval: true })
  localStatusWorker = worker

  worker.on('message', (message: LocalStatusWorkerMessage) => {
    if (message.type === 'sample') {
      publishLocalStatusSample(message.sample)
    } else {
      publishLocalStatusError(message.message)
    }
  })
  worker.on('error', error => {
    publishLocalStatusError(error.message)
  })
  worker.on('exit', () => {
    if (localStatusWorker === worker) {
      localStatusWorker = null
    }

    if (subscriptions.size > 0) {
      ensureLocalStatusWorker()
    }
  })

  return localStatusWorker
}

function stopLocalStatusWorkerIfIdle(): void {
  if (subscriptions.size > 0 || !localStatusWorker) return

  const worker = localStatusWorker
  localStatusWorker = null
  worker.postMessage({ type: 'stop' })
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
    nextSessionIds?.forEach(sessionId => unsubscribeLocalStatus(webContents, sessionId))
  })
}

function untrackWebContentsSubscription(webContents: WebContents, sessionId: string): void {
  webContentsSubscriptions.get(webContents.id)?.delete(sessionId)
}

function subscribeLocalStatus(webContents: WebContents, sessionId: string): void {
  const metadata = getTerminalSessionMetadata(sessionId, webContents)
  if (!metadata || metadata.protocol !== 'local') {
    throw new Error('Only local terminal status is supported')
  }

  subscriptions.set(getSubscriptionKey(webContents, sessionId), {
    sessionId,
    webContents,
  })
  trackWebContentsSubscription(webContents, sessionId)
  ensureLocalStatusWorker()
}

function unsubscribeLocalStatus(webContents: WebContents, sessionId: string): void {
  subscriptions.delete(getSubscriptionKey(webContents, sessionId))
  untrackWebContentsSubscription(webContents, sessionId)
  stopLocalStatusWorkerIfIdle()
}

function publishLocalStatusSample(sample: TerminalStatusSample): void {
  subscriptions.forEach(subscription => {
    const metadata = getTerminalSessionMetadata(subscription.sessionId, subscription.webContents)
    if (!metadata || metadata.protocol !== 'local') {
      unsubscribeLocalStatus(subscription.webContents, subscription.sessionId)
      return
    }

    if (!subscription.webContents.isDestroyed()) {
      const event: TerminalStatusSampleEvent = {
        sessionId: subscription.sessionId,
        sample,
      }
      subscription.webContents.send('terminalStatus:sample', event)
    }
  })
}

function publishLocalStatusError(message: string): void {
  subscriptions.forEach(subscription => {
    sendStatusError(subscription.webContents, {
      sessionId: subscription.sessionId,
      message,
    })
  })
}

export function registerTerminalStatusIpcHandlers(): void {
  ipcMain.handle('terminalStatus:subscribe', (event, request: TerminalStatusSubscribeRequest) => {
    subscribeLocalStatus(event.sender, request.sessionId)
  })

  ipcMain.handle('terminalStatus:unsubscribe', (event, request: TerminalStatusSubscribeRequest) => {
    unsubscribeLocalStatus(event.sender, request.sessionId)
  })

  app.once('before-quit', () => {
    subscriptions.clear()
    localStatusWorker?.postMessage({ type: 'stop' })
    localStatusWorker = null
  })
}
