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
