/**
 * LocaleContext
 * 统一管理语言、方向、字体栈的全局上下文
 * 切换locale时同步更新i18next、HTML属性、CSS变量、FluentProvider主题
 */

import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import i18n from '@/i18n'
import type { SupportedLocale, TextDirection, Platform } from '@/i18n/types'
import { getTextDirection, SUPPORTED_LOCALES } from '@/i18n/types'
import { detectSystemLocale, isValidLocale, mapOSLocaleToSupported } from '@/i18n/localeDetector'
import type { FontStack, FontOverride } from '@/i18n/fontConfig'
import { getEffectiveFontStack } from '@/i18n/fontConfig'
import { DEFAULT_LOCALE_PREFERENCE, type LocalePreference } from '@/shared/preferencesTypes'

/** 从i18next收集当前语言的所有菜单标签，用于发送到主进程更新macOS原生菜单 */
function collectMenuLabels(): Record<string, string> {
  const t = i18n.t
  return {
    menuShell: t('menu.shell'),
    menuShellConnect: t('menu.shell.connect'),
    menuShellManagement: t('menu.shell.management'),
    menuSettings: t('menu.settings'),
    menuSettingsPreferences: t('menu.settings.preferences'),
    menuHelp: t('menu.help'),
    menuHelpAbout: t('menu.help.about'),
    menuEdit: t('menu.edit'),
    menuEditUndo: t('menu.edit.undo'),
    menuEditRedo: t('menu.edit.redo'),
    menuEditCut: t('menu.edit.cut'),
    menuEditCopy: t('menu.edit.copy'),
    menuEditPaste: t('menu.edit.paste'),
    menuEditSelectAll: t('menu.edit.selectAll'),
    menuWindow: t('menu.window'),
    menuWindowMinimize: t('menu.window.minimize'),
    menuWindowClose: t('menu.window.close'),
  }
}

/** Locale上下文值 */
interface LocaleContextValue {
  currentLocale: SupportedLocale
  setCurrentLocale: (locale: SupportedLocale) => void
  localePreference: LocalePreference
  setLocalePreference: (preference: LocalePreference) => void
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

async function resolveSystemLocale(): Promise<SupportedLocale> {
  try {
    const systemInfo = await window.settingsAPI?.getSystemInfo()
    if (systemInfo?.locale) {
      return mapOSLocaleToSupported(systemInfo.locale)
    }
  } catch {
    // Renderer 无法访问主进程信息时回退到浏览器侧语言检测。
  }

  return detectSystemLocale()
}

/** LocaleProvider属性 */
interface LocaleProviderProps {
  children: ReactNode
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [currentLocale, setCurrentLocaleState] = useState<SupportedLocale>(
    () => (isValidLocale(i18n.language) ? i18n.language : 'en') as SupportedLocale,
  )
  const [localePreference, setLocalePreferenceState] = useState<LocalePreference>(DEFAULT_LOCALE_PREFERENCE)
  const [fontOverride, setFontOverrideState] = useState<FontOverride>(null)
  const [platform] = useState<Platform>(() => detectPlatform())

  const direction = getTextDirection(currentLocale)
  const fontStack = getEffectiveFontStack(currentLocale, platform, fontOverride)

  // 异步加载electron-store中存储的语言偏好
  useEffect(() => {
    async function loadStoredPreferences() {
      try {
        if (!window.settingsAPI) return
        const storedLocale = await window.settingsAPI.getLocale()
        if (storedLocale && isValidLocale(storedLocale)) {
          setLocalePreferenceState(storedLocale)
          setCurrentLocaleState(storedLocale as SupportedLocale)
          await i18n.changeLanguage(storedLocale)
          // 初始化后同步macOS原生菜单标签
          if (window.menuAPI) {
            window.menuAPI.updateLabels(collectMenuLabels())
          }
        } else {
          const systemLocale = await resolveSystemLocale()
          setLocalePreferenceState(DEFAULT_LOCALE_PREFERENCE)
          setCurrentLocaleState(systemLocale)
          await i18n.changeLanguage(systemLocale)
          if (window.menuAPI) {
            window.menuAPI.updateLabels(collectMenuLabels())
          }
        }
        const storedFontOverride = await window.settingsAPI.getFontOverride()
        if (storedFontOverride !== undefined) {
          setFontOverrideState(storedFontOverride as FontOverride)
        }
      } catch {
        // electron-store不可用时忽略，使用默认值
      }
    }
    loadStoredPreferences()
    // 无存储偏好时也同步macOS菜单标签（使用OS检测的默认语言）
    if (window.menuAPI) {
      window.menuAPI.updateLabels(collectMenuLabels())
    }
  }, [])

  // 切换语言时同步更新所有相关状态
  const setCurrentLocale = useCallback(async (locale: SupportedLocale) => {
    setLocalePreferenceState(locale)
    setCurrentLocaleState(locale)
    await i18n.changeLanguage(locale)

    // 更新HTML属性
    document.documentElement.lang = locale
    document.documentElement.dir = getTextDirection(locale)

    // 更新CSS字体变量
    document.documentElement.style.setProperty('--app-font-family', getEffectiveFontStack(locale, platform, fontOverride))

    // 持久化到electron-store
    try {
      await window.settingsAPI?.setLocale(locale)
    } catch {
      // 持久化失败时忽略
    }

    // 同步macOS原生菜单标签
    try {
      if (window.menuAPI) {
        window.menuAPI.updateLabels(collectMenuLabels())
      }
    } catch {
      // 主进程不可用时忽略
    }
  }, [platform, fontOverride])

  // 切换语言偏好；system 会重新解析当前系统语言。
  const setLocalePreference = useCallback(async (preference: LocalePreference) => {
    setLocalePreferenceState(preference)

    if (preference === 'system') {
      const systemLocale = await resolveSystemLocale()
      setCurrentLocaleState(systemLocale)
      await i18n.changeLanguage(systemLocale)
      document.documentElement.lang = systemLocale
      document.documentElement.dir = getTextDirection(systemLocale)
      document.documentElement.style.setProperty(
        '--app-font-family',
        getEffectiveFontStack(systemLocale, platform, fontOverride),
      )

      try {
        await window.settingsAPI?.setLocale('')
      } catch {
        // 持久化失败时忽略。
      }

      try {
        window.menuAPI?.updateLabels(collectMenuLabels())
      } catch {
        // 主进程不可用时忽略。
      }
      return
    }

    await setCurrentLocale(preference)
  }, [fontOverride, platform, setCurrentLocale])

  // 切换字体覆盖时同步更新CSS变量和持久化
  const setFontOverride = useCallback(async (override: FontOverride) => {
    setFontOverrideState(override)

    // 更新CSS字体变量
    const newStack = getEffectiveFontStack(currentLocale, platform, override)
    document.documentElement.style.setProperty('--app-font-family', newStack)

    // 持久化到electron-store
    try {
      await window.settingsAPI?.setFontOverride(override)
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
    localePreference,
    setLocalePreference,
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
