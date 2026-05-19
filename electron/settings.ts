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
 * Electron端设置持久化模块
 * 使用electron-store存储用户语言和字体偏好
 */

import ElectronStore from 'electron-store'
import { app } from 'electron'
import {
  DEFAULT_APP_THEME_PREFERENCE,
  DEFAULT_TERMINAL_FONT_FAMILY,
  DEFAULT_TERMINAL_FONT_LIGATURES,
  DEFAULT_TERMINAL_FONT_SIZE,
  DEFAULT_TERMINAL_THEME_ID,
  type AppThemePreference,
} from '../src/shared/preferencesTypes'

interface SettingsSchema {
  locale: string
  fontOverride: string | null
  defaultLocalShellId: string | null
  appThemePreference: AppThemePreference
  terminalFontFamily: string
  terminalFontSize: number
  terminalFontLigatures: boolean
  terminalThemeId: string
}

const store = new ElectronStore<SettingsSchema>({
  cwd: app.getPath('userData'),
  defaults: {
    locale: '',
    fontOverride: null,
    defaultLocalShellId: null,
    appThemePreference: DEFAULT_APP_THEME_PREFERENCE,
    terminalFontFamily: DEFAULT_TERMINAL_FONT_FAMILY,
    terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE,
    terminalFontLigatures: DEFAULT_TERMINAL_FONT_LIGATURES,
    terminalThemeId: DEFAULT_TERMINAL_THEME_ID,
  },
})

function isAppThemePreference(value: string): value is AppThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** 获取存储的语言偏好，空字符串表示未设置 */
export function getLocale(): string {
  return store.get('locale', '')
}

/** 设置语言偏好 */
export function setLocale(locale: string): void {
  store.set('locale', locale)
}

/** 获取存储的字体覆盖偏好 */
export function getFontOverride(): string | null {
  return store.get('fontOverride', null)
}

/** 设置字体覆盖偏好 */
export function setFontOverride(override: string | null): void {
  store.set('fontOverride', override)
}

/** 获取存储的默认本地 Shell 标识，null 表示跟随系统优先级自动选择 */
export function getDefaultLocalShellId(): string | null {
  return store.get('defaultLocalShellId', null)
}

/** 设置默认本地 Shell 标识，null 表示清除覆盖并回退到系统优先级 */
export function setDefaultLocalShellId(shellId: string | null): void {
  store.set('defaultLocalShellId', shellId)
}

/** 获取应用主题偏好，system 表示跟随系统 */
export function getAppThemePreference(): AppThemePreference {
  const value = store.get('appThemePreference', DEFAULT_APP_THEME_PREFERENCE)
  return isAppThemePreference(value) ? value : DEFAULT_APP_THEME_PREFERENCE
}

/** 设置应用主题偏好 */
export function setAppThemePreference(preference: AppThemePreference): void {
  store.set('appThemePreference', isAppThemePreference(preference) ? preference : DEFAULT_APP_THEME_PREFERENCE)
}

/** 获取终端字体 */
export function getTerminalFontFamily(): string {
  return store.get('terminalFontFamily', DEFAULT_TERMINAL_FONT_FAMILY)
}

/** 设置终端字体 */
export function setTerminalFontFamily(fontFamily: string): void {
  store.set('terminalFontFamily', fontFamily.trim() || DEFAULT_TERMINAL_FONT_FAMILY)
}

/** 获取终端字体大小 */
export function getTerminalFontSize(): number {
  const value = store.get('terminalFontSize', DEFAULT_TERMINAL_FONT_SIZE)
  return Number.isFinite(value) ? value : DEFAULT_TERMINAL_FONT_SIZE
}

/** 设置终端字体大小 */
export function setTerminalFontSize(fontSize: number): void {
  const nextFontSize = Math.min(32, Math.max(8, Math.round(fontSize)))
  store.set('terminalFontSize', nextFontSize)
}

/** 获取终端连字开关 */
export function getTerminalFontLigatures(): boolean {
  return store.get('terminalFontLigatures', DEFAULT_TERMINAL_FONT_LIGATURES)
}

/** 设置终端连字开关 */
export function setTerminalFontLigatures(enabled: boolean): void {
  store.set('terminalFontLigatures', enabled)
}

/** 获取终端主题标识 */
export function getTerminalThemeId(): string {
  return store.get('terminalThemeId', DEFAULT_TERMINAL_THEME_ID)
}

/** 设置终端主题标识 */
export function setTerminalThemeId(themeId: string): void {
  store.set('terminalThemeId', themeId.trim() || DEFAULT_TERMINAL_THEME_ID)
}

/** 获取系统信息：OS locale + platform */
export function getSystemInfo(): { locale: string; platform: string } {
  return {
    locale: app.getLocale(),
    platform: process.platform,
  }
}
