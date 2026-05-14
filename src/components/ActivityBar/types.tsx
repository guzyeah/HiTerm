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
 * ActivityBar 类型定义与配置
 * 定义工具面板类型枚举、图标映射、i18n键映射
 */

import type { ReactElement } from 'react'
import {
  PlugConnectedRegular,
  FolderRegular,
  HistoryRegular,
} from '@fluentui/react-icons'

/** 工具面板类型 */
export type ActivityType = 'connections' | 'files' | 'history'

/** 工具面板配置项 */
export interface ActivityConfig {
  id: ActivityType
  /** FluentUI 图标元素（已渲染的 JSX，非组件类） */
  icon: ReactElement
  /** i18n 翻译键：面板标题 */
  labelKey: string
}

/** 工具面板配置列表（顺序决定 Tab 排列顺序） */
export const ACTIVITY_CONFIGS: ActivityConfig[] = [
  { id: 'connections', icon: <PlugConnectedRegular />, labelKey: 'activityBar.connections' },
  { id: 'files', icon: <FolderRegular />, labelKey: 'activityBar.files' },
  { id: 'history', icon: <HistoryRegular />, labelKey: 'activityBar.history' },
]

/** 默认激活的面板 */
export const DEFAULT_ACTIVITY: ActivityType = 'connections'
