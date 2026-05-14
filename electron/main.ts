import electron from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  getLocale,
  setLocale,
  getFontOverride,
  setFontOverride,
  getDefaultLocalShellId,
  setDefaultLocalShellId,
  getSystemInfo,
} from './settings'
import { initNativeMenu, updateNativeMenu, type MenuLabels } from './menu'
import {
  initializeShellStore,
  saveShell,
  listGroups,
  listShellSummaries,
  getStartupLocalShellSummary,
} from './shellStore'
import { registerTerminalFilesIpcHandlers } from './terminalFiles'
import { registerTerminalIpcHandlers } from './terminalSession'
import { registerTerminalStatusIpcHandlers } from './terminalStatus'
import { registerTerminalHistoryIpcHandlers } from './terminalHistory'
import { listSerialPorts } from './utils/serialPort'
import type { OpenPathsDialogOptions } from '../src/shared/dialogTypes'

const { app, BrowserWindow, ipcMain, Menu, dialog } = electron

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: Electron.BrowserWindow | null

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
  ipcMain.handle('settings:getDefaultLocalShellId', () => getDefaultLocalShellId())
  ipcMain.handle('settings:setDefaultLocalShellId', (_event, shellId: string | null) => setDefaultLocalShellId(shellId))
  ipcMain.handle('settings:getSystemInfo', () => getSystemInfo())

  // renderer发送i18n菜单标签到主进程，macOS上重建原生菜单
  ipcMain.on('menu:updateLabels', (_event, labels: MenuLabels) => {
    if (process.platform === 'darwin') {
      updateNativeMenu(labels)
    }
  })

  // Shell 连接记录保存
  ipcMain.handle('shell:save', (_event, record) => {
    return saveShell(record)
  })

  // Shell 分组列表
  ipcMain.handle('shell:listGroups', () => {
    return listGroups()
  })

  // Shell 列表摘要
  ipcMain.handle('shell:listSummaries', () => {
    return listShellSummaries()
  })

  ipcMain.handle('shell:getStartupLocalShell', (_event, preferredShellId?: string | null) => {
    return getStartupLocalShellSummary(preferredShellId)
  })

  // 系统文件选择对话框
  ipcMain.handle('dialog:openFile', async (_event, options) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: options?.title,
      filters: options?.filters,
      properties: ['openFile'],
    })
    return result.filePaths[0] ?? null
  })

  ipcMain.handle('dialog:openPaths', async (_event, options?: OpenPathsDialogOptions) => {
    const win = BrowserWindow.getFocusedWindow()
    const properties: Array<'openFile' | 'openDirectory' | 'multiSelections'> = []

    if (options?.allowFiles) {
      properties.push('openFile')
    }
    if (options?.allowDirectories) {
      properties.push('openDirectory')
    }
    if (options?.multiSelections) {
      properties.push('multiSelections')
    }
    if (properties.length === 0) {
      properties.push('openFile')
    }

    const result = await dialog.showOpenDialog(win!, {
      title: options?.title,
      filters: options?.filters,
      properties,
    })

    return result.filePaths
  })

  // 串口枚举
  ipcMain.handle('serial:listPorts', async () => {
    return listSerialPorts()
  })

  registerTerminalIpcHandlers()
  registerTerminalFilesIpcHandlers()
  registerTerminalStatusIpcHandlers()
  registerTerminalHistoryIpcHandlers()
}

app.whenReady().then(() => {
  initializeShellStore()
  registerIpcHandlers()
  createWindow()
})
