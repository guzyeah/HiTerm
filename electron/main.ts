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
import { app, BrowserWindow, ipcMain, Menu, dialog, clipboard } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  getLocale,
  setLocale,
  getFontOverride,
  setFontOverride,
  getDefaultLocalShellId,
  setDefaultLocalShellId,
  getAppThemePreference,
  setAppThemePreference,
  getTerminalFontFamily,
  setTerminalFontFamily,
  getTerminalFontSize,
  setTerminalFontSize,
  getTerminalFontLigatures,
  setTerminalFontLigatures,
  getTerminalThemeId,
  setTerminalThemeId,
  getSystemInfo,
} from './settings'
import { initNativeMenu, updateNativeMenu, type MenuLabels } from './menu'
import {
  initializeShellStore,
  saveShell,
  deleteShell,
  deleteGroup,
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
    icon: path.join(process.env.VITE_PUBLIC, 'icons', process.platform === 'win32' ? 'icon.ico' : process.platform === 'darwin' ? 'icon.icns' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.on('enter-full-screen', () => {
    win?.webContents.send('window:fullscreenChanged', true)
  })

  win.on('leave-full-screen', () => {
    win?.webContents.send('window:fullscreenChanged', false)
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
  ipcMain.handle('settings:getAppThemePreference', () => getAppThemePreference())
  ipcMain.handle('settings:setAppThemePreference', (_event, preference) => setAppThemePreference(preference))
  ipcMain.handle('settings:getTerminalFontFamily', () => getTerminalFontFamily())
  ipcMain.handle('settings:setTerminalFontFamily', (_event, fontFamily: string) => setTerminalFontFamily(fontFamily))
  ipcMain.handle('settings:getTerminalFontSize', () => getTerminalFontSize())
  ipcMain.handle('settings:setTerminalFontSize', (_event, fontSize: number) => setTerminalFontSize(fontSize))
  ipcMain.handle('settings:getTerminalFontLigatures', () => getTerminalFontLigatures())
  ipcMain.handle('settings:setTerminalFontLigatures', (_event, enabled: boolean) => setTerminalFontLigatures(enabled))
  ipcMain.handle('settings:getTerminalThemeId', () => getTerminalThemeId())
  ipcMain.handle('settings:setTerminalThemeId', (_event, themeId: string) => setTerminalThemeId(themeId))
  ipcMain.handle('settings:getSystemInfo', () => getSystemInfo())

  ipcMain.handle('window:setFullscreen', (_event, fullscreen: boolean) => {
    const targetWindow = BrowserWindow.getFocusedWindow() ?? win
    targetWindow?.setFullScreen(fullscreen)
  })

  ipcMain.handle('window:isFullscreen', () => {
    const targetWindow = BrowserWindow.getFocusedWindow() ?? win
    return targetWindow?.isFullScreen() ?? false
  })

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

  // Shell 连接记录删除
  ipcMain.handle('shell:delete', (_event, shellId: string) => {
    return deleteShell(shellId)
  })

  // Shell 分组列表
  // Shell 分组删除，仅允许删除无连接的非预置分组
  ipcMain.handle('shell:deleteGroup', (_event, groupName: string) => {
    return deleteGroup(groupName)
  })

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

  ipcMain.handle('clipboard:readText', () => clipboard.readText())
  ipcMain.handle('clipboard:writeText', (_event, text: string) => {
    clipboard.writeText(text)
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
