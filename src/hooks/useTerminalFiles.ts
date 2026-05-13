import { useEffect, useState } from 'react'
import type {
  TerminalFileEntry,
  TerminalFilesSnapshot,
} from '@/shared/terminalFilesTypes'

interface TerminalFilesState {
  entriesByParent: Record<string, TerminalFileEntry[]>
  error: string | null
  homeDir: string | null
  isLoading: boolean
  loadingDirectories: Record<string, boolean>
  rootSnapshot: TerminalFilesSnapshot | null
  goHome: () => Promise<void>
  loadDirectory: (targetPath: string) => Promise<void>
  refresh: () => Promise<void>
  setRootPath: (targetPath: string) => Promise<void>
}

export function useTerminalFiles(sessionId: string | null): TerminalFilesState {
  const [rootSnapshot, setRootSnapshot] = useState<TerminalFilesSnapshot | null>(null)
  const [entriesByParent, setEntriesByParent] = useState<Record<string, TerminalFileEntry[]>>({})
  const [homeDir, setHomeDir] = useState<string | null>(null)
  const [loadingDirectories, setLoadingDirectories] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRootSnapshot(null)
    setEntriesByParent({})
    setHomeDir(null)
    setLoadingDirectories({})
    setIsLoading(Boolean(sessionId))
    setError(null)

    if (!sessionId || !window.terminalFilesAPI) return

    const removeSnapshotListener = window.terminalFilesAPI.onSnapshot(event => {
      if (event.sessionId !== sessionId) return

      setRootSnapshot(event.snapshot)
      setEntriesByParent({
        [event.snapshot.cwd]: event.snapshot.entries,
      })
      setHomeDir(event.snapshot.homeDir)
      setLoadingDirectories({})
      setIsLoading(false)
      setError(null)
    })

    const removeDirectoryListener = window.terminalFilesAPI.onDirectory(event => {
      if (event.sessionId !== sessionId) return

      setEntriesByParent(previous => ({
        ...previous,
        [event.parentPath]: event.entries,
      }))
      setLoadingDirectories(previous => {
        const nextLoadingDirectories = { ...previous }
        delete nextLoadingDirectories[event.parentPath]
        return nextLoadingDirectories
      })
      setError(null)
    })

    const removeErrorListener = window.terminalFilesAPI.onError(event => {
      if (event.sessionId && event.sessionId !== sessionId) return

      setIsLoading(false)
      setLoadingDirectories({})
      setError(event.message)
    })

    window.terminalFilesAPI.subscribe({ sessionId }).catch(nextError => {
      setIsLoading(false)
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    })

    return () => {
      removeSnapshotListener()
      removeDirectoryListener()
      removeErrorListener()
      window.terminalFilesAPI.unsubscribe({ sessionId }).catch(() => undefined)
    }
  }, [sessionId])

  const refresh = async (): Promise<void> => {
    if (!sessionId || !window.terminalFilesAPI) return

    setIsLoading(true)
    setError(null)
    try {
      await window.terminalFilesAPI.refresh({ sessionId })
    } catch (nextError) {
      setIsLoading(false)
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  const goHome = async (): Promise<void> => {
    if (!sessionId || !window.terminalFilesAPI) return

    setIsLoading(true)
    setError(null)
    try {
      await window.terminalFilesAPI.goHome({ sessionId })
    } catch (nextError) {
      setIsLoading(false)
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  const loadDirectory = async (targetPath: string): Promise<void> => {
    if (!sessionId || !window.terminalFilesAPI) return
    if (entriesByParent[targetPath] || loadingDirectories[targetPath]) return

    setLoadingDirectories(previous => ({
      ...previous,
      [targetPath]: true,
    }))
    setError(null)

    try {
      await window.terminalFilesAPI.readDirectory({
        sessionId,
        path: targetPath,
      })
    } catch (nextError) {
      setLoadingDirectories(previous => {
        const nextLoadingDirectories = { ...previous }
        delete nextLoadingDirectories[targetPath]
        return nextLoadingDirectories
      })
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  const setRootPath = async (targetPath: string): Promise<void> => {
    if (!sessionId || !window.terminalFilesAPI) return

    setIsLoading(true)
    setError(null)
    try {
      await window.terminalFilesAPI.setRootPath({
        sessionId,
        path: targetPath,
      })
    } catch (nextError) {
      setIsLoading(false)
      const message = nextError instanceof Error ? nextError.message : String(nextError)
      setError(message)
      throw nextError
    }
  }

  return {
    entriesByParent,
    error,
    homeDir,
    isLoading,
    loadingDirectories,
    rootSnapshot,
    goHome,
    loadDirectory,
    refresh,
    setRootPath,
  }
}
