import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components'
import {
  AddRegular,
  ChevronDownRegular,
  ChevronLeftRegular,
  ChevronRightRegular,
  DismissRegular,
  PanelLeftRegular,
  PanelTopExpandRegular,
} from '@fluentui/react-icons'
import { useRTL } from '@/hooks/useRTL'

type WorkspaceLayoutMode = 'horizontal' | 'vertical'

interface WorkspaceTab {
  id: string
  sequence: number
}

interface WorkspaceState {
  tabs: WorkspaceTab[]
  activeTabId: string
}

interface ScrollState {
  canScrollLeft: boolean
  canScrollRight: boolean
}

interface WorkspaceTabPanelProps {
  tab: WorkspaceTab
}

const INITIAL_TAB_SEQUENCE = 1

function createWorkspaceTab(sequence: number): WorkspaceTab {
  return {
    id: `workspace-tab-${sequence}`,
    sequence,
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
    transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease',
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
  contentArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  tabPanel: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    overflow: 'auto',
    boxSizing: 'border-box',
  },
  tabPanelInner: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    boxSizing: 'border-box',
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL} ${tokens.spacingHorizontalL}`,
    gap: tokens.spacingVerticalM,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalM,
  },
  panelHeaderText: {
    minWidth: 0,
  },
  panelTitle: {
    margin: 0,
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  panelDescription: {
    margin: `${tokens.spacingVerticalXS} 0 0`,
    maxWidth: '72ch',
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground2,
  },
  panelBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '24px',
    paddingInline: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'nowrap',
  },
  panelFrame: {
    flex: 1,
    minHeight: 0,
    borderRadius: tokens.borderRadiusMedium,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    padding: tokens.spacingHorizontalL,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: tokens.spacingVerticalM,
  },
  panelFrameContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    minWidth: 0,
  },
  panelFrameTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  panelChipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
  },
  panelChip: {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: '24px',
    paddingInline: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
})

function WorkspaceTabPanel({ tab }: WorkspaceTabPanelProps) {
  const styles = useStyles()
  const { t } = useTranslation()

  return (
    <section
      id={`${tab.id}-panel`}
      aria-labelledby={`${tab.id}-tab`}
      className={styles.tabPanel}
      role="tabpanel"
    >
      <div className={styles.tabPanelInner}>
        <div className={styles.panelHeader}>
          <div className={styles.panelHeaderText}>
            <h2 className={styles.panelTitle}>
              {t('workspace.panelTitle')}
            </h2>
            <p className={styles.panelDescription}>
              {t('workspace.panelDescription')}
            </p>
          </div>
          <span className={styles.panelBadge}>
            {t('workspace.tabLabel', { index: tab.sequence })}
          </span>
        </div>

        <div className={styles.panelFrame}>
          <div className={styles.panelFrameContent}>
            <div className={styles.panelFrameTitle}>
              {t('workspace.statusReady')}
            </div>
          </div>

          <div className={styles.panelChipRow}>
            <span className={styles.panelChip}>
              {t('workspace.tabLabel', { index: tab.sequence })}
            </span>
            <span className={styles.panelChip}>
              {t('workspace.statusReady')}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

export const WorkspacePanel: FC = () => {
  const styles = useStyles()
  const { t } = useTranslation()
  const { isRTL } = useRTL()
  const [layoutMode, setLayoutMode] = useState<WorkspaceLayoutMode>('horizontal')
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(() => {
    const firstTab = createWorkspaceTab(INITIAL_TAB_SEQUENCE)
    return {
      tabs: [firstTab],
      activeTabId: firstTab.id,
    }
  })
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)
  const [focusedTabId, setFocusedTabId] = useState<string | null>(null)
  const [scrollState, setScrollState] = useState<ScrollState>({
    canScrollLeft: false,
    canScrollRight: false,
  })
  const nextSequenceRef = useRef(INITIAL_TAB_SEQUENCE + 1)
  const tabButtonRefs = useRef(new Map<string, HTMLButtonElement | null>())
  const tabScrollViewportRef = useRef<HTMLDivElement | null>(null)
  const tabStripInnerRef = useRef<HTMLDivElement | null>(null)

  const { tabs, activeTabId } = workspaceState
  const isVertical = layoutMode === 'vertical'
  const activeTab = useMemo(
    () => tabs.find(tab => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs],
  )
  const visibleCloseTabId = hoveredTabId ?? focusedTabId

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

  const addTab = useCallback(() => {
    const newTab = createWorkspaceTab(nextSequenceRef.current)
    nextSequenceRef.current += 1

    setWorkspaceState(prev => ({
      tabs: [...prev.tabs, newTab],
      activeTabId: newTab.id,
    }))
    focusTab(newTab.id)
  }, [focusTab])

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
        // 保持至少一个工作标签，避免右侧内容区进入不可操作的空状态。
        const replacement = createWorkspaceTab(nextSequenceRef.current)
        nextSequenceRef.current += 1
        nextActiveId = replacement.id
        return {
          tabs: [replacement],
          activeTabId: replacement.id,
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

  const layoutRootClassName = mergeClasses(
    styles.root,
    isVertical ? styles.verticalRoot : styles.horizontalRoot,
  )

  const toggleLabel = isVertical ? t('workspace.dockTop') : t('workspace.dockLeft')
  const toggleIcon = isVertical ? <PanelTopExpandRegular /> : <PanelLeftRegular />
  const showScrollButtons = !isVertical && (scrollState.canScrollLeft || scrollState.canScrollRight)
  const panelTabs = tabs.map(tab => {
    const isActive = tab.id === activeTabId
    const tabLabel = t('workspace.tabLabel', { index: tab.sequence })
    const isCloseVisible = visibleCloseTabId === tab.id

    return (
      <div
        key={tab.id}
        className={mergeClasses(
          styles.tabItem,
          isVertical ? styles.tabItemVertical : styles.tabItemHorizontal,
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
          )}
          id={`${tab.id}-tab`}
          onClick={() => selectTab(tab.id)}
          onKeyDown={event => handleTabKeyDown(event, tab.id)}
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

  return (
    <div className={layoutRootClassName} role="region" aria-label={t('workspace.panelTitle')}>
      {isVertical ? (
        <>
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
                onClick={addTab}
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
          <main className={styles.contentArea}>
            <WorkspaceTabPanel key={activeTab.id} tab={activeTab} />
          </main>
        </>
      ) : (
        <>
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
                onClick={addTab}
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
          <main className={styles.contentArea}>
            <WorkspaceTabPanel key={activeTab.id} tab={activeTab} />
          </main>
        </>
      )}
    </div>
  )
}
