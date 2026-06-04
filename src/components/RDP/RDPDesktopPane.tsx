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
 * RDP 内嵌桌面面板骨架。
 * 当前先接通 UI/IPC 生命周期，后续由 IronRDP sidecar 提供真实帧数据。
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ClipboardPasteRegular,
  RemoteRegular,
  TabDesktopArrowClockwiseRegular,
} from '@fluentui/react-icons'
import { useWorkspaceRuntime } from '@/components/WorkspacePanel/workspaceRuntimeContext'
import type { RdpFramebufferUpdateEvent } from '@/shared/rdpTypes'

interface RDPDesktopPaneProps {
  shellId: string
  tabId: string
  isActive: boolean
}

interface CanvasSize {
  width: number
  height: number
}

type RdpConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed'

const DEFAULT_CANVAS_SIZE: CanvasSize = {
  width: 1280,
  height: 720,
}

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
  toolbar: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    minHeight: '40px',
    paddingInline: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalXS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    boxSizing: 'border-box',
  },
  toolbarTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flex: 1,
    minWidth: 0,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  toolbarTitleText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  toolbarMeta: {
    flexShrink: 0,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  toolbarAction: {
    width: '32px',
    minWidth: '32px',
    height: '32px',
    padding: 0,
  },
  viewport: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'auto',
    backgroundColor: tokens.colorNeutralBackgroundStatic,
  },
  canvasStage: {
    minWidth: '100%',
    minHeight: '100%',
    width: 'max-content',
    height: 'max-content',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingHorizontalM,
    boxSizing: 'border-box',
  },
  canvas: {
    display: 'block',
    flexShrink: 0,
    backgroundColor: '#000',
    outlineColor: tokens.colorBrandStroke1,
    outlineOffset: '2px',
    boxShadow: tokens.shadow4,
    cursor: 'default',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingHorizontalL,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    color: tokens.colorNeutralForegroundStaticInverted,
    boxSizing: 'border-box',
    pointerEvents: 'none',
  },
  overlayContent: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    maxWidth: 'min(560px, 100%)',
    minWidth: 0,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: 'rgba(32, 32, 32, 0.88)',
    boxShadow: tokens.shadow16,
    boxSizing: 'border-box',
  },
  overlayText: {
    minWidth: 0,
    overflowWrap: 'anywhere',
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
  },
})

function clearCanvas(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext('2d')
  if (!context) return

  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
}

function drawFramebufferUpdate(canvas: HTMLCanvasElement, event: RdpFramebufferUpdateEvent): void {
  const context = canvas.getContext('2d')
  if (!context) return

  const rgba = new Uint8ClampedArray(event.data)
  context.putImageData(new ImageData(rgba, event.width, event.height), event.x, event.y)
}

function getButtonMask(buttons: number): number {
  let mask = 0
  if ((buttons & 1) !== 0) mask |= 1
  if ((buttons & 4) !== 0) mask |= 2
  if ((buttons & 2) !== 0) mask |= 4
  return mask
}

function stopRemoteInputEvent(event: {
  preventDefault: () => void
  stopPropagation: () => void
}): void {
  event.preventDefault()
  event.stopPropagation()
}

export const RDPDesktopPane: FC<RDPDesktopPaneProps> = ({ shellId, tabId, isActive }) => {
  const styles = useStyles()
  const { t } = useTranslation()
  const { registerTerminalController } = useWorkspaceRuntime()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(DEFAULT_CANVAS_SIZE)
  const [desktopName, setDesktopName] = useState('')
  const [connectionState, setConnectionState] = useState<RdpConnectionState>('connecting')
  const [statusMessage, setStatusMessage] = useState('')
  const [reconnectToken, setReconnectToken] = useState(0)

  const getRemotePoint = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null

    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * canvas.width),
      y: Math.round(((event.clientY - rect.top) / rect.height) * canvas.height),
    }
  }, [])

  const sendPointerEvent = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const sessionId = sessionIdRef.current
    if (!sessionId || connectionState !== 'connected') return

    const point = getRemotePoint(event)
    if (!point) return

    void window.rdpAPI.pointerEvent({
      sessionId,
      buttonMask: getButtonMask(event.buttons),
      x: point.x,
      y: point.y,
    })
  }, [connectionState, getRemotePoint])

  const handlePointerEvent = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    stopRemoteInputEvent(event)
    event.currentTarget.focus()
    sendPointerEvent(event)
  }, [sendPointerEvent])

  const handleKeyEvent = useCallback((event: KeyboardEvent<HTMLCanvasElement>, down: boolean) => {
    const sessionId = sessionIdRef.current
    if (!sessionId || connectionState !== 'connected') return

    stopRemoteInputEvent(event)
    void window.rdpAPI.keyEvent({
      sessionId,
      code: event.code,
      down,
      key: event.key,
    })
  }, [connectionState])

  const reconnect = useCallback(() => {
    setReconnectToken(token => token + 1)
  }, [])

  const pasteClipboardToRemote = useCallback(async () => {
    const sessionId = sessionIdRef.current
    if (!sessionId || connectionState !== 'connected') return

    const text = await window.clipboardAPI.readText().catch(() => '')
    if (!text) return

    await window.rdpAPI.clientClipboard({ sessionId, text })
    canvasRef.current?.focus()
  }, [connectionState])

  const focusCanvas = useCallback(() => {
    canvasRef.current?.focus()
  }, [])

  const writeTextToRemoteClipboard = useCallback((text: string) => {
    const sessionId = sessionIdRef.current
    if (!sessionId || !text) return

    void window.rdpAPI.clientClipboard({ sessionId, text })
    canvasRef.current?.focus()
  }, [])

  useEffect(() => {
    if (isActive && connectionState === 'connected') {
      window.requestAnimationFrame(() => canvasRef.current?.focus())
    }
  }, [connectionState, isActive])

  useEffect(() => registerTerminalController(tabId, {
    focus: focusCanvas,
    writeText: writeTextToRemoteClipboard,
  }), [focusCanvas, registerTerminalController, tabId, writeTextToRemoteClipboard])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = canvasSize.width
    canvas.height = canvasSize.height
    clearCanvas(canvas)
  }, [canvasSize.height, canvasSize.width])

  useEffect(() => {
    let disposed = false
    sessionIdRef.current = null
    setConnectionState('connecting')
    setStatusMessage('')
    setDesktopName('')
    setCanvasSize(DEFAULT_CANVAS_SIZE)

    const removeFramebufferUpdateListener = window.rdpAPI.onFramebufferUpdate(event => {
      if (event.sessionId !== sessionIdRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return

      drawFramebufferUpdate(canvas, event)
    })
    const removeDesktopSizeListener = window.rdpAPI.onDesktopSize(event => {
      if (event.sessionId !== sessionIdRef.current) return
      setCanvasSize({ width: event.width, height: event.height })
    })
    const removeClipboardListener = window.rdpAPI.onClipboard(event => {
      if (event.sessionId !== sessionIdRef.current || !event.text) return
      void window.clipboardAPI.writeText(event.text)
    })
    const removeDisconnectedListener = window.rdpAPI.onDisconnected(event => {
      if (event.sessionId !== sessionIdRef.current) return
      sessionIdRef.current = null
      setConnectionState('disconnected')
      setStatusMessage(event.reason || t('rdp.disconnected'))
    })

    const startSession = async () => {
      try {
        const result = await window.rdpAPI.createSession({ shellId })

        if (disposed) {
          void window.rdpAPI.dispose({ sessionId: result.sessionId })
          return
        }

        sessionIdRef.current = result.sessionId
        setCanvasSize({ width: result.width, height: result.height })
        setDesktopName(result.desktopName)
        setConnectionState('connected')
        setStatusMessage('')
        window.requestAnimationFrame(() => canvasRef.current?.focus())
      } catch (error) {
        if (disposed) return

        setConnectionState('failed')
        const message = error instanceof Error ? error.message : String(error)
        setStatusMessage(
          message.includes('Embedded RDP engine is not available yet')
            ? t('rdp.engineUnavailable')
            : message,
        )
      }
    }

    void startSession()

    return () => {
      disposed = true
      removeFramebufferUpdateListener()
      removeDesktopSizeListener()
      removeClipboardListener()
      removeDisconnectedListener()

      const sessionId = sessionIdRef.current
      if (sessionId) {
        void window.rdpAPI.dispose({ sessionId })
        sessionIdRef.current = null
      }
    }
  }, [reconnectToken, shellId, t])

  const overlayText = connectionState === 'connecting'
    ? t('rdp.connecting')
    : connectionState === 'failed'
      ? t('rdp.connectionFailed', { message: statusMessage })
      : statusMessage
  const showOverlay = connectionState !== 'connected' || Boolean(statusMessage)
  const canvasStyle = {
    width: `${canvasSize.width}px`,
    height: `${canvasSize.height}px`,
  } satisfies CSSProperties

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <RemoteRegular />
          <span className={styles.toolbarTitleText}>
            {desktopName || t('rdp.desktop')}
          </span>
          <span className={styles.toolbarMeta}>
            {t('vnc.resolution', { width: canvasSize.width, height: canvasSize.height })}
          </span>
        </div>
        <Button
          appearance="subtle"
          aria-label={t('rdp.pasteClipboard')}
          className={styles.toolbarAction}
          disabled={connectionState !== 'connected'}
          icon={<ClipboardPasteRegular />}
          onClick={() => void pasteClipboardToRemote()}
          size="small"
          title={t('rdp.pasteClipboard')}
          type="button"
        />
        <Button
          appearance="subtle"
          aria-label={t('rdp.reconnect')}
          className={styles.toolbarAction}
          icon={<TabDesktopArrowClockwiseRegular />}
          onClick={reconnect}
          size="small"
          title={t('rdp.reconnect')}
          type="button"
        />
      </div>
      <div className={styles.viewport}>
        <div className={styles.canvasStage}>
          <canvas
            aria-label={t('rdp.desktop')}
            className={styles.canvas}
            onContextMenu={event => stopRemoteInputEvent(event)}
            onKeyDown={event => handleKeyEvent(event, true)}
            onKeyUp={event => handleKeyEvent(event, false)}
            onPointerCancel={handlePointerEvent}
            onPointerDown={handlePointerEvent}
            onPointerMove={handlePointerEvent}
            onPointerUp={handlePointerEvent}
            ref={canvasRef}
            style={canvasStyle}
            tabIndex={0}
          />
        </div>
        {showOverlay && (
          <div className={styles.overlay}>
            <div className={styles.overlayContent}>
              {connectionState === 'connecting' && <Spinner size="tiny" />}
              <span className={styles.overlayText}>{overlayText}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
