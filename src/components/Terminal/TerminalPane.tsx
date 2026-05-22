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
  type FC,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  MenuItem,
  MenuList,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  BroomRegular,
  ClipboardPasteRegular,
  CopyRegular,
  SelectAllOnRegular,
} from '@fluentui/react-icons'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { usePreferences } from '@/hooks/usePreferences'
import { useWorkspaceRuntime } from '@/components/WorkspacePanel/workspaceRuntimeContext'
import { terminalTheme } from './terminalTheme'
import { getTerminalThemeById } from './terminalThemes'
import type { TerminalPreferences } from '@/shared/preferencesTypes'

interface TerminalPaneProps {
  shellId: string
  tabId: string
  isActive: boolean
  onSessionDisposed?: (sessionId: string) => void
  onSessionReady?: (sessionId: string) => void
}

interface ContextMenuState {
  x: number
  y: number
}

const CONTEXT_MENU_VIEWPORT_GAP = 8

const useStyles = makeStyles({
  root: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    padding: '4px',
    boxSizing: 'border-box',
    backgroundColor: terminalTheme.background,
    overflow: 'hidden',
  },
  terminalHost: {
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
  },
  contextMenuSurface: {
    position: 'fixed',
    zIndex: 1200,
    minWidth: '220px',
    padding: tokens.spacingVerticalXXS,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow16,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  contextMenuItemContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalL,
    minWidth: '164px',
  },
  contextMenuShortcut: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    whiteSpace: 'nowrap',
  },
})

function fitTerminal(fitAddon: FitAddon, sessionId: string | null): void {
  try {
    fitAddon.fit()
    const dimensions = fitAddon.proposeDimensions()
    if (sessionId && dimensions) {
      window.terminalAPI.resize({
        sessionId,
        cols: dimensions.cols,
        rows: dimensions.rows,
      })
    }
  } catch {
    // xterm 在隐藏容器中无法测量尺寸时会抛错，等激活后再次 fit。
  }
}

function applyTerminalPreferences(terminal: Terminal, preferences: TerminalPreferences): void {
  terminal.options.fontFamily = preferences.fontFamily
  terminal.options.fontSize = preferences.fontSize
  terminal.options.theme = getTerminalThemeById(preferences.themeId).theme
  terminal.element?.style.setProperty(
    'font-variant-ligatures',
    preferences.fontLigatures ? 'contextual common-ligatures' : 'none',
  )
}

function isPrimaryShortcutModifier(event: KeyboardEvent): boolean {
  const isMacPlatform = navigator.platform.toUpperCase().includes('MAC')
  return event.ctrlKey || (isMacPlatform && event.metaKey)
}

function isTerminalCopyShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'c'
    && event.shiftKey
    && !event.altKey
    && isPrimaryShortcutModifier(event)
  )
}

function isTerminalPasteShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'v'
    && event.shiftKey
    && !event.altKey
    && isPrimaryShortcutModifier(event)
  )
}

function isTerminalTabKey(event: KeyboardEvent): boolean {
  return event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey
}

function stopTerminalBrowserEvent(event: Event): void {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

export const TerminalPane: FC<TerminalPaneProps> = ({
  shellId,
  tabId,
  isActive,
  onSessionDisposed,
  onSessionReady,
}) => {
  const styles = useStyles()
  const { t } = useTranslation()
  const { terminalPreferences } = usePreferences()
  const { registerTerminalController } = useWorkspaceRuntime()
  const activeTerminalTheme = getTerminalThemeById(terminalPreferences.themeId).theme
  const tRef = useRef(t)
  const terminalPreferencesRef = useRef(terminalPreferences)
  const onSessionDisposedRef = useRef(onSessionDisposed)
  const onSessionReadyRef = useRef(onSessionReady)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const selectionTextRef = useRef('')
  const isContextMenuOpenRef = useRef(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [isSessionReady, setIsSessionReady] = useState(false)

  const focusTerminal = useCallback(() => {
    terminalRef.current?.focus()
  }, [])

  const writeTextToTerminal = useCallback((text: string) => {
    const sessionId = sessionIdRef.current
    if (!sessionId || !text) return

    terminalRef.current?.focus()
    void window.terminalAPI.write({ sessionId, data: text })
  }, [])

  const closeContextMenu = useCallback(() => {
    isContextMenuOpenRef.current = false
    setContextMenu(null)
  }, [])

  const getSelectedText = useCallback(() => {
    const terminalSelection = selectionTextRef.current || terminalRef.current?.getSelection() || ''
    if (terminalSelection) {
      return terminalSelection
    }

    return window.getSelection()?.toString() ?? ''
  }, [])

  const copySelectionToClipboard = useCallback(async () => {
    const selection = getSelectedText()
    if (!selection) return

    try {
      await window.clipboardAPI.writeText(selection)
    } catch {
      // 剪贴板异常时保持静默，避免打断终端交互。
    }

    focusTerminal()
  }, [focusTerminal, getSelectedText])

  const pasteClipboardToTerminal = useCallback(async () => {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    const terminal = terminalRef.current
    if (!terminal) return

    let text = ''
    try {
      text = await window.clipboardAPI.readText()
    } catch {
      return
    }

    if (!text) {
      focusTerminal()
      return
    }

    terminal.focus()
    terminal.paste(text)

    focusTerminal()
  }, [focusTerminal])

  const selectAllTerminalContent = useCallback(() => {
    terminalRef.current?.selectAll()
    focusTerminal()
  }, [focusTerminal])

  const clearTerminalViewport = useCallback(() => {
    terminalRef.current?.clear()
    focusTerminal()
  }, [focusTerminal])

  const openContextMenu = useCallback((clientX: number, clientY: number) => {
    if (!terminalRef.current) return

    isContextMenuOpenRef.current = true
    const selection = terminalRef.current.getSelection()
    selectionTextRef.current = selection
    setHasSelection(Boolean(selection))
    setContextMenu({
      x: clientX,
      y: clientY,
    })
  }, [])

  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    terminalPreferencesRef.current = terminalPreferences
  }, [terminalPreferences])

  useEffect(() => {
    onSessionDisposedRef.current = onSessionDisposed
  }, [onSessionDisposed])

  useEffect(() => {
    onSessionReadyRef.current = onSessionReady
  }, [onSessionReady])

  useEffect(() => {
    isContextMenuOpenRef.current = Boolean(contextMenu)
  }, [contextMenu])

  useEffect(() => {
    if (isActive) return
    setContextMenu(null)
  }, [isActive])

  useEffect(() => registerTerminalController(tabId, {
    focus: focusTerminal,
    writeText: writeTextToTerminal,
  }), [focusTerminal, registerTerminalController, tabId, writeTextToTerminal])

  useEffect(() => {
    if (contextMenu) return

    const terminal = terminalRef.current
    const selection = terminal?.getSelection() || window.getSelection()?.toString() || ''
    selectionTextRef.current = selection
    setHasSelection(Boolean(selection))
  }, [contextMenu])

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

    if (nextX === contextMenu.x && nextY === contextMenu.y) {
      return
    }

    setContextMenu(prev => (
      prev
      && (prev.x !== nextX || prev.y !== nextY)
        ? { x: nextX, y: nextY }
        : prev
    ))
  }, [contextMenu])

  useEffect(() => {
    if (!contextMenu) return

    const handlePointerDown = (event: PointerEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) return
      setContextMenu(null)
    }
    const handleWindowBlur = () => setContextMenu(null)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('resize', handleWindowBlur)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('resize', handleWindowBlur)
    }
  }, [contextMenu])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !window.terminalAPI || !window.clipboardAPI) return
    let disposed = false

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: terminalPreferencesRef.current.fontFamily,
      fontSize: terminalPreferencesRef.current.fontSize,
      lineHeight: 1.2,
      scrollback: 10000,
      theme: getTerminalThemeById(terminalPreferencesRef.current.themeId).theme,
    })
    const fitAddon = new FitAddon()

    terminal.loadAddon(fitAddon)
    terminal.open(host)
    applyTerminalPreferences(terminal, terminalPreferencesRef.current)

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    selectionTextRef.current = ''
    setHasSelection(false)
    setIsSessionReady(false)

    const inputDisposable = terminal.onData(data => {
      const sessionId = sessionIdRef.current
      if (sessionId) {
        window.terminalAPI.write({ sessionId, data })
      }
    })
    const selectionChangeDisposable = terminal.onSelectionChange(() => {
      if (isContextMenuOpenRef.current) return

      const selection = terminal.getSelection() || window.getSelection()?.toString() || ''
      selectionTextRef.current = selection
      setHasSelection(Boolean(selection))
    })
    const handleNativeContextMenu = (event: MouseEvent) => {
      stopTerminalBrowserEvent(event)
      openContextMenu(event.clientX, event.clientY)
    }
    terminal.attachCustomKeyEventHandler(event => {
      if (event.type !== 'keydown') {
        return true
      }

      if (isTerminalTabKey(event)) {
        event.preventDefault()
        event.stopPropagation()
        return true
      }

      if (isTerminalCopyShortcut(event)) {
        stopTerminalBrowserEvent(event)
        void copySelectionToClipboard()
        return false
      }

      if (isTerminalPasteShortcut(event)) {
        stopTerminalBrowserEvent(event)
        void pasteClipboardToTerminal()
        return false
      }

      return true
    })

    const contextMenuTargets = [host, terminal.element].filter(
      (target): target is HTMLElement => Boolean(target),
    )
    contextMenuTargets.forEach(target => {
      target.addEventListener('contextmenu', handleNativeContextMenu, true)
    })

    const removeDataListener = window.terminalAPI.onData(event => {
      if (event.sessionId === sessionIdRef.current) {
        terminal.write(event.data)
      }
    })

    const removeExitListener = window.terminalAPI.onExit(event => {
      if (event.sessionId === sessionIdRef.current) {
        sessionIdRef.current = null
        setIsSessionReady(false)
        onSessionDisposedRef.current?.(event.sessionId)
        terminal.write(`\r\n${tRef.current('terminal.processExited', { exitCode: event.exitCode })}\r\n`)
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        fitTerminal(fitAddon, sessionIdRef.current)
      })
    })

    resizeObserver.observe(host)

    let startupFrameId: number | null = window.requestAnimationFrame(async () => {
      startupFrameId = null
      if (disposed) return

      fitTerminal(fitAddon, null)
      const dimensions = fitAddon.proposeDimensions() ?? { cols: terminal.cols, rows: terminal.rows }
      try {
        const result = await window.terminalAPI.createSession({
          shellId,
          cols: dimensions.cols,
          rows: dimensions.rows,
        })

        if (disposed) {
          void window.terminalAPI.dispose({ sessionId: result.sessionId })
          return
        }

        sessionIdRef.current = result.sessionId
        setIsSessionReady(true)
        onSessionReadyRef.current?.(result.sessionId)
        fitTerminal(fitAddon, result.sessionId)
        terminal.focus()
      } catch (error) {
        if (!disposed) {
          const message = error instanceof Error ? error.message : String(error)
          terminal.write(`\r\n${tRef.current('terminal.startFailed', { message })}\r\n`)
        }
      }
    })

    return () => {
      disposed = true

      if (startupFrameId !== null) {
        window.cancelAnimationFrame(startupFrameId)
      }

      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
      }

      resizeObserver.disconnect()
      inputDisposable.dispose()
      selectionChangeDisposable.dispose()
      contextMenuTargets.forEach(target => {
        target.removeEventListener('contextmenu', handleNativeContextMenu, true)
      })
      removeDataListener()
      removeExitListener()

      const sessionId = sessionIdRef.current
      if (sessionId) {
        window.terminalAPI.dispose({ sessionId })
        onSessionDisposedRef.current?.(sessionId)
        sessionIdRef.current = null
      }

      selectionTextRef.current = ''
      setHasSelection(false)
      setIsSessionReady(false)
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [copySelectionToClipboard, openContextMenu, pasteClipboardToTerminal, shellId])

  useEffect(() => {
    if (!isActive) return

    window.requestAnimationFrame(() => {
      const terminal = terminalRef.current
      const fitAddon = fitAddonRef.current
      if (!terminal || !fitAddon) return

      fitTerminal(fitAddon, sessionIdRef.current)
      terminal.focus()
    })
  }, [isActive])

  useEffect(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (!terminal || !fitAddon) return

    applyTerminalPreferences(terminal, terminalPreferences)
    const frameId = window.requestAnimationFrame(() => {
      fitTerminal(fitAddon, sessionIdRef.current)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [terminalPreferences])

  const canCopySelection = hasSelection
  const canPaste = isSessionReady

  return (
    <div className={styles.root} style={{ backgroundColor: activeTerminalTheme.background }}>
      <div className={styles.terminalHost} ref={hostRef} />

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
          <MenuList aria-label={t('terminal.contextMenu')}>
            <MenuItem
              aria-keyshortcuts="Control+Shift+C"
              disabled={!canCopySelection}
              icon={<CopyRegular />}
              onMouseDown={event => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={() => {
                closeContextMenu()
                void copySelectionToClipboard()
              }}
            >
              <span className={styles.contextMenuItemContent}>
                <span>{t('menu.edit.copy')}</span>
                <span className={styles.contextMenuShortcut}>{t('terminal.shortcutCopy')}</span>
              </span>
            </MenuItem>
            <MenuItem
              aria-keyshortcuts="Control+Shift+V"
              disabled={!canPaste}
              icon={<ClipboardPasteRegular />}
              onMouseDown={event => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={() => {
                closeContextMenu()
                void pasteClipboardToTerminal()
              }}
            >
              <span className={styles.contextMenuItemContent}>
                <span>{t('menu.edit.paste')}</span>
                <span className={styles.contextMenuShortcut}>{t('terminal.shortcutPaste')}</span>
              </span>
            </MenuItem>
            <MenuItem
              icon={<SelectAllOnRegular />}
              onMouseDown={event => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={() => {
                closeContextMenu()
                selectAllTerminalContent()
              }}
            >
              <span className={styles.contextMenuItemContent}>
                <span>{t('menu.edit.selectAll')}</span>
              </span>
            </MenuItem>
            <MenuItem
              icon={<BroomRegular />}
              onMouseDown={event => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={() => {
                closeContextMenu()
                clearTerminalViewport()
              }}
            >
              <span className={styles.contextMenuItemContent}>
                <span>{t('terminal.clearScreen')}</span>
              </span>
            </MenuItem>
          </MenuList>
        </div>
      )}
    </div>
  )
}
