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
import { createContext, useContext } from 'react'

export interface ActiveTerminalSession {
  tabId: string
  sessionId: string
  shellName: string
}

export interface WorkspaceRuntimeContextValue {
  activeTerminalSession: ActiveTerminalSession | null
  setActiveTerminalSession: (session: ActiveTerminalSession | null) => void
}

export const WorkspaceRuntimeContext = createContext<WorkspaceRuntimeContextValue | null>(null)

export function useWorkspaceRuntime(): WorkspaceRuntimeContextValue {
  const context = useContext(WorkspaceRuntimeContext)
  if (!context) {
    throw new Error('useWorkspaceRuntime must be used within WorkspaceRuntimeProvider')
  }

  return context
}
