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
/**
 * Terminal 命令历史持久化存储。
 * 使用独立 store 保存命令记录，避免与 Shell 配置耦合。
 */

import ElectronStore from 'electron-store'
import { randomUUID } from 'node:crypto'
import type { ProtocolType } from '../src/shared/shellTypes'
import type { TerminalHistoryRecord } from '../src/shared/terminalHistoryTypes'

const MAX_HISTORY_RECORDS = 5000

interface TerminalHistoryStoreSchema {
  records: TerminalHistoryRecord[]
}

export interface SaveTerminalHistoryRecordInput {
  sessionId: string
  shellId: string
  shellNameSnapshot: string
  protocol: ProtocolType
  command: string
  executedAt?: string
}

const store = new ElectronStore<TerminalHistoryStoreSchema>({
  defaults: {
    records: [],
  },
})

/** 追加一条命令历史，并保留固定上限的数据量。 */
export function appendTerminalHistoryRecord(
  input: SaveTerminalHistoryRecordInput,
): TerminalHistoryRecord {
  const record: TerminalHistoryRecord = {
    id: randomUUID(),
    sessionId: input.sessionId,
    shellId: input.shellId,
    shellNameSnapshot: input.shellNameSnapshot,
    protocol: input.protocol,
    command: input.command,
    executedAt: input.executedAt ?? new Date().toISOString(),
  }

  const nextRecords = [...store.get('records', []), record].slice(-MAX_HISTORY_RECORDS)
  store.set('records', nextRecords)

  return record
}

/** 按执行时间倒序返回命令历史。 */
export function listTerminalHistoryRecords(
  limit?: number,
  sessionId?: string | null,
): TerminalHistoryRecord[] {
  const records = [...store.get('records', [])]
    .filter(record => !sessionId || record.sessionId === sessionId)
    .sort((left, right) => (
    right.executedAt.localeCompare(left.executedAt)
    ))

  if (!limit || limit <= 0) {
    return records
  }

  return records.slice(0, limit)
}

/** 按记录 ID 删除命令历史。 */
export function deleteTerminalHistoryRecord(recordId: string): boolean {
  const records = store.get('records', [])
  const nextRecords = records.filter(record => record.id !== recordId)

  if (nextRecords.length === records.length) {
    return false
  }

  store.set('records', nextRecords)
  return true
}
