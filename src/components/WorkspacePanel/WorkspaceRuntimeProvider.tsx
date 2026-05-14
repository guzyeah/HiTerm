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
  useState,
  type FC,
  type ReactNode,
} from 'react'
import {
  WorkspaceRuntimeContext,
  type ActiveTerminalSession,
  type WorkspaceRuntimeContextValue,
} from './workspaceRuntimeContext'

interface WorkspaceRuntimeProviderProps {
  children: ReactNode
}

export const WorkspaceRuntimeProvider: FC<WorkspaceRuntimeProviderProps> = ({ children }) => {
  const [activeTerminalSession, setActiveTerminalSessionState] = useState<ActiveTerminalSession | null>(null)

  const setActiveTerminalSession = useCallback((session: ActiveTerminalSession | null) => {
    setActiveTerminalSessionState(previous => {
      if (
        previous?.tabId === session?.tabId
        && previous?.sessionId === session?.sessionId
        && previous?.shellName === session?.shellName
      ) {
        return previous
      }

      return session
    })
  }, [])

  const value = useMemo<WorkspaceRuntimeContextValue>(() => ({
    activeTerminalSession,
    setActiveTerminalSession,
  }), [activeTerminalSession, setActiveTerminalSession])

  return (
    <WorkspaceRuntimeContext.Provider value={value}>
      {children}
    </WorkspaceRuntimeContext.Provider>
  )
}
