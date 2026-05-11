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
}

interface DialogAPI {
  openFile: (options?: { title?: string; filters?: Electron.FileFilter[] }) => Promise<string | null>
}

interface SerialAPI {
  listSerialPorts: () => Promise<{ path: string; friendlyName?: string }[]>
}

interface Window {
  ipcRenderer: import('electron').IpcRenderer
  settingsAPI: SettingsAPI
  menuAPI: MenuAPI
  shellAPI: ShellAPI
  dialogAPI: DialogAPI
  serialAPI: SerialAPI
}
