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
 * 连接列表面板
 * 使用 Fluent Tree 展示数据库中的 Shell 分组与连接摘要。
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FC, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MenuItem,
  MenuList,
  Tree,
  TreeItem,
  TreeItemLayout,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  DeleteRegular,
  PlugConnectedRegular,
} from '@fluentui/react-icons'
import {
  DEFAULT_SHELL_GROUP_NAME,
  LOCAL_SHELL_GROUP_NAME,
  isPresetShellGroupName,
  SHELL_GROUP_I18N_KEYS,
} from '@/shared/shellGroups'
import { useWorkspaceRuntime } from '@/components/WorkspacePanel/workspaceRuntimeContext'
import { PROTOCOL_ICON_MAP } from '@/shared/protocolIcons'
import { emitOpenShellTab } from '@/shared/workspaceEvents'
import type { ShellSummary } from '@/shared/shellTypes'

interface ShellGroupNode {
  name: string
  shells: ShellSummary[]
}

interface ShellContextMenuState {
  kind: 'shell'
  x: number
  y: number
  shell: ShellSummary
}

interface GroupContextMenuState {
  kind: 'group'
  x: number
  y: number
  group: ShellGroupNode
}

type ContextMenuState = ShellContextMenuState | GroupContextMenuState

interface DeleteShellDialogState {
  shell: ShellSummary
  isSubmitting: boolean
}

interface AlertDialogState {
  title: string
  message: string
}

const GROUP_VALUE_PREFIX = 'group:'
const SHELL_VALUE_PREFIX = 'shell:'
const CONTEXT_MENU_VIEWPORT_GAP = 8

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
  contextMenuSurface: {
    position: 'fixed',
    zIndex: 1200,
    minWidth: '180px',
    padding: tokens.spacingVerticalXXS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  dangerMenuItem: {
    color: tokens.colorStatusDangerForeground1,
    ':hover': {
      backgroundColor: tokens.colorStatusDangerBackground1,
      color: tokens.colorStatusDangerForeground2,
    },
    ':active': {
      backgroundColor: tokens.colorNeutralBackground1Pressed,
      color: tokens.colorStatusDangerForeground3,
    },
  },
  contextMenuItemContent: {
    minWidth: '116px',
  },
  dialogContent: {
    display: 'grid',
    gap: tokens.spacingVerticalS,
  },
  dialogHint: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
})

function getGroupValue(groupName: string): string {
  return `${GROUP_VALUE_PREFIX}${groupName}`
}

function getShellValue(shellId: string): string {
  return `${SHELL_VALUE_PREFIX}${shellId}`
}

function getContextMenuIdentity(contextMenu: ContextMenuState): string {
  return contextMenu.kind === 'shell'
    ? getShellValue(contextMenu.shell.id)
    : getGroupValue(contextMenu.group.name)
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
  const { getOpenShellTabCount } = useWorkspaceRuntime()
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const [groups, setGroups] = useState<string[]>([])
  const [shells, setShells] = useState<ShellSummary[]>([])
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<DeleteShellDialogState | null>(null)
  const [alertDialog, setAlertDialog] = useState<AlertDialogState | null>(null)

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

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const openShellFromMenu = useCallback((shell: ShellSummary) => {
    closeContextMenu()
    openShell(shell)
  }, [closeContextMenu, openShell])

  const openShellContextMenu = useCallback((event: MouseEvent<HTMLElement>, shell: ShellSummary) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      kind: 'shell',
      x: event.clientX,
      y: event.clientY,
      shell,
    })
  }, [])

  const openGroupContextMenu = useCallback((event: MouseEvent<HTMLElement>, group: ShellGroupNode) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({
      kind: 'group',
      x: event.clientX,
      y: event.clientY,
      group,
    })
  }, [])

  const showDeleteBlockedDialog = useCallback((shell: ShellSummary, count: number) => {
    setAlertDialog({
      title: t('activityBar.connectionDeleteBlockedTitle'),
      message: t('activityBar.connectionDeleteBlockedMessage', { name: shell.name, count }),
    })
  }, [t])

  const openDeleteDialog = useCallback((shell: ShellSummary) => {
    closeContextMenu()
    const openTabCount = getOpenShellTabCount(shell.id)
    if (openTabCount > 0) {
      showDeleteBlockedDialog(shell, openTabCount)
      return
    }

    setDeleteDialog({ shell, isSubmitting: false })
  }, [closeContextMenu, getOpenShellTabCount, showDeleteBlockedDialog])

  const deleteGroupFromMenu = useCallback(async (group: ShellGroupNode) => {
    closeContextMenu()

    const groupLabel = getGroupLabel(group.name)
    if (group.shells.length > 0) {
      setAlertDialog({
        title: t('activityBar.groupDeleteFailedTitle'),
        message: t('activityBar.groupDeleteFailedWithConnections', { name: groupLabel }),
      })
      return
    }

    try {
      const deleted = await window.shellAPI?.deleteGroup(group.name)
      if (!deleted) throw new Error('Group record not found')

      setGroups(previous => previous.filter(name => name !== group.name))
      window.dispatchEvent(new CustomEvent('shells:changed'))
    } catch {
      setAlertDialog({
        title: t('activityBar.groupDeleteFailedTitle'),
        message: t('activityBar.groupDeleteFailedMessage', { name: groupLabel }),
      })
    }
  }, [closeContextMenu, getGroupLabel, t])

  const confirmDeleteShell = useCallback(async () => {
    if (!deleteDialog || !window.shellAPI) return

    const { shell } = deleteDialog
    const openTabCount = getOpenShellTabCount(shell.id)
    if (openTabCount > 0) {
      setDeleteDialog(null)
      showDeleteBlockedDialog(shell, openTabCount)
      return
    }

    setDeleteDialog({ shell, isSubmitting: true })

    try {
      const deleted = await window.shellAPI.deleteShell(shell.id)
      if (!deleted) throw new Error('Shell record not found')

      setShells(previous => previous.filter(item => item.id !== shell.id))
      setDeleteDialog(null)
      window.dispatchEvent(new CustomEvent('shells:changed'))
    } catch {
      setDeleteDialog(null)
      setAlertDialog({
        title: t('activityBar.connectionDeleteFailedTitle'),
        message: t('activityBar.connectionDeleteFailedMessage', { name: shell.name }),
      })
    }
  }, [deleteDialog, getOpenShellTabCount, showDeleteBlockedDialog, t])

  useEffect(() => {
    if (!contextMenu) return

    const surface = contextMenuRef.current
    if (!surface) return

    const nextX = Math.min(
      Math.max(contextMenu.x, CONTEXT_MENU_VIEWPORT_GAP),
      Math.max(CONTEXT_MENU_VIEWPORT_GAP, window.innerWidth - surface.offsetWidth - CONTEXT_MENU_VIEWPORT_GAP),
    )
    const nextY = Math.min(
      Math.max(contextMenu.y, CONTEXT_MENU_VIEWPORT_GAP),
      Math.max(CONTEXT_MENU_VIEWPORT_GAP, window.innerHeight - surface.offsetHeight - CONTEXT_MENU_VIEWPORT_GAP),
    )

    if (nextX === contextMenu.x && nextY === contextMenu.y) return

    const contextMenuIdentity = getContextMenuIdentity(contextMenu)
    setContextMenu(previous => (
      previous
      && getContextMenuIdentity(previous) === contextMenuIdentity
      && (previous.x !== nextX || previous.y !== nextY)
        ? { ...previous, x: nextX, y: nextY }
        : previous
    ))
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu) return

    const handlePointerDown = (event: PointerEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) return
      setContextMenu(null)
    }
    const handleClose = () => setContextMenu(null)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleClose)
    window.addEventListener('resize', handleClose)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleClose)
      window.removeEventListener('resize', handleClose)
    }
  }, [contextMenu])

  if (loading) {
    return <div className={styles.status}>{t('common.loading')}</div>
  }

  if (loadFailed) {
    return <div className={styles.status}>{t('common.error')}</div>
  }

  return (
    <>
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
                onContextMenu={event => openGroupContextMenu(event, group)}
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
                      onContextMenu={event => openShellContextMenu(event, shell)}
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

      {contextMenu && (
        <div
          className={styles.contextMenuSurface}
          onContextMenu={event => {
            event.preventDefault()
            event.stopPropagation()
          }}
          ref={contextMenuRef}
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          <MenuList
            aria-label={t(
              contextMenu.kind === 'shell'
                ? 'activityBar.connectionContextMenu'
                : 'activityBar.groupContextMenu',
            )}
          >
            {contextMenu.kind === 'group' ? (
              <MenuItem
                className={styles.dangerMenuItem}
                icon={<DeleteRegular />}
                onMouseDown={event => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClick={() => void deleteGroupFromMenu(contextMenu.group)}
              >
                <span className={styles.contextMenuItemContent}>
                  {t('activityBar.groupDelete')}
                </span>
              </MenuItem>
            ) : (
              <>
                <MenuItem
                  icon={<PlugConnectedRegular />}
                  onMouseDown={event => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onClick={() => openShellFromMenu(contextMenu.shell)}
                >
                  <span className={styles.contextMenuItemContent}>
                    {t('activityBar.connectionConnect')}
                  </span>
                </MenuItem>
                <MenuItem
                  className={styles.dangerMenuItem}
                  icon={<DeleteRegular />}
                  onMouseDown={event => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onClick={() => openDeleteDialog(contextMenu.shell)}
                >
                  <span className={styles.contextMenuItemContent}>
                    {t('activityBar.connectionDelete')}
                  </span>
                </MenuItem>
              </>
            )}
          </MenuList>
        </div>
      )}

      {deleteDialog && (
        <Dialog
          open
          onOpenChange={(_, data) => {
            if (deleteDialog.isSubmitting) return
            if (!data.open) setDeleteDialog(null)
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>{t('activityBar.connectionDeleteConfirmTitle')}</DialogTitle>
              <DialogContent className={styles.dialogContent}>
                <span>{t('activityBar.connectionDeleteConfirmMessage', { name: deleteDialog.shell.name })}</span>
                <span className={styles.dialogHint}>{t('activityBar.connectionDeleteConfirmHint')}</span>
              </DialogContent>
              <DialogActions>
                <Button
                  appearance="secondary"
                  disabled={deleteDialog.isSubmitting}
                  onClick={() => setDeleteDialog(null)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  appearance="primary"
                  disabled={deleteDialog.isSubmitting}
                  onClick={() => void confirmDeleteShell()}
                >
                  {t('activityBar.connectionDelete')}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}

      {alertDialog && (
        <Dialog
          open
          onOpenChange={(_, data) => {
            if (!data.open) setAlertDialog(null)
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>{alertDialog.title}</DialogTitle>
              <DialogContent>{alertDialog.message}</DialogContent>
              <DialogActions>
                <Button appearance="primary" onClick={() => setAlertDialog(null)}>
                  {t('common.ok')}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      )}
    </>
  )
}
