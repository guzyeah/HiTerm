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
 * 连接Shell对话框类型定义
 */

/** 支持的协议 */
export type ProtocolType = 'ssh' | 'local' | 'telnet' | 'serial' | 'vnc' | 'rdp'

/** 认证方式 */
export type AuthType = 'password' | 'privateKey' | 'none'

/** 校验位 */
export type ParityType = 'none' | 'even' | 'odd'

/** 流控制 */
export type FlowControlType = 'none' | 'rtscts' | 'xonxoff'

/** SSH 表单数据 */
export interface SSHFormData {
  host: string
  port: number
  username: string
  authType: Extract<AuthType, 'password' | 'privateKey'>
  password: string
  privateKeyPath: string
}

/** Local 表单数据 */
export interface LocalFormData {
  terminalPath: string
  workDir: string
}

/** Telnet 表单数据 */
export interface TelnetFormData {
  host: string
  port: number
  username: string
  authType: Extract<AuthType, 'none' | 'password'>
  password: string
}

/** Serial 表单数据 */
export interface SerialFormData {
  serialPort: string
  baudRate: number
  dataBits: number
  parity: ParityType
  stopBits: number
  flowControl: FlowControlType
}

/** VNC 表单数据 */
export interface VNCFormData {
  host: string
  port: number
  password: string
  colorDepth: string
  quality: string
}

/** RDP 表单数据 */
export interface RDPFormData {
  host: string
  port: number
  username: string
  password: string
  domain: string
  resolution: string
}

/** 各协议表单数据映射 */
export interface ProtocolFormDataMap {
  ssh: SSHFormData
  local: LocalFormData
  telnet: TelnetFormData
  serial: SerialFormData
  vnc: VNCFormData
  rdp: RDPFormData
}

/** 表单数据联合类型 */
export type ProtocolFormData =
  | SSHFormData
  | LocalFormData
  | TelnetFormData
  | SerialFormData
  | VNCFormData
  | RDPFormData

/** 协议配置 */
export interface ProtocolConfig {
  id: ProtocolType
  label: string
  icon: string
  defaultPort?: number
}

/** 串口信息 */
export interface SerialPortInfo {
  path: string
  friendlyName?: string
}

/** 保存的 Shell 记录 */
export interface ShellRecord {
  id: string
  protocol: ProtocolType
  name: string
  group: string | null
  host?: string | null
  port?: number | null
  username?: string | null
  authType?: AuthType | null
  secret?: string | null
  privateKeyPath?: string | null
  workDir?: string | null
  terminalPath?: string | null
  serialPort?: string | null
  baudRate?: number | null
  dataBits?: number | null
  parity?: string | null
  stopBits?: number | null
  flowControl?: string | null
  colorDepth?: string | null
  quality?: string | null
  domain?: string | null
  resolution?: string | null
  extraParams?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}
