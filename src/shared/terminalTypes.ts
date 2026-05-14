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
export interface TerminalSize {
  cols: number
  rows: number
}

export interface CreateTerminalSessionRequest extends TerminalSize {
  shellId: string
}

export interface CreateTerminalSessionResult {
  sessionId: string
}

export interface TerminalWriteRequest {
  sessionId: string
  data: string
}

export interface TerminalResizeRequest extends TerminalSize {
  sessionId: string
}

export interface TerminalSessionRequest {
  sessionId: string
}

export interface TerminalDataEvent {
  sessionId: string
  data: string
}

export interface TerminalExitEvent {
  sessionId: string
  exitCode: number
  signal?: number
}
