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
 * 主窗口布局组件
 * 将菜单栏下方区域分为左右两栏，各带独立状态栏
 */

import { type FC, type ReactNode } from 'react'
import { makeStyles, tokens } from '@fluentui/react-components'

interface MainLayoutProps {
  /** 左栏工具栏内容 */
  leftPanel: ReactNode
  /** 右栏主内容区 */
  rightPanel: ReactNode
  /** 左下状态栏内容 */
  leftStatusBar: ReactNode
  /** 右下状态栏内容 */
  rightStatusBar: ReactNode
}

/** 标准状态栏高度 (FluentUI 标准) */
const STATUS_BAR_HEIGHT = '32px'

/** 左栏宽度占比 */
const LEFT_PANEL_FRACTION = '20%'
/** 左栏最大宽度 */
const LEFT_PANEL_MAX_WIDTH = '300px'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    width: LEFT_PANEL_FRACTION,
    maxWidth: LEFT_PANEL_MAX_WIDTH,
    flexShrink: 0,
    minWidth: 0,
    borderRightColor: tokens.colorNeutralStroke2,
    borderRightStyle: 'solid',
    borderRightWidth: tokens.strokeWidthThin,
  },
  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  panelContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    height: STATUS_BAR_HEIGHT,
    minHeight: STATUS_BAR_HEIGHT,
    paddingInlineStart: tokens.spacingHorizontalM,
    paddingInlineEnd: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderTopColor: tokens.colorNeutralStroke2,
    borderTopStyle: 'solid',
    borderTopWidth: tokens.strokeWidthThin,
    boxSizing: 'border-box',
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
})

/**
 * 主窗口布局
 *
 * 左右两栏结构，各带独立状态栏：
 * ┌──────────┬─────────────────┐
 * │ 左栏      │ 右栏             │
 * │ (工具栏)  │ (主内容区)       │
 * │          │                 │
 * ├──────────┼─────────────────┤
 * │ 左下状态栏│ 右下状态栏       │
 * └──────────┴─────────────────┘
 */
export const MainLayout: FC<MainLayoutProps> = ({
  leftPanel,
  rightPanel,
  leftStatusBar,
  rightStatusBar,
}) => {
  const styles = useStyles()

  return (
    <div className={styles.root}>
      {/* 左栏：工具栏 + 左下状态栏 */}
      <div className={styles.leftColumn}>
        <div className={styles.panelContent}>{leftPanel}</div>
        <div className={styles.statusBar}>{leftStatusBar}</div>
      </div>

      {/* 右栏：主内容区 + 右下状态栏 */}
      <div className={styles.rightColumn}>
        <div className={styles.panelContent}>{rightPanel}</div>
        <div className={styles.statusBar}>{rightStatusBar}</div>
      </div>
    </div>
  )
}
