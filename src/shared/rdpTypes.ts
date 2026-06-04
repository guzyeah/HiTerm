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
export interface RdpCreateSessionRequest {
  shellId: string
}

export interface RdpCreateSessionResult {
  sessionId: string
  desktopName: string
  width: number
  height: number
}

export interface RdpSessionRequest {
  sessionId: string
}

export interface RdpPointerEventRequest extends RdpSessionRequest {
  buttonMask: number
  x: number
  y: number
}

export interface RdpKeyEventRequest extends RdpSessionRequest {
  code: string
  down: boolean
  key: string
}

export interface RdpResizeRequest extends RdpSessionRequest {
  width: number
  height: number
}

export interface RdpClientClipboardRequest extends RdpSessionRequest {
  text: string
}

export interface RdpFramebufferUpdateEvent {
  sessionId: string
  x: number
  y: number
  width: number
  height: number
  data: Uint8Array
}

export interface RdpDesktopSizeEvent {
  sessionId: string
  width: number
  height: number
}

export interface RdpClipboardEvent {
  sessionId: string
  text: string
}

export interface RdpDisconnectedEvent {
  sessionId: string
  reason?: string
}
