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
import type { ITheme } from '@xterm/xterm'
import { DEFAULT_TERMINAL_FONT_FAMILY, DEFAULT_TERMINAL_THEME_ID } from '@/shared/preferencesTypes'
import { getTerminalThemeById } from './terminalThemes'

export const terminalTheme: ITheme = getTerminalThemeById(DEFAULT_TERMINAL_THEME_ID).theme

export const terminalFontFamily = DEFAULT_TERMINAL_FONT_FAMILY
