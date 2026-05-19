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
 * Terminal 命令历史 IPC 与记录分发。
 */

import { ipcMain, type WebContents } from 'electron'
import { getShellById } from './shellStore'
import {
  deleteTerminalHistoryRecord,
  appendTerminalHistoryRecord,
  listTerminalHistoryRecords,
} from './terminalHistoryStore'
import type {
  TerminalHistoryDeleteRequest,
  TerminalHistoryDeleteResult,
  TerminalHistoryListRequest,
  TerminalHistoryListResult,
  TerminalHistoryDeletedEvent,
} from '../src/shared/terminalHistoryTypes'
import type { ProtocolType } from '../src/shared/shellTypes'

interface RecordTerminalCommandInput {
  sessionId: string
  shellId: string
  protocol: ProtocolType
  command: string
}

/** 记录一条命令，并通知当前窗口中的历史面板。 */
export function recordTerminalCommand(
  webContents: WebContents,
  input: RecordTerminalCommandInput,
): void {
  const normalizedCommand = input.command.trim()
  if (!normalizedCommand) return

  const shell = getShellById(input.shellId)
  const record = appendTerminalHistoryRecord({
    sessionId: input.sessionId,
    shellId: input.shellId,
    shellNameSnapshot: shell?.name ?? input.shellId,
    protocol: input.protocol,
    command: normalizedCommand,
  })

  if (!webContents.isDestroyed()) {
    webContents.send('terminalHistory:recorded', { record })
  }
}

/** 删除一条命令历史，并通知当前窗口。 */
export function removeTerminalHistoryRecord(
  webContents: WebContents,
  input: TerminalHistoryDeleteRequest,
): TerminalHistoryDeleteResult {
  const deleted = deleteTerminalHistoryRecord(input.recordId)
  if (deleted && !webContents.isDestroyed()) {
    webContents.send('terminalHistory:deleted', { recordId: input.recordId } satisfies TerminalHistoryDeletedEvent)
  }

  return { deleted }
}

/** 注册命令历史相关 IPC。 */
export function registerTerminalHistoryIpcHandlers(): void {
  ipcMain.handle(
    'terminalHistory:list',
    (_event, request?: TerminalHistoryListRequest): TerminalHistoryListResult => ({
      records: listTerminalHistoryRecords(request?.limit, request?.sessionId),
    }),
  )

  ipcMain.handle(
    'terminalHistory:delete',
    (event, request: TerminalHistoryDeleteRequest): TerminalHistoryDeleteResult => (
      removeTerminalHistoryRecord(event.sender, request)
    ),
  )
}
