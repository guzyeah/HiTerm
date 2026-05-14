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
 * 操作系统语言检测与映射
 * 将OS原始locale字符串映射到应用支持的SupportedLocale
 * 无法匹配时回退到英文
 */

import type { SupportedLocale } from './types'
import { SUPPORTED_LOCALES } from './types'

/** 默认回退语言 */
const DEFAULT_LOCALE: SupportedLocale = 'en'

/**
 * OS locale → SupportedLocale 映射表
 * 覆盖常见OS locale变体：
 * - Windows: zh-CN, en-US, ja-JP 等
 * - macOS: zh-Hans-CN, zh-Hant-TW, en-US 等
 * - Linux: zh_CN, C, POSIX 等
 */
const OS_LOCALE_MAP: ReadonlyMap<string, SupportedLocale> = new Map([
  // 英语
  ['en', 'en'],
  ['en-US', 'en'],
  ['en-GB', 'en'],
  ['en-AU', 'en'],
  ['en-CA', 'en'],
  ['en-IN', 'en'],
  ['en-NZ', 'en'],
  ['en-ZA', 'en'],
  ['en-IE', 'en'],
  ['en-PH', 'en'],
  ['en-SG', 'en'],

  // 简体中文
  ['zh-CN', 'zh-CN'],
  ['zh-Hans', 'zh-CN'],
  ['zh-Hans-CN', 'zh-CN'],
  ['zh-Hans-SG', 'zh-CN'],
  ['zh-CHS', 'zh-CN'],

  // 繁体中文
  ['zh-TW', 'zh-TW'],
  ['zh-Hant', 'zh-TW'],
  ['zh-Hant-TW', 'zh-TW'],
  ['zh-Hant-HK', 'zh-TW'],
  ['zh-HK', 'zh-TW'],
  ['zh-MO', 'zh-TW'],
  ['zh-CHT', 'zh-TW'],

  // 日语
  ['ja', 'ja'],
  ['ja-JP', 'ja'],

  // 韩语
  ['ko', 'ko'],
  ['ko-KR', 'ko'],

  // 法语
  ['fr', 'fr'],
  ['fr-FR', 'fr'],
  ['fr-CA', 'fr'],
  ['fr-BE', 'fr'],
  ['fr-CH', 'fr'],

  // 德语
  ['de', 'de'],
  ['de-DE', 'de'],
  ['de-AT', 'de'],
  ['de-CH', 'de'],
  ['de-LU', 'de'],

  // 意大利语
  ['it', 'it'],
  ['it-IT', 'it'],
  ['it-CH', 'it'],

  // 西班牙语
  ['es', 'es'],
  ['es-ES', 'es'],
  ['es-MX', 'es'],
  ['es-AR', 'es'],
  ['es-CL', 'es'],
  ['es-CO', 'es'],

  // 阿拉伯语
  ['ar', 'ar'],
  ['ar-SA', 'ar'],
  ['ar-EG', 'ar'],
  ['ar-AE', 'ar'],
  ['ar-IQ', 'ar'],
  ['ar-JO', 'ar'],
  ['ar-LB', 'ar'],
  ['ar-KW', 'ar'],
  ['ar-BH', 'ar'],
  ['ar-QA', 'ar'],
  ['ar-OM', 'ar'],
  ['ar-MA', 'ar'],
  ['ar-DZ', 'ar'],
  ['ar-TN', 'ar'],
  ['ar-LY', 'ar'],
  ['ar-YE', 'ar'],
  ['ar-SY', 'ar'],
  ['ar-IL', 'ar'],

  // 越南语
  ['vi', 'vi'],
  ['vi-VN', 'vi'],
])

/**
 * 将OS locale字符串映射到SupportedLocale
 * 精确匹配优先，然后尝试语言部分匹配，最终回退到英文
 */
export function mapOSLocaleToSupported(osLocale: string): SupportedLocale {
  if (!osLocale || osLocale === 'C' || osLocale === 'POSIX') {
    return DEFAULT_LOCALE
  }

  // 精确匹配
  const exact = OS_LOCALE_MAP.get(osLocale)
  if (exact) return exact

  // 提取语言部分（如 zh-Hans-CN → zh-Hans）
  const langSubtag = osLocale.split(/[-_]/)[0]
  const regionSubtag = osLocale.split(/[-_]/)[1]

  // 尢试语言部分匹配
  const langMatch = OS_LOCALE_MAP.get(langSubtag)
  if (langMatch) return langMatch

  // 尝试语言+Region组合（zh-Hans-CN → 尝试 zh-Hans, zh-CN）
  if (regionSubtag) {
    const langRegion = `${langSubtag}-${regionSubtag}`
    const lrMatch = OS_LOCALE_MAP.get(langRegion)
    if (lrMatch) return lrMatch
  }

  // 尝试遍历所有映射键的前缀匹配
  for (const [key, value] of OS_LOCALE_MAP) {
    if (key.startsWith(langSubtag)) return value
  }

  return DEFAULT_LOCALE
}

/**
 * 检测当前系统语言并映射到SupportedLocale
 * 在Electron renderer中使用navigator.languages的首选语言
 * navigator.languages按用户偏好排序，第一个元素是最首选语言
 */
export function detectSystemLocale(): SupportedLocale {
  const primaryLocale = (navigator.languages?.[0]) ?? navigator.language ?? 'en'
  return mapOSLocaleToSupported(primaryLocale)
}

/**
 * 验证给定字符串是否为合法的SupportedLocale
 */
export function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale)
}