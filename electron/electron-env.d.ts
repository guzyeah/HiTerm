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
  getDefaultLocalShellId: () => Promise<string | null>
  setDefaultLocalShellId: (shellId: string | null) => Promise<void>
  getAppThemePreference: () => Promise<import('../src/shared/preferencesTypes').AppThemePreference>
  setAppThemePreference: (preference: import('../src/shared/preferencesTypes').AppThemePreference) => Promise<void>
  getTerminalFontFamily: () => Promise<string>
  setTerminalFontFamily: (fontFamily: string) => Promise<void>
  getTerminalFontSize: () => Promise<number>
  setTerminalFontSize: (fontSize: number) => Promise<void>
  getTerminalFontLigatures: () => Promise<boolean>
  setTerminalFontLigatures: (enabled: boolean) => Promise<void>
  getTerminalThemeId: () => Promise<string>
  setTerminalThemeId: (themeId: string) => Promise<void>
  getSystemInfo: () => Promise<{ locale: string; platform: string }>
}

interface MenuAPI {
  updateLabels: (labels: Record<string, string>) => void
}

interface WindowAPI {
  setFullscreen: (fullscreen: boolean) => Promise<void>
  isFullscreen: () => Promise<boolean>
  onFullscreenChange: (callback: (fullscreen: boolean) => void) => () => void
}

interface SystemAPI {
  openExternalUrl: (url: string) => Promise<void>
}

interface ShellAPI {
  saveShell: (record: unknown) => Promise<unknown>
  deleteShell: (shellId: string) => Promise<boolean>
  deleteGroup: (groupName: string) => Promise<boolean>
  listGroups: () => Promise<string[]>
  listShellSummaries: () => Promise<import('../src/shared/shellTypes').ShellSummary[]>
  getStartupLocalShell: (preferredShellId?: string | null) => Promise<import('../src/shared/shellTypes').ShellSummary | null>
}

interface DialogAPI {
  openFile: (options?: { title?: string; filters?: Electron.FileFilter[] }) => Promise<string | null>
  openPaths: (options?: import('../src/shared/dialogTypes').OpenPathsDialogOptions) => Promise<string[]>
  getPathsForFiles: (files: File[]) => string[]
}

interface ClipboardAPI {
  readText: () => Promise<string>
  writeText: (text: string) => Promise<void>
}

interface SerialAPI {
  listSerialPorts: () => Promise<{ path: string; friendlyName?: string }[]>
}

interface TerminalAPI {
  createSession: (
    request: import('../src/shared/terminalTypes').CreateTerminalSessionRequest
  ) => Promise<import('../src/shared/terminalTypes').CreateTerminalSessionResult>
  write: (request: import('../src/shared/terminalTypes').TerminalWriteRequest) => Promise<void>
  resize: (request: import('../src/shared/terminalTypes').TerminalResizeRequest) => Promise<void>
  dispose: (request: import('../src/shared/terminalTypes').TerminalSessionRequest) => Promise<void>
  onData: (callback: (event: import('../src/shared/terminalTypes').TerminalDataEvent) => void) => () => void
  onExit: (callback: (event: import('../src/shared/terminalTypes').TerminalExitEvent) => void) => () => void
}

interface VncAPI {
  createSession: (
    request: import('../src/shared/vncTypes').VncCreateSessionRequest
  ) => Promise<import('../src/shared/vncTypes').VncCreateSessionResult>
  pointerEvent: (request: import('../src/shared/vncTypes').VncPointerEventRequest) => Promise<void>
  keyEvent: (request: import('../src/shared/vncTypes').VncKeyEventRequest) => Promise<void>
  clientCutText: (request: import('../src/shared/vncTypes').VncClientCutTextRequest) => Promise<void>
  dispose: (request: import('../src/shared/vncTypes').VncSessionRequest) => Promise<void>
  onFramebufferUpdate: (callback: (event: import('../src/shared/vncTypes').VncFramebufferUpdateEvent) => void) => () => void
  onDesktopSize: (callback: (event: import('../src/shared/vncTypes').VncDesktopSizeEvent) => void) => () => void
  onClipboard: (callback: (event: import('../src/shared/vncTypes').VncClipboardEvent) => void) => () => void
  onBell: (callback: (event: import('../src/shared/vncTypes').VncBellEvent) => void) => () => void
  onDisconnected: (callback: (event: import('../src/shared/vncTypes').VncDisconnectedEvent) => void) => () => void
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

interface TerminalHistoryAPI {
  list: (request?: import('../src/shared/terminalHistoryTypes').TerminalHistoryListRequest) => Promise<import('../src/shared/terminalHistoryTypes').TerminalHistoryListResult>
  deleteRecord: (request: import('../src/shared/terminalHistoryTypes').TerminalHistoryDeleteRequest) => Promise<import('../src/shared/terminalHistoryTypes').TerminalHistoryDeleteResult>
  onRecorded: (callback: (event: import('../src/shared/terminalHistoryTypes').TerminalHistoryRecordEvent) => void) => () => void
  onDeleted: (callback: (event: import('../src/shared/terminalHistoryTypes').TerminalHistoryDeletedEvent) => void) => () => void
}

interface Window {
  ipcRenderer: import('electron').IpcRenderer
  settingsAPI: SettingsAPI
  windowAPI: WindowAPI
  systemAPI: SystemAPI
  menuAPI: MenuAPI
  shellAPI: ShellAPI
  dialogAPI: DialogAPI
  clipboardAPI: ClipboardAPI
  serialAPI: SerialAPI
  terminalAPI: TerminalAPI
  vncAPI: VncAPI
  terminalFilesAPI: TerminalFilesAPI
  terminalStatusAPI: TerminalStatusAPI
  terminalHistoryAPI: TerminalHistoryAPI
}
