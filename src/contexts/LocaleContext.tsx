/**
 * LocaleContext
 * 统一管理语言、方向、字体栈的全局上下文
 * 切换locale时同步更新i18next、HTML属性、CSS变量、FluentProvider主题
 */

import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import i18n from '@/i18n'
import type { SupportedLocale, TextDirection, Platform } from '@/i18n/types'
import { getTextDirection, SUPPORTED_LOCALES } from '@/i18n/types'
import { isValidLocale } from '@/i18n/localeDetector'
import type { FontStack, FontOverride } from '@/i18n/fontConfig'
import { getEffectiveFontStack } from '@/i18n/fontConfig'

/** Locale上下文值 */
interface LocaleContextValue {
  currentLocale: SupportedLocale
  setCurrentLocale: (locale: SupportedLocale) => void
  direction: TextDirection
  fontStack: FontStack
  fontOverride: FontOverride
  setFontOverride: (override: FontOverride) => void
  platform: Platform
  supportedLocales: SupportedLocale[]
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export { LocaleContext }

/** 检测操作系统平台 */
function detectPlatform(): Platform {
  // Electron renderer中通过userAgent推断平台
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'win32'
  if (ua.includes('mac')) return 'darwin'
  if (ua.includes('linux') || ua.includes('unix')) return 'linux'
  // 无法检测时默认win32（最常见桌面平台）
  return 'win32'
}

/** LocaleProvider属性 */
interface LocaleProviderProps {
  children: ReactNode
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [currentLocale, setCurrentLocaleState] = useState<SupportedLocale>(
    () => (isValidLocale(i18n.language) ? i18n.language : 'en') as SupportedLocale,
  )
  const [fontOverride, setFontOverrideState] = useState<FontOverride>(null)
  const [platform] = useState<Platform>(() => detectPlatform())

  const direction = getTextDirection(currentLocale)
  const fontStack = getEffectiveFontStack(currentLocale, platform, fontOverride)

  // 异步加载electron-store中存储的语言偏好
  useEffect(() => {
    async function loadStoredPreferences() {
      try {
        if (!window.ipcRenderer) return
        const storedLocale = await window.ipcRenderer.invoke('settings:getLocale')
        if (storedLocale && isValidLocale(storedLocale)) {
          setCurrentLocaleState(storedLocale as SupportedLocale)
          i18n.changeLanguage(storedLocale)
        }
        const storedFontOverride = await window.ipcRenderer.invoke('settings:getFontOverride')
        if (storedFontOverride !== undefined) {
          setFontOverrideState(storedFontOverride as FontOverride)
        }
      } catch {
        // electron-store不可用时忽略，使用默认值
      }
    }
    loadStoredPreferences()
  }, [])

  // 切换语言时同步更新所有相关状态
  const setCurrentLocale = useCallback(async (locale: SupportedLocale) => {
    setCurrentLocaleState(locale)
    await i18n.changeLanguage(locale)

    // 更新HTML属性
    document.documentElement.lang = locale
    document.documentElement.dir = getTextDirection(locale)

    // 更新CSS字体变量
    document.documentElement.style.setProperty('--app-font-family', getEffectiveFontStack(locale, platform, fontOverride))

    // 持久化到electron-store
    try {
      if (window.ipcRenderer) {
        await window.ipcRenderer.invoke('settings:setLocale', locale)
      }
    } catch {
      // 持久化失败时忽略
    }
  }, [platform, fontOverride])

  // 切换字体覆盖时同步更新CSS变量和持久化
  const setFontOverride = useCallback(async (override: FontOverride) => {
    setFontOverrideState(override)

    // 更新CSS字体变量
    const newStack = getEffectiveFontStack(currentLocale, platform, override)
    document.documentElement.style.setProperty('--app-font-family', newStack)

    // 持久化到electron-store
    try {
      if (window.ipcRenderer) {
        await window.ipcRenderer.invoke('settings:setFontOverride', override)
      }
    } catch {
      // 持久化失败时忽略
    }
  }, [currentLocale, platform])

  // 初始化时设置HTML属性和CSS变量
  useEffect(() => {
    document.documentElement.lang = currentLocale
    document.documentElement.dir = direction
    document.documentElement.style.setProperty('--app-font-family', fontStack)
  }, [currentLocale, direction, fontStack])

  const value: LocaleContextValue = {
    currentLocale,
    setCurrentLocale,
    direction,
    fontStack,
    fontOverride,
    setFontOverride,
    platform,
    supportedLocales: SUPPORTED_LOCALES,
  }

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}