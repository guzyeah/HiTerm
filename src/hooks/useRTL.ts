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