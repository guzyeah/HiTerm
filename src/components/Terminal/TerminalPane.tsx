import { useEffect, useRef, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { makeStyles } from '@fluentui/react-components'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { terminalFontFamily, terminalTheme } from './terminalTheme'

interface TerminalPaneProps {
  shellId: string
  isActive: boolean
}

const useStyles = makeStyles({
  root: {
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

export const TerminalPane: FC<TerminalPaneProps> = ({ shellId, isActive }) => {
  const styles = useStyles()
  const { t } = useTranslation()
  const tRef = useRef(t)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const resizeFrameRef = useRef<number | null>(null)

  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !window.terminalAPI) return
    let disposed = false

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: terminalFontFamily,
      fontSize: 13,
      lineHeight: 1.2,
      scrollback: 10000,
      theme: terminalTheme,
    })
    const fitAddon = new FitAddon()

    terminal.loadAddon(fitAddon)
    terminal.open(host)
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const inputDisposable = terminal.onData(data => {
      const sessionId = sessionIdRef.current
      if (sessionId) {
        window.terminalAPI.write({ sessionId, data })
      }
    })

    const removeDataListener = window.terminalAPI.onData(event => {
      if (event.sessionId === sessionIdRef.current) {
        terminal.write(event.data)
      }
    })

    const removeExitListener = window.terminalAPI.onExit(event => {
      if (event.sessionId === sessionIdRef.current) {
        sessionIdRef.current = null
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
        const result = await window.terminalAPI.createLocalSession({
          shellId,
          cols: dimensions.cols,
          rows: dimensions.rows,
        })

        if (disposed) {
          void window.terminalAPI.dispose({ sessionId: result.sessionId })
          return
        }

        sessionIdRef.current = result.sessionId
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
      removeDataListener()
      removeExitListener()

      const sessionId = sessionIdRef.current
      if (sessionId) {
        window.terminalAPI.dispose({ sessionId })
        sessionIdRef.current = null
      }

      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [shellId])

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

  return (
    <div className={styles.root}>
      <div className={styles.terminalHost} ref={hostRef} />
    </div>
  )
}
