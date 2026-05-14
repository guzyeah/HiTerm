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
