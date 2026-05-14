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
import type { TerminalStatusSample } from '@/shared/terminalStatusTypes'

interface TerminalStatusState {
  cpuHistory: Array<number | null>
  error: string | null
  memoryHistory: Array<number | null>
  sample: TerminalStatusSample | null
}

const HISTORY_LIMIT = 10

function appendHistoryValue(
  history: Array<number | null>,
  value: number | null,
): Array<number | null> {
  return [...history, value].slice(-HISTORY_LIMIT)
}

export function useTerminalStatus(sessionId: string | null): TerminalStatusState {
  const [sample, setSample] = useState<TerminalStatusSample | null>(null)
  const [cpuHistory, setCpuHistory] = useState<Array<number | null>>([])
  const [memoryHistory, setMemoryHistory] = useState<Array<number | null>>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSample(null)
    setCpuHistory([])
    setMemoryHistory([])
    setError(null)

    if (!sessionId || !window.terminalStatusAPI) return

    const removeSampleListener = window.terminalStatusAPI.onSample(event => {
      if (event.sessionId !== sessionId) return

      setSample(event.sample)
      setCpuHistory(previous => appendHistoryValue(previous, event.sample.cpu.usagePercent))
      setMemoryHistory(previous => appendHistoryValue(previous, event.sample.memory.usagePercent))
    })
    const removeErrorListener = window.terminalStatusAPI.onError(event => {
      if (event.sessionId && event.sessionId !== sessionId) return
      setError(event.message)
    })

    window.terminalStatusAPI.subscribe({ sessionId }).catch(error => {
      setError(error instanceof Error ? error.message : String(error))
    })

    return () => {
      removeSampleListener()
      removeErrorListener()
      window.terminalStatusAPI.unsubscribe({ sessionId }).catch(() => undefined)
    }
  }, [sessionId])

  return {
    cpuHistory,
    error,
    memoryHistory,
    sample,
  }
}
