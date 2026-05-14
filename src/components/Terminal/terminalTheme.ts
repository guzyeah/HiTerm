import type { ITheme } from '@xterm/xterm'
import { DEFAULT_TERMINAL_FONT_FAMILY, DEFAULT_TERMINAL_THEME_ID } from '@/shared/preferencesTypes'
import { getTerminalThemeById } from './terminalThemes'

export const terminalTheme: ITheme = getTerminalThemeById(DEFAULT_TERMINAL_THEME_ID).theme

export const terminalFontFamily = DEFAULT_TERMINAL_FONT_FAMILY
