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
  type DragEvent as ReactDragEvent,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
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
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  ProgressBar,
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
  DeleteRegular,
  DocumentAddRegular,
  DocumentRegular,
  FolderAddRegular,
  FolderOpenRegular,
  FolderRegular,
  HomeRegular,
} from '@fluentui/react-icons'
import { useWorkspaceRuntime } from '@/components/WorkspacePanel/workspaceRuntimeContext'
import { useTerminalFiles } from '@/hooks/useTerminalFiles'
import type {
  TerminalFileEntry,
  TerminalFileKind,
  TerminalFilesTransferDirection,
} from '@/shared/terminalFilesTypes'

const ROOT_VALUE_PREFIX = 'root:'
const DIRECTORY_VALUE_PREFIX = 'directory:'
const FILE_VALUE_PREFIX = 'file:'
const MIN_PERMISSIONS_WIDTH = 88
const MAX_PERMISSIONS_WIDTH = 180
const MIN_MODIFIED_WIDTH = 124
const MAX_MODIFIED_WIDTH = 240

type SelectableItemKind = TerminalFileKind | 'root'
type CreateEntryKind = 'file' | 'directory'

interface AlertDialogState {
  message: string
  title: string
}

interface ContextMenuState {
  targetKind: SelectableItemKind
  targetPath: string
  x: number
  y: number
}

interface SelectedItemState {
  kind: SelectableItemKind
  path: string
}

interface CreateDialogState {
  kind: CreateEntryKind
  parentPath: string
  name: string
  isSubmitting: boolean
}

interface DeleteDialogState {
  items: SelectedItemState[]
  isSubmitting: boolean
}

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
    transition: 'background-color 120ms ease, color 120ms ease, box-shadow 120ms ease',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
    ':focus-within': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
  },
  selectedLayout: {
    backgroundColor: tokens.colorBrandBackground2Hover,
    boxShadow: `inset 0 0 0 ${tokens.strokeWidthThin} ${tokens.colorBrandStroke1}`,
    color: tokens.colorNeutralForeground1,
  },
  rootItemLayout: {
    fontWeight: tokens.fontWeightSemibold,
  },
  dropTargetLayout: {
    backgroundColor: tokens.colorBrandBackground2,
    boxShadow: `inset 0 0 0 ${tokens.strokeWidthThin} ${tokens.colorBrandStroke1}`,
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
  dialogContentStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalXS,
  },
  dialogField: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
  dialogFieldLabel: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  dialogHint: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
  },
  contextMenuSurface: {
    position: 'fixed',
    zIndex: 1000,
    minWidth: '180px',
    padding: tokens.spacingVerticalXXS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  transferStatusBar: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    paddingBlock: tokens.spacingVerticalXS,
    paddingInline: tokens.spacingHorizontalS,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  transferStatusHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    minWidth: 0,
  },
  transferStatusTitle: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase200,
  },
  transferStatusValue: {
    flexShrink: 0,
    color: tokens.colorNeutralForeground2,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    fontSize: tokens.fontSizeBase200,
  },
  transferStatusMetaRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
    minWidth: 0,
  },
  transferStatusMeta: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
  },
  transferStatusProgress: {
    width: '100%',
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

function normalizePaths(paths: string[]): string[] {
  return [...new Set(paths.map(targetPath => targetPath.trim()).filter(Boolean))]
}

function isDirectoryLike(kind: SelectableItemKind): boolean {
  return kind === 'root' || kind === 'directory'
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
  const [alertDialog, setAlertDialog] = useState<AlertDialogState | null>(null)
  const [createDialog, setCreateDialog] = useState<CreateDialogState | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [dragTargetPath, setDragTargetPath] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<SelectedItemState[]>([])
  const rootPathInputRef = useRef<HTMLInputElement | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const clearTransferStateRef = useRef<() => void>(() => undefined)
  const lastFailedTransferTaskIdRef = useRef<string | null>(null)
  const lastRootPathRef = useRef<string | null>(null)
  const {
    entriesByParent,
    error,
    isLoading,
    isTransferring,
    loadingDirectories,
    rootSnapshot,
    transferState,
    goHome,
    loadDirectory,
    refresh,
    setRootPath,
    createFile,
    createDirectory,
    deleteEntries,
    uploadFiles,
    downloadFiles,
    clearTransferState,
  } = useTerminalFiles(activeTerminalSession?.sessionId ?? null)

  clearTransferStateRef.current = clearTransferState

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
  const selectedPathSet = useMemo(() => new Set(selectedItems.map(item => item.path)), [selectedItems])
  const parentPathByChild = useMemo(() => {
    const nextMap = new Map<string, string>()

    Object.entries(entriesByParent).forEach(([parentPath, entries]) => {
      entries.forEach(entry => {
        nextMap.set(entry.absolutePath, parentPath)
      })
    })

    return nextMap
  }, [entriesByParent])
  const createParentPath = useMemo(() => {
    if (!rootSnapshot) return null
    if (selectedItems.length !== 1) return rootSnapshot.cwd

    const [selectedItem] = selectedItems
    if (!selectedItem) return rootSnapshot.cwd
    if (selectedItem.kind === 'file') {
      return parentPathByChild.get(selectedItem.path) ?? rootSnapshot.cwd
    }

    return selectedItem.path
  }, [parentPathByChild, rootSnapshot, selectedItems])
  const selectedDeletableItems = useMemo(() => (
    selectedItems.filter(item => item.kind !== 'root')
  ), [selectedItems])
  const canCreateEntry = !isTransferring && selectedItems.length <= 1 && Boolean(createParentPath)
  const canDeleteEntries = !isTransferring && selectedDeletableItems.length > 0

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
      setCreateDialog(null)
      setDeleteDialog(null)
      setContextMenu(null)
      setSelectedItems([])
      lastRootPathRef.current = null
      return
    }

    setDraftRootPath(rootSnapshot.cwd)

    if (lastRootPathRef.current !== rootSnapshot.cwd) {
      lastRootPathRef.current = rootSnapshot.cwd
      setSelectedItems([{
        path: rootSnapshot.cwd,
        kind: 'root',
      }])
    }
  }, [rootSnapshot])

  useEffect(() => {
    if (!isEditingRootPath) return

    rootPathInputRef.current?.focus()
    rootPathInputRef.current?.select()
  }, [isEditingRootPath])

  useEffect(() => {
    if (!contextMenu) return

    const handlePointerDown = (event: PointerEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) return
      setContextMenu(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu])

  useEffect(() => {
    if (!transferState || transferState.status !== 'failed') return
    if (lastFailedTransferTaskIdRef.current === transferState.taskId) return

    lastFailedTransferTaskIdRef.current = transferState.taskId
    setAlertDialog({
      title: transferState.direction === 'download'
        ? t('activityBar.filesDownloadFailedTitle')
        : t('activityBar.filesUploadFailedTitle'),
      message: transferState.direction === 'download'
        ? t('activityBar.filesDownloadFailedMessage', {
          message: transferState.errorMessage ?? t('common.error'),
        })
        : t('activityBar.filesUploadFailedMessage', {
          message: transferState.errorMessage ?? t('common.error'),
        }),
    })
    clearTransferStateRef.current()
  }, [transferState, t])

  function openAlertDialog(title: string, message: string): void {
    setAlertDialog({ title, message })
  }

  function normalizeComparablePath(targetPath: string): string {
    return targetPath.replace(/[\\/]+/g, '/').replace(/\/$/, '')
  }

  function isPathWithinTarget(parentPath: string, candidatePath: string): boolean {
    const normalizedParentPath = normalizeComparablePath(parentPath)
    const normalizedCandidatePath = normalizeComparablePath(candidatePath)
    if (normalizedParentPath === normalizedCandidatePath) return true

    return normalizedCandidatePath.startsWith(`${normalizedParentPath}/`)
  }

  function selectSingleItem(path: string, kind: SelectableItemKind): void {
    setSelectedItems([{ path, kind }])
  }

  function toggleItemSelection(path: string, kind: SelectableItemKind): void {
    setSelectedItems(previous => {
      const alreadySelected = previous.some(item => item.path === path)
      if (alreadySelected) {
        return previous.filter(item => item.path !== path)
      }

      if (kind === 'root') {
        return [{ path, kind }]
      }

      const nextItems = previous.filter(item => item.kind !== 'root')
      return [...nextItems, { path, kind }]
    })
  }

  function handleItemClick(
    path: string,
    kind: SelectableItemKind,
    event: ReactMouseEvent<HTMLElement>,
  ): void {
    event.stopPropagation()
    setContextMenu(null)

    if (event.ctrlKey || event.metaKey) {
      toggleItemSelection(path, kind)
      return
    }

    selectSingleItem(path, kind)
  }

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
      openAlertDialog(
        t('activityBar.filesInvalidPathTitle'),
        t('activityBar.filesInvalidPathMessage', { path: draftRootPath }),
      )
      return
    }

    setIsUpdatingRootPath(true)
    try {
      await setRootPath(nextPath)
      setIsEditingRootPath(false)
    } catch {
      setIsEditingRootPath(false)
      openAlertDialog(
        t('activityBar.filesInvalidPathTitle'),
        t('activityBar.filesInvalidPathMessage', { path: nextPath }),
      )
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

  async function handleUploadSelection(destinationPath: string, sourcePaths: string[]): Promise<void> {
    const normalizedSourcePaths = normalizePaths(sourcePaths)
    if (normalizedSourcePaths.length === 0) return

    try {
      await uploadFiles(destinationPath, normalizedSourcePaths)
    } catch (nextError) {
      openAlertDialog(
        t('activityBar.filesUploadFailedTitle'),
        t('activityBar.filesUploadFailedMessage', {
          message: nextError instanceof Error ? nextError.message : String(nextError),
        }),
      )
    }
  }

  async function handleDownloadSelection(destinationPath: string, sourcePaths: string[]): Promise<void> {
    const normalizedSourcePaths = normalizePaths(sourcePaths)
    if (normalizedSourcePaths.length === 0) return

    try {
      await downloadFiles(destinationPath, normalizedSourcePaths)
    } catch (nextError) {
      openAlertDialog(
        t('activityBar.filesDownloadFailedTitle'),
        t('activityBar.filesDownloadFailedMessage', {
          message: nextError instanceof Error ? nextError.message : String(nextError),
        }),
      )
    }
  }

  async function pickUploadSources(
    destinationPath: string,
    sourceType: 'files' | 'directories',
  ): Promise<void> {
    if (!window.dialogAPI?.openPaths) return

    const selectedPaths = await window.dialogAPI.openPaths({
      title: sourceType === 'files'
        ? t('activityBar.filesUploadFile')
        : t('activityBar.filesUploadFolder'),
      allowFiles: sourceType === 'files',
      allowDirectories: sourceType === 'directories',
      multiSelections: true,
    })

    await handleUploadSelection(destinationPath, selectedPaths)
  }

  async function pickDownloadTarget(sourcePaths: string[]): Promise<void> {
    if (!window.dialogAPI?.openPaths) return

    const selectedPaths = await window.dialogAPI.openPaths({
      title: t('activityBar.filesDownloadTo'),
      allowDirectories: true,
      multiSelections: false,
    })

    const destinationPath = selectedPaths[0]
    if (!destinationPath) return

    await handleDownloadSelection(destinationPath, sourcePaths)
  }

  function openCreateDialog(kind: CreateEntryKind): void {
    if (!createParentPath) return

    setContextMenu(null)
    setCreateDialog({
      kind,
      parentPath: createParentPath,
      name: '',
      isSubmitting: false,
    })
  }

  async function handleSubmitCreateDialog(): Promise<void> {
    if (!createDialog) return

    const trimmedName = createDialog.name.trim()
    if (!trimmedName) {
      openAlertDialog(
        createDialog.kind === 'directory'
          ? t('activityBar.filesCreateDirectoryFailedTitle')
          : t('activityBar.filesCreateFileFailedTitle'),
        t('activityBar.filesCreateInvalidNameMessage'),
      )
      return
    }

    setCreateDialog(previous => previous ? {
      ...previous,
      isSubmitting: true,
    } : previous)

    try {
      const createdPath = createDialog.kind === 'directory'
        ? await createDirectory(createDialog.parentPath, trimmedName)
        : await createFile(createDialog.parentPath, trimmedName)

      if (!isPathWithinTarget(rootSnapshot?.cwd ?? '', createDialog.parentPath)) {
        setCreateDialog(null)
        return
      }

      if (rootSnapshot && createDialog.parentPath !== rootSnapshot.cwd) {
        setOpenItems(previous => {
          const nextOpenItems = new Set(previous)
          nextOpenItems.add(getDirectoryValue(createDialog.parentPath))
          return nextOpenItems
        })
      }

      setSelectedItems([{
        path: createdPath,
        kind: createDialog.kind === 'directory' ? 'directory' : 'file',
      }])
      setCreateDialog(null)
      setContextMenu(null)
    } catch (nextError) {
      openAlertDialog(
        createDialog.kind === 'directory'
          ? t('activityBar.filesCreateDirectoryFailedTitle')
          : t('activityBar.filesCreateFileFailedTitle'),
        createDialog.kind === 'directory'
          ? t('activityBar.filesCreateDirectoryFailedMessage', {
            message: nextError instanceof Error ? nextError.message : String(nextError),
          })
          : t('activityBar.filesCreateFileFailedMessage', {
            message: nextError instanceof Error ? nextError.message : String(nextError),
          }),
      )
      setCreateDialog(previous => previous ? {
        ...previous,
        isSubmitting: false,
      } : previous)
    }
  }

  function openDeleteDialogForSelectedItems(): void {
    if (selectedDeletableItems.length === 0) return

    setContextMenu(null)
    setDeleteDialog({
      items: selectedDeletableItems,
      isSubmitting: false,
    })
  }

  async function handleConfirmDeleteDialog(): Promise<void> {
    if (!deleteDialog) return

    setDeleteDialog(previous => previous ? {
      ...previous,
      isSubmitting: true,
    } : previous)

    try {
      const deletedPaths = await deleteEntries(deleteDialog.items.map(item => item.path))
      const deletedPathSet = new Set(deletedPaths)

      setOpenItems(previous => {
        const nextOpenItems = new Set<string>()

        previous.forEach(value => {
          const directoryPath = getDirectoryPathFromValue(value)
          if (!directoryPath) {
            nextOpenItems.add(value)
            return
          }

          const shouldRemove = deletedPaths.some(deletedPath => isPathWithinTarget(deletedPath, directoryPath))
          if (!shouldRemove) {
            nextOpenItems.add(value)
          }
        })

        if (rootValue) {
          nextOpenItems.add(rootValue)
        }
        return nextOpenItems
      })

      if (rootSnapshot) {
        setSelectedItems([{
          path: rootSnapshot.cwd,
          kind: 'root',
        }])
      } else {
        setSelectedItems(previous => previous.filter(item => !deletedPathSet.has(item.path)))
      }

      setDeleteDialog(null)
      setContextMenu(null)
    } catch (nextError) {
      openAlertDialog(
        t('activityBar.filesDeleteFailedTitle'),
        t('activityBar.filesDeleteFailedMessage', {
          message: nextError instanceof Error ? nextError.message : String(nextError),
        }),
      )
      setDeleteDialog(previous => previous ? {
        ...previous,
        isSubmitting: false,
      } : previous)
    }
  }

  function hasFileDrag(event: ReactDragEvent<HTMLElement>): boolean {
    return Array.from(event.dataTransfer.types).includes('Files')
  }

  function extractDroppedPaths(event: ReactDragEvent<HTMLElement>): string[] {
    if (!window.dialogAPI?.getPathsForFiles) return []

    const files = Array.from(event.dataTransfer.files ?? [])
    return normalizePaths(window.dialogAPI.getPathsForFiles(files))
  }

  function handleDirectoryDragOver(targetPath: string, event: ReactDragEvent<HTMLElement>): void {
    if (isTransferring || !hasFileDrag(event)) return

    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    if (dragTargetPath !== targetPath) {
      setDragTargetPath(targetPath)
    }
  }

  function handleDirectoryDragLeave(targetPath: string, event: ReactDragEvent<HTMLElement>): void {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
    if (dragTargetPath === targetPath) {
      setDragTargetPath(null)
    }
  }

  function handleDirectoryDrop(targetPath: string, event: ReactDragEvent<HTMLElement>): void {
    if (isTransferring || !hasFileDrag(event)) return

    event.preventDefault()
    event.stopPropagation()
    setDragTargetPath(null)
    setContextMenu(null)
    void handleUploadSelection(targetPath, extractDroppedPaths(event))
  }

  function handleBrowserDragLeave(event: ReactDragEvent<HTMLDivElement>): void {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
    setDragTargetPath(null)
  }

  function handleBrowserDragOver(event: ReactDragEvent<HTMLDivElement>): void {
    if (!hasFileDrag(event)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleBrowserDrop(event: ReactDragEvent<HTMLDivElement>): void {
    if (!hasFileDrag(event)) return

    event.preventDefault()
    event.stopPropagation()
    setDragTargetPath(null)
  }

  function handleItemContextMenu(
    targetPath: string,
    targetKind: SelectableItemKind,
    event: React.MouseEvent<HTMLElement>,
  ): void {
    event.preventDefault()
    event.stopPropagation()
    if (!selectedPathSet.has(targetPath)) {
      selectSingleItem(targetPath, targetKind)
    }
    setContextMenu({
      targetKind,
      targetPath,
      x: event.clientX,
      y: event.clientY,
    })
  }

  function renderDirectoryLayout(
    targetPath: string,
    targetKind: SelectableItemKind,
    icon: ReactNode,
    label: ReactNode,
    permissions?: string,
    modifiedAtMs?: number,
    isRoot = false,
  ) {
    const isSelected = selectedPathSet.has(targetPath)

    return (
      <TreeItemLayout
        className={mergeClasses(
          styles.itemLayout,
          isSelected ? styles.selectedLayout : undefined,
          isRoot ? styles.rootItemLayout : undefined,
          dragTargetPath === targetPath ? styles.dropTargetLayout : undefined,
        )}
        iconBefore={<span className={styles.icon}>{icon}</span>}
        onClick={event => handleItemClick(targetPath, targetKind, event)}
        onContextMenu={event => handleItemContextMenu(targetPath, targetKind, event)}
        onDragLeave={event => handleDirectoryDragLeave(targetPath, event)}
        onDragOver={event => handleDirectoryDragOver(targetPath, event)}
        onDrop={event => handleDirectoryDrop(targetPath, event)}
      >
        {renderItemContent(label, permissions, modifiedAtMs)}
      </TreeItemLayout>
    )
  }

  function renderFileLayout(
    targetPath: string,
    label: string,
    permissions?: string,
    modifiedAtMs?: number,
  ) {
    const isSelected = selectedPathSet.has(targetPath)

    return (
      <TreeItemLayout
        className={mergeClasses(
          styles.itemLayout,
          isSelected ? styles.selectedLayout : undefined,
        )}
        iconBefore={<span className={styles.icon}><DocumentRegular /></span>}
        onClick={event => handleItemClick(targetPath, 'file', event)}
        onContextMenu={event => handleItemContextMenu(targetPath, 'file', event)}
      >
        {renderItemContent(label, permissions, modifiedAtMs)}
      </TreeItemLayout>
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
            {renderDirectoryLayout(
              entry.absolutePath,
              'directory',
              <FolderRegular />,
              entry.name,
              entry.permissions,
              entry.modifiedAtMs,
            )}
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
          {renderFileLayout(
            entry.absolutePath,
            entry.name,
            entry.permissions,
            entry.modifiedAtMs,
          )}
        </TreeItem>
      )
    })
  }

  function renderTransferTitle(direction: TerminalFilesTransferDirection, isScanning: boolean): string {
    if (isScanning) {
      return direction === 'download'
        ? t('activityBar.filesDownloadPreparing')
        : t('activityBar.filesUploadPreparing')
    }

    return direction === 'download'
      ? t('activityBar.filesDownloadingItem', {
        name: transferState?.currentItemName ?? t('activityBar.filesTransferProgressFallback'),
      })
      : t('activityBar.filesUploadingItem', {
        name: transferState?.currentItemName ?? t('activityBar.filesTransferProgressFallback'),
      })
  }

  function renderTransferStatusBar(): ReactNode {
    if (!transferState) return null

    const isScanning = transferState.status === 'scanning'
    const progressValue = typeof transferState.percent === 'number'
      ? Math.max(0, Math.min(1, transferState.percent / 100))
      : undefined
    const progressText = typeof transferState.percent === 'number'
      ? `${Math.round(transferState.percent)}%`
      : '--'

    return (
      <div className={styles.transferStatusBar}>
        <div className={styles.transferStatusHeader}>
          <span className={styles.transferStatusTitle} title={transferState.currentItemName ?? undefined}>
            {renderTransferTitle(transferState.direction, isScanning)}
          </span>
          <span className={styles.transferStatusValue}>{progressText}</span>
        </div>
        <div className={styles.transferStatusMetaRow}>
          <span className={styles.transferStatusMeta} title={transferState.destinationPath}>
            {t('activityBar.filesTransferTarget')}: {transferState.destinationPath}
          </span>
          <span className={styles.transferStatusMeta}>
            {t('activityBar.filesTransferItems', {
              completed: transferState.completedItems,
              total: transferState.totalItems,
            })}
          </span>
        </div>
        <ProgressBar
          className={styles.transferStatusProgress}
          max={1}
          value={isScanning ? undefined : progressValue}
        />
      </div>
    )
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
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button
                aria-label={t('activityBar.filesUpload')}
                appearance="subtle"
                className={styles.toolbarButton}
                disabled={isTransferring}
                icon={<ArrowUploadRegular />}
                size="small"
                title={t('activityBar.filesUpload')}
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem
                  disabled={isTransferring}
                  onClick={() => void pickUploadSources(rootSnapshot.cwd, 'files')}
                >
                  {t('activityBar.filesUploadFile')}
                </MenuItem>
                <MenuItem
                  disabled={isTransferring}
                  onClick={() => void pickUploadSources(rootSnapshot.cwd, 'directories')}
                >
                  {t('activityBar.filesUploadFolder')}
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button
                aria-label={t('activityBar.filesDownload')}
                appearance="subtle"
                className={styles.toolbarButton}
                disabled={isTransferring}
                icon={<ArrowDownloadRegular />}
                size="small"
                title={t('activityBar.filesDownload')}
              />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem
                  disabled={isTransferring || selectedItems.length === 0}
                  onClick={() => void pickDownloadTarget(selectedItems.map(item => item.path))}
                >
                  {t('activityBar.filesDownloadSelected')}
                </MenuItem>
                <MenuItem
                  disabled={isTransferring}
                  onClick={() => void pickDownloadTarget([rootSnapshot.cwd])}
                >
                  {t('activityBar.filesDownloadCurrentDirectory')}
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
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
            disabled={!canCreateEntry}
            icon={<FolderAddRegular />}
            onClick={() => openCreateDialog('directory')}
            size="small"
            title={t('activityBar.filesNewFolder')}
          />
          <Button
            aria-label={t('activityBar.filesNewFile')}
            appearance="subtle"
            className={styles.toolbarButton}
            disabled={!canCreateEntry}
            icon={<DocumentAddRegular />}
            onClick={() => openCreateDialog('file')}
            size="small"
            title={t('activityBar.filesNewFile')}
          />
          <Button
            aria-label={t('activityBar.filesDelete')}
            appearance="subtle"
            className={styles.toolbarButton}
            disabled={!canDeleteEntries}
            icon={<DeleteRegular />}
            onClick={openDeleteDialogForSelectedItems}
            size="small"
            title={t('activityBar.filesDelete')}
          />
        </div>

        <div
          className={styles.browser}
          onDragLeave={handleBrowserDragLeave}
          onDragOver={handleBrowserDragOver}
          onDrop={handleBrowserDrop}
        >
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
                {renderDirectoryLayout(
                  rootSnapshot.cwd,
                  'root',
                  <FolderOpenRegular />,
                  renderRootNameCell(rootSnapshot.cwd),
                  undefined,
                  undefined,
                  true,
                )}
                <Tree>
                  {rootSnapshot.entries.length === 0
                    ? renderPlaceholderLeaf(`${rootSnapshot.cwd}:empty`, t('activityBar.filesEmpty'))
                    : renderEntries(rootSnapshot.entries)}
                </Tree>
              </TreeItem>
            </Tree>
          </div>
        </div>

        {renderTransferStatusBar()}
      </div>

      {contextMenu && (
        <div
          className={styles.contextMenuSurface}
          ref={contextMenuRef}
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          <MenuList>
            <MenuItem
              disabled={isTransferring}
              onClick={() => {
                setContextMenu(null)
                void pickDownloadTarget(selectedItems.map(item => item.path))
              }}
            >
              {t('activityBar.filesDownloadTo')}
            </MenuItem>
            {isDirectoryLike(contextMenu.targetKind) && (
              <MenuItem
                disabled={isTransferring}
                onClick={() => {
                  setContextMenu(null)
                  void pickUploadSources(contextMenu.targetPath, 'files')
                }}
              >
                {t('activityBar.filesUploadFile')}
              </MenuItem>
            )}
            {isDirectoryLike(contextMenu.targetKind) && (
              <MenuItem
                disabled={isTransferring}
                onClick={() => {
                  setContextMenu(null)
                  void pickUploadSources(contextMenu.targetPath, 'directories')
                }}
              >
                {t('activityBar.filesUploadFolder')}
              </MenuItem>
            )}
            {isDirectoryLike(contextMenu.targetKind) && (
              <MenuItem
                disabled={!canCreateEntry}
                onClick={() => {
                  setContextMenu(null)
                  openCreateDialog('directory')
                }}
              >
                {t('activityBar.filesNewFolder')}
              </MenuItem>
            )}
            {isDirectoryLike(contextMenu.targetKind) && (
              <MenuItem
                disabled={!canCreateEntry}
                onClick={() => {
                  setContextMenu(null)
                  openCreateDialog('file')
                }}
              >
                {t('activityBar.filesNewFile')}
              </MenuItem>
            )}
            {contextMenu.targetKind !== 'root' && (
              <MenuItem
                disabled={!canDeleteEntries}
                onClick={() => {
                  setContextMenu(null)
                  openDeleteDialogForSelectedItems()
                }}
              >
                {t('activityBar.filesDelete')}
              </MenuItem>
            )}
          </MenuList>
        </div>
      )}

      <Dialog
        onOpenChange={(_, data) => {
          if (createDialog?.isSubmitting) return
          if (!data.open) {
            setCreateDialog(null)
          }
        }}
        open={Boolean(createDialog)}
      >
        <DialogSurface className={styles.dialogSurface}>
          <DialogBody>
            <DialogTitle>
              {createDialog?.kind === 'directory'
                ? t('activityBar.filesCreateDirectoryTitle')
                : t('activityBar.filesCreateFileTitle')}
            </DialogTitle>
            <DialogContent>
              <div className={styles.dialogContentStack}>
                <div className={styles.dialogField}>
                  <span className={styles.dialogFieldLabel}>{t('activityBar.filesCreateParent')}</span>
                  <Input
                    appearance="filled-darker"
                    readOnly
                    size="small"
                    value={createDialog?.parentPath ?? ''}
                  />
                </div>
                <div className={styles.dialogField}>
                  <span className={styles.dialogFieldLabel}>{t('activityBar.filesCreateName')}</span>
                  <Input
                    appearance="filled-darker"
                    autoFocus
                    disabled={createDialog?.isSubmitting}
                    onChange={(_, data) => {
                      setCreateDialog(previous => previous ? {
                        ...previous,
                        name: data.value,
                      } : previous)
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleSubmitCreateDialog()
                      }
                    }}
                    placeholder={t('activityBar.filesCreateNamePlaceholder')}
                    size="small"
                    value={createDialog?.name ?? ''}
                  />
                  <span className={styles.dialogHint}>{t('activityBar.filesCreateInvalidNameHint')}</span>
                </div>
              </div>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                disabled={createDialog?.isSubmitting}
                onClick={() => setCreateDialog(null)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                appearance="primary"
                disabled={createDialog?.isSubmitting}
                onClick={() => void handleSubmitCreateDialog()}
              >
                {t('common.confirm')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog
        onOpenChange={(_, data) => {
          if (deleteDialog?.isSubmitting) return
          if (!data.open) {
            setDeleteDialog(null)
          }
        }}
        open={Boolean(deleteDialog)}
      >
        <DialogSurface className={styles.dialogSurface}>
          <DialogBody>
            <DialogTitle>{t('activityBar.filesDeleteConfirmTitle')}</DialogTitle>
            <DialogContent>
              <div className={styles.dialogContentStack}>
                <span>
                  {deleteDialog && deleteDialog.items.length === 1
                    ? t('activityBar.filesDeleteConfirmSingle', {
                      name: deleteDialog.items[0]?.path.split(/[\\/]/).pop() ?? deleteDialog.items[0]?.path ?? '',
                    })
                    : t('activityBar.filesDeleteConfirmMultiple', {
                      count: deleteDialog?.items.length ?? 0,
                    })}
                </span>
                <span className={styles.dialogHint}>
                  {deleteDialog?.items.some(item => item.kind === 'directory')
                    ? t('activityBar.filesDeleteConfirmRecursiveHint')
                    : t('activityBar.filesDeleteConfirmHint')}
                </span>
              </div>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                disabled={deleteDialog?.isSubmitting}
                onClick={() => setDeleteDialog(null)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                appearance="primary"
                disabled={deleteDialog?.isSubmitting}
                onClick={() => void handleConfirmDeleteDialog()}
              >
                {t('common.confirm')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog
        modalType="alert"
        onOpenChange={(_, data) => {
          if (!data.open) {
            setAlertDialog(null)
          }
        }}
        open={Boolean(alertDialog)}
      >
        <DialogSurface className={styles.dialogSurface}>
          <DialogBody>
            <DialogTitle>{alertDialog?.title ?? ''}</DialogTitle>
            <DialogContent>{alertDialog?.message ?? ''}</DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setAlertDialog(null)}>
                {t('common.ok')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  )
}
