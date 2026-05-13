import { ipcRenderer, contextBridge } from 'electron'
import type {
  CreateLocalTerminalSessionRequest,
  CreateLocalTerminalSessionResult,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalResizeRequest,
  TerminalSessionRequest,
  TerminalWriteRequest,
} from '../src/shared/terminalTypes'
import type {
  TerminalStatusErrorEvent,
  TerminalStatusSampleEvent,
  TerminalStatusSubscribeRequest,
} from '../src/shared/terminalStatusTypes'

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
  getSystemInfo: () => ipcRenderer.invoke('settings:getSystemInfo'),
})

// --------- Expose Menu API to the Renderer process ---------
contextBridge.exposeInMainWorld('menuAPI', {
  updateLabels: (labels: Record<string, string>) => ipcRenderer.send('menu:updateLabels', labels),
})

// --------- Expose Shell API to the Renderer process ---------
contextBridge.exposeInMainWorld('shellAPI', {
  saveShell: (record: unknown) => ipcRenderer.invoke('shell:save', record),
  listGroups: () => ipcRenderer.invoke('shell:listGroups'),
  listShellSummaries: () => ipcRenderer.invoke('shell:listSummaries'),
})

// --------- Expose Dialog API to the Renderer process ---------
contextBridge.exposeInMainWorld('dialogAPI', {
  openFile: (options?: { title?: string; filters?: Electron.FileFilter[] }) =>
    ipcRenderer.invoke('dialog:openFile', options),
})

// --------- Expose Serial API to the Renderer process ---------
contextBridge.exposeInMainWorld('serialAPI', {
  listSerialPorts: () => ipcRenderer.invoke('serial:listPorts'),
})

// --------- Expose Terminal API to the Renderer process ---------
contextBridge.exposeInMainWorld('terminalAPI', {
  createLocalSession: (request: CreateLocalTerminalSessionRequest): Promise<CreateLocalTerminalSessionResult> =>
    ipcRenderer.invoke('terminal:createLocalSession', request),
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
