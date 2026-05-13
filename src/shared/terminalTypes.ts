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
