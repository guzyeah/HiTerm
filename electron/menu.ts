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
/**
 * macOS原生菜单构建与更新模块
 * 使用Electron Menu API构建原生菜单栏
 * 自定义菜单项通过IPC将点击事件发送到renderer
 * Edit/Window菜单使用Electron内置role，系统自动处理快捷键和本地化
 */

import { Menu, BrowserWindow } from 'electron'

/** 菜单标签字典：renderer通过IPC发送的i18n翻译文本 */
export interface MenuLabels {
  menuShell: string
  menuShellConnect: string
  menuShellManagement: string
  menuSettings: string
  menuSettingsPreferences: string
  menuHelp: string
  menuHelpAbout: string
  menuEdit: string
  menuEditUndo: string
  menuEditRedo: string
  menuEditCut: string
  menuEditCopy: string
  menuEditPaste: string
  menuEditSelectAll: string
  menuWindow: string
  menuWindowMinimize: string
  menuWindowClose: string
}

/** 默认英文标签，用于初始化（renderer尚未加载时） */
const DEFAULT_LABELS: MenuLabels = {
  menuShell: 'Shell',
  menuShellConnect: 'Connect Shell',
  menuShellManagement: 'Shell Management',
  menuSettings: 'Settings',
  menuSettingsPreferences: 'Preferences',
  menuHelp: 'Help',
  menuHelpAbout: 'About',
  menuEdit: 'Edit',
  menuEditUndo: 'Undo',
  menuEditRedo: 'Redo',
  menuEditCut: 'Cut',
  menuEditCopy: 'Copy',
  menuEditPaste: 'Paste',
  menuEditSelectAll: 'Select All',
  menuWindow: 'Window',
  menuWindowMinimize: 'Minimize',
  menuWindowClose: 'Close',
}

/** 菜单项点击时发送到renderer的标识 */
type MenuItemId = 'shell.connect' | 'shell.management' | 'settings.preferences' | 'help.about'

/** 向renderer发送菜单点击事件 */
function sendMenuClickToRenderer(itemId: MenuItemId) {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send('menu:click', itemId)
  }
}

/**
 * 根据i18n标签构建macOS原生菜单
 * 菜单结构：Shell → Edit → 设置 → Window → 帮助
 */
export function buildNativeMenu(labels: MenuLabels): Electron.Menu {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: labels.menuShell,
      submenu: [
        {
          label: labels.menuShellConnect,
          click: () => sendMenuClickToRenderer('shell.connect'),
        },
        {
          label: labels.menuShellManagement,
          click: () => sendMenuClickToRenderer('shell.management'),
        },
      ],
    },
    {
      label: labels.menuEdit,
      submenu: [
        { role: 'undo', label: labels.menuEditUndo },
        { role: 'redo', label: labels.menuEditRedo },
        { type: 'separator' },
        { role: 'cut', label: labels.menuEditCut },
        { role: 'copy', label: labels.menuEditCopy },
        { role: 'paste', label: labels.menuEditPaste },
        { role: 'selectAll', label: labels.menuEditSelectAll },
      ],
    },
    {
      label: labels.menuSettings,
      submenu: [
        {
          label: labels.menuSettingsPreferences,
          click: () => sendMenuClickToRenderer('settings.preferences'),
        },
      ],
    },
    {
      label: labels.menuWindow,
      submenu: [
        { role: 'minimize', label: labels.menuWindowMinimize },
        { role: 'close', label: labels.menuWindowClose },
      ],
    },
    {
      label: labels.menuHelp,
      submenu: [
        {
          label: labels.menuHelpAbout,
          click: () => sendMenuClickToRenderer('help.about'),
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}

/**
 * 初始化macOS原生菜单（使用默认英文标签）
 * renderer加载后会通过IPC发送i18n标签来更新菜单
 */
export function initNativeMenu(): void {
  const menu = buildNativeMenu(DEFAULT_LABELS)
  Menu.setApplicationMenu(menu)
}

/**
 * 根据renderer发送的i18n标签更新macOS原生菜单
 * 用于locale变更时同步更新菜单文本
 */
export function updateNativeMenu(labels: MenuLabels): void {
  const menu = buildNativeMenu(labels)
  Menu.setApplicationMenu(menu)
}
