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

interface TerminalFilesCreateEntryRequestBase extends TerminalFilesSessionRequest {
  parentPath: string
  name: string
}

interface TerminalFilesTransferRequestBase extends TerminalFilesSessionRequest {
  destinationPath: string
  sourcePaths: string[]
}

export interface TerminalFilesCreateFileRequest extends TerminalFilesCreateEntryRequestBase {}

export interface TerminalFilesCreateDirectoryRequest extends TerminalFilesCreateEntryRequestBase {}

export interface TerminalFilesCreateEntryResult {
  createdPath: string
}

export interface TerminalFilesDeleteEntriesRequest extends TerminalFilesSessionRequest {
  targetPaths: string[]
}

export interface TerminalFilesDeleteEntriesResult {
  deletedPaths: string[]
}

export interface TerminalFilesUploadRequest extends TerminalFilesTransferRequestBase {}

export interface TerminalFilesDownloadRequest extends TerminalFilesTransferRequestBase {}

export type TerminalFilesTransferDirection = 'upload' | 'download'

export type TerminalFilesTransferStatus = 'scanning' | 'transferring' | 'completed' | 'failed'

export interface TerminalFilesTransferState {
  taskId: string
  direction: TerminalFilesTransferDirection
  destinationPath: string
  currentItemName: string | null
  completedItems: number
  totalItems: number
  copiedBytes: number
  totalBytes: number | null
  percent: number | null
  status: TerminalFilesTransferStatus
  errorMessage?: string
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

export interface TerminalFilesTransferStateEvent {
  sessionId: string
  state: TerminalFilesTransferState
}

export type TerminalFilesUploadStatus = TerminalFilesTransferStatus
export type TerminalFilesUploadState = TerminalFilesTransferState
export type TerminalFilesUploadStateEvent = TerminalFilesTransferStateEvent
