export type TerminalFileKind = 'file' | 'directory'

export interface TerminalFileEntry {
  name: string
  absolutePath: string
  kind: TerminalFileKind
  permissions: string
  modifiedAtMs: number
}

export interface TerminalFilesSnapshot {
  cwd: string
  homeDir: string
  entries: TerminalFileEntry[]
}

export interface TerminalFilesSessionRequest {
  sessionId: string
}

export interface TerminalFilesReadDirectoryRequest extends TerminalFilesSessionRequest {
  path: string
}

export interface TerminalFilesSetRootPathRequest extends TerminalFilesSessionRequest {
  path: string
}

export interface TerminalFilesSnapshotEvent {
  sessionId: string
  snapshot: TerminalFilesSnapshot
}

export interface TerminalFilesDirectoryEvent {
  sessionId: string
  parentPath: string
  entries: TerminalFileEntry[]
}

export interface TerminalFilesErrorEvent {
  sessionId?: string
  message: string
}
