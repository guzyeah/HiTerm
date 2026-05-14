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
import type { ProtocolType } from './shellTypes'

/** 单条终端命令历史记录。 */
export interface TerminalHistoryRecord {
  id: string
  sessionId: string
  shellId: string
  shellNameSnapshot: string
  protocol: ProtocolType
  command: string
  executedAt: string
}

/** 查询命令历史的请求。 */
export interface TerminalHistoryListRequest {
  sessionId?: string | null
  limit?: number
}

/** 查询命令历史的响应。 */
export interface TerminalHistoryListResult {
  records: TerminalHistoryRecord[]
}

/** 删除命令历史的请求。 */
export interface TerminalHistoryDeleteRequest {
  recordId: string
}

/** 删除命令历史的响应。 */
export interface TerminalHistoryDeleteResult {
  deleted: boolean
}

/** 新增命令历史时的事件。 */
export interface TerminalHistoryRecordEvent {
  record: TerminalHistoryRecord
}

/** 删除命令历史时的事件。 */
export interface TerminalHistoryDeletedEvent {
  recordId: string
}
