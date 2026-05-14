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
export interface TerminalStatusDisk {
  id: string
  name: string
  mountPoint: string
  totalBytes: number
  freeBytes: number
  usedBytes: number
  usagePercent: number | null
  isPrimary: boolean
}

export interface TerminalStatusSample {
  timestamp: number
  cpu: {
    usagePercent: number | null
  }
  memory: {
    totalBytes: number
    freeBytes: number
    usedBytes: number
    usagePercent: number | null
  }
  network: {
    uploadBytesPerSecond: number | null
    downloadBytesPerSecond: number | null
  }
  diskIo: {
    readBytesPerSecond: number | null
    writeBytesPerSecond: number | null
  }
  primaryDisk: TerminalStatusDisk | null
  disks: TerminalStatusDisk[]
}

export interface TerminalStatusSubscribeRequest {
  sessionId: string
}

export interface TerminalStatusSampleEvent {
  sessionId: string
  sample: TerminalStatusSample
}

export interface TerminalStatusErrorEvent {
  sessionId?: string
  message: string
}
