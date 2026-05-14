/**
 * Terminal 会话管理。
 * 统一维护 Local PTY 与 SSH 会话，并为文件/状态侧信道暴露只读能力。
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import electron, { type WebContents } from 'electron'
import * as pty from 'node-pty'
import { Client, type ClientChannel, type ConnectConfig, type SFTPWrapper } from 'ssh2'
import { getShellById } from './shellStore'
import { recordTerminalCommand } from './terminalHistory'
import type {
  CreateTerminalSessionRequest,
  CreateTerminalSessionResult,
  TerminalResizeRequest,
  TerminalSessionRequest,
  TerminalWriteRequest,
} from '../src/shared/terminalTypes'
import type { ProtocolType } from '../src/shared/shellTypes'

const { app, ipcMain } = electron

export type RemoteOs = 'linux' | 'darwin' | 'unknown'

interface CommandCaptureState {
  lineBuffer: string
  escapeBuffer: string
  isAlternateScreen: boolean
  recentOutput: string
}

interface TerminalSessionBase {
  webContents: WebContents
  shellId: string
  protocol: ProtocolType
  cwd: string
  homeDir: string
  remoteOs: RemoteOs | null
  commandCapture: CommandCaptureState
}

interface LocalTerminalSession extends TerminalSessionBase {
  protocol: 'local'
  ptyProcess: pty.IPty
  disposables: pty.IDisposable[]
}

interface SshTerminalSession extends TerminalSessionBase {
  protocol: 'ssh'
  client: Client
  shellChannel: ClientChannel
  activeExecChannels: Set<ClientChannel>
  sftpPromise: Promise<SFTPWrapper> | null
  sftp: SFTPWrapper | null
  isClosing: boolean
}

type TerminalSession = LocalTerminalSession | SshTerminalSession

export interface TerminalSessionMetadata {
  sessionId: string
  shellId: string
  protocol: ProtocolType
  webContentsId: number
  cwd: string
  homeDir: string
  remoteOs: RemoteOs | null
}

export interface SshCommandResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

const terminalSessions = new Map<string, TerminalSession>()
const webContentsSessionIds = new Map<number, Set<string>>()
const trackedWebContentsIds = new Set<number>()
const ESCAPE_PATTERN = '\\x' + '1b'
const BELL_PATTERN = '\\x' + '07'
const ALTERNATE_SCREEN_ENABLE_PATTERN = new RegExp(`${ESCAPE_PATTERN}\\[\\?(?:47|1047|1049)h`)
const ALTERNATE_SCREEN_DISABLE_PATTERN = new RegExp(`${ESCAPE_PATTERN}\\[\\?(?:47|1047|1049)l`)
const ANSI_CONTROL_PATTERN = new RegExp(
  `${ESCAPE_PATTERN}(?:\\[[0-?]*[ -/]*[@-~]|\\][^${BELL_PATTERN}${ESCAPE_PATTERN}]*(?:${BELL_PATTERN}|${ESCAPE_PATTERN}\\\\)|[@-Z\\\\-_])`,
  'g',
)
const SENSITIVE_PROMPT_PATTERN = /(?:password|passphrase|verification code|otp|pin|密码|口令)\s*[:：]\s*$/i

function normalizeTerminalSize(cols: number, rows: number): { cols: number; rows: number } {
  return {
    cols: Math.max(2, Math.floor(cols) || 80),
    rows: Math.max(1, Math.floor(rows) || 24),
  }
}

function createCommandCaptureState(): CommandCaptureState {
  return {
    lineBuffer: '',
    escapeBuffer: '',
    isAlternateScreen: false,
    recentOutput: '',
  }
}

function stripAnsiSequences(value: string): string {
  return value.replace(ANSI_CONTROL_PATTERN, '')
}

function removeLastWord(value: string): string {
  return value.replace(/\s*[\S\u00A0]+$/u, '')
}

function looksLikeSensitivePrompt(recentOutput: string): boolean {
  return SENSITIVE_PROMPT_PATTERN.test(recentOutput.trimEnd())
}

function clearCapturedLine(state: CommandCaptureState): void {
  state.lineBuffer = ''
  state.escapeBuffer = ''
}

function finalizeCapturedCommand(sessionId: string, session: TerminalSession): void {
  const command = session.commandCapture.lineBuffer.trim()
  clearCapturedLine(session.commandCapture)

  if (!command || session.commandCapture.isAlternateScreen) return
  if (looksLikeSensitivePrompt(session.commandCapture.recentOutput)) return

  recordTerminalCommand(session.webContents, {
    sessionId,
    shellId: session.shellId,
    protocol: session.protocol,
    command,
  })
}

function consumeEscapeSequence(state: CommandCaptureState, character: string): boolean {
  if (!state.escapeBuffer) return false

  state.escapeBuffer += character

  if (state.escapeBuffer.startsWith('\u001b[')) {
    const lastCharacter = state.escapeBuffer[state.escapeBuffer.length - 1] ?? ''
    if (/[@-~]/.test(lastCharacter)) {
      state.escapeBuffer = ''
    }
    return true
  }

  if (state.escapeBuffer.startsWith('\u001bO')) {
    if (state.escapeBuffer.length >= 3) {
      state.escapeBuffer = ''
    }
    return true
  }

  if (state.escapeBuffer.length >= 2) {
    state.escapeBuffer = ''
  }

  return true
}

function captureTerminalInput(sessionId: string, session: TerminalSession, data: string): void {
  const state = session.commandCapture

  for (let index = 0; index < data.length; index += 1) {
    const character = data[index] ?? ''
    if (!character) continue

    if (consumeEscapeSequence(state, character)) {
      continue
    }

    if (character === '\u001b') {
      state.escapeBuffer = character
      continue
    }

    if (character === '\r' || character === '\n') {
      if (!(character === '\n' && data[index - 1] === '\r')) {
        finalizeCapturedCommand(sessionId, session)
      }
      continue
    }

    if (character === '\u007f' || character === '\b') {
      state.lineBuffer = state.lineBuffer.slice(0, -1)
      continue
    }

    if (character === '\u0015') {
      state.lineBuffer = ''
      continue
    }

    if (character === '\u0017') {
      state.lineBuffer = removeLastWord(state.lineBuffer)
      continue
    }

    if (character === '\u0003') {
      clearCapturedLine(state)
      continue
    }

    if (character < ' ' || character === '\u0000') {
      continue
    }

    state.lineBuffer += character
    if (state.lineBuffer.length > 8192) {
      state.lineBuffer = state.lineBuffer.slice(-8192)
    }
  }
}

function captureTerminalOutput(session: TerminalSession, data: string): void {
  const state = session.commandCapture

  if (ALTERNATE_SCREEN_ENABLE_PATTERN.test(data)) {
    state.isAlternateScreen = true
    clearCapturedLine(state)
  }

  if (ALTERNATE_SCREEN_DISABLE_PATTERN.test(data)) {
    state.isAlternateScreen = false
  }

  const normalizedOutput = stripAnsiSequences(data).replace(/\r/g, '')
  state.recentOutput = `${state.recentOutput}${normalizedOutput}`.slice(-256)
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

function validateSshHost(host: string | null | undefined): string {
  const normalizedHost = host?.trim()
  if (!normalizedHost) {
    throw new Error('Missing SSH host')
  }

  return normalizedHost
}

function resolveSshUsername(username: string | null | undefined): string {
  const normalizedUsername = username?.trim()
  if (normalizedUsername) return normalizedUsername

  const fallbackUsername = process.env.USER || process.env.USERNAME
  if (fallbackUsername) return fallbackUsername

  throw new Error('Missing SSH username')
}

function readPrivateKey(privateKeyPath: string | null | undefined): Buffer {
  const normalizedPath = privateKeyPath?.trim()
  if (!normalizedPath) {
    throw new Error('Missing private key path')
  }

  if (!existsSync(normalizedPath)) {
    throw new Error('Private key file does not exist')
  }

  return readFileSync(normalizedPath)
}

function buildSshConnectConfig(shell: ReturnType<typeof getShellById>): ConnectConfig {
  if (!shell || shell.protocol !== 'ssh') {
    throw new Error('Only SSH shell sessions are supported')
  }

  const authType = shell.authType ?? 'password'
  const connectConfig: ConnectConfig = {
    host: validateSshHost(shell.host),
    port: shell.port ?? 22,
    username: resolveSshUsername(shell.username),
    readyTimeout: 15000,
    keepaliveInterval: 15000,
    keepaliveCountMax: 3,
  }

  if (authType === 'privateKey') {
    connectConfig.privateKey = readPrivateKey(shell.privateKeyPath)
  } else if (authType === 'password') {
    connectConfig.password = shell.secret ?? undefined
  }

  return connectConfig
}

function getSessionForSender(sessionId: string, sender: WebContents): TerminalSession {
  const session = terminalSessions.get(sessionId)
  if (!session || session.webContents.id !== sender.id) {
    throw new Error('Terminal session not found')
  }

  return session
}

function getSshSessionForSender(sessionId: string, sender?: WebContents): SshTerminalSession {
  const session = sender
    ? getSessionForSender(sessionId, sender)
    : terminalSessions.get(sessionId)

  if (!session || session.protocol !== 'ssh') {
    throw new Error('SSH terminal session not found')
  }

  return session
}

export function getTerminalSessionMetadata(
  sessionId: string,
  sender?: WebContents,
): TerminalSessionMetadata | null {
  const session = terminalSessions.get(sessionId)
  if (!session || (sender && session.webContents.id !== sender.id)) {
    return null
  }

  return {
    sessionId,
    shellId: session.shellId,
    protocol: session.protocol,
    webContentsId: session.webContents.id,
    cwd: session.cwd,
    homeDir: session.homeDir,
    remoteOs: session.remoteOs,
  }
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

function safeSendTerminalExit(
  session: TerminalSession,
  sessionId: string,
  exitCode: number,
): void {
  if (!session.webContents.isDestroyed()) {
    session.webContents.send('terminal:exit', {
      sessionId,
      exitCode,
    })
  }
}

function cleanupSshSession(session: SshTerminalSession): void {
  session.activeExecChannels.forEach(channel => {
    try {
      channel.close()
    } catch {
      // 忽略已关闭的 exec channel。
    }
  })
  session.activeExecChannels.clear()

  try {
    session.shellChannel.close()
  } catch {
    // shell channel 可能已经关闭。
  }

  try {
    session.client.end()
  } catch {
    // 客户端可能已经关闭。
  }
}

function disposeTerminalSession(sessionId: string): void {
  const session = terminalSessions.get(sessionId)
  if (!session) return

  terminalSessions.delete(sessionId)
  untrackSessionWebContents(sessionId, session.webContents)

  if (session.protocol === 'local') {
    session.disposables.forEach(disposable => disposable.dispose())

    try {
      session.ptyProcess.kill()
    } catch {
      // 进程可能已自然退出。
    }
    return
  }

  session.isClosing = true
  cleanupSshSession(session)
}

function executeSshCommandWithClient(
  client: Client,
  activeExecChannels: Set<ClientChannel>,
  command: string,
  timeoutMs = 8000,
): Promise<SshCommandResult> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    let exitCode: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      callback()
    }

    client.exec(command, (error, channel) => {
      if (error || !channel) {
        finish(() => reject(error ?? new Error('Failed to execute SSH command')))
        return
      }

      activeExecChannels.add(channel)

      channel.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString('utf8')
      })
      channel.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString('utf8')
      })
      channel.on('exit', code => {
        exitCode = typeof code === 'number' ? code : null
      })
      channel.on('close', () => {
        activeExecChannels.delete(channel)
        finish(() => resolve({
          stdout,
          stderr,
          exitCode,
        }))
      })
      channel.on('error', (nextError: Error) => {
        activeExecChannels.delete(channel)
        finish(() => reject(nextError))
      })

      timeoutId = setTimeout(() => {
        activeExecChannels.delete(channel)
        try {
          channel.close()
        } catch {
          // 超时关闭失败时也直接返回超时错误。
        }
        finish(() => reject(new Error('SSH command timed out')))
      }, timeoutMs)
    })
  })
}

function createSftpWithClient(client: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error || !sftp) {
        reject(error ?? new Error('Failed to create SFTP channel'))
        return
      }

      resolve(sftp)
    })
  })
}

function resolveSftpRealpath(sftp: SFTPWrapper, targetPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sftp.realpath(targetPath, (error, absolutePath) => {
      if (error || !absolutePath) {
        reject(error ?? new Error('Failed to resolve remote path'))
        return
      }

      resolve(absolutePath)
    })
  })
}

function resolveSftpHomeDirectory(sftp: SFTPWrapper): Promise<string> {
  return resolveSftpRealpath(sftp, '.').catch(() => '/')
}

async function detectRemoteOs(client: Client): Promise<RemoteOs> {
  const activeExecChannels = new Set<ClientChannel>()
  try {
    const result = await executeSshCommandWithClient(client, activeExecChannels, 'uname -s', 5000)
    const normalizedStdout = result.stdout.trim().toLowerCase()
    if (normalizedStdout.includes('linux')) return 'linux'
    if (normalizedStdout.includes('darwin')) return 'darwin'
  } catch {
    // 非 POSIX 主机直接回退到 unknown。
  } finally {
    activeExecChannels.forEach(channel => {
      try {
        channel.close()
      } catch {
        // 忽略临时探测 channel 的关闭异常。
      }
    })
  }

  return 'unknown'
}

function openSshShell(
  client: Client,
  cols: number,
  rows: number,
): Promise<ClientChannel> {
  return new Promise((resolve, reject) => {
    client.shell({
      term: 'xterm-256color',
      cols,
      rows,
    }, (error, channel) => {
      if (error || !channel) {
        reject(error ?? new Error('Failed to open SSH shell'))
        return
      }

      resolve(channel)
    })
  })
}

async function createConnectedSshSession(
  shellId: string,
  cols: number,
  rows: number,
): Promise<{
  client: Client
  shellChannel: ClientChannel
  homeDir: string
  cwd: string
  remoteOs: RemoteOs
}> {
  const shell = getShellById(shellId)
  const connectConfig = buildSshConnectConfig(shell)
  const client = new Client()

  return new Promise((resolve, reject) => {
    let settled = false

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      callback()
    }

    client.on('ready', async () => {
      try {
        const remoteOs = await detectRemoteOs(client)
        const sftp = await createSftpWithClient(client)
        const homeDir = await resolveSftpHomeDirectory(sftp)
        const cwd = await resolveSftpRealpath(sftp, '.').catch(() => homeDir)
        const shellChannel = await openSshShell(client, cols, rows)

        finish(() => resolve({
          client,
          shellChannel,
          homeDir,
          cwd,
          remoteOs,
        }))
      } catch (error) {
        finish(() => {
          client.end()
          reject(error instanceof Error ? error : new Error(String(error)))
        })
      }
    })

    client.on('error', error => {
      finish(() => reject(error))
    })

    client.on('close', () => {
      finish(() => reject(new Error('SSH connection closed before initialization completed')))
    })

    client.connect(connectConfig)
  })
}

function createLocalSession(
  webContents: WebContents,
  request: CreateTerminalSessionRequest,
): CreateTerminalSessionResult {
  const shell = getShellById(request.shellId)
  if (!shell || shell.protocol !== 'local') {
    throw new Error('Only local shell sessions are supported')
  }

  const terminalPath = validateTerminalPath(shell.terminalPath)
  const homeDir = homedir()
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
      const session = terminalSessions.get(sessionId)
      if (session) {
        captureTerminalOutput(session, data)
      }

      if (!webContents.isDestroyed()) {
        webContents.send('terminal:data', { sessionId, data })
      }
    }),
    ptyProcess.onExit(event => {
      const session = terminalSessions.get(sessionId)
      terminalSessions.delete(sessionId)
      if (session && session.protocol === 'local') {
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
    shellId: shell.id,
    protocol: shell.protocol,
    cwd,
    homeDir,
    remoteOs: null,
    commandCapture: createCommandCaptureState(),
  })
  trackSessionWebContents(sessionId, webContents)

  return { sessionId }
}

async function createSshSession(
  webContents: WebContents,
  request: CreateTerminalSessionRequest,
): Promise<CreateTerminalSessionResult> {
  const shell = getShellById(request.shellId)
  if (!shell || shell.protocol !== 'ssh') {
    throw new Error('Only SSH shell sessions are supported')
  }

  const { cols, rows } = normalizeTerminalSize(request.cols, request.rows)
  const sessionId = randomUUID()
  const {
    client,
    shellChannel,
    cwd,
    homeDir,
    remoteOs,
  } = await createConnectedSshSession(request.shellId, cols, rows)

  const session: SshTerminalSession = {
    client,
    cwd,
    homeDir,
    protocol: 'ssh',
    remoteOs,
    shellId: shell.id,
    shellChannel,
    webContents,
    activeExecChannels: new Set(),
    sftp: null,
    sftpPromise: null,
    isClosing: false,
    commandCapture: createCommandCaptureState(),
  }

  shellChannel.on('data', (chunk: Buffer | string) => {
    const data = chunk.toString('utf8')
    captureTerminalOutput(session, data)

    if (!webContents.isDestroyed()) {
      webContents.send('terminal:data', {
        sessionId,
        data,
      })
    }
  })
  shellChannel.stderr.on('data', (chunk: Buffer | string) => {
    const data = chunk.toString('utf8')
    captureTerminalOutput(session, data)

    if (!webContents.isDestroyed()) {
      webContents.send('terminal:data', {
        sessionId,
        data,
      })
    }
  })
  shellChannel.on('close', (exitCode?: number) => {
    const currentSession = terminalSessions.get(sessionId)
    if (!currentSession || currentSession.protocol !== 'ssh') return

    terminalSessions.delete(sessionId)
    untrackSessionWebContents(sessionId, currentSession.webContents)
    currentSession.isClosing = true
    cleanupSshSession(currentSession)
    safeSendTerminalExit(currentSession, sessionId, typeof exitCode === 'number' ? exitCode : 0)
  })
  shellChannel.on('error', () => {
    // 通道异常通常会随后触发 close，这里不额外向终端写入文本，避免打断用户输出。
  })
  client.on('close', () => {
    const currentSession = terminalSessions.get(sessionId)
    if (!currentSession || currentSession.protocol !== 'ssh') return
    if (currentSession.isClosing) return

    terminalSessions.delete(sessionId)
    untrackSessionWebContents(sessionId, currentSession.webContents)
    currentSession.isClosing = true
    cleanupSshSession(currentSession)
    safeSendTerminalExit(currentSession, sessionId, 255)
  })

  terminalSessions.set(sessionId, session)
  trackSessionWebContents(sessionId, webContents)

  return { sessionId }
}

async function createSession(
  webContents: WebContents,
  request: CreateTerminalSessionRequest,
): Promise<CreateTerminalSessionResult> {
  const shell = getShellById(request.shellId)
  if (!shell) {
    throw new Error('Shell configuration not found')
  }

  if (shell.protocol === 'local') {
    return createLocalSession(webContents, request)
  }

  if (shell.protocol === 'ssh') {
    return createSshSession(webContents, request)
  }

  throw new Error(`Unsupported shell protocol: ${shell.protocol}`)
}

export async function getTerminalSessionSftp(
  sessionId: string,
  sender?: WebContents,
): Promise<SFTPWrapper> {
  const session = getSshSessionForSender(sessionId, sender)
  if (session.sftp) {
    return session.sftp
  }

  if (!session.sftpPromise) {
    session.sftpPromise = createSftpWithClient(session.client)
      .then(sftp => {
        session.sftp = sftp
        return sftp
      })
      .catch(error => {
        session.sftpPromise = null
        throw error
      })
  }

  return session.sftpPromise
}

export async function executeSshSessionCommand(
  sessionId: string,
  command: string,
  sender?: WebContents,
  timeoutMs = 8000,
): Promise<SshCommandResult> {
  const session = getSshSessionForSender(sessionId, sender)
  return executeSshCommandWithClient(session.client, session.activeExecChannels, command, timeoutMs)
}

export function registerTerminalIpcHandlers(): void {
  ipcMain.handle('terminal:createSession', (event, request: CreateTerminalSessionRequest) => (
    createSession(event.sender, request)
  ))

  ipcMain.handle('terminal:write', (event, request: TerminalWriteRequest) => {
    const session = getSessionForSender(request.sessionId, event.sender)
    captureTerminalInput(request.sessionId, session, request.data)

    if (session.protocol === 'local') {
      session.ptyProcess.write(request.data)
      return
    }

    session.shellChannel.write(request.data)
  })

  ipcMain.handle('terminal:resize', (event, request: TerminalResizeRequest) => {
    const session = getSessionForSender(request.sessionId, event.sender)
    const { cols, rows } = normalizeTerminalSize(request.cols, request.rows)

    if (session.protocol === 'local') {
      session.ptyProcess.resize(cols, rows)
      return
    }

    session.shellChannel.setWindow(rows, cols, 0, 0)
  })

  ipcMain.handle('terminal:dispose', (event, request: TerminalSessionRequest) => {
    getSessionForSender(request.sessionId, event.sender)
    disposeTerminalSession(request.sessionId)
  })

  app.once('before-quit', () => {
    Array.from(terminalSessions.keys()).forEach(disposeTerminalSession)
  })
}
