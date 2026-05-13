/**
 * Files 面板
 * 展示当前活动 Local Terminal 会话工作目录下的文件树。
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Tree,
  TreeItem,
  TreeItemLayout,
  type TreeItemValue,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowClockwiseRegular,
  ArrowDownloadRegular,
  ArrowUploadRegular,
  DocumentAddRegular,
  DocumentRegular,
  FolderAddRegular,
  FolderOpenRegular,
  FolderRegular,
  HomeRegular,
} from '@fluentui/react-icons'
import { useWorkspaceRuntime } from '@/components/WorkspacePanel/workspaceRuntimeContext'
import { useTerminalFiles } from '@/hooks/useTerminalFiles'
import type { TerminalFileEntry } from '@/shared/terminalFilesTypes'

const ROOT_VALUE_PREFIX = 'root:'
const DIRECTORY_VALUE_PREFIX = 'directory:'
const FILE_VALUE_PREFIX = 'file:'
const MIN_PERMISSIONS_WIDTH = 88
const MAX_PERMISSIONS_WIDTH = 180
const MIN_MODIFIED_WIDTH = 124
const MAX_MODIFIED_WIDTH = 240

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    gap: tokens.spacingVerticalSNudge,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    flexShrink: 0,
  },
  toolbarButton: {
    width: '28px',
    minWidth: '28px',
    height: '28px',
    padding: 0,
  },
  browser: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'auto',
  },
  browserInner: {
    minWidth: '100%',
    width: 'max-content',
  },
  headerRow: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) var(--files-column-permissions-width) var(--files-column-modified-width)',
    alignItems: 'center',
    minWidth: '100%',
    width: 'max-content',
    height: '28px',
    paddingInlineStart: tokens.spacingHorizontalS,
    paddingInlineEnd: tokens.spacingHorizontalXS,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    boxSizing: 'border-box',
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  headerName: {
    minWidth: 0,
    paddingInlineEnd: tokens.spacingHorizontalM,
    whiteSpace: 'nowrap',
  },
  headerCell: {
    position: 'relative',
    minWidth: 0,
    paddingInlineEnd: tokens.spacingHorizontalS,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    insetInlineEnd: '-6px',
    width: '12px',
    height: '100%',
    cursor: 'col-resize',
    touchAction: 'none',
    zIndex: 2,
  },
  tree: {
    minWidth: '100%',
    width: 'max-content',
  },
  itemLayout: {
    minWidth: '100%',
    width: 'max-content',
    borderRadius: tokens.borderRadiusMedium,
    boxSizing: 'border-box',
    transition: 'background-color 120ms ease, color 120ms ease',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
    ':focus-within': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
  },
  rootItemLayout: {
    fontWeight: tokens.fontWeightSemibold,
  },
  itemContent: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) var(--files-column-permissions-width) var(--files-column-modified-width)',
    alignItems: 'center',
    minWidth: '100%',
    width: 'max-content',
    gap: tokens.spacingHorizontalS,
    height: '24px',
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  nameCell: {
    minWidth: 0,
    paddingInlineEnd: tokens.spacingHorizontalM,
    whiteSpace: 'nowrap',
  },
  editableNameCell: {
    display: 'block',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'text',
  },
  rootPathInput: {
    width: '100%',
    minWidth: 0,
  },
  metaCell: {
    minWidth: 0,
    color: tokens.colorNeutralForeground3,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  icon: {
    display: 'inline-flex',
    color: tokens.colorNeutralForeground2,
  },
  status: {
    paddingBlock: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  placeholderItem: {
    color: tokens.colorNeutralForeground3,
  },
  dialogSurface: {
    width: '420px',
    maxWidth: 'calc(100vw - 32px)',
  },
})

function getRootValue(rootPath: string): string {
  return `${ROOT_VALUE_PREFIX}${rootPath}`
}

function getDirectoryValue(targetPath: string): string {
  return `${DIRECTORY_VALUE_PREFIX}${targetPath}`
}

function getFileValue(targetPath: string): string {
  return `${FILE_VALUE_PREFIX}${targetPath}`
}

function getDirectoryPathFromValue(value: string): string | null {
  return value.startsWith(DIRECTORY_VALUE_PREFIX)
    ? value.slice(DIRECTORY_VALUE_PREFIX.length)
    : null
}

function clampWidth(width: number, minWidth: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(minWidth, width))
}

function formatModifiedAt(modifiedAtMs: number, formatter: Intl.DateTimeFormat): string {
  return formatter.format(new Date(modifiedAtMs))
}

export const FilesPanel: FC = () => {
  const styles = useStyles()
  const { t, i18n } = useTranslation()
  const { activeTerminalSession } = useWorkspaceRuntime()
  const [openItems, setOpenItems] = useState<Set<string>>(() => new Set())
  const [permissionsWidth, setPermissionsWidth] = useState(96)
  const [modifiedWidth, setModifiedWidth] = useState(144)
  const [isEditingRootPath, setIsEditingRootPath] = useState(false)
  const [draftRootPath, setDraftRootPath] = useState('')
  const [isUpdatingRootPath, setIsUpdatingRootPath] = useState(false)
  const [invalidPathValue, setInvalidPathValue] = useState('')
  const [isInvalidPathDialogOpen, setIsInvalidPathDialogOpen] = useState(false)
  const rootPathInputRef = useRef<HTMLInputElement | null>(null)
  const {
    entriesByParent,
    error,
    isLoading,
    loadingDirectories,
    rootSnapshot,
    goHome,
    loadDirectory,
    refresh,
    setRootPath,
  } = useTerminalFiles(activeTerminalSession?.sessionId ?? null)

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }), [i18n.resolvedLanguage])

  const rootValue = rootSnapshot ? getRootValue(rootSnapshot.cwd) : null
  const columnStyle = {
    '--files-column-permissions-width': `${permissionsWidth}px`,
    '--files-column-modified-width': `${modifiedWidth}px`,
  } as CSSProperties

  useEffect(() => {
    if (!rootValue) {
      setOpenItems(new Set())
      return
    }

    setOpenItems(new Set([rootValue]))
  }, [rootValue])

  useEffect(() => {
    if (!rootSnapshot) {
      setDraftRootPath('')
      setIsEditingRootPath(false)
      setIsUpdatingRootPath(false)
      return
    }

    setDraftRootPath(rootSnapshot.cwd)
  }, [rootSnapshot])

  useEffect(() => {
    if (!isEditingRootPath) return

    rootPathInputRef.current?.focus()
    rootPathInputRef.current?.select()
  }, [isEditingRootPath])

  function handleResizeStart(
    column: 'permissions' | 'modified',
    event: ReactPointerEvent<HTMLDivElement>,
  ): void {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = column === 'permissions' ? permissionsWidth : modifiedWidth

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + (moveEvent.clientX - startX)
      if (column === 'permissions') {
        setPermissionsWidth(clampWidth(nextWidth, MIN_PERMISSIONS_WIDTH, MAX_PERMISSIONS_WIDTH))
        return
      }

      setModifiedWidth(clampWidth(nextWidth, MIN_MODIFIED_WIDTH, MAX_MODIFIED_WIDTH))
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  function handleOpenChange(nextValues: Iterable<TreeItemValue>): void {
    const nextOpenItems = new Set([...nextValues].map(String))
    if (rootValue) {
      nextOpenItems.add(rootValue)
    }

    nextOpenItems.forEach(value => {
      if (openItems.has(value)) return

      const directoryPath = getDirectoryPathFromValue(value)
      if (directoryPath) {
        void loadDirectory(directoryPath)
      }
    })

    setOpenItems(nextOpenItems)
  }

  function handleBeginRootPathEdit(): void {
    if (!rootSnapshot || isUpdatingRootPath) return

    setDraftRootPath(rootSnapshot.cwd)
    setIsEditingRootPath(true)
  }

  function handleCancelRootPathEdit(): void {
    setIsEditingRootPath(false)
    setIsUpdatingRootPath(false)
    setDraftRootPath(rootSnapshot?.cwd ?? '')
  }

  async function handleCommitRootPath(): Promise<void> {
    if (!rootSnapshot || isUpdatingRootPath) return

    const nextPath = draftRootPath.trim()
    if (!nextPath) {
      handleCancelRootPathEdit()
      setInvalidPathValue(draftRootPath)
      setIsInvalidPathDialogOpen(true)
      return
    }

    setIsUpdatingRootPath(true)
    try {
      await setRootPath(nextPath)
      setIsEditingRootPath(false)
    } catch {
      setIsEditingRootPath(false)
      setInvalidPathValue(nextPath)
      setIsInvalidPathDialogOpen(true)
    } finally {
      setIsUpdatingRootPath(false)
    }
  }

  function handleRootPathKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      void handleCommitRootPath()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      handleCancelRootPathEdit()
    }
  }

  function renderRootNameCell(label: string): ReactNode {
    if (!isEditingRootPath) {
      return (
        <span
          className={styles.editableNameCell}
          onDoubleClick={event => {
            event.preventDefault()
            event.stopPropagation()
            handleBeginRootPathEdit()
          }}
          title={label}
        >
          {label}
        </span>
      )
    }

    return (
      <Input
        appearance="filled-darker"
        className={styles.rootPathInput}
        disabled={isUpdatingRootPath}
        onBlur={() => {
          if (isUpdatingRootPath) return
          handleCancelRootPathEdit()
        }}
        onChange={(_, data) => setDraftRootPath(data.value)}
        onClick={event => event.stopPropagation()}
        onKeyDown={handleRootPathKeyDown}
        placeholder={t('activityBar.filesEditPathPlaceholder')}
        ref={rootPathInputRef}
        size="small"
        value={draftRootPath}
      />
    )
  }

  function renderItemContent(
    label: ReactNode,
    permissions?: string,
    modifiedAtMs?: number,
  ) {
    return (
      <div className={styles.itemContent} style={columnStyle}>
        <span className={styles.nameCell}>{label}</span>
        <span className={styles.metaCell}>{permissions ?? ''}</span>
        <span className={styles.metaCell}>
          {typeof modifiedAtMs === 'number' ? formatModifiedAt(modifiedAtMs, dateFormatter) : ''}
        </span>
      </div>
    )
  }

  function renderPlaceholderLeaf(value: string, label: string) {
    return (
      <TreeItem key={value} itemType="leaf" value={value}>
        <TreeItemLayout className={mergeClasses(styles.itemLayout, styles.placeholderItem)}>
          {renderItemContent(label)}
        </TreeItemLayout>
      </TreeItem>
    )
  }

  function renderEntries(entries: TerminalFileEntry[]): JSX.Element[] {
    return entries.map(entry => {
      if (entry.kind === 'directory') {
        const childEntries = entriesByParent[entry.absolutePath]
        const isDirectoryLoading = Boolean(loadingDirectories[entry.absolutePath])

        return (
          <TreeItem
            key={entry.absolutePath}
            itemType="branch"
            value={getDirectoryValue(entry.absolutePath)}
          >
            <TreeItemLayout
              className={styles.itemLayout}
              iconBefore={<span className={styles.icon}><FolderRegular /></span>}
            >
              {renderItemContent(entry.name, entry.permissions, entry.modifiedAtMs)}
            </TreeItemLayout>
            <Tree>
              {isDirectoryLoading && renderPlaceholderLeaf(
                `${entry.absolutePath}:loading`,
                t('common.loading'),
              )}
              {!isDirectoryLoading && childEntries && childEntries.length === 0 && renderPlaceholderLeaf(
                `${entry.absolutePath}:empty`,
                t('activityBar.filesEmpty'),
              )}
              {!isDirectoryLoading && childEntries && renderEntries(childEntries)}
            </Tree>
          </TreeItem>
        )
      }

      return (
        <TreeItem
          key={entry.absolutePath}
          itemType="leaf"
          value={getFileValue(entry.absolutePath)}
        >
          <TreeItemLayout
            className={styles.itemLayout}
            iconBefore={<span className={styles.icon}><DocumentRegular /></span>}
          >
            {renderItemContent(entry.name, entry.permissions, entry.modifiedAtMs)}
          </TreeItemLayout>
        </TreeItem>
      )
    })
  }

  if (!activeTerminalSession) {
    return <div className={styles.status}>{t('activityBar.filesNoSession')}</div>
  }

  if (!rootSnapshot && isLoading) {
    return <div className={styles.status}>{t('activityBar.filesLoading')}</div>
  }

  if (!rootSnapshot && error) {
    return <div className={styles.status}>{error}</div>
  }

  if (!rootSnapshot) {
    return <div className={styles.status}>{t('activityBar.filesLoading')}</div>
  }

  return (
    <>
      <div className={styles.root}>
        <div className={styles.toolbar}>
          <Button
            aria-label={t('activityBar.filesUpload')}
            appearance="subtle"
            className={styles.toolbarButton}
            disabled
            icon={<ArrowUploadRegular />}
            size="small"
            title={t('activityBar.filesUpload')}
          />
          <Button
            aria-label={t('activityBar.filesDownload')}
            appearance="subtle"
            className={styles.toolbarButton}
            disabled
            icon={<ArrowDownloadRegular />}
            size="small"
            title={t('activityBar.filesDownload')}
          />
          <Button
            aria-label={t('activityBar.filesRefresh')}
            appearance="subtle"
            className={styles.toolbarButton}
            icon={<ArrowClockwiseRegular />}
            onClick={() => void refresh()}
            size="small"
            title={t('activityBar.filesRefresh')}
          />
          <Button
            aria-label={t('activityBar.filesGoHome')}
            appearance="subtle"
            className={styles.toolbarButton}
            icon={<HomeRegular />}
            onClick={() => void goHome()}
            size="small"
            title={t('activityBar.filesGoHome')}
          />
          <Button
            aria-label={t('activityBar.filesNewFolder')}
            appearance="subtle"
            className={styles.toolbarButton}
            disabled
            icon={<FolderAddRegular />}
            size="small"
            title={t('activityBar.filesNewFolder')}
          />
          <Button
            aria-label={t('activityBar.filesNewFile')}
            appearance="subtle"
            className={styles.toolbarButton}
            disabled
            icon={<DocumentAddRegular />}
            size="small"
            title={t('activityBar.filesNewFile')}
          />
        </div>

        <div className={styles.browser}>
          <div className={styles.browserInner} style={columnStyle}>
            <div className={styles.headerRow}>
              <div className={styles.headerName}>{t('activityBar.filesColumnName')}</div>
              <div className={styles.headerCell}>
                {t('activityBar.filesColumnPermissions')}
                <div
                  className={styles.resizeHandle}
                  onPointerDown={event => handleResizeStart('permissions', event)}
                  role="separator"
                />
              </div>
              <div className={styles.headerCell}>
                {t('activityBar.filesColumnModified')}
                <div
                  className={styles.resizeHandle}
                  onPointerDown={event => handleResizeStart('modified', event)}
                  role="separator"
                />
              </div>
            </div>

            <Tree
              appearance="subtle-alpha"
              aria-label={t('activityBar.files')}
              className={styles.tree}
              onOpenChange={(_, data) => handleOpenChange(data.openItems)}
              openItems={openItems}
              size="small"
            >
              <TreeItem
                itemType="branch"
                value={getRootValue(rootSnapshot.cwd)}
              >
                <TreeItemLayout
                  className={mergeClasses(styles.itemLayout, styles.rootItemLayout)}
                  iconBefore={<span className={styles.icon}><FolderOpenRegular /></span>}
                >
                  {renderItemContent(renderRootNameCell(rootSnapshot.cwd))}
                </TreeItemLayout>
                <Tree>
                  {rootSnapshot.entries.length === 0
                    ? renderPlaceholderLeaf(`${rootSnapshot.cwd}:empty`, t('activityBar.filesEmpty'))
                    : renderEntries(rootSnapshot.entries)}
                </Tree>
              </TreeItem>
            </Tree>
          </div>
        </div>
      </div>

      <Dialog
        modalType="alert"
        onOpenChange={(_, data) => setIsInvalidPathDialogOpen(data.open)}
        open={isInvalidPathDialogOpen}
      >
        <DialogSurface className={styles.dialogSurface}>
          <DialogBody>
            <DialogTitle>{t('activityBar.filesInvalidPathTitle')}</DialogTitle>
            <DialogContent>
              {t('activityBar.filesInvalidPathMessage', { path: invalidPathValue })}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setIsInvalidPathDialogOpen(false)}>
                {t('common.ok')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  )
}
