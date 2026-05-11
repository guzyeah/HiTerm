import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getLocale, setLocale, getFontOverride, setFontOverride, getSystemInfo } from './settings'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {

  Menu.setApplicationMenu(null);

  win = new BrowserWindow({
    width: 1280,
    height: 860,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

function registerSettingsHandlers() {
  ipcMain.handle('settings:getLocale', () => getLocale())
  ipcMain.handle('settings:setLocale', (_event, locale: string) => setLocale(locale))
  ipcMain.handle('settings:getFontOverride', () => getFontOverride())
  ipcMain.handle('settings:setFontOverride', (_event, override: string | null) => setFontOverride(override))
  ipcMain.handle('settings:getSystemInfo', () => getSystemInfo())
}

app.whenReady().then(() => {
  registerSettingsHandlers()
  createWindow()
})