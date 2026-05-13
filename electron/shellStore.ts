/**
 * Shell 连接记录存储模块
 * 使用 electron-store 持久化存储，敏感字段使用 AES-256-GCM 加密
 */

import ElectronStore from 'electron-store'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'crypto'
import {
  LOCAL_SHELL_GROUP_NAME,
  PRESET_SHELL_GROUP_NAMES,
} from '../src/shared/shellGroups'
import type { ShellSummary } from '../src/shared/shellTypes'
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

/** Shell 分组记录，Shell 中只保存 group 名称进行关联 */
export interface ShellGroup {
  name: string
  createdAt: string
  updatedAt: string
}

interface ShellStoreSchema {
  shells: ShellRecord[]
  groups: ShellGroup[]
}

interface BuiltinLocalShell {
  name: string
  terminalPath: string
}

const store = new ElectronStore<ShellStoreSchema>({
  defaults: {
    shells: [],
    groups: [],
  },
})

/** 规范化分组名，避免空白字符串落盘 */
function normalizeGroupName(group: string | null | undefined): string | null {
  const name = group?.trim()
  return name ? name : null
}

/** 规范化终端路径用于去重，Windows 下忽略大小写 */
function normalizeTerminalPath(terminalPath: string | null | undefined): string | null {
  const normalizedPath = terminalPath ? path.normalize(terminalPath) : null
  if (!normalizedPath) return null
  return process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath
}

/** 取第一个存在的可执行文件路径 */
function findFirstExistingPath(candidates: string[]): string | null {
  return candidates.find(candidate => existsSync(candidate)) ?? null
}

/** 去重并保留原始顺序 */
function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = getKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** 从现有 Shell 记录迁移历史分组名到独立 groups 集合 */
function ensureGroupsMigratedFromShells(): ShellGroup[] {
  const groups = store.get('groups', [])
  const existingNames = new Set(groups.map(group => group.name))
  const shellGroupNames = store
    .get('shells', [])
    .map(shell => normalizeGroupName(shell.group))
    .filter((name): name is string => name !== null)

  const missingNames = [...new Set(shellGroupNames)].filter(name => !existingNames.has(name))
  if (missingNames.length === 0) return groups

  const now = new Date().toISOString()
  const migratedGroups = [
    ...groups,
    ...missingNames.map(name => ({
      name,
      createdAt: now,
      updatedAt: now,
    })),
  ]

  store.set('groups', migratedGroups)
  return migratedGroups
}

/** 确保应用预置分组存在 */
function ensurePresetGroups(): ShellGroup[] {
  const groups = ensureGroupsMigratedFromShells()
  const existingNames = new Set(groups.map(group => group.name))
  const now = new Date().toISOString()
  const missingGroups = PRESET_SHELL_GROUP_NAMES
    .filter(name => !existingNames.has(name))
    .map(name => ({
      name,
      createdAt: now,
      updatedAt: now,
    }))

  if (missingGroups.length === 0) return groups

  const nextGroups = [...groups, ...missingGroups]
  store.set('groups', nextGroups)
  return nextGroups
}

/** 按预置分组优先的顺序输出分组 */
function sortGroups(groups: ShellGroup[]): ShellGroup[] {
  const presetOrder = new Map<string, number>(PRESET_SHELL_GROUP_NAMES.map((name, index) => [name, index]))

  return [...groups].sort((a, b) => {
    const aOrder = presetOrder.get(a.name)
    const bOrder = presetOrder.get(b.name)
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder
    if (aOrder !== undefined) return -1
    if (bOrder !== undefined) return 1
    return a.name.localeCompare(b.name)
  })
}

/** 保存分组名；如果已存在则不重复创建 */
export function saveGroup(name: string): ShellGroup | null {
  const normalizedName = normalizeGroupName(name)
  if (!normalizedName) return null

  const groups = ensureGroupsMigratedFromShells()
  const existing = groups.find(group => group.name === normalizedName)
  if (existing) return existing

  const now = new Date().toISOString()
  const group: ShellGroup = {
    name: normalizedName,
    createdAt: now,
    updatedAt: now,
  }

  store.set('groups', [...groups, group])
  return group
}

/** 生成 Windows 上 Git Bash 的候选路径，盘符覆盖 A-Z */
function getWindowsGitBashCandidates(): string[] {
  const gitBashRelativePaths = [
    'Program Files\\Git\\bin\\bash.exe',
    'Program Files (x86)\\Git\\bin\\bash.exe',
    'Programs\\Git\\bin\\bash.exe',
  ]

  return Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index))
    .flatMap(drive => gitBashRelativePaths.map(relativePath => `${drive}:\\${relativePath}`))
}

/** 扫描当前系统常见的本地 Shell */
function detectBuiltinLocalShells(): BuiltinLocalShell[] {
  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
    const powershellPath = findFirstExistingPath([
      path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ])
    const cmdPath = findFirstExistingPath([
      path.join(systemRoot, 'System32', 'cmd.exe'),
    ])
    const gitBashPaths = getWindowsGitBashCandidates().filter(candidate => existsSync(candidate))

    return uniqueBy([
      ...(powershellPath ? [{ name: 'PowerShell', terminalPath: powershellPath }] : []),
      ...(cmdPath ? [{ name: 'CMD', terminalPath: cmdPath }] : []),
      ...gitBashPaths.map(terminalPath => ({ name: 'Git Bash', terminalPath })),
    ], shell => normalizeTerminalPath(shell.terminalPath) ?? shell.terminalPath)
  }

  if (process.platform === 'darwin') {
    const zshPath = findFirstExistingPath(['/bin/zsh', '/usr/bin/zsh'])
    return zshPath ? [{ name: 'zsh', terminalPath: zshPath }] : []
  }

  if (process.platform === 'linux') {
    const bashPath = findFirstExistingPath(['/bin/bash', '/usr/bin/bash'])
    const zshPath = findFirstExistingPath(['/bin/zsh', '/usr/bin/zsh', '/usr/local/bin/zsh'])

    return [
      ...(bashPath ? [{ name: 'bash', terminalPath: bashPath }] : []),
      ...(zshPath ? [{ name: 'zsh', terminalPath: zshPath }] : []),
    ]
  }

  return []
}

/** 存入系统内置本地 Shell，按终端路径去重 */
function seedBuiltinLocalShells(): void {
  const shells = store.get('shells', [])
  const existingLocalShellPaths = new Set(
    shells
      .filter(shell => shell.protocol === 'local')
      .map(shell => normalizeTerminalPath(shell.terminalPath))
      .filter((terminalPath): terminalPath is string => terminalPath !== null),
  )

  const builtinShells = detectBuiltinLocalShells()
    .filter(shell => {
      const terminalPath = normalizeTerminalPath(shell.terminalPath)
      return terminalPath ? !existingLocalShellPaths.has(terminalPath) : false
    })

  if (builtinShells.length === 0) return

  const now = new Date().toISOString()
  const newShells = builtinShells.map(shell => ({
    id: randomUUID(),
    protocol: 'local' as const,
    name: shell.name,
    group: LOCAL_SHELL_GROUP_NAME,
    terminalPath: shell.terminalPath,
    workDir: null,
    extraParams: {
      builtinLocalShell: true,
    },
    createdAt: now,
    updatedAt: now,
  }))

  store.set('shells', [...shells, ...newShells])
}

/** 初始化 Shell 存储：预置分组并导入系统本地 Shell */
export function initializeShellStore(): void {
  ensurePresetGroups()
  seedBuiltinLocalShells()
}

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
  const group = normalizeGroupName(record.group)

  const newRecord: ShellRecord = {
    ...record,
    group,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  }

  const encryptedRecord = encryptSecrets(newRecord)
  store.set('shells', [...shells, encryptedRecord])
  if (group) saveGroup(group)

  return newRecord
}

/** 更新 Shell 连接记录 */
export function updateShell(id: string, updates: Partial<ShellRecord>): ShellRecord | null {
  const shells = store.get('shells', [])
  const index = shells.findIndex(s => s.id === id)

  if (index === -1) return null

  const normalizedUpdates: Partial<ShellRecord> = updates.group === undefined
    ? updates
    : {
        ...updates,
        group: normalizeGroupName(updates.group),
      }

  const updated: ShellRecord = {
    ...shells[index],
    ...normalizedUpdates,
    updatedAt: new Date().toISOString(),
  }

  const encryptedRecord = encryptSecrets(updated)
  shells[index] = encryptedRecord
  store.set('shells', shells)
  if (updated.group) saveGroup(updated.group)

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

/** 获取 Shell 列表摘要，不向渲染进程暴露敏感字段 */
export function listShellSummaries(): ShellSummary[] {
  return store.get('shells', []).map(shell => ({
    id: shell.id,
    protocol: shell.protocol,
    name: shell.name,
    group: shell.group,
  }))
}

/** 按协议获取 Shell 连接记录 */
export function listShellsByProtocol(protocol: ProtocolType): ShellRecord[] {
  return listShells().filter(s => s.protocol === protocol)
}

/** 获取所有分组名称（去重） */
export function listGroups(): string[] {
  return sortGroups(ensurePresetGroups()).map(group => group.name)
}

/** 按 ID 获取 Shell 连接记录 */
export function getShellById(id: string): ShellRecord | null {
  const shells = store.get('shells', [])
  const record = shells.find(s => s.id === id)
  return record ? decryptSecrets(record) : null
}
