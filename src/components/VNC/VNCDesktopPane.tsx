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
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
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
  ProjectionScreenRegular,
  TabDesktopArrowClockwiseRegular,
} from '@fluentui/react-icons'
import { useWorkspaceRuntime } from '@/components/WorkspacePanel/workspaceRuntimeContext'
import type {
  VncFramebufferUpdateEvent,
  VncRectangleUpdate,
} from '@/shared/vncTypes'

interface VNCDesktopPaneProps {
  shellId: string
  tabId: string
  isActive: boolean
}

interface CanvasSize {
  width: number
  height: number
}

type VncConnectionState = 'connecting' | 'connected' | 'disconnected' | 'failed'

const SPECIAL_KEYSYMS: Record<string, number> = {
  Backspace: 0xff08,
  Tab: 0xff09,
  Enter: 0xff0d,
  Escape: 0xff1b,
  Insert: 0xff63,
  Delete: 0xffff,
  Home: 0xff50,
  End: 0xff57,
  PageUp: 0xff55,
  PageDown: 0xff56,
  ArrowLeft: 0xff51,
  ArrowUp: 0xff52,
  ArrowRight: 0xff53,
  ArrowDown: 0xff54,
  Shift: 0xffe1,
  Control: 0xffe3,
  Alt: 0xffe9,
  Meta: 0xffeb,
  F1: 0xffbe,
  F2: 0xffbf,
  F3: 0xffc0,
  F4: 0xffc1,
  F5: 0xffc2,
  F6: 0xffc3,
  F7: 0xffc4,
  F8: 0xffc5,
  F9: 0xffc6,
  F10: 0xffc7,
  F11: 0xffc8,
  F12: 0xffc9,
}

const CODE_KEYSYMS: Record<string, number> = {
  ShiftLeft: 0xffe1,
  ShiftRight: 0xffe2,
  ControlLeft: 0xffe3,
  ControlRight: 0xffe4,
  AltLeft: 0xffe9,
  AltRight: 0xffea,
  MetaLeft: 0xffeb,
  MetaRight: 0xffec,
}

const WHEEL_UP_MASK = 8
const WHEEL_DOWN_MASK = 16
const WHEEL_LEFT_MASK = 32
const WHEEL_RIGHT_MASK = 64

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
    maxWidth: 'min(520px, 100%)',
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

function getButtonMask(buttons: number): number {
  let mask = 0
  if ((buttons & 1) !== 0) mask |= 1
  if ((buttons & 4) !== 0) mask |= 2
  if ((buttons & 2) !== 0) mask |= 4
  return mask
}

function getEventKeySym(event: KeyboardEvent<HTMLCanvasElement>): number | null {
  const codeKeySym = CODE_KEYSYMS[event.code]
  if (codeKeySym) return codeKeySym

  const specialKeySym = SPECIAL_KEYSYMS[event.key]
  if (specialKeySym) return specialKeySym

  if (event.key.length === 1) {
    return event.key.codePointAt(0) ?? null
  }

  return null
}

function stopRemoteInputEvent(event: {
  preventDefault: () => void
  stopPropagation: () => void
}): void {
  event.preventDefault()
  event.stopPropagation()
}

function clearCanvas(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext('2d')
  if (!context) return

  context.fillStyle = '#000'
  context.fillRect(0, 0, canvas.width, canvas.height)
}

function drawRectangle(canvas: HTMLCanvasElement, rectangle: VncRectangleUpdate): void {
  const context = canvas.getContext('2d')
  if (!context) return

  if (rectangle.encoding === 'copyRect') {
    context.drawImage(
      canvas,
      rectangle.srcX,
      rectangle.srcY,
      rectangle.width,
      rectangle.height,
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
    )
    return
  }

  const rgba = new Uint8ClampedArray(rectangle.data)
  context.putImageData(new ImageData(rgba, rectangle.width, rectangle.height), rectangle.x, rectangle.y)
}

export const VNCDesktopPane: FC<VNCDesktopPaneProps> = ({ shellId, tabId, isActive }) => {
  const styles = useStyles()
  const { t } = useTranslation()
  const { registerTerminalController } = useWorkspaceRuntime()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const buttonMaskRef = useRef(0)
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 0, height: 0 })
  const [desktopName, setDesktopName] = useState('')
  const [connectionState, setConnectionState] = useState<VncConnectionState>('connecting')
  const [statusMessage, setStatusMessage] = useState('')
  const [reconnectToken, setReconnectToken] = useState(0)

  const sendPointerEvent = useCallback((buttonMask: number, x: number, y: number) => {
    const sessionId = sessionIdRef.current
    if (!sessionId || connectionState !== 'connected') return

    void window.vncAPI.pointerEvent({
      sessionId,
      buttonMask,
      x,
      y,
    })
  }, [connectionState])

  const getRemotePoint = useCallback((event: ReactPointerEvent<HTMLCanvasElement> | WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null

    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * canvas.width),
      y: Math.round(((event.clientY - rect.top) / rect.height) * canvas.height),
    }
  }, [])

  const pasteClipboardToRemote = useCallback(async () => {
    const sessionId = sessionIdRef.current
    if (!sessionId || connectionState !== 'connected') return

    try {
      const text = await window.clipboardAPI.readText()
      if (!text) return

      await window.vncAPI.clientCutText({ sessionId, text })
      canvasRef.current?.focus()
    } catch {
      // 剪贴板不可用时保持远程会话不中断。
    }
  }, [connectionState])

  const reconnect = useCallback(() => {
    setReconnectToken(token => token + 1)
  }, [])

  const focusCanvas = useCallback(() => {
    canvasRef.current?.focus()
  }, [])

  const writeTextToRemoteClipboard = useCallback((text: string) => {
    const sessionId = sessionIdRef.current
    if (!sessionId || !text) return

    void window.vncAPI.clientCutText({ sessionId, text })
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
    let disposed = false
    setConnectionState('connecting')
    setStatusMessage('')
    setDesktopName('')
    setCanvasSize({ width: 0, height: 0 })
    sessionIdRef.current = null
    buttonMaskRef.current = 0

    const removeFramebufferUpdateListener = window.vncAPI.onFramebufferUpdate((event: VncFramebufferUpdateEvent) => {
      if (event.sessionId !== sessionIdRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return

      event.rectangles.forEach(rectangle => drawRectangle(canvas, rectangle))
    })
    const removeDesktopSizeListener = window.vncAPI.onDesktopSize(event => {
      if (event.sessionId !== sessionIdRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.width = event.width
      canvas.height = event.height
      clearCanvas(canvas)
      setCanvasSize({ width: event.width, height: event.height })
    })
    const removeClipboardListener = window.vncAPI.onClipboard(event => {
      if (event.sessionId !== sessionIdRef.current || !event.text) return
      void window.clipboardAPI.writeText(event.text)
    })
    const removeBellListener = window.vncAPI.onBell(event => {
      if (event.sessionId !== sessionIdRef.current) return
      setStatusMessage(t('vnc.bell'))
      window.setTimeout(() => {
        setStatusMessage(current => (current === t('vnc.bell') ? '' : current))
      }, 1200)
    })
    const removeDisconnectedListener = window.vncAPI.onDisconnected(event => {
      if (event.sessionId !== sessionIdRef.current) return
      sessionIdRef.current = null
      setConnectionState('disconnected')
      setStatusMessage(event.reason || t('vnc.disconnected'))
    })

    const startSession = async () => {
      try {
        const result = await window.vncAPI.createSession({
          shellId,
          shared: true,
        })

        if (disposed) {
          void window.vncAPI.dispose({ sessionId: result.sessionId })
          return
        }

        const canvas = canvasRef.current
        if (canvas) {
          canvas.width = result.width
          canvas.height = result.height
          clearCanvas(canvas)
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
        setStatusMessage(error instanceof Error ? error.message : String(error))
      }
    }

    void startSession()

    return () => {
      disposed = true
      removeFramebufferUpdateListener()
      removeDesktopSizeListener()
      removeClipboardListener()
      removeBellListener()
      removeDisconnectedListener()

      const sessionId = sessionIdRef.current
      if (sessionId) {
        void window.vncAPI.dispose({ sessionId })
        sessionIdRef.current = null
      }
    }
  }, [reconnectToken, shellId, t])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    stopRemoteInputEvent(event)
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)

    const point = getRemotePoint(event)
    if (!point) return

    const buttonMask = getButtonMask(event.buttons)
    buttonMaskRef.current = buttonMask
    sendPointerEvent(buttonMask, point.x, point.y)
  }, [getRemotePoint, sendPointerEvent])

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = getRemotePoint(event)
    if (!point) return

    const buttonMask = getButtonMask(event.buttons) || buttonMaskRef.current
    sendPointerEvent(buttonMask, point.x, point.y)
  }, [getRemotePoint, sendPointerEvent])

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    stopRemoteInputEvent(event)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const point = getRemotePoint(event)
    if (!point) return

    const buttonMask = getButtonMask(event.buttons)
    buttonMaskRef.current = buttonMask
    sendPointerEvent(buttonMask, point.x, point.y)
  }, [getRemotePoint, sendPointerEvent])

  const handleWheel = useCallback((event: WheelEvent<HTMLCanvasElement>) => {
    stopRemoteInputEvent(event)
    const point = getRemotePoint(event)
    if (!point) return

    const verticalMask = event.deltaY < 0 ? WHEEL_UP_MASK : event.deltaY > 0 ? WHEEL_DOWN_MASK : 0
    const horizontalMask = event.deltaX < 0 ? WHEEL_LEFT_MASK : event.deltaX > 0 ? WHEEL_RIGHT_MASK : 0
    const wheelMask = verticalMask || horizontalMask
    if (!wheelMask) return

    sendPointerEvent(buttonMaskRef.current | wheelMask, point.x, point.y)
    sendPointerEvent(buttonMaskRef.current, point.x, point.y)
  }, [getRemotePoint, sendPointerEvent])

  const handleKeyEvent = useCallback((event: KeyboardEvent<HTMLCanvasElement>, down: boolean) => {
    const keySym = getEventKeySym(event)
    if (!keySym) return

    stopRemoteInputEvent(event)

    const sessionId = sessionIdRef.current
    if (!sessionId || connectionState !== 'connected') return

    void window.vncAPI.keyEvent({
      sessionId,
      down,
      keySym,
    })
  }, [connectionState])

  const showOverlay = connectionState !== 'connected' || Boolean(statusMessage)
  const overlayText = connectionState === 'connecting'
    ? t('vnc.connecting')
    : connectionState === 'failed'
      ? t('vnc.connectionFailed', { message: statusMessage })
      : statusMessage
  const canvasStyle = {
    width: canvasSize.width ? `${canvasSize.width}px` : '1px',
    height: canvasSize.height ? `${canvasSize.height}px` : '1px',
  } satisfies CSSProperties

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <ProjectionScreenRegular />
          <span className={styles.toolbarTitleText}>
            {desktopName || t('vnc.desktop')}
          </span>
          {canvasSize.width > 0 && canvasSize.height > 0 && (
            <span className={styles.toolbarMeta}>
              {t('vnc.resolution', { width: canvasSize.width, height: canvasSize.height })}
            </span>
          )}
        </div>
        <Button
          appearance="subtle"
          aria-label={t('vnc.pasteClipboard')}
          className={styles.toolbarAction}
          disabled={connectionState !== 'connected'}
          icon={<ClipboardPasteRegular />}
          onClick={() => void pasteClipboardToRemote()}
          size="small"
          title={t('vnc.pasteClipboard')}
          type="button"
        />
        <Button
          appearance="subtle"
          aria-label={t('vnc.reconnect')}
          className={styles.toolbarAction}
          icon={<TabDesktopArrowClockwiseRegular />}
          onClick={reconnect}
          size="small"
          title={t('vnc.reconnect')}
          type="button"
        />
      </div>
      <div className={styles.viewport}>
        <div className={styles.canvasStage}>
          <canvas
            aria-label={t('vnc.desktop')}
            className={styles.canvas}
            onContextMenu={event => stopRemoteInputEvent(event)}
            onKeyDown={event => handleKeyEvent(event, true)}
            onKeyUp={event => handleKeyEvent(event, false)}
            onPointerCancel={handlePointerUp}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
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
