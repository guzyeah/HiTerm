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
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react'
import {
  WorkspaceRuntimeContext,
  type ActiveTerminalSession,
  type TerminalController,
  type WorkspaceRuntimeContextValue,
} from './workspaceRuntimeContext'

interface WorkspaceRuntimeProviderProps {
  children: ReactNode
}

export const WorkspaceRuntimeProvider: FC<WorkspaceRuntimeProviderProps> = ({ children }) => {
  const [activeTerminalSession, setActiveTerminalSessionState] = useState<ActiveTerminalSession | null>(null)
  const activeTerminalSessionRef = useRef<ActiveTerminalSession | null>(null)
  const terminalControllersRef = useRef(new Map<string, TerminalController>())

  const setActiveTerminalSession = useCallback((session: ActiveTerminalSession | null) => {
    activeTerminalSessionRef.current = session
    setActiveTerminalSessionState(previous => {
      if (
        previous?.tabId === session?.tabId
        && previous?.sessionId === session?.sessionId
        && previous?.shellName === session?.shellName
        && previous?.protocol === session?.protocol
      ) {
        return previous
      }

      return session
    })
  }, [])

  const registerTerminalController = useCallback((tabId: string, controller: TerminalController) => {
    terminalControllersRef.current.set(tabId, controller)

    return () => {
      if (terminalControllersRef.current.get(tabId) === controller) {
        terminalControllersRef.current.delete(tabId)
      }
    }
  }, [])

  const focusActiveTerminal = useCallback(() => {
    const activeTabId = activeTerminalSessionRef.current?.tabId
    if (!activeTabId) return

    terminalControllersRef.current.get(activeTabId)?.focus()
  }, [])

  const writeToActiveTerminal = useCallback((text: string) => {
    const activeTabId = activeTerminalSessionRef.current?.tabId
    if (!activeTabId) return

    terminalControllersRef.current.get(activeTabId)?.writeText(text)
  }, [])

  const value = useMemo<WorkspaceRuntimeContextValue>(() => ({
    activeTerminalSession,
    focusActiveTerminal,
    registerTerminalController,
    setActiveTerminalSession,
    writeToActiveTerminal,
  }), [
    activeTerminalSession,
    focusActiveTerminal,
    registerTerminalController,
    setActiveTerminalSession,
    writeToActiveTerminal,
  ])

  return (
    <WorkspaceRuntimeContext.Provider value={value}>
      {children}
    </WorkspaceRuntimeContext.Provider>
  )
}
