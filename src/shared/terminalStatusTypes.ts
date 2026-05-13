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
