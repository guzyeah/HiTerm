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
 * useRTL 钩子
 * 返回当前语言的方向信息
 */

import { useLocale } from '@/hooks/useLocale'
import type { TextDirection } from '@/i18n/types'

interface RTLResult {
  direction: TextDirection
  isRTL: boolean
}

export function useRTL(): RTLResult {
  const { direction } = useLocale()
  return { direction, isRTL: direction === 'rtl' }
}