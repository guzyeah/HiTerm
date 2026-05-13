/**
 * Terminal 会话管理
 * 主进程负责创建和维护 node-pty，会话通过 sessionId 与渲染进程通信。
 */

import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, ipcMain, type WebContents } from 'electron'
import * as pty from 'node-pty'
import { getShellById } from './shellStore'
import type {
  CreateLocalTerminalSessionRequest,
  CreateLocalTerminalSessionResult,
  TerminalResizeRequest,
  TerminalSessionRequest,
  TerminalWriteRequest,
} from '../src/shared/terminalTypes'

interface TerminalSession {
  ptyProcess: pty.IPty
  webContents: WebContents
  disposables: pty.IDisposable[]
}

const terminalSessions = new Map<string, TerminalSession>()
const webContentsSessionIds = new Map<number, Set<string>>()
const trackedWebContentsIds = new Set<number>()

function normalizeTerminalSize(cols: number, rows: number): { cols: number; rows: number } {
  return {
    cols: Math.max(2, Math.floor(cols) || 80),
    rows: Math.max(1, Math.floor(rows) || 24),
  }
}

function resolveWorkingDirectory(workDir: string | null | undefined): string {
  if (!workDir) return homedir()

  try {
    return existsSync(workDir) && statSync(workDir).isDirectory() ? workDir : homedir()
  } catch {
    return homedir()
  }
}

function validateTerminalPath(terminalPath: string | null | undefined): string {
  const executablePath = terminalPath?.trim()
  if (!executablePath) {
    throw new Error('Missing terminal path')
  }

  if (path.isAbsolute(executablePath) && !existsSync(executablePath)) {
    throw new Error('Terminal path does not exist')
  }

  return executablePath
}

function getSessionForSender(sessionId: string, sender: WebContents): TerminalSession {
  const session = terminalSessions.get(sessionId)
  if (!session || session.webContents.id !== sender.id) {
    throw new Error('Terminal session not found')
  }

  return session
}

function trackSessionWebContents(sessionId: string, webContents: WebContents): void {
  let sessionIds = webContentsSessionIds.get(webContents.id)
  if (!sessionIds) {
    sessionIds = new Set()
    webContentsSessionIds.set(webContents.id, sessionIds)
  }

  sessionIds.add(sessionId)

  if (trackedWebContentsIds.has(webContents.id)) return

  trackedWebContentsIds.add(webContents.id)
  webContents.once('destroyed', () => {
    const nextSessionIds = webContentsSessionIds.get(webContents.id)
    webContentsSessionIds.delete(webContents.id)
    trackedWebContentsIds.delete(webContents.id)
    nextSessionIds?.forEach(disposeTerminalSession)
  })
}

function untrackSessionWebContents(sessionId: string, webContents: WebContents): void {
  webContentsSessionIds.get(webContents.id)?.delete(sessionId)
}

function disposeTerminalSession(sessionId: string): void {
  const session = terminalSessions.get(sessionId)
  if (!session) return

  terminalSessions.delete(sessionId)
  untrackSessionWebContents(sessionId, session.webContents)
  session.disposables.forEach(disposable => disposable.dispose())

  try {
    session.ptyProcess.kill()
  } catch {
    // 进程可能已自然退出，忽略重复释放。
  }
}

function createLocalSession(
  webContents: WebContents,
  request: CreateLocalTerminalSessionRequest,
): CreateLocalTerminalSessionResult {
  const shell = getShellById(request.shellId)
  if (!shell || shell.protocol !== 'local') {
    throw new Error('Only local shell sessions are supported')
  }

  const terminalPath = validateTerminalPath(shell.terminalPath)
  const cwd = resolveWorkingDirectory(shell.workDir)
  const { cols, rows } = normalizeTerminalSize(request.cols, request.rows)
  const sessionId = randomUUID()
  const ptyProcess = pty.spawn(terminalPath, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM_PROGRAM: 'HiTerm',
    },
    encoding: 'utf8',
  })

  const disposables = [
    ptyProcess.onData(data => {
      if (!webContents.isDestroyed()) {
        webContents.send('terminal:data', { sessionId, data })
      }
    }),
    ptyProcess.onExit(event => {
      const session = terminalSessions.get(sessionId)
      terminalSessions.delete(sessionId)
      if (session) {
        untrackSessionWebContents(sessionId, session.webContents)
        session.disposables.forEach(disposable => disposable.dispose())
      }

      if (!webContents.isDestroyed()) {
        webContents.send('terminal:exit', {
          sessionId,
          exitCode: event.exitCode,
          signal: event.signal,
        })
      }
    }),
  ]

  terminalSessions.set(sessionId, {
    ptyProcess,
    webContents,
    disposables,
  })
  trackSessionWebContents(sessionId, webContents)

  return { sessionId }
}

export function registerTerminalIpcHandlers(): void {
  ipcMain.handle('terminal:createLocalSession', (event, request: CreateLocalTerminalSessionRequest) => (
    createLocalSession(event.sender, request)
  ))

  ipcMain.handle('terminal:write', (event, request: TerminalWriteRequest) => {
    getSessionForSender(request.sessionId, event.sender).ptyProcess.write(request.data)
  })

  ipcMain.handle('terminal:resize', (event, request: TerminalResizeRequest) => {
    const { cols, rows } = normalizeTerminalSize(request.cols, request.rows)
    getSessionForSender(request.sessionId, event.sender).ptyProcess.resize(cols, rows)
  })

  ipcMain.handle('terminal:dispose', (event, request: TerminalSessionRequest) => {
    getSessionForSender(request.sessionId, event.sender)
    disposeTerminalSession(request.sessionId)
  })

  app.once('before-quit', () => {
    Array.from(terminalSessions.keys()).forEach(disposeTerminalSession)
  })
}
