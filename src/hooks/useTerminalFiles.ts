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
import { useEffect, useRef, useState } from 'react'
import type {
  TerminalFileEntry,
  TerminalFilesSnapshot,
  TerminalFilesTransferState,
} from '@/shared/terminalFilesTypes'

interface TerminalFilesState {
  entriesByParent: Record<string, TerminalFileEntry[]>
  error: string | null
  homeDir: string | null
  isLoading: boolean
  isTransferring: boolean
  loadingDirectories: Record<string, boolean>
  rootSnapshot: TerminalFilesSnapshot | null
  transferState: TerminalFilesTransferState | null
  goHome: () => Promise<void>
  loadDirectory: (targetPath: string) => Promise<void>
  refresh: () => Promise<void>
  setRootPath: (targetPath: string) => Promise<void>
  createFile: (parentPath: string, name: string) => Promise<string>
  createDirectory: (parentPath: string, name: string) => Promise<string>
  deleteEntries: (targetPaths: string[]) => Promise<string[]>
  uploadFiles: (destinationPath: string, sourcePaths: string[]) => Promise<void>
  downloadFiles: (destinationPath: string, sourcePaths: string[]) => Promise<void>
  clearTransferState: () => void
}

export function useTerminalFiles(sessionId: string | null): TerminalFilesState {
  const [rootSnapshot, setRootSnapshot] = useState<TerminalFilesSnapshot | null>(null)
  const [entriesByParent, setEntriesByParent] = useState<Record<string, TerminalFileEntry[]>>({})
  const [homeDir, setHomeDir] = useState<string | null>(null)
  const [loadingDirectories, setLoadingDirectories] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transferState, setTransferState] = useState<TerminalFilesTransferState | null>(null)
  const rootPathRef = useRef<string | null>(null)
  const entriesByParentRef = useRef<Record<string, TerminalFileEntry[]>>({})
  const transferClearTimerRef = useRef<number | null>(null)

  rootPathRef.current = rootSnapshot?.cwd ?? null
  entriesByParentRef.current = entriesByParent

  const normalizeComparablePath = (targetPath: string): string => (
    targetPath.replace(/[\\/]+/g, '/').replace(/\/$/, '')
  )

  const isPathWithinRoot = (rootPath: string, candidatePath: string): boolean => {
    const normalizedRootPath = normalizeComparablePath(rootPath)
    const normalizedCandidatePath = normalizeComparablePath(candidatePath)
    if (normalizedRootPath === normalizedCandidatePath) return true

    return normalizedCandidatePath.startsWith(`${normalizedRootPath}/`)
  }

  useEffect(() => {
    setRootSnapshot(null)
    setEntriesByParent({})
    setHomeDir(null)
    setLoadingDirectories({})
    setIsLoading(Boolean(sessionId))
    setError(null)
    setTransferState(null)

    if (transferClearTimerRef.current) {
      window.clearTimeout(transferClearTimerRef.current)
      transferClearTimerRef.current = null
    }

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

    const removeTransferStateListener = window.terminalFilesAPI.onTransferState(event => {
      if (event.sessionId !== sessionId) return

      if (transferClearTimerRef.current) {
        window.clearTimeout(transferClearTimerRef.current)
        transferClearTimerRef.current = null
      }

      setTransferState(event.state)

      if (event.state.status !== 'completed') {
        return
      }

      if (event.state.direction === 'upload') {
        if (event.state.destinationPath === rootPathRef.current) {
          window.terminalFilesAPI.refresh({ sessionId }).catch(() => undefined)
        } else if (entriesByParentRef.current[event.state.destinationPath]) {
          window.terminalFilesAPI.readDirectory({
            sessionId,
            path: event.state.destinationPath,
          }).catch(() => undefined)
        }
      }

      transferClearTimerRef.current = window.setTimeout(() => {
        setTransferState(previous => (
          previous?.taskId === event.state.taskId ? null : previous
        ))
        transferClearTimerRef.current = null
      }, 1200)
    })

    window.terminalFilesAPI.subscribe({ sessionId }).catch(nextError => {
      setIsLoading(false)
      setError(nextError instanceof Error ? nextError.message : String(nextError))
    })

    return () => {
      removeSnapshotListener()
      removeDirectoryListener()
      removeErrorListener()
      removeTransferStateListener()

      if (transferClearTimerRef.current) {
        window.clearTimeout(transferClearTimerRef.current)
        transferClearTimerRef.current = null
      }

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

  const reloadDirectory = async (targetPath: string): Promise<void> => {
    if (!sessionId || !window.terminalFilesAPI) return

    setLoadingDirectories(previous => ({
      ...previous,
      [targetPath]: true,
    }))

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
      throw nextError
    }
  }

  const pruneEntriesCache = (deletedPaths: string[]): void => {
    if (deletedPaths.length === 0) return

    setEntriesByParent(previous => {
      const nextEntriesByParent = { ...previous }

      deletedPaths.forEach(deletedPath => {
        Object.keys(nextEntriesByParent).forEach(parentPath => {
          if (isPathWithinRoot(deletedPath, parentPath)) {
            delete nextEntriesByParent[parentPath]
          }
        })
      })

      return nextEntriesByParent
    })
  }

  const findParentPath = (targetPath: string): string | null => {
    const parentEntry = Object.entries(entriesByParentRef.current).find(([, entries]) => (
      entries.some(entry => entry.absolutePath === targetPath)
    ))

    return parentEntry?.[0] ?? null
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

  const createFile = async (parentPath: string, name: string): Promise<string> => {
    if (!sessionId || !window.terminalFilesAPI) return ''

    setError(null)
    const { createdPath } = await window.terminalFilesAPI.createFile({
      sessionId,
      parentPath,
      name,
    })

    if (parentPath === rootPathRef.current) {
      await window.terminalFilesAPI.refresh({ sessionId })
    } else {
      await reloadDirectory(parentPath)
    }

    return createdPath
  }

  const createDirectory = async (parentPath: string, name: string): Promise<string> => {
    if (!sessionId || !window.terminalFilesAPI) return ''

    setError(null)
    const { createdPath } = await window.terminalFilesAPI.createDirectory({
      sessionId,
      parentPath,
      name,
    })

    if (parentPath === rootPathRef.current) {
      await window.terminalFilesAPI.refresh({ sessionId })
    } else {
      await reloadDirectory(parentPath)
    }

    return createdPath
  }

  const deleteEntries = async (targetPaths: string[]): Promise<string[]> => {
    if (!sessionId || !window.terminalFilesAPI) return []
    if (targetPaths.length === 0) return []

    setError(null)
    const refreshParentPaths = new Set<string>()

    targetPaths.forEach(targetPath => {
      const parentPath = findParentPath(targetPath)
      if (parentPath) {
        refreshParentPaths.add(parentPath)
      }
    })

    const { deletedPaths } = await window.terminalFilesAPI.deleteEntries({
      sessionId,
      targetPaths,
    })

    pruneEntriesCache(deletedPaths)

    await Promise.all([...refreshParentPaths].map(async parentPath => {
      if (parentPath === rootPathRef.current) {
        await window.terminalFilesAPI.refresh({ sessionId })
        return
      }

      await reloadDirectory(parentPath)
    }))

    return deletedPaths
  }

  const uploadFiles = async (destinationPath: string, sourcePaths: string[]): Promise<void> => {
    if (!sessionId || !window.terminalFilesAPI) return
    if (sourcePaths.length === 0) return

    setError(null)
    await window.terminalFilesAPI.upload({
      sessionId,
      destinationPath,
      sourcePaths,
    })
  }

  const downloadFiles = async (destinationPath: string, sourcePaths: string[]): Promise<void> => {
    if (!sessionId || !window.terminalFilesAPI) return
    if (sourcePaths.length === 0) return

    setError(null)
    await window.terminalFilesAPI.download({
      sessionId,
      destinationPath,
      sourcePaths,
    })
  }

  const clearTransferState = (): void => {
    if (transferClearTimerRef.current) {
      window.clearTimeout(transferClearTimerRef.current)
      transferClearTimerRef.current = null
    }

    setTransferState(null)
  }

  return {
    entriesByParent,
    error,
    homeDir,
    isLoading,
    isTransferring: transferState?.status === 'scanning' || transferState?.status === 'transferring',
    loadingDirectories,
    rootSnapshot,
    transferState,
    goHome,
    loadDirectory,
    refresh,
    setRootPath,
    createFile,
    createDirectory,
    deleteEntries,
    uploadFiles,
    downloadFiles,
    clearTransferState,
  }
}
