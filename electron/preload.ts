import { ipcRenderer, contextBridge } from 'electron'

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