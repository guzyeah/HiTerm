/**
 * 渲染字体运行时检测工具
 * 使用canvas文本测量法检测当前--app-font-family中实际渲染的字体
 * 原理：在canvas上分别用候选字体+兜底字体测量同一测试字符串宽度，
 * 第一个宽度与兜底字体宽度不同的候选字体即为实际渲染字体
 */

/** 用于区分字体的测试字符串，包含窄字和宽字混合 */
const TEST_STRING = 'mmmmmmmmmmlliWMMMMW'

/** 兜底字体，几乎所有系统都可用 */
const FALLBACK_FONT = 'monospace'

/** 从CSS font-family字符串中解析出候选字体名列表 */
function parseFontStack(fontStack: string): string[] {
  return fontStack
    .split(',')
    .map(f => f.trim().replace(/^"|"$/g, ''))
    .filter(f => f !== 'sans-serif' && f !== 'serif' && f !== FALLBACK_FONT && f !== 'monospace')
}

/** 在canvas上测量指定字体下测试字符串的宽度 */
function measureTextWidth(fontFamily: string): number {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = `14px ${fontFamily}, ${FALLBACK_FONT}`
  return ctx.measureText(TEST_STRING).width
}

/**
 * 检测当前--app-font-family CSS变量中实际渲染的字体
 * 逐一遍历字体栈中的候选字体，第一个宽度与兜底字体不同的即为实际渲染字体
 * 若所有候选字体宽度均与兜底一致，返回兜底字体名
 */
export function detectActualRenderedFont(): string {
  const fontStack = getComputedStyle(document.documentElement).getPropertyValue('--app-font-family').trim()
  if (!fontStack) return FALLBACK_FONT

  const candidates = parseFontStack(fontStack)
  const fallbackWidth = measureTextWidth(FALLBACK_FONT)

  for (const candidate of candidates) {
    const width = measureTextWidth(candidate)
    if (width !== fallbackWidth && width > 0) {
      return candidate
    }
  }

  return FALLBACK_FONT
}