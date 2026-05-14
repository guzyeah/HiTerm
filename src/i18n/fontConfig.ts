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
 * 字体配置系统
 * 根据语言和操作系统平台确定最佳字体栈
 * 支持用户自定义字体覆盖，预留动态变化接口
 */

import type { SupportedLocale, Platform } from './types'

/** 字体栈字符串类型（CSS font-family值） */
export type FontStack = string

/** 用户字体覆盖类型（null表示使用默认） */
export type FontOverride = FontStack | null

/**
 * 默认字体栈映射矩阵
 * 结构：locale → platform → font stack
 * 所有栈最终以 sans-serif 兜底
 * CJK字体在Windows上同时提供英文名和中文名以确保兼容性
 */
const DEFAULT_FONT_STACKS: Readonly<Record<SupportedLocale, Readonly<Record<Platform, FontStack>>>> = {
  'en': {
    win32: '"Segoe UI", Tahoma, sans-serif',
    darwin: '"-apple-system", "BlinkMacSystemFont", "Helvetica Neue", sans-serif',
    linux: '"Noto Sans", "DejaVu Sans", sans-serif',
  },
  'zh-CN': {
    win32: '"Microsoft YaHei", "微软雅黑", "Segoe UI", sans-serif',
    darwin: '"PingFang SC", "Hiragino Sans GB", "-apple-system", sans-serif',
    linux: '"Noto Sans CJK SC", "WenQuanYi Micro Hei", "Noto Sans", sans-serif',
  },
  'zh-TW': {
    win32: '"Microsoft JhengHei", "微软正黑体", "Segoe UI", sans-serif',
    darwin: '"PingFang TC", "Hiragino Sans TC", "-apple-system", sans-serif',
    linux: '"Noto Sans CJK TC", "WenQuanYi Micro Hei", "Noto Sans", sans-serif',
  },
  'ja': {
    win32: '"Meiryo", "メイリオ", "Segoe UI", sans-serif',
    darwin: '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "-apple-system", sans-serif',
    linux: '"Noto Sans CJK JP", "IPAGothic", "Noto Sans", sans-serif',
  },
  'ko': {
    win32: '"Malgun Gothic", "맑은 고딕", "Segoe UI", sans-serif',
    darwin: '"Apple SD Gothic Neo", "-apple-system", sans-serif',
    linux: '"Noto Sans CJK KR", "Baekmuk Gulim", "Noto Sans", sans-serif',
  },
  'fr': {
    win32: '"Segoe UI", Tahoma, sans-serif',
    darwin: '"-apple-system", "BlinkMacSystemFont", "Helvetica Neue", sans-serif',
    linux: '"Noto Sans", "DejaVu Sans", sans-serif',
  },
  'de': {
    win32: '"Segoe UI", Tahoma, sans-serif',
    darwin: '"-apple-system", "BlinkMacSystemFont", "Helvetica Neue", sans-serif',
    linux: '"Noto Sans", "DejaVu Sans", sans-serif',
  },
  'it': {
    win32: '"Segoe UI", Tahoma, sans-serif',
    darwin: '"-apple-system", "BlinkMacSystemFont", "Helvetica Neue", sans-serif',
    linux: '"Noto Sans", "DejaVu Sans", sans-serif',
  },
  'es': {
    win32: '"Segoe UI", Tahoma, sans-serif',
    darwin: '"-apple-system", "BlinkMacSystemFont", "Helvetica Neue", sans-serif',
    linux: '"Noto Sans", "DejaVu Sans", sans-serif',
  },
  'ar': {
    win32: '"Segoe UI", "Traditional Arabic", "Tahoma", sans-serif',
    darwin: '"-apple-system", "Geeza Pro", "Helvetica Neue", sans-serif',
    linux: '"Noto Sans Arabic", "Noto Naskh Arabic", "Noto Sans", sans-serif',
  },
  'vi': {
    win32: '"Segoe UI", Tahoma, sans-serif',
    darwin: '"-apple-system", "BlinkMacSystemFont", "Helvetica Neue", sans-serif',
    linux: '"Noto Sans", "DejaVu Sans", sans-serif',
  },
}

/**
 * 获取给定语言和平台的默认字体栈
 * @param locale 目标语言
 * @param platform 操作系统平台
 * @returns CSS font-family字符串
 */
export function getDefaultFontStack(locale: SupportedLocale, platform: Platform): FontStack {
  return DEFAULT_FONT_STACKS[locale]?.[platform] ?? DEFAULT_FONT_STACKS.en[platform] ?? 'sans-serif'
}

/**
 * 获取生效的字体栈（考虑用户覆盖）
 * 用户覆盖存在时优先使用覆盖值，否则使用默认栈
 * 用户覆盖值会自动追加 sans-serif 兜底
 * @param locale 目标语言
 * @param platform 操作系统平台
 * @param override 用户自定义字体覆盖（null表示使用默认）
 * @returns CSS font-family字符串
 */
export function getEffectiveFontStack(
  locale: SupportedLocale,
  platform: Platform,
  override: FontOverride = null,
): FontStack {
  if (override) {
    return override.endsWith('sans-serif') || override.endsWith('serif')
      ? override
      : `${override}, sans-serif`
  }
  return getDefaultFontStack(locale, platform)
}