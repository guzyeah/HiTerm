/**
 * useLocale 钩子
 * 从LocaleContext中读取语言、方向、字体栈等状态
 */

import { useContext } from 'react'
import { LocaleContext } from '@/contexts/LocaleContext'
import type { SupportedLocale, TextDirection, Platform } from '@/i18n/types'
import type { FontStack, FontOverride } from '@/i18n/fontConfig'
import type { LocalePreference } from '@/shared/preferencesTypes'

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

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used within a LocaleProvider')
  }
  return ctx
}
