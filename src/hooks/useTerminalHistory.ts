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
import { useEffect, useState } from 'react'
import type { TerminalHistoryRecord } from '@/shared/terminalHistoryTypes'

interface TerminalHistoryState {
  records: TerminalHistoryRecord[]
  isLoading: boolean
  error: string | null
  deleteRecord: (recordId: string) => Promise<void>
}

/** 读取并订阅命令历史。 */
export function useTerminalHistory(sessionId: string | null, limit = 2000): TerminalHistoryState {
  const [records, setRecords] = useState<TerminalHistoryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isDisposed = false

    if (!window.terminalHistoryAPI || !sessionId) {
      setRecords([])
      setIsLoading(false)
      setError(null)
      return
    }

    setRecords([])
    setIsLoading(true)
    setError(null)

    window.terminalHistoryAPI.list({ limit, sessionId })
      .then(result => {
        if (isDisposed) return
        setRecords(result.records)
        setIsLoading(false)
      })
      .catch(nextError => {
        if (isDisposed) return
        setError(nextError instanceof Error ? nextError.message : String(nextError))
        setIsLoading(false)
      })

    const removeRecordedListener = window.terminalHistoryAPI.onRecorded(event => {
      if (event.record.sessionId !== sessionId) return

      setRecords(previous => {
        const nextRecords = [event.record, ...previous.filter(record => record.id !== event.record.id)]
        return limit > 0 ? nextRecords.slice(0, limit) : nextRecords
      })
    })

    const removeDeletedListener = window.terminalHistoryAPI.onDeleted(event => {
      setRecords(previous => previous.filter(record => record.id !== event.recordId))
    })

    return () => {
      isDisposed = true
      removeRecordedListener()
      removeDeletedListener()
    }
  }, [limit, sessionId])

  const deleteRecord = async (recordId: string): Promise<void> => {
    if (!window.terminalHistoryAPI || !sessionId) return

    const result = await window.terminalHistoryAPI.deleteRecord({ recordId })
    if (result.deleted) {
      setRecords(previous => previous.filter(record => record.id !== recordId))
    }
  }

  return {
    records,
    isLoading,
    error,
    deleteRecord,
  }
}
