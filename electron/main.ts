import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getLocale, setLocale, getFontOverride, setFontOverride, getSystemInfo } from './settings'
import { initNativeMenu, updateNativeMenu, type MenuLabels } from './menu'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  // macOS使用原生菜单栏，Win/Linux移除原生菜单使用自绘菜单
  if (process.platform === 'darwin') {
    initNativeMenu()
  } else {
    Menu.setApplicationMenu(null)
  }

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

function registerIpcHandlers() {
  ipcMain.handle('settings:getLocale', () => getLocale())
  ipcMain.handle('settings:setLocale', (_event, locale: string) => setLocale(locale))
  ipcMain.handle('settings:getFontOverride', () => getFontOverride())
  ipcMain.handle('settings:setFontOverride', (_event, override: string | null) => setFontOverride(override))
  ipcMain.handle('settings:getSystemInfo', () => getSystemInfo())

  // renderer发送i18n菜单标签到主进程，macOS上重建原生菜单
  ipcMain.on('menu:updateLabels', (_event, labels: MenuLabels) => {
    if (process.platform === 'darwin') {
      updateNativeMenu(labels)
    }
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})