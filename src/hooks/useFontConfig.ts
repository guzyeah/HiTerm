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