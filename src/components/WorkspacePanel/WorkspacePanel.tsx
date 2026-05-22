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
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  MenuItem,
  MenuList,
  makeStyles,
  mergeClasses,
  Spinner,
  tokens,
} from '@fluentui/react-components'
import {
  AddRegular,
  ChevronDownRegular,
  ChevronLeftRegular,
  ChevronRightRegular,
  CopyRegular,
  DismissRegular,
  PanelLeftRegular,
  PanelTopExpandRegular,
} from '@fluentui/react-icons'
import { useRTL } from '@/hooks/useRTL'
import { TerminalPane } from '@/components/Terminal/TerminalPane'
import { VNCDesktopPane } from '@/components/VNC/VNCDesktopPane'
import { subscribeOpenShellTab } from '@/shared/workspaceEvents'
import { useWorkspaceRuntime } from './workspaceRuntimeContext'
import type { ShellSummary } from '@/shared/shellTypes'

type WorkspaceLayoutMode = 'horizontal' | 'vertical'

type WorkspaceTabContent = {
  type: 'terminal' | 'vnc'
  protocol: ShellSummary['protocol']
  shellId: string
  shellName: string
  sessionId?: string
}

interface WorkspaceTab {
  id: string
  sequence: number
  title?: string
  content: WorkspaceTabContent
}

interface WorkspaceState {
  tabs: WorkspaceTab[]
  activeTabId: string
}

interface ScrollState {
  canScrollLeft: boolean
  canScrollRight: boolean
}

interface TabContextMenuState {
  x: number
  y: number
  tabId: string
}

interface TabDragSession {
  tabId: string
  pointerId: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  offsetX: number
  offsetY: number
  width: number
  height: number
  isDragging: boolean
}

interface WorkspaceTabPanelProps {
  focusMode?: boolean
  onTerminalSessionDisposed: (tabId: string, sessionId: string) => void
  onTerminalSessionReady: (tabId: string, sessionId: string) => void
  tab: WorkspaceTab
  isActive: boolean
}

interface WorkspacePanelProps {
  focusMode?: boolean
}

const INITIAL_TAB_SEQUENCE = 1
const CONTEXT_MENU_VIEWPORT_GAP = 8
const TAB_DRAG_START_DISTANCE = 4

function createWorkspaceTab(
  sequence: number,
  content: WorkspaceTabContent,
  title?: string,
): WorkspaceTab {
  return {
    id: `workspace-tab-${sequence}`,
    sequence,
    title,
    content,
  }
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    boxSizing: 'border-box',
  },
  horizontalRoot: {
    flexDirection: 'column',
  },
  verticalRoot: {
    flexDirection: 'row',
  },
  horizontalBar: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    minHeight: '40px',
    paddingInline: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    boxSizing: 'border-box',
  },
  tabScrollFrame: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  tabScrollViewport: {
    flex: 1,
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    scrollBehavior: 'smooth',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
  tabOverflowFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '28px',
    zIndex: 1,
    pointerEvents: 'none',
  },
  tabOverflowFadeLeft: {
    left: 0,
    backgroundImage: `linear-gradient(90deg, ${tokens.colorNeutralBackground2} 0%, transparent 100%)`,
  },
  tabOverflowFadeRight: {
    right: 0,
    backgroundImage: `linear-gradient(270deg, ${tokens.colorNeutralBackground2} 0%, transparent 100%)`,
  },
  tabStripInner: {
    display: 'flex',
    alignItems: 'stretch',
    gap: tokens.spacingHorizontalXS,
    minWidth: '100%',
    width: '100%',
    paddingInlineEnd: tokens.spacingHorizontalXS,
    boxSizing: 'border-box',
  },
  scrollButtonGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },
  tabActionButton: {
    width: '32px',
    minWidth: '32px',
    height: '32px',
    padding: 0,
    flexShrink: 0,
    borderRadius: tokens.borderRadiusMedium,
    boxSizing: 'border-box',
  },
  verticalSidebar: {
    flex: '0 0 20%',
    maxWidth: '300px',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground2,
    borderInlineEndColor: tokens.colorNeutralStroke2,
    borderInlineEndStyle: 'solid',
    borderInlineEndWidth: tokens.strokeWidthThin,
    boxSizing: 'border-box',
  },
  verticalTabList: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingInline: tokens.spacingHorizontalXS,
    paddingBlock: tokens.spacingVerticalXS,
    boxSizing: 'border-box',
  },
  verticalFooter: {
    flexShrink: 0,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalXS,
    padding: tokens.spacingHorizontalXS,
    boxSizing: 'border-box',
  },
  tabItem: {
    position: 'relative',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  tabItemDragging: {
    zIndex: 2,
  },
  tabItemHorizontal: {
    flex: '1 1 168px',
    minWidth: '64px',
    maxWidth: '240px',
  },
  tabItemVertical: {
    width: '100%',
    flexShrink: 0,
  },
  tabButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
    transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease',
  },
  tabButtonDragging: {
    cursor: 'grabbing',
    opacity: 0.48,
  },
  tabButtonHorizontal: {
    width: '100%',
    height: '32px',
    minWidth: 0,
    maxWidth: '100%',
    paddingInlineStart: tokens.spacingHorizontalM,
    paddingInlineEnd: '30px',
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid transparent`,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
    '&:focus-visible': {
      backgroundColor: tokens.colorNeutralBackground1,
      color: tokens.colorNeutralForeground1,
    },
  },
  tabButtonHorizontalActive: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
    color: tokens.colorNeutralForeground1,
    boxShadow: `inset 0 -2px 0 ${tokens.colorBrandBackground}`,
    fontWeight: tokens.fontWeightSemibold,
  },
  tabButtonVertical: {
    width: '100%',
    minHeight: '32px',
    paddingInlineStart: tokens.spacingHorizontalM,
    paddingInlineEnd: '30px',
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid transparent`,
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground2,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
    '&:focus-visible': {
      backgroundColor: tokens.colorNeutralBackground1,
      color: tokens.colorNeutralForeground1,
    },
  },
  tabButtonVerticalActive: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderTopColor: tokens.colorNeutralStroke2,
    borderRightColor: tokens.colorNeutralStroke2,
    borderBottomColor: tokens.colorNeutralStroke2,
    borderLeftColor: tokens.colorNeutralStroke2,
    color: tokens.colorNeutralForeground1,
    boxShadow: `inset 2px 0 0 ${tokens.colorBrandBackground}`,
    fontWeight: tokens.fontWeightSemibold,
  },
  tabLabel: {
    display: 'block',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    textAlign: 'start',
    lineHeight: tokens.lineHeightBase300,
  },
  tabCloseButton: {
    position: 'absolute',
    insetInlineEnd: tokens.spacingHorizontalXS,
    top: '50%',
    transform: 'translateY(-50%)',
    width: '20px',
    minWidth: '20px',
    height: '20px',
    padding: 0,
    borderRadius: tokens.borderRadiusCircular,
    boxSizing: 'border-box',
    opacity: 0,
    transition: 'opacity 120ms ease, background-color 120ms ease',
  },
  tabCloseButtonVisible: {
    opacity: 1,
    pointerEvents: 'auto',
  },
  tabCloseButtonHidden: {
    pointerEvents: 'none',
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
  contextMenuItemContent: {
    minWidth: '116px',
  },
  dragPreview: {
    position: 'fixed',
    left: 0,
    top: 0,
    zIndex: 1400,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minWidth: 0,
    paddingInlineStart: tokens.spacingHorizontalM,
    paddingInlineEnd: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    boxSizing: 'border-box',
    boxShadow: tokens.shadow16,
    fontWeight: tokens.fontWeightSemibold,
    transform: 'translate3d(var(--drag-x), var(--drag-y), 0)',
  },
  dragPreviewHorizontal: {
    height: '32px',
    boxShadow: `${tokens.shadow16}, inset 0 -2px 0 ${tokens.colorBrandBackground}`,
  },
  dragPreviewVertical: {
    minHeight: '32px',
    boxShadow: `${tokens.shadow16}, inset 2px 0 0 ${tokens.colorBrandBackground}`,
  },
  dragPreviewLabel: {
    display: 'block',
    minWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    lineHeight: tokens.lineHeightBase300,
  },
  contentArea: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  tabPanel: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    width: '100%',
    height: '100%',
    overflow: 'auto',
    boxSizing: 'border-box',
  },
  tabPanelActive: {
    visibility: 'visible',
    pointerEvents: 'auto',
    zIndex: 1,
  },
  tabPanelInactive: {
    visibility: 'hidden',
    pointerEvents: 'none',
    zIndex: 0,
  },
  terminalTabPanel: {
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalM,
    minHeight: 0,
    padding: tokens.spacingHorizontalL,
    boxSizing: 'border-box',
  },
  emptyStateText: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXS,
    color: tokens.colorNeutralForeground2,
    textAlign: 'center',
  },
  emptyStateTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  emptyStateDescription: {
    fontSize: tokens.fontSizeBase200,
  },
})

function WorkspaceTabPanel({
  focusMode = false,
  isActive,
  onTerminalSessionDisposed,
  onTerminalSessionReady,
  tab,
}: WorkspaceTabPanelProps) {
  const styles = useStyles()

  return (
    <section
      id={`${tab.id}-panel`}
      aria-labelledby={`${tab.id}-tab`}
      aria-hidden={!isActive}
      className={mergeClasses(
        styles.tabPanel,
        styles.terminalTabPanel,
        isActive ? styles.tabPanelActive : styles.tabPanelInactive,
      )}
      role="tabpanel"
      style={focusMode && !isActive ? { display: 'none' } : undefined}
    >
      {tab.content.type === 'vnc' ? (
        <VNCDesktopPane
          shellId={tab.content.shellId}
          tabId={tab.id}
          isActive={isActive}
        />
      ) : (
        <TerminalPane
          shellId={tab.content.shellId}
          tabId={tab.id}
          isActive={isActive}
          onSessionDisposed={sessionId => onTerminalSessionDisposed(tab.id, sessionId)}
          onSessionReady={sessionId => onTerminalSessionReady(tab.id, sessionId)}
        />
      )}
    </section>
  )
}

export const WorkspacePanel: FC<WorkspacePanelProps> = ({ focusMode = false }) => {
  const styles = useStyles()
  const { t } = useTranslation()
  const { isRTL } = useRTL()
  const { setActiveTerminalSession } = useWorkspaceRuntime()
  const [layoutMode, setLayoutMode] = useState<WorkspaceLayoutMode>('horizontal')
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    tabs: [],
    activeTabId: '',
  })
  const [startupState, setStartupState] = useState<'idle' | 'loading' | 'unavailable'>('idle')
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)
  const [focusedTabId, setFocusedTabId] = useState<string | null>(null)
  const [scrollState, setScrollState] = useState<ScrollState>({
    canScrollLeft: false,
    canScrollRight: false,
  })
  const [tabContextMenu, setTabContextMenu] = useState<TabContextMenuState | null>(null)
  const [tabDragSession, setTabDragSession] = useState<TabDragSession | null>(null)
  const nextSequenceRef = useRef(INITIAL_TAB_SEQUENCE)
  const isResolvingDefaultTabRef = useRef(false)
  const tabContextMenuRef = useRef<HTMLDivElement | null>(null)
  const tabDragSessionRef = useRef<TabDragSession | null>(null)
  const tabButtonRefs = useRef(new Map<string, HTMLButtonElement | null>())
  const tabScrollViewportRef = useRef<HTMLDivElement | null>(null)
  const tabStripInnerRef = useRef<HTMLDivElement | null>(null)
  const tabsRef = useRef<WorkspaceTab[]>([])
  const isVerticalRef = useRef(false)

  const { tabs, activeTabId } = workspaceState
  const isVertical = layoutMode === 'vertical'
  const visibleCloseTabId = hoveredTabId ?? focusedTabId
  tabsRef.current = tabs
  isVerticalRef.current = isVertical

  const setTabButtonRef = useCallback((tabId: string) => (node: HTMLButtonElement | null) => {
    if (node) {
      tabButtonRefs.current.set(tabId, node)
    } else {
      tabButtonRefs.current.delete(tabId)
    }
  }, [])

  const focusTab = useCallback((tabId: string) => {
    window.requestAnimationFrame(() => {
      tabButtonRefs.current.get(tabId)?.focus({ preventScroll: true })
    })
  }, [])

  const openTerminalTab = useCallback((shell: ShellSummary, onlyWhenEmpty = false) => {
    let openedTabId: string | null = null

    setWorkspaceState(prev => {
      if (onlyWhenEmpty && prev.tabs.length > 0) {
        return prev
      }

      const nextTab = createWorkspaceTab(
        nextSequenceRef.current,
        {
          type: shell.protocol === 'vnc' ? 'vnc' : 'terminal',
          protocol: shell.protocol,
          shellId: shell.id,
          shellName: shell.name,
        },
        shell.name,
      )
      nextSequenceRef.current += 1
      openedTabId = nextTab.id

      return {
        tabs: [...prev.tabs, nextTab],
        activeTabId: nextTab.id,
      }
    })

    if (openedTabId) {
      focusTab(openedTabId)
    }

    return openedTabId
  }, [focusTab])

  const openStartupTerminalTab = useCallback(async (onlyWhenEmpty = false) => {
    if (onlyWhenEmpty && isResolvingDefaultTabRef.current) {
      return
    }

    isResolvingDefaultTabRef.current = true
    if (onlyWhenEmpty) {
      setStartupState('loading')
    }

    try {
      const preferredShellId = await window.settingsAPI.getDefaultLocalShellId()
      const shell = await window.shellAPI.getStartupLocalShell(preferredShellId)
      if (!shell) {
        if (onlyWhenEmpty) {
          setStartupState('unavailable')
        }
        return
      }

      openTerminalTab(shell, onlyWhenEmpty)
      if (onlyWhenEmpty) {
        setStartupState('idle')
      }
    } catch {
      if (onlyWhenEmpty) {
        setStartupState('unavailable')
      }
    } finally {
      isResolvingDefaultTabRef.current = false
    }
  }, [openTerminalTab])

  const closeTabContextMenu = useCallback(() => {
    setTabContextMenu(null)
  }, [])

  const openTabContextMenu = useCallback((event: MouseEvent<HTMLElement>, tabId: string) => {
    event.preventDefault()
    event.stopPropagation()
    setTabContextMenu({
      x: event.clientX,
      y: event.clientY,
      tabId,
    })
  }, [])

  const cloneTab = useCallback((tabId: string) => {
    let clonedTabId: string | null = null

    setWorkspaceState(prev => {
      const sourceIndex = prev.tabs.findIndex(tab => tab.id === tabId)
      if (sourceIndex < 0) return prev

      const sourceTab = prev.tabs[sourceIndex]
      const nextTab = createWorkspaceTab(
        nextSequenceRef.current,
        {
          type: sourceTab.content.type,
          protocol: sourceTab.content.protocol,
          shellId: sourceTab.content.shellId,
          shellName: sourceTab.content.shellName,
        },
        sourceTab.title,
      )
      nextSequenceRef.current += 1
      clonedTabId = nextTab.id

      return {
        tabs: [
          ...prev.tabs.slice(0, sourceIndex + 1),
          nextTab,
          ...prev.tabs.slice(sourceIndex + 1),
        ],
        activeTabId: nextTab.id,
      }
    })

    closeTabContextMenu()

    if (clonedTabId) {
      focusTab(clonedTabId)
    }
  }, [closeTabContextMenu, focusTab])

  const updateScrollState = useCallback(() => {
    if (isVertical) {
      setScrollState({ canScrollLeft: false, canScrollRight: false })
      return
    }

    // 通过真实可见区域判断溢出，避开 RTL 下 scrollLeft 语义不一致的问题。
    const viewport = tabScrollViewportRef.current
    const firstTab = tabs[0] ? tabButtonRefs.current.get(tabs[0].id) : null
    const lastTab = tabs[tabs.length - 1] ? tabButtonRefs.current.get(tabs[tabs.length - 1].id) : null

    if (!viewport || !firstTab || !lastTab) {
      setScrollState({ canScrollLeft: false, canScrollRight: false })
      return
    }

    const viewportRect = viewport.getBoundingClientRect()
    const firstRect = firstTab.getBoundingClientRect()
    const lastRect = lastTab.getBoundingClientRect()

    const nextState: ScrollState = {
      canScrollLeft: firstRect.left < viewportRect.left - 1,
      canScrollRight: lastRect.right > viewportRect.right + 1,
    }

    setScrollState(prev => (
      prev.canScrollLeft === nextState.canScrollLeft
      && prev.canScrollRight === nextState.canScrollRight
        ? prev
        : nextState
    ))
  }, [isVertical, tabs])

  const updateTerminalTabSession = useCallback((tabId: string, sessionId?: string) => {
    setWorkspaceState(prev => ({
      tabs: prev.tabs.map(tab => {
        if (tab.id !== tabId) return tab

        return {
          ...tab,
          content: {
            ...tab.content,
            sessionId,
          },
        }
      }),
      activeTabId: prev.activeTabId,
    }))
  }, [])

  const handleTerminalSessionReady = useCallback((tabId: string, sessionId: string) => {
    updateTerminalTabSession(tabId, sessionId)
  }, [updateTerminalTabSession])

  const handleTerminalSessionDisposed = useCallback((tabId: string, sessionId: string) => {
    setWorkspaceState(prev => ({
      tabs: prev.tabs.map(tab => {
        if (
          tab.id !== tabId
          || tab.content.sessionId !== sessionId
        ) {
          return tab
        }

        return {
          ...tab,
          content: {
            ...tab.content,
            sessionId: undefined,
          },
        }
      }),
      activeTabId: prev.activeTabId,
    }))
  }, [])

  const closeTab = useCallback((tabId: string) => {
    let nextActiveId = activeTabId

    setWorkspaceState(prev => {
      const currentIndex = prev.tabs.findIndex(tab => tab.id === tabId)
      if (currentIndex < 0) {
        nextActiveId = prev.activeTabId
        return prev
      }

      const nextTabs = prev.tabs.filter(tab => tab.id !== tabId)
      if (nextTabs.length === 0) {
        nextActiveId = ''
        return {
          tabs: [],
          activeTabId: '',
        }
      }

      const nextActive = prev.activeTabId === tabId
        ? (nextTabs[currentIndex] ?? nextTabs[currentIndex - 1] ?? nextTabs[0])
        : nextTabs.find(tab => tab.id === prev.activeTabId) ?? nextTabs[0]

      nextActiveId = nextActive.id
      return {
        tabs: nextTabs,
        activeTabId: nextActive.id,
      }
    })

    focusTab(nextActiveId)
  }, [activeTabId, focusTab])

  const selectTab = useCallback((tabId: string) => {
    setWorkspaceState(prev => (
      prev.activeTabId === tabId
        ? prev
        : {
            tabs: prev.tabs,
            activeTabId: tabId,
          }
    ))
  }, [])

  const getTabDropIndex = useCallback((clientX: number, clientY: number, tabId: string) => {
    const currentTabs = tabsRef.current
    const currentIndex = currentTabs.findIndex(tab => tab.id === tabId)
    if (currentIndex < 0 || currentTabs.length < 2) return null

    const isVerticalLayout = isVerticalRef.current
    const pointerCoordinate = isVerticalLayout ? clientY : clientX
    let targetIndex = currentTabs.length

    for (const [index, tab] of currentTabs.entries()) {
      const tabButton = tabButtonRefs.current.get(tab.id)
      if (!tabButton) continue

      const rect = tabButton.getBoundingClientRect()
      const midpoint = isVerticalLayout
        ? rect.top + rect.height / 2
        : rect.left + rect.width / 2

      if (pointerCoordinate < midpoint) {
        targetIndex = index
        break
      }
    }

    const adjustedIndex = currentIndex < targetIndex ? targetIndex - 1 : targetIndex
    return Math.max(0, Math.min(adjustedIndex, currentTabs.length - 1))
  }, [])

  const moveTabToIndex = useCallback((tabId: string, targetIndex: number) => {
    setWorkspaceState(prev => {
      const currentIndex = prev.tabs.findIndex(tab => tab.id === tabId)
      if (currentIndex < 0) return prev

      const boundedIndex = Math.max(0, Math.min(targetIndex, prev.tabs.length - 1))
      if (currentIndex === boundedIndex) {
        return prev.activeTabId === tabId ? prev : { ...prev, activeTabId: tabId }
      }

      const nextTabs = [...prev.tabs]
      const [movedTab] = nextTabs.splice(currentIndex, 1)
      nextTabs.splice(boundedIndex, 0, movedTab)
      tabsRef.current = nextTabs

      return {
        tabs: nextTabs,
        activeTabId: tabId,
      }
    })

    focusTab(tabId)
  }, [focusTab])

  const finishTabDrag = useCallback(() => {
    const session = tabDragSessionRef.current
    tabDragSessionRef.current = null
    setTabDragSession(null)

    if (session?.isDragging) {
      focusTab(session.tabId)
    }
  }, [focusTab])

  const startTabDrag = useCallback((event: ReactPointerEvent<HTMLElement>, tabId: string) => {
    if (event.button !== 0) return

    const tabRect = event.currentTarget.getBoundingClientRect()

    closeTabContextMenu()
    selectTab(tabId)
    setFocusedTabId(tabId)
    event.currentTarget.focus({ preventScroll: true })
    focusTab(tabId)

    const nextSession: TabDragSession = {
      tabId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      offsetX: event.clientX - tabRect.left,
      offsetY: event.clientY - tabRect.top,
      width: tabRect.width,
      height: tabRect.height,
      isDragging: false,
    }

    tabDragSessionRef.current = nextSession
    setTabDragSession(nextSession)
  }, [closeTabContextMenu, focusTab, selectTab])

  const toggleLayoutMode = useCallback(() => {
    setLayoutMode(prev => (prev === 'horizontal' ? 'vertical' : 'horizontal'))
  }, [])

  const scrollTabStrip = useCallback((direction: 'left' | 'right') => {
    const viewport = tabScrollViewportRef.current
    if (!viewport) return

    const viewportRect = viewport.getBoundingClientRect()
    const orderedTabs = tabs
      .map(tab => tabButtonRefs.current.get(tab.id))
      .filter((element): element is HTMLButtonElement => Boolean(element))

    if (!orderedTabs.length) return

    const target = direction === 'left'
      ? [...orderedTabs].reverse().find(element => element.getBoundingClientRect().left < viewportRect.left - 1)
      : orderedTabs.find(element => element.getBoundingClientRect().right > viewportRect.right + 1)

    target?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [tabs])

  const handleTabKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>, tabId: string) => {
    const currentIndex = tabs.findIndex(tab => tab.id === tabId)
    if (currentIndex < 0) return

    const forwardKey = isVertical ? 'ArrowDown' : isRTL ? 'ArrowLeft' : 'ArrowRight'
    const backwardKey = isVertical ? 'ArrowUp' : isRTL ? 'ArrowRight' : 'ArrowLeft'

    let nextIndex = currentIndex

    if (event.key === forwardKey) {
      event.preventDefault()
      nextIndex = (currentIndex + 1) % tabs.length
    } else if (event.key === backwardKey) {
      event.preventDefault()
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (event.key === 'Home') {
      event.preventDefault()
      nextIndex = 0
    } else if (event.key === 'End') {
      event.preventDefault()
      nextIndex = tabs.length - 1
    } else if (event.key === 'Delete') {
      event.preventDefault()
      closeTab(tabId)
      return
    } else {
      return
    }

    const nextTab = tabs[nextIndex]
    if (!nextTab) return
    selectTab(nextTab.id)
    focusTab(nextTab.id)
  }, [closeTab, focusTab, isRTL, isVertical, selectTab, tabs])

  useEffect(() => {
    if (!tabContextMenu) return

    const surface = tabContextMenuRef.current
    if (!surface) return

    const nextX = Math.min(
      Math.max(tabContextMenu.x, CONTEXT_MENU_VIEWPORT_GAP),
      Math.max(CONTEXT_MENU_VIEWPORT_GAP, window.innerWidth - surface.offsetWidth - CONTEXT_MENU_VIEWPORT_GAP),
    )
    const nextY = Math.min(
      Math.max(tabContextMenu.y, CONTEXT_MENU_VIEWPORT_GAP),
      Math.max(CONTEXT_MENU_VIEWPORT_GAP, window.innerHeight - surface.offsetHeight - CONTEXT_MENU_VIEWPORT_GAP),
    )

    if (nextX === tabContextMenu.x && nextY === tabContextMenu.y) return

    setTabContextMenu(previous => (
      previous?.tabId === tabContextMenu.tabId
      && (previous.x !== nextX || previous.y !== nextY)
        ? { ...previous, x: nextX, y: nextY }
        : previous
    ))
  }, [tabContextMenu])

  useEffect(() => {
    if (!tabDragSession) return

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const session = tabDragSessionRef.current
      if (!session || event.pointerId !== session.pointerId) return

      if ((event.buttons & 1) !== 1) {
        finishTabDrag()
        return
      }

      const dragDistance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY)
      let activeSession = session

      if (!session.isDragging) {
        if (dragDistance < TAB_DRAG_START_DISTANCE) return

        activeSession = {
          ...session,
          currentX: event.clientX,
          currentY: event.clientY,
          isDragging: true,
        }
        tabDragSessionRef.current = activeSession
        setTabDragSession(activeSession)
        closeTabContextMenu()
        selectTab(activeSession.tabId)
        setFocusedTabId(activeSession.tabId)
        focusTab(activeSession.tabId)
      }

      event.preventDefault()

      if (activeSession.currentX !== event.clientX || activeSession.currentY !== event.clientY) {
        activeSession = {
          ...activeSession,
          currentX: event.clientX,
          currentY: event.clientY,
        }
        tabDragSessionRef.current = activeSession
        setTabDragSession(activeSession)
      }

      const dropIndex = getTabDropIndex(event.clientX, event.clientY, activeSession.tabId)
      if (dropIndex !== null) {
        moveTabToIndex(activeSession.tabId, dropIndex)
      }
    }

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      const session = tabDragSessionRef.current
      if (!session || event.pointerId !== session.pointerId) return

      if (session.isDragging) {
        event.preventDefault()
      }
      finishTabDrag()
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') finishTabDrag()
    }

    document.addEventListener('pointermove', handlePointerMove, { capture: true })
    document.addEventListener('pointerup', handlePointerEnd, { capture: true })
    document.addEventListener('pointercancel', handlePointerEnd, { capture: true })
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', finishTabDrag)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove, { capture: true })
      document.removeEventListener('pointerup', handlePointerEnd, { capture: true })
      document.removeEventListener('pointercancel', handlePointerEnd, { capture: true })
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', finishTabDrag)
    }
  }, [
    closeTabContextMenu,
    finishTabDrag,
    focusTab,
    getTabDropIndex,
    moveTabToIndex,
    selectTab,
    tabDragSession,
  ])

  useEffect(() => {
    if (!tabContextMenu) return

    const handlePointerDown = (event: PointerEvent) => {
      if (tabContextMenuRef.current?.contains(event.target as Node)) return
      setTabContextMenu(null)
    }
    const handleClose = () => setTabContextMenu(null)
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setTabContextMenu(null)
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
  }, [tabContextMenu])

  useEffect(() => {
    if (!isVertical && tabs.length > 1) {
      const viewport = tabScrollViewportRef.current
      const inner = tabStripInnerRef.current
      if (!viewport || !inner || typeof ResizeObserver === 'undefined') {
        updateScrollState()
        return
      }

      const observer = new ResizeObserver(() => {
        updateScrollState()
      })

      observer.observe(viewport)
      observer.observe(inner)
      updateScrollState()

      const handleScroll = () => updateScrollState()
      viewport.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        observer.disconnect()
        viewport.removeEventListener('scroll', handleScroll)
      }
    }

    setScrollState({ canScrollLeft: false, canScrollRight: false })
  }, [isVertical, tabs.length, updateScrollState])

  useEffect(() => {
    const activeButton = tabButtonRefs.current.get(activeTabId)
    activeButton?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [activeTabId, isVertical, layoutMode, tabs.length])

  useEffect(() => subscribeOpenShellTab(shell => openTerminalTab(shell)), [openTerminalTab])

  useEffect(() => {
    if (tabs.length === 0) {
      if (startupState === 'idle' && !isResolvingDefaultTabRef.current) {
        void openStartupTerminalTab(true)
      }
      return
    }

    if (startupState !== 'idle') {
      setStartupState('idle')
    }
  }, [openStartupTerminalTab, startupState, tabs.length])

  useEffect(() => {
    const activeTab = tabs.find(tab => tab.id === activeTabId)
    if (activeTab?.content.type === 'vnc') {
      setActiveTerminalSession({
        tabId: activeTab.id,
        sessionId: null,
        shellName: activeTab.content.shellName,
        protocol: activeTab.content.protocol,
      })
      return
    }

    if (
      activeTab?.content.type === 'terminal'
      && activeTab.content.sessionId
    ) {
      setActiveTerminalSession({
        tabId: activeTab.id,
        sessionId: activeTab.content.sessionId,
        shellName: activeTab.content.shellName,
        protocol: activeTab.content.protocol,
      })
      return
    }

    setActiveTerminalSession(null)
  }, [activeTabId, setActiveTerminalSession, tabs])

  useEffect(() => () => setActiveTerminalSession(null), [setActiveTerminalSession])

  const layoutRootClassName = mergeClasses(
    styles.root,
    isVertical ? styles.verticalRoot : styles.horizontalRoot,
  )

  const toggleLabel = isVertical ? t('workspace.dockTop') : t('workspace.dockLeft')
  const toggleIcon = isVertical ? <PanelTopExpandRegular /> : <PanelLeftRegular />
  const showScrollButtons = !isVertical && (scrollState.canScrollLeft || scrollState.canScrollRight)
  const showEmptyState = tabs.length === 0
  const draggedTab = tabDragSession?.isDragging
    ? tabs.find(tab => tab.id === tabDragSession.tabId)
    : undefined
  const draggedTabLabel = draggedTab
    ? (draggedTab.title ?? t('workspace.tabLabel', { index: draggedTab.sequence }))
    : ''
  const panelTabs = tabs.map(tab => {
    const isActive = tab.id === activeTabId
    const tabLabel = tab.title ?? t('workspace.tabLabel', { index: tab.sequence })
    const isCloseVisible = visibleCloseTabId === tab.id
    const isDragging = tabDragSession?.isDragging && tabDragSession.tabId === tab.id

    return (
      <div
        key={tab.id}
        className={mergeClasses(
          styles.tabItem,
          isVertical ? styles.tabItemVertical : styles.tabItemHorizontal,
          isDragging ? styles.tabItemDragging : undefined,
        )}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setFocusedTabId(current => (current === tab.id ? null : current))
          }
        }}
        onFocusCapture={() => setFocusedTabId(tab.id)}
        onMouseEnter={() => setHoveredTabId(tab.id)}
        onMouseLeave={() => setHoveredTabId(current => (current === tab.id ? null : current))}
      >
        <Button
          appearance="transparent"
          aria-controls={`${tab.id}-panel`}
          aria-selected={isActive}
          className={mergeClasses(
            styles.tabButton,
            isVertical ? styles.tabButtonVertical : styles.tabButtonHorizontal,
            isActive ? (isVertical ? styles.tabButtonVerticalActive : styles.tabButtonHorizontalActive) : undefined,
            isDragging ? styles.tabButtonDragging : undefined,
          )}
          id={`${tab.id}-tab`}
          onClick={() => selectTab(tab.id)}
          onContextMenu={event => openTabContextMenu(event, tab.id)}
          onKeyDown={event => handleTabKeyDown(event, tab.id)}
          onPointerDown={event => startTabDrag(event, tab.id)}
          ref={setTabButtonRef(tab.id)}
          role="tab"
          size="small"
          tabIndex={isActive ? 0 : -1}
          title={tabLabel}
        >
          <span className={styles.tabLabel}>{tabLabel}</span>
        </Button>
        <Button
          aria-label={t('workspace.closeTab')}
          appearance="subtle"
          className={mergeClasses(
            styles.tabCloseButton,
            isCloseVisible ? styles.tabCloseButtonVisible : styles.tabCloseButtonHidden,
          )}
          icon={<DismissRegular />}
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            closeTab(tab.id)
          }}
          onMouseDown={event => {
            event.stopPropagation()
          }}
          size="small"
          tabIndex={isCloseVisible ? 0 : -1}
          title={t('workspace.closeTab')}
          type="button"
        />
      </div>
    )
  })
  const contentPanels = showEmptyState ? (
    <div className={styles.emptyState}>
      {startupState === 'loading' ? (
        <>
          <Spinner size="medium" />
          <div className={styles.emptyStateText}>
            <span className={styles.emptyStateTitle}>{t('common.loading')}</span>
          </div>
        </>
      ) : (
        <div className={styles.emptyStateText}>
          <span className={styles.emptyStateTitle}>{t('status.unavailable')}</span>
          <span className={styles.emptyStateDescription}>{t('status.unavailable')}</span>
        </div>
      )}
    </div>
  ) : (
    tabs.map(tab => (
      <WorkspaceTabPanel
        focusMode={focusMode}
        key={tab.id}
        tab={tab}
        isActive={tab.id === activeTabId}
        onTerminalSessionDisposed={handleTerminalSessionDisposed}
        onTerminalSessionReady={handleTerminalSessionReady}
      />
    ))
  )

  return (
    <div className={layoutRootClassName} role="region" aria-label={t('workspace.panelTitle')}>
      {!focusMode && isVertical && (
        <aside className={styles.verticalSidebar}>
          <div className={styles.verticalTabList} role="tablist" aria-orientation="vertical">
            {panelTabs}
          </div>
          <div className={styles.verticalFooter}>
            <Button
              aria-label={t('workspace.addTab')}
              appearance="subtle"
              className={styles.tabActionButton}
              icon={<AddRegular />}
              onClick={() => void openStartupTerminalTab(false)}
              size="small"
              title={t('workspace.addTab')}
              type="button"
            />
            <Button
              aria-label={t('workspace.moreActions')}
              appearance="subtle"
              className={styles.tabActionButton}
              icon={<ChevronDownRegular />}
              disabled
              size="small"
              title={t('workspace.moreActions')}
              type="button"
            />
            <Button
              aria-label={toggleLabel}
              appearance="subtle"
              className={styles.tabActionButton}
              icon={toggleIcon}
              onClick={toggleLayoutMode}
              size="small"
              title={toggleLabel}
              type="button"
            />
          </div>
        </aside>
      )}
      {!focusMode && !isVertical && (
        <div className={styles.horizontalBar}>
          <div className={styles.tabScrollFrame}>
            <div className={styles.tabScrollViewport} ref={tabScrollViewportRef}>
              <div className={styles.tabStripInner} ref={tabStripInnerRef} role="tablist" aria-orientation="horizontal">
                {panelTabs}
              </div>
            </div>
            {scrollState.canScrollLeft && (
              <div
                aria-hidden="true"
                className={mergeClasses(styles.tabOverflowFade, styles.tabOverflowFadeLeft)}
              />
            )}
            {scrollState.canScrollRight && (
              <div
                aria-hidden="true"
                className={mergeClasses(styles.tabOverflowFade, styles.tabOverflowFadeRight)}
              />
            )}
          </div>
          <div className={styles.actionGroup}>
            <Button
              aria-label={t('workspace.addTab')}
              appearance="subtle"
              className={styles.tabActionButton}
              icon={<AddRegular />}
              onClick={() => void openStartupTerminalTab(false)}
              size="small"
              title={t('workspace.addTab')}
              type="button"
            />
            <Button
              aria-label={t('workspace.moreActions')}
              appearance="subtle"
              className={styles.tabActionButton}
              icon={<ChevronDownRegular />}
              disabled
              size="small"
              title={t('workspace.moreActions')}
              type="button"
            />
          </div>
          {showScrollButtons && (
            <div className={styles.scrollButtonGroup}>
              <Button
                aria-label={t('workspace.scrollLeft')}
                appearance="subtle"
                className={styles.tabActionButton}
                disabled={!scrollState.canScrollLeft}
                icon={<ChevronLeftRegular />}
                onClick={() => scrollTabStrip('left')}
                size="small"
                title={t('workspace.scrollLeft')}
                type="button"
              />
              <Button
                aria-label={t('workspace.scrollRight')}
                appearance="subtle"
                className={styles.tabActionButton}
                disabled={!scrollState.canScrollRight}
                icon={<ChevronRightRegular />}
                onClick={() => scrollTabStrip('right')}
                size="small"
                title={t('workspace.scrollRight')}
                type="button"
              />
            </div>
          )}
          <Button
            aria-label={toggleLabel}
            appearance="subtle"
            className={styles.tabActionButton}
            icon={toggleIcon}
            onClick={toggleLayoutMode}
            size="small"
            title={toggleLabel}
            type="button"
          />
        </div>
      )}
      {tabContextMenu && (
        <div
          className={styles.contextMenuSurface}
          onContextMenu={event => {
            event.preventDefault()
            event.stopPropagation()
          }}
          ref={tabContextMenuRef}
          style={{
            left: `${tabContextMenu.x}px`,
            top: `${tabContextMenu.y}px`,
          }}
        >
          <MenuList aria-label={t('workspace.tabContextMenu')}>
            <MenuItem
              icon={<CopyRegular />}
              onMouseDown={event => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={() => cloneTab(tabContextMenu.tabId)}
            >
              <span className={styles.contextMenuItemContent}>
                {t('workspace.cloneTab')}
              </span>
            </MenuItem>
          </MenuList>
        </div>
      )}
      {tabDragSession?.isDragging && draggedTab && (
        <div
          aria-hidden="true"
          className={mergeClasses(
            styles.dragPreview,
            isVertical ? styles.dragPreviewVertical : styles.dragPreviewHorizontal,
          )}
          style={{
            '--drag-x': `${tabDragSession.currentX - tabDragSession.offsetX}px`,
            '--drag-y': `${tabDragSession.currentY - tabDragSession.offsetY}px`,
            width: `${tabDragSession.width}px`,
            height: `${tabDragSession.height}px`,
          } as CSSProperties & Record<'--drag-x' | '--drag-y', string>}
        >
          <span className={styles.dragPreviewLabel}>{draggedTabLabel}</span>
        </div>
      )}
      <main className={styles.contentArea} key="workspace-content">
        {contentPanels}
      </main>
    </div>
  )
}
