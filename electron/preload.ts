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
import electron from 'electron'
import type {
  CreateTerminalSessionRequest,
  CreateTerminalSessionResult,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalResizeRequest,
  TerminalSessionRequest,
  TerminalWriteRequest,
} from '../src/shared/terminalTypes'
import type {
  TerminalFilesCreateDirectoryRequest,
  TerminalFilesCreateEntryResult,
  TerminalFilesCreateFileRequest,
  TerminalFilesDeleteEntriesRequest,
  TerminalFilesDeleteEntriesResult,
  TerminalFilesDirectoryEvent,
  TerminalFilesDownloadRequest,
  TerminalFilesErrorEvent,
  TerminalFilesReadDirectoryRequest,
  TerminalFilesSessionRequest,
  TerminalFilesSetRootPathRequest,
  TerminalFilesSnapshotEvent,
  TerminalFilesTransferStateEvent,
  TerminalFilesUploadRequest,
} from '../src/shared/terminalFilesTypes'
import type {
  TerminalStatusErrorEvent,
  TerminalStatusSampleEvent,
  TerminalStatusSubscribeRequest,
} from '../src/shared/terminalStatusTypes'
import type {
  TerminalHistoryDeleteRequest,
  TerminalHistoryDeleteResult,
  TerminalHistoryListRequest,
  TerminalHistoryListResult,
  TerminalHistoryRecordEvent,
  TerminalHistoryDeletedEvent,
} from '../src/shared/terminalHistoryTypes'
import type { OpenPathsDialogOptions } from '../src/shared/dialogTypes'

const { ipcRenderer, contextBridge, webUtils } = electron

// --------- Expose IPC API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

// --------- Expose Settings API to the Renderer process ---------
contextBridge.exposeInMainWorld('settingsAPI', {
  getLocale: () => ipcRenderer.invoke('settings:getLocale'),
  setLocale: (locale: string) => ipcRenderer.invoke('settings:setLocale', locale),
  getFontOverride: () => ipcRenderer.invoke('settings:getFontOverride'),
  setFontOverride: (override: string | null) => ipcRenderer.invoke('settings:setFontOverride', override),
  getDefaultLocalShellId: () => ipcRenderer.invoke('settings:getDefaultLocalShellId'),
  setDefaultLocalShellId: (shellId: string | null) => ipcRenderer.invoke('settings:setDefaultLocalShellId', shellId),
  getAppThemePreference: () => ipcRenderer.invoke('settings:getAppThemePreference'),
  setAppThemePreference: (preference: string) => ipcRenderer.invoke('settings:setAppThemePreference', preference),
  getTerminalFontFamily: () => ipcRenderer.invoke('settings:getTerminalFontFamily'),
  setTerminalFontFamily: (fontFamily: string) => ipcRenderer.invoke('settings:setTerminalFontFamily', fontFamily),
  getTerminalFontSize: () => ipcRenderer.invoke('settings:getTerminalFontSize'),
  setTerminalFontSize: (fontSize: number) => ipcRenderer.invoke('settings:setTerminalFontSize', fontSize),
  getTerminalFontLigatures: () => ipcRenderer.invoke('settings:getTerminalFontLigatures'),
  setTerminalFontLigatures: (enabled: boolean) => ipcRenderer.invoke('settings:setTerminalFontLigatures', enabled),
  getTerminalThemeId: () => ipcRenderer.invoke('settings:getTerminalThemeId'),
  setTerminalThemeId: (themeId: string) => ipcRenderer.invoke('settings:setTerminalThemeId', themeId),
  getSystemInfo: () => ipcRenderer.invoke('settings:getSystemInfo'),
})

// --------- Expose Window API to the Renderer process ---------
contextBridge.exposeInMainWorld('windowAPI', {
  setFullscreen: (fullscreen: boolean): Promise<void> =>
    ipcRenderer.invoke('window:setFullscreen', fullscreen),
  isFullscreen: (): Promise<boolean> =>
    ipcRenderer.invoke('window:isFullscreen'),
  onFullscreenChange: (callback: (fullscreen: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, fullscreen: boolean) => callback(fullscreen)
    ipcRenderer.on('window:fullscreenChanged', listener)
    return () => ipcRenderer.off('window:fullscreenChanged', listener)
  },
})

// --------- Expose System API to the Renderer process ---------
contextBridge.exposeInMainWorld('systemAPI', {
  openExternalUrl: (url: string): Promise<void> =>
    ipcRenderer.invoke('system:openExternalUrl', url),
})

// --------- Expose Menu API to the Renderer process ---------
contextBridge.exposeInMainWorld('menuAPI', {
  updateLabels: (labels: Record<string, string>) => ipcRenderer.send('menu:updateLabels', labels),
})

// --------- Expose Shell API to the Renderer process ---------
contextBridge.exposeInMainWorld('shellAPI', {
  saveShell: (record: unknown) => ipcRenderer.invoke('shell:save', record),
  deleteShell: (shellId: string): Promise<boolean> => ipcRenderer.invoke('shell:delete', shellId),
  deleteGroup: (groupName: string): Promise<boolean> => ipcRenderer.invoke('shell:deleteGroup', groupName),
  listGroups: () => ipcRenderer.invoke('shell:listGroups'),
  listShellSummaries: () => ipcRenderer.invoke('shell:listSummaries'),
  getStartupLocalShell: (preferredShellId?: string | null) =>
    ipcRenderer.invoke('shell:getStartupLocalShell', preferredShellId),
})

// --------- Expose Dialog API to the Renderer process ---------
contextBridge.exposeInMainWorld('dialogAPI', {
  openFile: (options?: { title?: string; filters?: Electron.FileFilter[] }) =>
    ipcRenderer.invoke('dialog:openFile', options),
  openPaths: (options?: OpenPathsDialogOptions): Promise<string[]> =>
    ipcRenderer.invoke('dialog:openPaths', options),
  getPathsForFiles: (files: File[]): string[] =>
    files.map(file => webUtils.getPathForFile(file)).filter(Boolean),
})

// --------- Expose Clipboard API to the Renderer process ---------
contextBridge.exposeInMainWorld('clipboardAPI', {
  readText: (): Promise<string> => ipcRenderer.invoke('clipboard:readText'),
  writeText: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:writeText', text),
})

// --------- Expose Serial API to the Renderer process ---------
contextBridge.exposeInMainWorld('serialAPI', {
  listSerialPorts: () => ipcRenderer.invoke('serial:listPorts'),
})

// --------- Expose Terminal API to the Renderer process ---------
contextBridge.exposeInMainWorld('terminalAPI', {
  createSession: (request: CreateTerminalSessionRequest): Promise<CreateTerminalSessionResult> =>
    ipcRenderer.invoke('terminal:createSession', request),
  write: (request: TerminalWriteRequest): Promise<void> =>
    ipcRenderer.invoke('terminal:write', request),
  resize: (request: TerminalResizeRequest): Promise<void> =>
    ipcRenderer.invoke('terminal:resize', request),
  dispose: (request: TerminalSessionRequest): Promise<void> =>
    ipcRenderer.invoke('terminal:dispose', request),
  onData: (callback: (event: TerminalDataEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalDataEvent) => callback(payload)
    ipcRenderer.on('terminal:data', listener)
    return () => ipcRenderer.off('terminal:data', listener)
  },
  onExit: (callback: (event: TerminalExitEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalExitEvent) => callback(payload)
    ipcRenderer.on('terminal:exit', listener)
    return () => ipcRenderer.off('terminal:exit', listener)
  },
})

// --------- Expose Terminal Files API to the Renderer process ---------
contextBridge.exposeInMainWorld('terminalFilesAPI', {
  subscribe: (request: TerminalFilesSessionRequest): Promise<void> =>
    ipcRenderer.invoke('terminalFiles:subscribe', request),
  unsubscribe: (request: TerminalFilesSessionRequest): Promise<void> =>
    ipcRenderer.invoke('terminalFiles:unsubscribe', request),
  refresh: (request: TerminalFilesSessionRequest): Promise<void> =>
    ipcRenderer.invoke('terminalFiles:refresh', request),
  goHome: (request: TerminalFilesSessionRequest): Promise<void> =>
    ipcRenderer.invoke('terminalFiles:goHome', request),
  readDirectory: (request: TerminalFilesReadDirectoryRequest): Promise<void> =>
    ipcRenderer.invoke('terminalFiles:readDirectory', request),
  setRootPath: (request: TerminalFilesSetRootPathRequest): Promise<void> =>
    ipcRenderer.invoke('terminalFiles:setRootPath', request),
  createFile: (request: TerminalFilesCreateFileRequest): Promise<TerminalFilesCreateEntryResult> =>
    ipcRenderer.invoke('terminalFiles:createFile', request),
  createDirectory: (request: TerminalFilesCreateDirectoryRequest): Promise<TerminalFilesCreateEntryResult> =>
    ipcRenderer.invoke('terminalFiles:createDirectory', request),
  deleteEntries: (request: TerminalFilesDeleteEntriesRequest): Promise<TerminalFilesDeleteEntriesResult> =>
    ipcRenderer.invoke('terminalFiles:deleteEntries', request),
  upload: (request: TerminalFilesUploadRequest): Promise<void> =>
    ipcRenderer.invoke('terminalFiles:upload', request),
  download: (request: TerminalFilesDownloadRequest): Promise<void> =>
    ipcRenderer.invoke('terminalFiles:download', request),
  onSnapshot: (callback: (event: TerminalFilesSnapshotEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalFilesSnapshotEvent) => callback(payload)
    ipcRenderer.on('terminalFiles:snapshot', listener)
    return () => ipcRenderer.off('terminalFiles:snapshot', listener)
  },
  onDirectory: (callback: (event: TerminalFilesDirectoryEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalFilesDirectoryEvent) => callback(payload)
    ipcRenderer.on('terminalFiles:directory', listener)
    return () => ipcRenderer.off('terminalFiles:directory', listener)
  },
  onError: (callback: (event: TerminalFilesErrorEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalFilesErrorEvent) => callback(payload)
    ipcRenderer.on('terminalFiles:error', listener)
    return () => ipcRenderer.off('terminalFiles:error', listener)
  },
  onTransferState: (callback: (event: TerminalFilesTransferStateEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalFilesTransferStateEvent) => callback(payload)
    ipcRenderer.on('terminalFiles:transferState', listener)
    return () => ipcRenderer.off('terminalFiles:transferState', listener)
  },
})

// --------- Expose Terminal Status API to the Renderer process ---------
contextBridge.exposeInMainWorld('terminalStatusAPI', {
  subscribe: (request: TerminalStatusSubscribeRequest): Promise<void> =>
    ipcRenderer.invoke('terminalStatus:subscribe', request),
  unsubscribe: (request: TerminalStatusSubscribeRequest): Promise<void> =>
    ipcRenderer.invoke('terminalStatus:unsubscribe', request),
  onSample: (callback: (event: TerminalStatusSampleEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalStatusSampleEvent) => callback(payload)
    ipcRenderer.on('terminalStatus:sample', listener)
    return () => ipcRenderer.off('terminalStatus:sample', listener)
  },
  onError: (callback: (event: TerminalStatusErrorEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalStatusErrorEvent) => callback(payload)
    ipcRenderer.on('terminalStatus:error', listener)
    return () => ipcRenderer.off('terminalStatus:error', listener)
  },
})

// --------- Expose Terminal History API to the Renderer process ---------
contextBridge.exposeInMainWorld('terminalHistoryAPI', {
  list: (request?: TerminalHistoryListRequest): Promise<TerminalHistoryListResult> =>
    ipcRenderer.invoke('terminalHistory:list', request),
  deleteRecord: (request: TerminalHistoryDeleteRequest): Promise<TerminalHistoryDeleteResult> =>
    ipcRenderer.invoke('terminalHistory:delete', request),
  onRecorded: (callback: (event: TerminalHistoryRecordEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalHistoryRecordEvent) => callback(payload)
    ipcRenderer.on('terminalHistory:recorded', listener)
    return () => ipcRenderer.off('terminalHistory:recorded', listener)
  },
  onDeleted: (callback: (event: TerminalHistoryDeletedEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TerminalHistoryDeletedEvent) => callback(payload)
    ipcRenderer.on('terminalHistory:deleted', listener)
    return () => ipcRenderer.off('terminalHistory:deleted', listener)
  },
})
