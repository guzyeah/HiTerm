/**
 * i18n 类型定义
 * 定义支持的语言枚举、RTL语言集合、语言显示名称映射、字体配置类型
 */

/** 应用支持的11种语言 */
export type SupportedLocale =
  | 'en'
  | 'zh-CN'
  | 'zh-TW'
  | 'ja'
  | 'ko'
  | 'fr'
  | 'de'
  | 'it'
  | 'es'
  | 'ar'
  | 'vi'

/** 所有支持的语言列表 */
export const SUPPORTED_LOCALES: SupportedLocale[] = [
  'en',
  'zh-CN',
  'zh-TW',
  'ja',
  'ko',
  'fr',
  'de',
  'it',
  'es',
  'ar',
  'vi',
]

/** RTL（从右到左）语言集合 */
export const RTL_LOCALES: ReadonlySet<SupportedLocale> = new Set(['ar'])

/** 判断给定语言是否为RTL */
export function isRTL(locale: SupportedLocale): boolean {
  return RTL_LOCALES.has(locale)
}

/** 语言在各自locale下的原生显示名称 */
export const LOCALE_NATIVE_NAMES: Readonly<Record<SupportedLocale, string>> = {
  'en': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'ja': '日本語',
  'ko': '한국어',
  'fr': 'Français',
  'de': 'Deutsch',
  'it': 'Italiano',
  'es': 'Español',
  'ar': 'العربية',
  'vi': 'Tiếng Việt',
}

/** 语言在各locale下显示的英文名称 */
export const LOCALE_ENGLISH_NAMES: Readonly<Record<SupportedLocale, string>> = {
  'en': 'English',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'es': 'Spanish',
  'ar': 'Arabic',
  'vi': 'Vietnamese',
}

/** 操作系统平台类型 */
export type Platform = 'win32' | 'darwin' | 'linux'

/** 文字方向类型 */
export type TextDirection = 'ltr' | 'rtl'

/** 获取给定语言的方向 */
export function getTextDirection(locale: SupportedLocale): TextDirection {
  return isRTL(locale) ? 'rtl' : 'ltr'
}