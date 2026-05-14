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
import type { SupportedLocale } from '../i18n/types'

export type AppThemePreference = 'system' | 'light' | 'dark'
export type ResolvedAppTheme = 'light' | 'dark'
export type LocalePreference = 'system' | SupportedLocale

export interface TerminalPreferences {
  fontFamily: string
  fontSize: number
  fontLigatures: boolean
  themeId: string
  defaultLocalShellId: string | null
}

export const DEFAULT_APP_THEME_PREFERENCE: AppThemePreference = 'system'
export const DEFAULT_LOCALE_PREFERENCE: LocalePreference = 'system'
export const DEFAULT_TERMINAL_FONT_FAMILY = [
  '"Cascadia Mono"',
  '"Cascadia Code"',
  'Consolas',
  '"SFMono-Regular"',
  '"Liberation Mono"',
  'monospace',
].join(', ')
export const DEFAULT_TERMINAL_FONT_SIZE = 13
export const DEFAULT_TERMINAL_FONT_LIGATURES = false
export const DEFAULT_TERMINAL_THEME_ID = 'windows-console-dark'
