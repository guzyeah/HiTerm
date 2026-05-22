/*
 * HiTerm - A beautiful and easy-to-use integrated remote connection tool
 * Copyright (c) 2026 Guzyeah Software
 *
 * This software is released under a dual licensing model:
 * 1. AGPL-3.0-only (see LICENSE.AGPL for details)
 * 2. Commercial Proprietary License (please contact to guzyeah@foxmail.com)
 *
 * You may choose the license that best suits your needs.
 */
/**
 * VNC/RFB 会话管理。
 * 主进程直接维护 TCP RFB 连接，渲染进程只接收 RGBA 矩形并回传键鼠事件。
 */

import { randomUUID } from 'node:crypto'
import net from 'node:net'
import { app, ipcMain, type WebContents } from 'electron'
import * as CryptoJS from 'crypto-js'
import { getShellById, type ShellRecord } from './shellStore'
import type {
  VncBellEvent,
  VncClientCutTextRequest,
  VncClipboardEvent,
  VncCreateSessionRequest,
  VncCreateSessionResult,
  VncDesktopSizeEvent,
  VncDisconnectedEvent,
  VncFramebufferUpdateEvent,
  VncKeyEventRequest,
  VncPointerEventRequest,
  VncRectangleUpdate,
  VncSessionRequest,
} from '../src/shared/vncTypes'

interface RfbProtocolVersion {
  major: number
  minor: 3 | 7 | 8
}

interface RfbPixelFormat {
  bitsPerPixel: number
  depth: number
  bigEndian: boolean
  trueColor: boolean
  redMax: number
  greenMax: number
  blueMax: number
  redShift: number
  greenShift: number
  blueShift: number
}

interface VncServerInit {
  desktopName: string
  height: number
  pixelFormat: RfbPixelFormat
  width: number
}

interface PendingRead {
  length: number
  reject: (reason?: unknown) => void
  resolve: (buffer: Buffer) => void
}

const RFB_VERSION_SIZE = 12
const RFB_VERSION_PATTERN = /^RFB (\d{3})\.(\d{3})\n$/
const SECURITY_TYPE_INVALID = 0
const SECURITY_TYPE_NONE = 1
const SECURITY_TYPE_VNC_AUTH = 2
const SECURITY_RESULT_OK = 0
const ENCODING_RAW = 0
const ENCODING_COPY_RECT = 1
const ENCODING_HEXTILE = 5
const ENCODING_DESKTOP_SIZE = -223
const MESSAGE_FRAMEBUFFER_UPDATE = 0
const MESSAGE_SET_COLOR_MAP_ENTRIES = 1
const MESSAGE_BELL = 2
const MESSAGE_SERVER_CUT_TEXT = 3
const CONNECT_TIMEOUT_MS = 15000
const MAX_REASON_LENGTH = 4096
const MAX_CLIPBOARD_TEXT_LENGTH = 1024 * 1024
const MAX_FRAMEBUFFER_DIMENSION = 32767

const vncSessions = new Map<string, VncClientSession>()
const webContentsSessionIds = new Map<number, Set<string>>()
const trackedWebContentsIds = new Set<number>()

class AsyncBufferedReader {
  private available = 0
  private chunks: Buffer[] = []
  private closedError: Error | null = null
  private pendingRead: PendingRead | null = null

  push(chunk: Buffer): void {
    if (this.closedError || chunk.length === 0) return

    this.chunks.push(chunk)
    this.available += chunk.length
    this.resolvePendingRead()
  }

  fail(error: Error): void {
    if (this.closedError) return

    this.closedError = error
    if (this.pendingRead) {
      const pendingRead = this.pendingRead
      this.pendingRead = null
      pendingRead.reject(error)
    }
  }

  readBytes(length: number): Promise<Buffer> {
    if (!Number.isSafeInteger(length) || length < 0) {
      return Promise.reject(new Error('Invalid RFB read length'))
    }

    if (length === 0) {
      return Promise.resolve(Buffer.alloc(0))
    }

    if (this.available >= length) {
      return Promise.resolve(this.consume(length))
    }

    if (this.closedError) {
      return Promise.reject(this.closedError)
    }

    if (this.pendingRead) {
      return Promise.reject(new Error('Concurrent RFB reads are not supported'))
    }

    return new Promise((resolve, reject) => {
      this.pendingRead = { length, resolve, reject }
      this.resolvePendingRead()
    })
  }

  private resolvePendingRead(): void {
    const pendingRead = this.pendingRead
    if (!pendingRead || this.available < pendingRead.length) return

    this.pendingRead = null
    pendingRead.resolve(this.consume(pendingRead.length))
  }

  private consume(length: number): Buffer {
    const output = Buffer.allocUnsafe(length)
    let outputOffset = 0

    while (outputOffset < length) {
      const chunk = this.chunks[0]
      if (!chunk) break

      const bytesToCopy = Math.min(chunk.length, length - outputOffset)
      chunk.copy(output, outputOffset, 0, bytesToCopy)
      outputOffset += bytesToCopy

      if (bytesToCopy === chunk.length) {
        this.chunks.shift()
      } else {
        this.chunks[0] = chunk.subarray(bytesToCopy)
      }
    }

    this.available -= length
    return output
  }
}

function sanitizeProtocolReason(reason: string): string {
  return Array.from(reason, character => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127 ? ' ' : character
  }).join('').trim()
}

function parseRfbVersion(buffer: Buffer): RfbProtocolVersion {
  const value = buffer.toString('ascii')
  const match = RFB_VERSION_PATTERN.exec(value)
  if (!match) {
    throw new Error('Invalid RFB protocol version')
  }

  const serverMajor = Number(match[1])
  const serverMinor = Number(match[2])
  if (serverMajor < 3 || (serverMajor === 3 && serverMinor < 3)) {
    throw new Error(`Unsupported RFB protocol version: ${value.trim()}`)
  }

  if (serverMajor === 3 && serverMinor < 7) {
    return { major: 3, minor: 3 }
  }

  if (serverMajor === 3 && serverMinor < 8) {
    return { major: 3, minor: 7 }
  }

  return { major: 3, minor: 8 }
}

function formatRfbVersion(version: RfbProtocolVersion): Buffer {
  return Buffer.from(`RFB ${String(version.major).padStart(3, '0')}.${String(version.minor).padStart(3, '0')}\n`, 'ascii')
}

function parsePixelFormat(buffer: Buffer, offset = 0): RfbPixelFormat {
  return {
    bitsPerPixel: buffer.readUInt8(offset),
    depth: buffer.readUInt8(offset + 1),
    bigEndian: buffer.readUInt8(offset + 2) !== 0,
    trueColor: buffer.readUInt8(offset + 3) !== 0,
    redMax: buffer.readUInt16BE(offset + 4),
    greenMax: buffer.readUInt16BE(offset + 6),
    blueMax: buffer.readUInt16BE(offset + 8),
    redShift: buffer.readUInt8(offset + 10),
    greenShift: buffer.readUInt8(offset + 11),
    blueShift: buffer.readUInt8(offset + 12),
  }
}

function writePixelFormat(pixelFormat: RfbPixelFormat): Buffer {
  const buffer = Buffer.alloc(16)
  buffer.writeUInt8(pixelFormat.bitsPerPixel, 0)
  buffer.writeUInt8(pixelFormat.depth, 1)
  buffer.writeUInt8(pixelFormat.bigEndian ? 1 : 0, 2)
  buffer.writeUInt8(pixelFormat.trueColor ? 1 : 0, 3)
  buffer.writeUInt16BE(pixelFormat.redMax, 4)
  buffer.writeUInt16BE(pixelFormat.greenMax, 6)
  buffer.writeUInt16BE(pixelFormat.blueMax, 8)
  buffer.writeUInt8(pixelFormat.redShift, 10)
  buffer.writeUInt8(pixelFormat.greenShift, 11)
  buffer.writeUInt8(pixelFormat.blueShift, 12)
  return buffer
}

function createClientPixelFormat(colorDepth: string | null | undefined): RfbPixelFormat {
  if (colorDepth === '8') {
    return {
      bitsPerPixel: 8,
      depth: 8,
      bigEndian: false,
      trueColor: true,
      redMax: 7,
      greenMax: 7,
      blueMax: 3,
      redShift: 5,
      greenShift: 2,
      blueShift: 0,
    }
  }

  if (colorDepth === '16') {
    return {
      bitsPerPixel: 16,
      depth: 16,
      bigEndian: false,
      trueColor: true,
      redMax: 31,
      greenMax: 63,
      blueMax: 31,
      redShift: 11,
      greenShift: 5,
      blueShift: 0,
    }
  }

  return {
    bitsPerPixel: 32,
    depth: 24,
    bigEndian: false,
    trueColor: true,
    redMax: 255,
    greenMax: 255,
    blueMax: 255,
    redShift: 16,
    greenShift: 8,
    blueShift: 0,
  }
}

function getBytesPerPixel(pixelFormat: RfbPixelFormat): number {
  const bytesPerPixel = pixelFormat.bitsPerPixel / 8
  if (!Number.isInteger(bytesPerPixel) || bytesPerPixel < 1 || bytesPerPixel > 4) {
    throw new Error(`Unsupported VNC pixel width: ${pixelFormat.bitsPerPixel}`)
  }

  return bytesPerPixel
}

function scaleColor(value: number, max: number): number {
  if (max <= 0) return 0
  if (max === 255) return value & 0xff
  return Math.round((value * 255) / max) & 0xff
}

function readPixelValue(buffer: Buffer, offset: number, pixelFormat: RfbPixelFormat, bytesPerPixel: number): number {
  if (bytesPerPixel === 1) return buffer.readUInt8(offset)
  if (bytesPerPixel === 2) return pixelFormat.bigEndian ? buffer.readUInt16BE(offset) : buffer.readUInt16LE(offset)
  if (bytesPerPixel === 3) {
    return pixelFormat.bigEndian
      ? buffer.readUIntBE(offset, 3)
      : buffer.readUIntLE(offset, 3)
  }

  return pixelFormat.bigEndian ? buffer.readUInt32BE(offset) : buffer.readUInt32LE(offset)
}

function writeRgbaPixel(target: Uint8Array, offset: number, pixelValue: number, pixelFormat: RfbPixelFormat): void {
  const red = (pixelValue >> pixelFormat.redShift) & pixelFormat.redMax
  const green = (pixelValue >> pixelFormat.greenShift) & pixelFormat.greenMax
  const blue = (pixelValue >> pixelFormat.blueShift) & pixelFormat.blueMax
  target[offset] = scaleColor(red, pixelFormat.redMax)
  target[offset + 1] = scaleColor(green, pixelFormat.greenMax)
  target[offset + 2] = scaleColor(blue, pixelFormat.blueMax)
  target[offset + 3] = 255
}

function convertPixelBufferToRgba(
  source: Buffer,
  width: number,
  height: number,
  pixelFormat: RfbPixelFormat,
): Uint8Array {
  if (!pixelFormat.trueColor) {
    throw new Error('Indexed-color VNC pixel formats are not supported')
  }

  const bytesPerPixel = getBytesPerPixel(pixelFormat)
  const pixelCount = width * height
  const output = new Uint8Array(pixelCount * 4)

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const pixelValue = readPixelValue(source, pixelIndex * bytesPerPixel, pixelFormat, bytesPerPixel)
    writeRgbaPixel(output, pixelIndex * 4, pixelValue, pixelFormat)
  }

  return output
}

function fillRgbaRect(
  target: Uint8Array,
  targetWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
  pixelValue: number,
  pixelFormat: RfbPixelFormat,
): void {
  const rgba = new Uint8Array(4)
  writeRgbaPixel(rgba, 0, pixelValue, pixelFormat)

  for (let row = 0; row < height; row += 1) {
    let offset = ((y + row) * targetWidth + x) * 4
    for (let col = 0; col < width; col += 1) {
      target[offset] = rgba[0]
      target[offset + 1] = rgba[1]
      target[offset + 2] = rgba[2]
      target[offset + 3] = 255
      offset += 4
    }
  }
}

function blitRawPixelsToRgba(
  target: Uint8Array,
  targetWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
  source: Buffer,
  pixelFormat: RfbPixelFormat,
): void {
  if (!pixelFormat.trueColor) {
    throw new Error('Indexed-color VNC pixel formats are not supported')
  }

  const bytesPerPixel = getBytesPerPixel(pixelFormat)
  let sourceOffset = 0

  for (let row = 0; row < height; row += 1) {
    let targetOffset = ((y + row) * targetWidth + x) * 4
    for (let col = 0; col < width; col += 1) {
      const pixelValue = readPixelValue(source, sourceOffset, pixelFormat, bytesPerPixel)
      writeRgbaPixel(target, targetOffset, pixelValue, pixelFormat)
      sourceOffset += bytesPerPixel
      targetOffset += 4
    }
  }
}

function reverseByteBits(value: number): number {
  let output = 0
  for (let index = 0; index < 8; index += 1) {
    output = (output << 1) | ((value >> index) & 1)
  }
  return output
}

function createVncPasswordKey(password: string): Buffer {
  const key = Buffer.alloc(8)
  for (let index = 0; index < key.length; index += 1) {
    key[index] = reverseByteBits(index < password.length ? password.charCodeAt(index) & 0xff : 0)
  }
  return key
}

function wordArrayToBuffer(wordArray: CryptoJS.lib.WordArray): Buffer {
  const output = Buffer.allocUnsafe(wordArray.sigBytes)
  for (let index = 0; index < wordArray.sigBytes; index += 1) {
    output[index] = (wordArray.words[index >>> 2] >>> (24 - (index % 4) * 8)) & 0xff
  }
  return output
}

function encryptVncChallenge(challenge: Buffer, password: string): Buffer {
  const key = CryptoJS.lib.WordArray.create(createVncPasswordKey(password))
  const message = CryptoJS.lib.WordArray.create(challenge)
  const encrypted = CryptoJS.DES.encrypt(message, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.NoPadding,
  })

  return wordArrayToBuffer(encrypted.ciphertext)
}

function validateVncHost(host: string | null | undefined): string {
  const normalizedHost = host?.trim()
  if (!normalizedHost) {
    throw new Error('Missing VNC host')
  }
  return normalizedHost
}

function validateVncPort(port: number | null | undefined): number {
  const normalizedPort = Math.floor(port ?? 5900)
  if (normalizedPort < 1 || normalizedPort > 65535) {
    throw new Error('Invalid VNC port')
  }
  return normalizedPort
}

function validateFramebufferSize(width: number, height: number): void {
  if (
    width < 1
    || height < 1
    || width > MAX_FRAMEBUFFER_DIMENSION
    || height > MAX_FRAMEBUFFER_DIMENSION
  ) {
    throw new Error(`Invalid VNC framebuffer size: ${width}x${height}`)
  }
}

function normalizeCoordinate(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(max, Math.round(value)))
}

function normalizeClipboardText(text: string): Buffer {
  const buffer = Buffer.from(text, 'utf8')
  if (buffer.length > MAX_CLIPBOARD_TEXT_LENGTH) {
    throw new Error('VNC clipboard text is too large')
  }
  return buffer
}

function safeSend<TPayload>(
  webContents: WebContents,
  channel: string,
  payload: TPayload,
): void {
  if (!webContents.isDestroyed()) {
    webContents.send(channel, payload)
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
    nextSessionIds?.forEach(disposeVncSession)
  })
}

function untrackSessionWebContents(sessionId: string, webContents: WebContents): void {
  webContentsSessionIds.get(webContents.id)?.delete(sessionId)
}

function getSessionForSender(sessionId: string, sender: WebContents): VncClientSession {
  const session = vncSessions.get(sessionId)
  if (!session || session.webContents.id !== sender.id) {
    throw new Error('VNC session not found')
  }

  return session
}

function disposeVncSession(sessionId: string): void {
  const session = vncSessions.get(sessionId)
  if (!session) return

  vncSessions.delete(sessionId)
  untrackSessionWebContents(sessionId, session.webContents)
  session.dispose()
}

function notifyVncSessionClosed(sessionId: string, reason?: string): void {
  const session = vncSessions.get(sessionId)
  if (!session) return

  vncSessions.delete(sessionId)
  untrackSessionWebContents(sessionId, session.webContents)
  session.dispose()
  session.sendDisconnected(reason)
}

class VncClientSession {
  private desktopName = ''
  private disposed = false
  private framebufferHeight = 0
  private framebufferWidth = 0
  private pixelFormat: RfbPixelFormat
  private readonly reader = new AsyncBufferedReader()
  private socket: net.Socket | null = null

  constructor(
    readonly sessionId: string,
    readonly shell: ShellRecord,
    readonly webContents: WebContents,
    private readonly shared: boolean,
  ) {
    this.pixelFormat = createClientPixelFormat(shell.colorDepth)
  }

  async connect(): Promise<VncCreateSessionResult> {
    const host = validateVncHost(this.shell.host)
    const port = validateVncPort(this.shell.port)
    const socket = net.createConnection({ host, port })
    this.socket = socket

    socket.setNoDelay(true)
    socket.setTimeout(CONNECT_TIMEOUT_MS)
    socket.on('data', chunk => this.reader.push(chunk))
    socket.on('timeout', () => {
      this.reader.fail(new Error('VNC connection timed out'))
      socket.destroy()
    })
    socket.on('error', error => {
      this.reader.fail(error)
    })
    socket.on('close', () => {
      this.reader.fail(new Error('VNC connection closed'))
      if (!this.disposed) {
        notifyVncSessionClosed(this.sessionId, 'VNC connection closed')
      }
    })

    await new Promise<void>((resolve, reject) => {
      const handleConnect = () => {
        socket.off('error', handleError)
        resolve()
      }
      const handleError = (error: Error) => {
        socket.off('connect', handleConnect)
        reject(error)
      }

      socket.once('connect', handleConnect)
      socket.once('error', handleError)
    })

    await this.performHandshake()
    socket.setTimeout(0)

    return {
      sessionId: this.sessionId,
      desktopName: this.desktopName,
      width: this.framebufferWidth,
      height: this.framebufferHeight,
    }
  }

  start(): void {
    this.sendSetPixelFormat(this.pixelFormat)
    this.sendSetEncodings()
    this.requestFramebufferUpdate(false)
    void this.readServerMessages()
  }

  dispose(): void {
    if (this.disposed) return

    this.disposed = true
    this.reader.fail(new Error('VNC session disposed'))

    try {
      this.socket?.destroy()
    } catch {
      // 已关闭的 socket 无需重复处理。
    }
  }

  sendDisconnected(reason?: string): void {
    safeSend<VncDisconnectedEvent>(this.webContents, 'vnc:disconnected', {
      sessionId: this.sessionId,
      reason,
    })
  }

  sendPointerEvent(request: Omit<VncPointerEventRequest, 'sessionId'>): void {
    const buffer = Buffer.alloc(6)
    buffer.writeUInt8(5, 0)
    buffer.writeUInt8(request.buttonMask & 0xff, 1)
    buffer.writeUInt16BE(normalizeCoordinate(request.x, Math.max(0, this.framebufferWidth - 1)), 2)
    buffer.writeUInt16BE(normalizeCoordinate(request.y, Math.max(0, this.framebufferHeight - 1)), 4)
    this.write(buffer)
  }

  sendKeyEvent(request: Omit<VncKeyEventRequest, 'sessionId'>): void {
    const buffer = Buffer.alloc(8)
    buffer.writeUInt8(4, 0)
    buffer.writeUInt8(request.down ? 1 : 0, 1)
    buffer.writeUInt32BE(request.keySym >>> 0, 4)
    this.write(buffer)
  }

  sendClientCutText(text: string): void {
    const textBuffer = normalizeClipboardText(text)
    const header = Buffer.alloc(8)
    header.writeUInt8(6, 0)
    header.writeUInt32BE(textBuffer.length, 4)
    this.write(Buffer.concat([header, textBuffer]))
  }

  private async performHandshake(): Promise<void> {
    const version = parseRfbVersion(await this.reader.readBytes(RFB_VERSION_SIZE))
    this.write(formatRfbVersion(version))

    const securityType = await this.negotiateSecurityType(version)
    if (securityType === SECURITY_TYPE_VNC_AUTH) {
      await this.performVncAuthentication()
    }

    await this.readSecurityResultIfNeeded(version, securityType)
    this.sendClientInit()
    const serverInit = await this.readServerInit()
    this.desktopName = serverInit.desktopName
    this.framebufferWidth = serverInit.width
    this.framebufferHeight = serverInit.height
  }

  private async negotiateSecurityType(version: RfbProtocolVersion): Promise<number> {
    if (version.minor === 3) {
      const securityType = (await this.reader.readBytes(4)).readUInt32BE(0)
      if (securityType === SECURITY_TYPE_INVALID) {
        throw new Error(await this.readReasonString())
      }

      if (securityType !== SECURITY_TYPE_NONE && securityType !== SECURITY_TYPE_VNC_AUTH) {
        throw new Error(`Unsupported VNC security type: ${securityType}`)
      }

      if (securityType === SECURITY_TYPE_VNC_AUTH && !this.shell.secret) {
        throw new Error('VNC password is required')
      }

      return securityType
    }

    const securityTypeCount = (await this.reader.readBytes(1)).readUInt8(0)
    if (securityTypeCount === 0) {
      throw new Error(await this.readReasonString())
    }

    const securityTypes = [...await this.reader.readBytes(securityTypeCount)]
    const hasPassword = Boolean(this.shell.secret)
    let selectedSecurityType = 0

    if (hasPassword && securityTypes.includes(SECURITY_TYPE_VNC_AUTH)) {
      selectedSecurityType = SECURITY_TYPE_VNC_AUTH
    } else if (securityTypes.includes(SECURITY_TYPE_NONE)) {
      selectedSecurityType = SECURITY_TYPE_NONE
    } else if (securityTypes.includes(SECURITY_TYPE_VNC_AUTH)) {
      throw new Error('VNC password is required')
    } else {
      throw new Error(`Unsupported VNC security types: ${securityTypes.join(', ')}`)
    }

    this.write(Buffer.from([selectedSecurityType]))
    return selectedSecurityType
  }

  private async performVncAuthentication(): Promise<void> {
    const password = this.shell.secret
    if (!password) {
      throw new Error('VNC password is required')
    }

    const challenge = await this.reader.readBytes(16)
    this.write(encryptVncChallenge(challenge, password))
  }

  private async readSecurityResultIfNeeded(
    version: RfbProtocolVersion,
    securityType: number,
  ): Promise<void> {
    if (securityType === SECURITY_TYPE_NONE && version.minor === 3) {
      return
    }

    const status = (await this.reader.readBytes(4)).readUInt32BE(0)
    if (status === SECURITY_RESULT_OK) return

    const fallbackReason = status === 2
      ? 'VNC authentication failed too many times'
      : 'VNC authentication failed'

    if (version.minor === 8) {
      const reason = await this.readReasonString().catch(() => fallbackReason)
      throw new Error(reason || fallbackReason)
    }

    throw new Error(fallbackReason)
  }

  private sendClientInit(): void {
    this.write(Buffer.from([this.shared ? 1 : 0]))
  }

  private async readServerInit(): Promise<VncServerInit> {
    const header = await this.reader.readBytes(24)
    const width = header.readUInt16BE(0)
    const height = header.readUInt16BE(2)
    validateFramebufferSize(width, height)

    const pixelFormat = parsePixelFormat(header, 4)
    const nameLength = header.readUInt32BE(20)
    if (nameLength > MAX_REASON_LENGTH * 16) {
      throw new Error('VNC desktop name is too large')
    }

    const desktopName = (await this.reader.readBytes(nameLength)).toString('utf8')

    return {
      desktopName,
      height,
      pixelFormat,
      width,
    }
  }

  private async readReasonString(): Promise<string> {
    const reasonLength = (await this.reader.readBytes(4)).readUInt32BE(0)
    if (reasonLength > MAX_REASON_LENGTH) {
      throw new Error('VNC server returned an oversized error reason')
    }

    return sanitizeProtocolReason((await this.reader.readBytes(reasonLength)).toString('utf8'))
  }

  private sendSetPixelFormat(pixelFormat: RfbPixelFormat): void {
    const buffer = Buffer.alloc(20)
    buffer.writeUInt8(0, 0)
    writePixelFormat(pixelFormat).copy(buffer, 4)
    this.write(buffer)
  }

  private sendSetEncodings(): void {
    const encodings = [ENCODING_HEXTILE, ENCODING_COPY_RECT, ENCODING_RAW, ENCODING_DESKTOP_SIZE]
    const buffer = Buffer.alloc(4 + encodings.length * 4)
    buffer.writeUInt8(2, 0)
    buffer.writeUInt16BE(encodings.length, 2)

    encodings.forEach((encoding, index) => {
      buffer.writeInt32BE(encoding, 4 + index * 4)
    })

    this.write(buffer)
  }

  private requestFramebufferUpdate(incremental: boolean): void {
    const buffer = Buffer.alloc(10)
    buffer.writeUInt8(3, 0)
    buffer.writeUInt8(incremental ? 1 : 0, 1)
    buffer.writeUInt16BE(0, 2)
    buffer.writeUInt16BE(0, 4)
    buffer.writeUInt16BE(this.framebufferWidth, 6)
    buffer.writeUInt16BE(this.framebufferHeight, 8)
    this.write(buffer)
  }

  private async readServerMessages(): Promise<void> {
    try {
      while (!this.disposed) {
        const messageType = (await this.reader.readBytes(1)).readUInt8(0)
        switch (messageType) {
          case MESSAGE_FRAMEBUFFER_UPDATE:
            await this.readFramebufferUpdate()
            this.requestFramebufferUpdate(true)
            break
          case MESSAGE_SET_COLOR_MAP_ENTRIES:
            await this.skipSetColorMapEntries()
            break
          case MESSAGE_BELL:
            safeSend<VncBellEvent>(this.webContents, 'vnc:bell', { sessionId: this.sessionId })
            break
          case MESSAGE_SERVER_CUT_TEXT:
            await this.readServerCutText()
            break
          default:
            throw new Error(`Unsupported VNC server message: ${messageType}`)
        }
      }
    } catch (error) {
      if (this.disposed) return

      const reason = error instanceof Error ? error.message : String(error)
      notifyVncSessionClosed(this.sessionId, reason)
    }
  }

  private async readFramebufferUpdate(): Promise<void> {
    await this.reader.readBytes(1)
    const rectangleCount = (await this.reader.readBytes(2)).readUInt16BE(0)
    const rectangles: VncRectangleUpdate[] = []

    for (let index = 0; index < rectangleCount; index += 1) {
      const header = await this.reader.readBytes(12)
      const x = header.readUInt16BE(0)
      const y = header.readUInt16BE(2)
      const width = header.readUInt16BE(4)
      const height = header.readUInt16BE(6)
      const encoding = header.readInt32BE(8)

      if (encoding === ENCODING_DESKTOP_SIZE) {
        this.resizeFramebuffer(width, height)
        continue
      }

      if (width === 0 || height === 0) {
        continue
      }

      if (encoding === ENCODING_RAW) {
        rectangles.push(await this.readRawRectangle(x, y, width, height))
      } else if (encoding === ENCODING_COPY_RECT) {
        rectangles.push(await this.readCopyRectRectangle(x, y, width, height))
      } else if (encoding === ENCODING_HEXTILE) {
        rectangles.push(await this.readHextileRectangle(x, y, width, height))
      } else {
        throw new Error(`Unsupported VNC rectangle encoding: ${encoding}`)
      }
    }

    if (rectangles.length > 0) {
      safeSend<VncFramebufferUpdateEvent>(this.webContents, 'vnc:framebufferUpdate', {
        sessionId: this.sessionId,
        rectangles,
      })
    }
  }

  private async readRawRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<VncRectangleUpdate> {
    const bytesPerPixel = getBytesPerPixel(this.pixelFormat)
    const pixelBuffer = await this.reader.readBytes(width * height * bytesPerPixel)

    return {
      encoding: 'raw',
      x,
      y,
      width,
      height,
      data: convertPixelBufferToRgba(pixelBuffer, width, height, this.pixelFormat),
    }
  }

  private async readCopyRectRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<VncRectangleUpdate> {
    const buffer = await this.reader.readBytes(4)
    return {
      encoding: 'copyRect',
      x,
      y,
      width,
      height,
      srcX: buffer.readUInt16BE(0),
      srcY: buffer.readUInt16BE(2),
    }
  }

  private async readHextileRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<VncRectangleUpdate> {
    const bytesPerPixel = getBytesPerPixel(this.pixelFormat)
    const output = new Uint8Array(width * height * 4)
    let backgroundPixel = 0
    let foregroundPixel = 0

    for (let tileY = 0; tileY < height; tileY += 16) {
      for (let tileX = 0; tileX < width; tileX += 16) {
        const tileWidth = Math.min(16, width - tileX)
        const tileHeight = Math.min(16, height - tileY)
        const subencoding = (await this.reader.readBytes(1)).readUInt8(0)

        if ((subencoding & 1) !== 0) {
          const rawTile = await this.reader.readBytes(tileWidth * tileHeight * bytesPerPixel)
          blitRawPixelsToRgba(
            output,
            width,
            tileX,
            tileY,
            tileWidth,
            tileHeight,
            rawTile,
            this.pixelFormat,
          )
          continue
        }

        if ((subencoding & 2) !== 0) {
          backgroundPixel = readPixelValue(await this.reader.readBytes(bytesPerPixel), 0, this.pixelFormat, bytesPerPixel)
        }

        fillRgbaRect(output, width, tileX, tileY, tileWidth, tileHeight, backgroundPixel, this.pixelFormat)

        if ((subencoding & 4) !== 0) {
          foregroundPixel = readPixelValue(await this.reader.readBytes(bytesPerPixel), 0, this.pixelFormat, bytesPerPixel)
        }

        if ((subencoding & 8) === 0) {
          continue
        }

        const subrectangleCount = (await this.reader.readBytes(1)).readUInt8(0)
        const hasColoredSubrectangles = (subencoding & 16) !== 0

        for (let subrectangleIndex = 0; subrectangleIndex < subrectangleCount; subrectangleIndex += 1) {
          const pixelValue = hasColoredSubrectangles
            ? readPixelValue(await this.reader.readBytes(bytesPerPixel), 0, this.pixelFormat, bytesPerPixel)
            : foregroundPixel
          const geometry = await this.reader.readBytes(2)
          const subX = geometry.readUInt8(0) >> 4
          const subY = geometry.readUInt8(0) & 0x0f
          const subWidth = (geometry.readUInt8(1) >> 4) + 1
          const subHeight = (geometry.readUInt8(1) & 0x0f) + 1

          fillRgbaRect(
            output,
            width,
            tileX + subX,
            tileY + subY,
            Math.min(subWidth, tileWidth - subX),
            Math.min(subHeight, tileHeight - subY),
            pixelValue,
            this.pixelFormat,
          )
        }
      }
    }

    return {
      encoding: 'raw',
      x,
      y,
      width,
      height,
      data: output,
    }
  }

  private resizeFramebuffer(width: number, height: number): void {
    validateFramebufferSize(width, height)
    this.framebufferWidth = width
    this.framebufferHeight = height
    safeSend<VncDesktopSizeEvent>(this.webContents, 'vnc:desktopSize', {
      sessionId: this.sessionId,
      width,
      height,
    })
  }

  private async skipSetColorMapEntries(): Promise<void> {
    await this.reader.readBytes(1)
    const header = await this.reader.readBytes(4)
    const colorCount = header.readUInt16BE(2)
    await this.reader.readBytes(colorCount * 6)
  }

  private async readServerCutText(): Promise<void> {
    const header = await this.reader.readBytes(7)
    const textLength = header.readUInt32BE(3)
    if (textLength > MAX_CLIPBOARD_TEXT_LENGTH) {
      await this.reader.readBytes(textLength)
      return
    }

    const text = (await this.reader.readBytes(textLength)).toString('utf8')
    safeSend<VncClipboardEvent>(this.webContents, 'vnc:clipboard', {
      sessionId: this.sessionId,
      text,
    })
  }

  private write(buffer: Buffer): void {
    if (this.disposed || !this.socket || this.socket.destroyed) {
      throw new Error('VNC session is closed')
    }

    this.socket.write(buffer)
  }
}

async function createVncSession(
  webContents: WebContents,
  request: VncCreateSessionRequest,
): Promise<VncCreateSessionResult> {
  const shell = getShellById(request.shellId)
  if (!shell || shell.protocol !== 'vnc') {
    throw new Error('Only VNC sessions are supported')
  }

  const sessionId = randomUUID()
  const session = new VncClientSession(sessionId, shell, webContents, request.shared ?? true)

  try {
    const result = await session.connect()
    vncSessions.set(sessionId, session)
    trackSessionWebContents(sessionId, webContents)
    try {
      session.start()
    } catch (error) {
      disposeVncSession(sessionId)
      throw error
    }
    return result
  } catch (error) {
    if (vncSessions.has(sessionId)) {
      disposeVncSession(sessionId)
    } else {
      session.dispose()
    }
    throw error
  }
}

export function registerVncIpcHandlers(): void {
  ipcMain.handle('vnc:createSession', (event, request: VncCreateSessionRequest) => (
    createVncSession(event.sender, request)
  ))

  ipcMain.handle('vnc:pointerEvent', (event, request: VncPointerEventRequest) => {
    const session = getSessionForSender(request.sessionId, event.sender)
    session.sendPointerEvent({
      buttonMask: request.buttonMask,
      x: request.x,
      y: request.y,
    })
  })

  ipcMain.handle('vnc:keyEvent', (event, request: VncKeyEventRequest) => {
    const session = getSessionForSender(request.sessionId, event.sender)
    session.sendKeyEvent({
      down: request.down,
      keySym: request.keySym,
    })
  })

  ipcMain.handle('vnc:clientCutText', (event, request: VncClientCutTextRequest) => {
    const session = getSessionForSender(request.sessionId, event.sender)
    session.sendClientCutText(request.text)
  })

  ipcMain.handle('vnc:dispose', (event, request: VncSessionRequest) => {
    getSessionForSender(request.sessionId, event.sender)
    disposeVncSession(request.sessionId)
  })

  app.once('before-quit', () => {
    Array.from(vncSessions.keys()).forEach(disposeVncSession)
  })
}
