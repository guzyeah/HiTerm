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
import type { IBufferRange } from '@xterm/xterm'

export type TerminalSemanticKind =
  | 'url'
  | 'filePath'
  | 'ipAddress'
  | 'command'
  | 'errorLocation'

export interface TerminalSemanticPayloadMap {
  url: {
    href: string
  }
  filePath: {
    path: string
  }
  ipAddress: {
    address: string
  }
  command: {
    command: string
  }
  errorLocation: {
    path: string
    line?: number
    column?: number
  }
}

export interface TerminalSemanticToken<
  Kind extends TerminalSemanticKind = TerminalSemanticKind,
> {
  kind: Kind
  text: string
  range: IBufferRange
  priority: number
  payload?: Kind extends keyof TerminalSemanticPayloadMap
    ? TerminalSemanticPayloadMap[Kind]
    : unknown
}

export interface TerminalSemanticDetectionContext {
  cols: number
  startBufferLine: number
  endBufferLine: number
  resolveRange: (startIndex: number, length: number) => IBufferRange | null
}

export interface TerminalSemanticDetector {
  readonly kind: TerminalSemanticKind
  detect(
    text: string,
    context: TerminalSemanticDetectionContext,
  ): TerminalSemanticToken[]
}
