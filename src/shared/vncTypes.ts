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
export type VncRectangleEncoding = 'raw' | 'copyRect'

export interface VncCreateSessionRequest {
  shellId: string
  shared?: boolean
}

export interface VncCreateSessionResult {
  sessionId: string
  desktopName: string
  width: number
  height: number
}

export interface VncSessionRequest {
  sessionId: string
}

export interface VncPointerEventRequest extends VncSessionRequest {
  buttonMask: number
  x: number
  y: number
}

export interface VncKeyEventRequest extends VncSessionRequest {
  down: boolean
  keySym: number
}

export interface VncClientCutTextRequest extends VncSessionRequest {
  text: string
}

export interface VncRawRectangleUpdate {
  encoding: 'raw'
  x: number
  y: number
  width: number
  height: number
  data: Uint8Array
}

export interface VncCopyRectUpdate {
  encoding: 'copyRect'
  x: number
  y: number
  width: number
  height: number
  srcX: number
  srcY: number
}

export type VncRectangleUpdate = VncRawRectangleUpdate | VncCopyRectUpdate

export interface VncFramebufferUpdateEvent {
  sessionId: string
  rectangles: VncRectangleUpdate[]
}

export interface VncDesktopSizeEvent {
  sessionId: string
  width: number
  height: number
}

export interface VncClipboardEvent {
  sessionId: string
  text: string
}

export interface VncBellEvent {
  sessionId: string
}

export interface VncDisconnectedEvent {
  sessionId: string
  reason?: string
}
