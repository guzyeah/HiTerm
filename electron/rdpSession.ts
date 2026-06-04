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
 * RDP 图形会话 IPC 骨架。
 * 后续接入 IronRDP sidecar 后，这里负责进程生命周期、输入转发和帧数据分发。
 */

import { app, ipcMain, type WebContents } from 'electron'
import { getShellById } from './shellStore'
import type {
  RdpClientClipboardRequest,
  RdpCreateSessionRequest,
  RdpCreateSessionResult,
  RdpKeyEventRequest,
  RdpPointerEventRequest,
  RdpResizeRequest,
  RdpSessionRequest,
} from '../src/shared/rdpTypes'

interface RdpSession {
  sessionId: string
  shellId: string
  webContents: WebContents
}

const rdpSessions = new Map<string, RdpSession>()

function getRdpSessionForSender(sessionId: string, sender: WebContents): RdpSession {
  const session = rdpSessions.get(sessionId)
  if (!session || session.webContents.id !== sender.id) {
    throw new Error('RDP session not found')
  }

  return session
}

function disposeRdpSession(sessionId: string): void {
  rdpSessions.delete(sessionId)
}

function createRdpSession(
  webContents: WebContents,
  request: RdpCreateSessionRequest,
): RdpCreateSessionResult {
  const shell = getShellById(request.shellId)
  if (!shell || shell.protocol !== 'rdp') {
    throw new Error('Only RDP sessions are supported')
  }

  void webContents

  // TODO: 连接 IronRDP sidecar 后在这里返回真实桌面尺寸和名称。
  throw new Error('Embedded RDP engine is not available yet')
}

export function registerRdpIpcHandlers(): void {
  ipcMain.handle('rdp:createSession', (event, request: RdpCreateSessionRequest) => (
    createRdpSession(event.sender, request)
  ))

  ipcMain.handle('rdp:pointerEvent', (event, request: RdpPointerEventRequest) => {
    getRdpSessionForSender(request.sessionId, event.sender)
    // TODO: 转发鼠标事件到 IronRDP sidecar。
  })

  ipcMain.handle('rdp:keyEvent', (event, request: RdpKeyEventRequest) => {
    getRdpSessionForSender(request.sessionId, event.sender)
    // TODO: 转发键盘事件到 IronRDP sidecar。
  })

  ipcMain.handle('rdp:resize', (event, request: RdpResizeRequest) => {
    getRdpSessionForSender(request.sessionId, event.sender)
    // TODO: 转发 resize 到 IronRDP sidecar。
  })

  ipcMain.handle('rdp:clientClipboard', (event, request: RdpClientClipboardRequest) => {
    getRdpSessionForSender(request.sessionId, event.sender)
    // TODO: 转发剪贴板文本到 IronRDP sidecar。
  })

  ipcMain.handle('rdp:dispose', (event, request: RdpSessionRequest) => {
    getRdpSessionForSender(request.sessionId, event.sender)
    disposeRdpSession(request.sessionId)
  })

  app.once('before-quit', () => {
    rdpSessions.clear()
  })
}
