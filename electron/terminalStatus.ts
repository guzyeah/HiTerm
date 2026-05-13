/**
 * Terminal 状态采样通道。
 * Local 会话复用全局 worker，SSH 会话按订阅创建独立采样器。
 */

import electron, { type WebContents } from 'electron'
import { Worker } from 'node:worker_threads'
import { getTerminalSessionMetadata } from './terminalSession'
import { LOCAL_STATUS_WORKER_SOURCE } from './localStatusWorkerSource'
import {
  clearSshTerminalStatusState,
  sampleSshTerminalStatus,
} from './sshStatusSampling'
import type {
  TerminalStatusErrorEvent,
  TerminalStatusSample,
  TerminalStatusSampleEvent,
  TerminalStatusSubscribeRequest,
} from '../src/shared/terminalStatusTypes'

const { app, ipcMain } = electron

interface TerminalStatusSubscription {
  sessionId: string
  webContents: WebContents
  protocol: 'local' | 'ssh'
}

interface SshSamplerTask {
  intervalId: ReturnType<typeof setInterval>
  isSampling: boolean
}

type LocalStatusWorkerMessage =
  | { type: 'sample'; sample: TerminalStatusSample }
  | { type: 'error'; message: string }

const subscriptions = new Map<string, TerminalStatusSubscription>()
const webContentsSubscriptions = new Map<number, Set<string>>()
const trackedWebContentsIds = new Set<number>()
const sshSamplerTasks = new Map<string, SshSamplerTask>()

let localStatusWorker: Worker | null = null

function getSubscriptionKey(webContents: WebContents, sessionId: string): string {
  return `${webContents.id}:${sessionId}`
}

function sendStatusError(webContents: WebContents, payload: TerminalStatusErrorEvent): void {
  if (!webContents.isDestroyed()) {
    webContents.send('terminalStatus:error', payload)
  }
}

function hasLocalSubscriptions(): boolean {
  return [...subscriptions.values()].some(subscription => subscription.protocol === 'local')
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

    if (hasLocalSubscriptions()) {
      ensureLocalStatusWorker()
    }
  })

  return localStatusWorker
}

function stopLocalStatusWorkerIfIdle(): void {
  if (hasLocalSubscriptions() || !localStatusWorker) return

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
    nextSessionIds?.forEach(sessionId => unsubscribeTerminalStatus(webContents, sessionId))
  })
}

function untrackWebContentsSubscription(webContents: WebContents, sessionId: string): void {
  webContentsSubscriptions.get(webContents.id)?.delete(sessionId)
}

function publishLocalStatusSample(sample: TerminalStatusSample): void {
  subscriptions.forEach(subscription => {
    if (subscription.protocol !== 'local') return

    const metadata = getTerminalSessionMetadata(subscription.sessionId, subscription.webContents)
    if (!metadata || metadata.protocol !== 'local') {
      unsubscribeTerminalStatus(subscription.webContents, subscription.sessionId)
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
    if (subscription.protocol !== 'local') return

    sendStatusError(subscription.webContents, {
      sessionId: subscription.sessionId,
      message,
    })
  })
}

function stopSshSampler(subscriptionKey: string): void {
  const samplerTask = sshSamplerTasks.get(subscriptionKey)
  if (!samplerTask) return

  clearInterval(samplerTask.intervalId)
  sshSamplerTasks.delete(subscriptionKey)
}

function sampleSshStatusForSubscription(subscriptionKey: string): void {
  const samplerTask = sshSamplerTasks.get(subscriptionKey)
  const subscription = subscriptions.get(subscriptionKey)
  if (!samplerTask || !subscription) return
  if (samplerTask.isSampling) return

  samplerTask.isSampling = true

  void (async () => {
    try {
      const metadata = getTerminalSessionMetadata(subscription.sessionId, subscription.webContents)
      if (!metadata || metadata.protocol !== 'ssh') {
        unsubscribeTerminalStatus(subscription.webContents, subscription.sessionId)
        return
      }

      const sample = await sampleSshTerminalStatus(subscription.sessionId, metadata.remoteOs)
      if (!subscription.webContents.isDestroyed()) {
        const event: TerminalStatusSampleEvent = {
          sessionId: subscription.sessionId,
          sample,
        }
        subscription.webContents.send('terminalStatus:sample', event)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendStatusError(subscription.webContents, {
        sessionId: subscription.sessionId,
        message,
      })
      if (message.includes('currently supported only')) {
        stopSshSampler(subscriptionKey)
      }
    } finally {
      const nextSamplerTask = sshSamplerTasks.get(subscriptionKey)
      if (nextSamplerTask) {
        nextSamplerTask.isSampling = false
      }
    }
  })()
}

function startSshSampler(webContents: WebContents, sessionId: string): void {
  const subscriptionKey = getSubscriptionKey(webContents, sessionId)
  if (sshSamplerTasks.has(subscriptionKey)) return

  const intervalId = setInterval(() => {
    sampleSshStatusForSubscription(subscriptionKey)
  }, 1000)

  sshSamplerTasks.set(subscriptionKey, {
    intervalId,
    isSampling: false,
  })
  sampleSshStatusForSubscription(subscriptionKey)
}

function subscribeTerminalStatus(webContents: WebContents, sessionId: string): void {
  const metadata = getTerminalSessionMetadata(sessionId, webContents)
  if (!metadata || (metadata.protocol !== 'local' && metadata.protocol !== 'ssh')) {
    throw new Error('Unsupported terminal status session')
  }

  subscriptions.set(getSubscriptionKey(webContents, sessionId), {
    sessionId,
    webContents,
    protocol: metadata.protocol,
  })
  trackWebContentsSubscription(webContents, sessionId)

  if (metadata.protocol === 'local') {
    ensureLocalStatusWorker()
    return
  }

  startSshSampler(webContents, sessionId)
}

function unsubscribeTerminalStatus(webContents: WebContents, sessionId: string): void {
  const subscriptionKey = getSubscriptionKey(webContents, sessionId)
  const subscription = subscriptions.get(subscriptionKey)

  subscriptions.delete(subscriptionKey)
  untrackWebContentsSubscription(webContents, sessionId)

  if (subscription?.protocol === 'ssh') {
    stopSshSampler(subscriptionKey)
    clearSshTerminalStatusState(sessionId)
  }

  stopLocalStatusWorkerIfIdle()
}

export function registerTerminalStatusIpcHandlers(): void {
  ipcMain.handle('terminalStatus:subscribe', (event, request: TerminalStatusSubscribeRequest) => {
    subscribeTerminalStatus(event.sender, request.sessionId)
  })

  ipcMain.handle('terminalStatus:unsubscribe', (event, request: TerminalStatusSubscribeRequest) => {
    unsubscribeTerminalStatus(event.sender, request.sessionId)
  })

  app.once('before-quit', () => {
    subscriptions.clear()
    sshSamplerTasks.forEach(samplerTask => {
      clearInterval(samplerTask.intervalId)
    })
    sshSamplerTasks.clear()
    localStatusWorker?.postMessage({ type: 'stop' })
    localStatusWorker = null
  })
}
