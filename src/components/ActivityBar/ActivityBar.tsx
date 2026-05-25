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
 * ActivityBar 组件
 * 左侧面板的顶部 icon-only TabList + 面板标题 + 内容切换
 */

import { useEffect, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  TabList,
  Tab,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ACTIVITY_CONFIGS,
  DEFAULT_ACTIVITY,
  type ActivityType,
} from './types'
import { ConnectionsPanel } from './panels/ConnectionsPanel'
import { FilesPanel } from './panels/FilesPanel'
import { HistoryPanel } from './panels/HistoryPanel'
import { useWorkspaceRuntime } from '@/components/WorkspacePanel/workspaceRuntimeContext'

/** 面板组件映射 */
const PANEL_MAP: Record<ActivityType, FC> = {
  connections: ConnectionsPanel,
  files: FilesPanel,
  history: HistoryPanel,
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  tabBar: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    paddingInlineStart: tokens.spacingHorizontalS,
    paddingInlineEnd: tokens.spacingHorizontalS,
    paddingBlockStart: tokens.spacingVerticalXS,
    paddingBlockEnd: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderBottomStyle: 'solid',
    borderBottomWidth: tokens.strokeWidthThin,
  },
  header: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    paddingBlockStart: tokens.spacingVerticalS,
    paddingBlockEnd: tokens.spacingVerticalS,
    paddingInlineStart: tokens.spacingHorizontalL,
    paddingInlineEnd: tokens.spacingHorizontalL,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderBottomStyle: 'solid',
    borderBottomWidth: tokens.strokeWidthThin,
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingInlineStart: tokens.spacingHorizontalM,
    paddingInlineEnd: tokens.spacingHorizontalM,
    paddingBlockStart: tokens.spacingVerticalSNudge,
    paddingBlockEnd: tokens.spacingVerticalSNudge,
  },
})

export const ActivityBar: FC = () => {
  const styles = useStyles()
  const { t } = useTranslation()
  const { activeTerminalSession } = useWorkspaceRuntime()
  const [active, setActive] = useState<ActivityType>(DEFAULT_ACTIVITY)

  const isFilesDisabled = activeTerminalSession?.protocol === 'vnc' || activeTerminalSession?.protocol === 'telnet'
  const isHistoryDisabled = activeTerminalSession?.protocol === 'vnc'
  const activeActivity = (active === 'files' && isFilesDisabled) || (active === 'history' && isHistoryDisabled)
    ? DEFAULT_ACTIVITY
    : active
  const PanelComponent = PANEL_MAP[activeActivity]
  const activeConfig = ACTIVITY_CONFIGS.find(c => c.id === activeActivity)

  useEffect(() => {
    if ((active === 'files' && isFilesDisabled) || (active === 'history' && isHistoryDisabled)) {
      setActive(DEFAULT_ACTIVITY)
    }
  }, [active, isFilesDisabled, isHistoryDisabled])

  return (
    <div className={styles.root}>
      <div className={styles.tabBar}>
        <TabList
          selectedValue={activeActivity}
          onTabSelect={(_, data) => setActive(data.value as ActivityType)}
          appearance="subtle"
          size="small"
        >
          {ACTIVITY_CONFIGS.map(config => {
            const isDisabled = (config.id === 'files' && isFilesDisabled)
              || (config.id === 'history' && isHistoryDisabled)

            return (
              <Tab
                key={config.id}
                value={config.id}
                disabled={isDisabled}
                icon={config.icon}
              />
            )
          })}
        </TabList>
      </div>
      {activeConfig && (
        <div className={styles.header}>{t(activeConfig.labelKey)}</div>
      )}
      <div className={styles.content}>
        <PanelComponent />
      </div>
    </div>
  )
}
