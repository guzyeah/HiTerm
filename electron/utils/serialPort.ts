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
 * 系统串口枚举工具
 * 使用系统命令枚举可用串口，避免引入原生模块依赖
 */

import { execSync } from 'child_process'
import { platform } from 'os'

export interface SerialPortInfo {
  path: string
  friendlyName?: string
}

/** 枚举系统上的所有串口 */
export async function listSerialPorts(): Promise<SerialPortInfo[]> {
  const currentPlatform = platform()

  if (currentPlatform === 'win32') {
    return listWindowsPorts()
  } else if (currentPlatform === 'darwin') {
    return listMacPorts()
  } else {
    return listLinuxPorts()
  }
}

/** Windows 串口枚举：使用 mode 命令和 wmic */
function listWindowsPorts(): SerialPortInfo[] {
  const ports: SerialPortInfo[] = []

  try {
    // 尝试使用 wmic 获取串口列表
    const output = execSync('wmic path Win32_SerialPort get DeviceID,FriendlyName /format:csv', {
      encoding: 'utf-8',
      timeout: 5000,
    })

    const lines = output.split('\n').filter(line => line.trim() && !line.includes('Node'))
    for (const line of lines) {
      const parts = line.split(',').filter(Boolean)
      if (parts.length >= 3) {
        const deviceId = parts[1]?.trim()
        const friendlyName = parts[2]?.trim()
        if (deviceId) {
          ports.push({
            path: deviceId,
            friendlyName: friendlyName || deviceId,
          })
        }
      }
    }
  } catch {
    // wmic 可能不可用，回退到 mode 命令
  }

  // 如果 wmic 失败或没有结果，尝试 mode 命令
  if (ports.length === 0) {
    try {
      const output = execSync('mode', { encoding: 'utf-8', timeout: 5000 })
      const matches = output.match(/COM\d+/g)
      if (matches) {
        for (const match of [...new Set(matches)]) {
          ports.push({ path: match, friendlyName: match })
        }
      }
    } catch {
      // mode 命令失败
    }
  }

  return ports
}

/** macOS 串口枚举 */
function listMacPorts(): SerialPortInfo[] {
  const ports: SerialPortInfo[] = []

  try {
    // 列出所有 tty 设备
    const output = execSync('ls /dev/tty.* /dev/cu.* 2>/dev/null || true', {
      encoding: 'utf-8',
      shell: '/bin/bash',
      timeout: 5000,
    })

    const lines = output.split('\n').filter(Boolean)
    for (const line of lines) {
      const path = line.trim()
      if (path) {
        ports.push({ path, friendlyName: path.split('/').pop() || path })
      }
    }
  } catch {
    // 忽略错误
  }

  return ports
}

/** Linux 串口枚举 */
function listLinuxPorts(): SerialPortInfo[] {
  const ports: SerialPortInfo[] = []

  try {
    // 列出 USB 串口和 ACM 设备
    const output = execSync(
      'ls /dev/ttyUSB* /dev/ttyACM* /dev/ttyS* 2>/dev/null || true',
      {
        encoding: 'utf-8',
        shell: '/bin/bash',
        timeout: 5000,
      },
    )

    const lines = output.split('\n').filter(Boolean)
    for (const line of lines) {
      const path = line.trim()
      if (path) {
        ports.push({ path, friendlyName: path.split('/').pop() || path })
      }
    }
  } catch {
    // 忽略错误
  }

  return ports
}
