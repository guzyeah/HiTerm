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
 * useFontConfig 钩子
 * 返回当前生效的字体栈和字体覆盖状态
 * 便于组件按需获取字体信息
 */

import { useLocale } from '@/hooks/useLocale'
import type { FontStack, FontOverride } from '@/i18n/fontConfig'

interface FontConfigResult {
  fontStack: FontStack
  fontOverride: FontOverride
  setFontOverride: (override: FontOverride) => void
}

export function useFontConfig(): FontConfigResult {
  const { fontStack, fontOverride, setFontOverride } = useLocale()
  return { fontStack, fontOverride, setFontOverride }
}