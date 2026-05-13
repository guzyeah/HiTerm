/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface SettingsAPI {
  getLocale: () => Promise<string>
  setLocale: (locale: string) => Promise<void>
  getFontOverride: () => Promise<string | null>
  setFontOverride: (override: string | null) => Promise<void>
  getSystemInfo: () => Promise<{ locale: string; platform: string }>
}

interface MenuAPI {
  updateLabels: (labels: Record<string, string>) => void
}

interface ShellAPI {
  saveShell: (record: unknown) => Promise<unknown>
  listGroups: () => Promise<string[]>
  listShellSummaries: () => Promise<import('../src/shared/shellTypes').ShellSummary[]>
}

interface DialogAPI {
  openFile: (options?: { title?: string; filters?: Electron.FileFilter[] }) => Promise<string | null>
  openPaths: (options?: import('../src/shared/dialogTypes').OpenPathsDialogOptions) => Promise<string[]>
  getPathsForFiles: (files: File[]) => string[]
}

interface SerialAPI {
  listSerialPorts: () => Promise<{ path: string; friendlyName?: string }[]>
}

interface TerminalAPI {
  createLocalSession: (
    request: import('../src/shared/terminalTypes').CreateLocalTerminalSessionRequest
  ) => Promise<import('../src/shared/terminalTypes').CreateLocalTerminalSessionResult>
  write: (request: import('../src/shared/terminalTypes').TerminalWriteRequest) => Promise<void>
  resize: (request: import('../src/shared/terminalTypes').TerminalResizeRequest) => Promise<void>
  dispose: (request: import('../src/shared/terminalTypes').TerminalSessionRequest) => Promise<void>
  onData: (callback: (event: import('../src/shared/terminalTypes').TerminalDataEvent) => void) => () => void
  onExit: (callback: (event: import('../src/shared/terminalTypes').TerminalExitEvent) => void) => () => void
}

interface TerminalFilesAPI {
  subscribe: (request: import('../src/shared/terminalFilesTypes').TerminalFilesSessionRequest) => Promise<void>
  unsubscribe: (request: import('../src/shared/terminalFilesTypes').TerminalFilesSessionRequest) => Promise<void>
  refresh: (request: import('../src/shared/terminalFilesTypes').TerminalFilesSessionRequest) => Promise<void>
  goHome: (request: import('../src/shared/terminalFilesTypes').TerminalFilesSessionRequest) => Promise<void>
  readDirectory: (request: import('../src/shared/terminalFilesTypes').TerminalFilesReadDirectoryRequest) => Promise<void>
  setRootPath: (request: import('../src/shared/terminalFilesTypes').TerminalFilesSetRootPathRequest) => Promise<void>
  createFile: (request: import('../src/shared/terminalFilesTypes').TerminalFilesCreateFileRequest) => Promise<import('../src/shared/terminalFilesTypes').TerminalFilesCreateEntryResult>
  createDirectory: (request: import('../src/shared/terminalFilesTypes').TerminalFilesCreateDirectoryRequest) => Promise<import('../src/shared/terminalFilesTypes').TerminalFilesCreateEntryResult>
  deleteEntries: (request: import('../src/shared/terminalFilesTypes').TerminalFilesDeleteEntriesRequest) => Promise<import('../src/shared/terminalFilesTypes').TerminalFilesDeleteEntriesResult>
  upload: (request: import('../src/shared/terminalFilesTypes').TerminalFilesUploadRequest) => Promise<void>
  download: (request: import('../src/shared/terminalFilesTypes').TerminalFilesDownloadRequest) => Promise<void>
  onSnapshot: (callback: (event: import('../src/shared/terminalFilesTypes').TerminalFilesSnapshotEvent) => void) => () => void
  onDirectory: (callback: (event: import('../src/shared/terminalFilesTypes').TerminalFilesDirectoryEvent) => void) => () => void
  onError: (callback: (event: import('../src/shared/terminalFilesTypes').TerminalFilesErrorEvent) => void) => () => void
  onTransferState: (callback: (event: import('../src/shared/terminalFilesTypes').TerminalFilesTransferStateEvent) => void) => () => void
}

interface TerminalStatusAPI {
  subscribe: (request: import('../src/shared/terminalStatusTypes').TerminalStatusSubscribeRequest) => Promise<void>
  unsubscribe: (request: import('../src/shared/terminalStatusTypes').TerminalStatusSubscribeRequest) => Promise<void>
  onSample: (callback: (event: import('../src/shared/terminalStatusTypes').TerminalStatusSampleEvent) => void) => () => void
  onError: (callback: (event: import('../src/shared/terminalStatusTypes').TerminalStatusErrorEvent) => void) => () => void
}

interface Window {
  ipcRenderer: import('electron').IpcRenderer
  settingsAPI: SettingsAPI
  menuAPI: MenuAPI
  shellAPI: ShellAPI
  dialogAPI: DialogAPI
  serialAPI: SerialAPI
  terminalAPI: TerminalAPI
  terminalFilesAPI: TerminalFilesAPI
  terminalStatusAPI: TerminalStatusAPI
}
