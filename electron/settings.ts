/**
 * Electron端设置持久化模块
 * 使用electron-store存储用户语言和字体偏好
 */

import ElectronStore from 'electron-store'
import { app } from 'electron'

interface SettingsSchema {
  locale: string
  fontOverride: string | null
}

const store = new ElectronStore<SettingsSchema>({
  defaults: {
    locale: '',
    fontOverride: null,
  },
})

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

/** 获取系统信息：OS locale + platform */
export function getSystemInfo(): { locale: string; platform: string } {
  return {
    locale: app.getLocale(),
    platform: process.platform,
  }
}