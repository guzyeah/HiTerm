/**
 * 连接列表面板
 * 使用 Fluent Tree 展示数据库中的 Shell 分组与连接摘要。
 */

import { useCallback, useEffect, useMemo, useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Tree,
  TreeItem,
  TreeItemLayout,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  DEFAULT_SHELL_GROUP_NAME,
  LOCAL_SHELL_GROUP_NAME,
  isPresetShellGroupName,
  SHELL_GROUP_I18N_KEYS,
} from '@/shared/shellGroups'
import { PROTOCOL_ICON_MAP } from '@/shared/protocolIcons'
import { emitOpenShellTab } from '@/shared/workspaceEvents'
import type { ShellSummary } from '@/shared/shellTypes'

interface ShellGroupNode {
  name: string
  shells: ShellSummary[]
}

const GROUP_VALUE_PREFIX = 'group:'
const SHELL_VALUE_PREFIX = 'shell:'

const useStyles = makeStyles({
  root: {
    minHeight: 0,
  },
  tree: {
    minWidth: 0,
  },
  itemLayout: {
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    transition: 'background-color 120ms ease, color 120ms ease',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
    ':active': {
      backgroundColor: tokens.colorNeutralBackground1Pressed,
      color: tokens.colorNeutralForeground1,
    },
    ':focus-within': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
  },
  groupLabel: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: tokens.fontWeightSemibold,
  },
  shellLabel: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  shellIcon: {
    display: 'inline-flex',
    color: tokens.colorNeutralForeground2,
  },
  count: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  status: {
    paddingBlock: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
})

function getGroupValue(groupName: string): string {
  return `${GROUP_VALUE_PREFIX}${groupName}`
}

function getShellValue(shellId: string): string {
  return `${SHELL_VALUE_PREFIX}${shellId}`
}

function getShellGroupName(shell: ShellSummary): string {
  return shell.group?.trim() || DEFAULT_SHELL_GROUP_NAME
}

function sortShells(shells: ShellSummary[]): ShellSummary[] {
  return [...shells].sort((a, b) => a.name.localeCompare(b.name))
}

function sortGroupNames(groupNames: string[]): string[] {
  const uniqueGroupNames = [...new Set(groupNames)]
  const customGroupNames = uniqueGroupNames
    .filter(name => name !== LOCAL_SHELL_GROUP_NAME && name !== DEFAULT_SHELL_GROUP_NAME)
    .sort((a, b) => a.localeCompare(b))

  return [
    LOCAL_SHELL_GROUP_NAME,
    ...customGroupNames,
    DEFAULT_SHELL_GROUP_NAME,
  ]
}

function buildGroupTree(groups: string[], shells: ShellSummary[]): ShellGroupNode[] {
  const shellGroupNames = shells.map(getShellGroupName)
  const groupNames = sortGroupNames([
    ...groups,
    ...shellGroupNames,
    LOCAL_SHELL_GROUP_NAME,
    DEFAULT_SHELL_GROUP_NAME,
  ])

  return groupNames.map(groupName => ({
    name: groupName,
    shells: sortShells(shells.filter(shell => getShellGroupName(shell) === groupName)),
  }))
}

export const ConnectionsPanel: FC = () => {
  const styles = useStyles()
  const { t } = useTranslation()
  const [groups, setGroups] = useState<string[]>([])
  const [shells, setShells] = useState<ShellSummary[]>([])
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  const getGroupLabel = useCallback((groupName: string) => (
    isPresetShellGroupName(groupName)
      ? t(SHELL_GROUP_I18N_KEYS[groupName])
      : groupName
  ), [t])

  const loadShellTree = useCallback(async () => {
    if (!window.shellAPI) {
      setLoading(false)
      return
    }

    try {
      setLoadFailed(false)
      const [nextGroups, nextShells] = await Promise.all([
        window.shellAPI.listGroups(),
        window.shellAPI.listShellSummaries(),
      ])

      const nextTree = buildGroupTree(nextGroups, nextShells)
      setGroups(nextGroups)
      setShells(nextShells)
      setOpenItems(new Set(nextTree.map(group => getGroupValue(group.name))))
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadShellTree()

    const handleShellsChanged = () => {
      loadShellTree()
    }

    window.addEventListener('shells:changed', handleShellsChanged)
    return () => {
      window.removeEventListener('shells:changed', handleShellsChanged)
    }
  }, [loadShellTree])

  const groupTree = useMemo(() => buildGroupTree(groups, shells), [groups, shells])

  const openShell = useCallback((shell: ShellSummary) => {
    emitOpenShellTab(shell)
  }, [])

  if (loading) {
    return <div className={styles.status}>{t('common.loading')}</div>
  }

  if (loadFailed) {
    return <div className={styles.status}>{t('common.error')}</div>
  }

  return (
    <div className={styles.root}>
      <Tree
        aria-label={t('activityBar.connections')}
        appearance="subtle-alpha"
        className={styles.tree}
        openItems={openItems}
        onOpenChange={(_, data) => setOpenItems(new Set([...data.openItems].map(String)))}
        size="small"
      >
        {groupTree.map(group => (
          <TreeItem
            key={group.name}
            itemType="branch"
            value={getGroupValue(group.name)}
          >
            <TreeItemLayout
              aside={<span className={styles.count}>{group.shells.length}</span>}
              className={styles.itemLayout}
            >
              <span className={styles.groupLabel} title={getGroupLabel(group.name)}>
                {getGroupLabel(group.name)}
              </span>
            </TreeItemLayout>
            <Tree>
              {group.shells.map(shell => (
                <TreeItem
                  key={shell.id}
                  itemType="leaf"
                  value={getShellValue(shell.id)}
                >
                  <TreeItemLayout
                    className={styles.itemLayout}
                    iconBefore={<span className={styles.shellIcon}>{PROTOCOL_ICON_MAP[shell.protocol]}</span>}
                    onDoubleClick={() => openShell(shell)}
                  >
                    <span className={styles.shellLabel} title={shell.name}>
                      {shell.name}
                    </span>
                  </TreeItemLayout>
                </TreeItem>
              ))}
            </Tree>
          </TreeItem>
        ))}
      </Tree>
    </div>
  )
}
