export interface TerminalSize {
  cols: number
  rows: number
}

export interface CreateLocalTerminalSessionRequest extends TerminalSize {
  shellId: string
}

export interface CreateLocalTerminalSessionResult {
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
