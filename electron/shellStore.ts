/**
 * Shell 连接记录存储模块
 * 使用 electron-store 持久化存储，敏感字段使用 AES-256-GCM 加密
 */

import ElectronStore from 'electron-store'
import { randomUUID } from 'crypto'
import { aesEncrypt, aesDecrypt } from './utils/crypto'

/** 认证方式 */
export type AuthType = 'password' | 'privateKey' | 'none'

/** 校验位 */
export type Parity = 'none' | 'even' | 'odd'

/** 流控制 */
export type FlowControl = 'none' | 'rtscts' | 'xonxoff'

/** 支持的协议 */
export type ProtocolType = 'ssh' | 'local' | 'telnet' | 'serial' | 'vnc' | 'rdp'

/** Shell 连接记录 */
export interface ShellRecord {
  id: string
  protocol: ProtocolType
  name: string
  group: string | null
  // 通用网络参数
  host?: string | null
  port?: number | null
  username?: string | null
  // 认证
  authType?: AuthType | null
  secret?: string | null           // 加密后的密码/私钥内容
  privateKeyPath?: string | null
  // Local 参数
  terminalPath?: string | null
  workDir?: string | null
  // Serial 参数
  serialPort?: string | null
  baudRate?: number | null
  dataBits?: number | null
  parity?: Parity | null
  stopBits?: number | null
  flowControl?: FlowControl | null
  // VNC/RDP 参数
  colorDepth?: string | null
  quality?: string | null
  domain?: string | null
  resolution?: string | null
  // 扩展
  extraParams?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

interface ShellStoreSchema {
  shells: ShellRecord[]
}

const store = new ElectronStore<ShellStoreSchema>({
  defaults: {
    shells: [],
  },
})

/** 加密敏感字段 */
function encryptSecrets(record: ShellRecord): ShellRecord {
  const encrypted = { ...record }
  if (encrypted.secret) {
    encrypted.secret = aesEncrypt(encrypted.secret)
  }
  return encrypted
}

/** 解密敏感字段 */
function decryptSecrets(record: ShellRecord): ShellRecord {
  const decrypted = { ...record }
  if (decrypted.secret) {
    try {
      decrypted.secret = aesDecrypt(decrypted.secret)
    } catch {
      // 解密失败时保留原值
    }
  }
  return decrypted
}

/** 保存 Shell 连接记录 */
export function saveShell(record: Omit<ShellRecord, 'id' | 'createdAt' | 'updatedAt'>): ShellRecord {
  const shells = store.get('shells', [])
  const now = new Date().toISOString()

  const newRecord: ShellRecord = {
    ...record,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  }

  const encryptedRecord = encryptSecrets(newRecord)
  store.set('shells', [...shells, encryptedRecord])

  return newRecord
}

/** 更新 Shell 连接记录 */
export function updateShell(id: string, updates: Partial<ShellRecord>): ShellRecord | null {
  const shells = store.get('shells', [])
  const index = shells.findIndex(s => s.id === id)

  if (index === -1) return null

  const updated: ShellRecord = {
    ...shells[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  const encryptedRecord = encryptSecrets(updated)
  shells[index] = encryptedRecord
  store.set('shells', shells)

  return decryptSecrets(updated)
}

/** 删除 Shell 连接记录 */
export function deleteShell(id: string): boolean {
  const shells = store.get('shells', [])
  const filtered = shells.filter(s => s.id !== id)

  if (filtered.length === shells.length) return false

  store.set('shells', filtered)
  return true
}

/** 获取所有 Shell 连接记录（解密） */
export function listShells(): ShellRecord[] {
  const shells = store.get('shells', [])
  return shells.map(decryptSecrets)
}

/** 按协议获取 Shell 连接记录 */
export function listShellsByProtocol(protocol: ProtocolType): ShellRecord[] {
  return listShells().filter(s => s.protocol === protocol)
}

/** 获取所有分组名称（去重） */
export function listGroups(): string[] {
  const shells = store.get('shells', [])
  const groups = shells
    .map(s => s.group)
    .filter((g): g is string => g !== null && g !== undefined && g.trim() !== '')

  return [...new Set(groups)]
}

/** 按 ID 获取 Shell 连接记录 */
export function getShellById(id: string): ShellRecord | null {
  const shells = store.get('shells', [])
  const record = shells.find(s => s.id === id)
  return record ? decryptSecrets(record) : null
}
