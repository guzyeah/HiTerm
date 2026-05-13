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
