/**
 * SSH 状态采样。
 * 当前优先支持 Linux 远端，避免通过交互 shell 抢占字符流。
 */

import { executeSshSessionCommand, type RemoteOs } from './terminalSession'
import type {
  TerminalStatusDisk,
  TerminalStatusSample,
} from '../src/shared/terminalStatusTypes'

interface CounterSnapshot {
  cpu: {
    idle: number
    total: number
  } | null
  network: {
    receivedBytes: number
    sentBytes: number
    timestamp: number
  } | null
  diskIo: {
    readBytes: number
    writeBytes: number
    timestamp: number
  } | null
}

const previousCountersBySession = new Map<string, CounterSnapshot>()
const SECTION_MARKERS = {
  cpu: '__HITERM_CPU__',
  mem: '__HITERM_MEM__',
  net: '__HITERM_NET__',
  diskIo: '__HITERM_DISKIO__',
  df: '__HITERM_DF__',
} as const

function toNumber(value: string | number | undefined): number {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function clampPercent(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, value))
}

function usagePercent(usedBytes: number, totalBytes: number): number | null {
  if (!totalBytes) return null
  return clampPercent((usedBytes / totalBytes) * 100)
}

function splitSections(output: string): Record<string, string[]> {
  const sections: Record<string, string[]> = {}
  let currentSection = ''

  output.split(/\r?\n/).forEach(line => {
    const trimmedLine = line.trim()
    if (Object.values(SECTION_MARKERS).includes(trimmedLine as never)) {
      currentSection = trimmedLine
      sections[currentSection] = []
      return
    }

    if (!currentSection) return
    sections[currentSection].push(line)
  })

  return sections
}

function parseLinuxCpu(lines: string[]): { idle: number; total: number } | null {
  const cpuLine = lines.find(line => line.startsWith('cpu '))
  if (!cpuLine) return null

  const values = cpuLine.trim().split(/\s+/).slice(1).map(toNumber)
  const idle = values[3] ?? 0
  const total = values.reduce((sum, value) => sum + value, 0)
  return { idle, total }
}

function calculateCpuUsage(
  previous: CounterSnapshot['cpu'],
  current: CounterSnapshot['cpu'],
): number | null {
  if (!previous || !current) return null

  const idleDelta = current.idle - previous.idle
  const totalDelta = current.total - previous.total
  if (totalDelta <= 0) return null

  return clampPercent(((totalDelta - idleDelta) / totalDelta) * 100)
}

function parseLinuxMemory(lines: string[]): {
  totalBytes: number
  freeBytes: number
  usedBytes: number
  usagePercent: number | null
} {
  const memoryMap = new Map<string, number>()

  lines.forEach(line => {
    const match = line.match(/^([A-Za-z_]+):\s+(\d+)/)
    if (!match) return
    memoryMap.set(match[1], toNumber(match[2]) * 1024)
  })

  const totalBytes = memoryMap.get('MemTotal') ?? 0
  const freeBytes = memoryMap.get('MemAvailable') ?? memoryMap.get('MemFree') ?? 0
  const usedBytes = Math.max(0, totalBytes - freeBytes)

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: usagePercent(usedBytes, totalBytes),
  }
}

function parseLinuxNetwork(lines: string[]): CounterSnapshot['network'] {
  let receivedBytes = 0
  let sentBytes = 0

  lines.forEach(line => {
    const [namePart, valuesPart] = line.split(':')
    if (!valuesPart) return

    const interfaceName = namePart.trim()
    if (!interfaceName || interfaceName === 'lo') return

    const values = valuesPart.trim().split(/\s+/).map(toNumber)
    receivedBytes += values[0] ?? 0
    sentBytes += values[8] ?? 0
  })

  return {
    receivedBytes,
    sentBytes,
    timestamp: Date.now(),
  }
}

function calculateNetworkRates(
  previous: CounterSnapshot['network'],
  current: CounterSnapshot['network'],
): {
  uploadBytesPerSecond: number | null
  downloadBytesPerSecond: number | null
} {
  if (!previous || !current) {
    return {
      uploadBytesPerSecond: null,
      downloadBytesPerSecond: null,
    }
  }

  const seconds = (current.timestamp - previous.timestamp) / 1000
  if (seconds <= 0) {
    return {
      uploadBytesPerSecond: null,
      downloadBytesPerSecond: null,
    }
  }

  return {
    uploadBytesPerSecond: Math.max(0, (current.sentBytes - previous.sentBytes) / seconds),
    downloadBytesPerSecond: Math.max(0, (current.receivedBytes - previous.receivedBytes) / seconds),
  }
}

function parseLinuxDiskIo(lines: string[]): CounterSnapshot['diskIo'] {
  let readBytes = 0
  let writeBytes = 0

  lines.forEach(line => {
    const values = line.trim().split(/\s+/)
    const deviceName = values[2]
    if (!deviceName || /^(loop|ram|fd)/.test(deviceName)) return
    if (/\d$/.test(deviceName) && !/^nvme\d+n\d+$/.test(deviceName)) return

    readBytes += toNumber(values[5]) * 512
    writeBytes += toNumber(values[9]) * 512
  })

  return {
    readBytes,
    writeBytes,
    timestamp: Date.now(),
  }
}

function calculateDiskIoRates(
  previous: CounterSnapshot['diskIo'],
  current: CounterSnapshot['diskIo'],
): {
  readBytesPerSecond: number | null
  writeBytesPerSecond: number | null
} {
  if (!previous || !current) {
    return {
      readBytesPerSecond: null,
      writeBytesPerSecond: null,
    }
  }

  const seconds = (current.timestamp - previous.timestamp) / 1000
  if (seconds <= 0) {
    return {
      readBytesPerSecond: null,
      writeBytesPerSecond: null,
    }
  }

  return {
    readBytesPerSecond: Math.max(0, (current.readBytes - previous.readBytes) / seconds),
    writeBytesPerSecond: Math.max(0, (current.writeBytes - previous.writeBytes) / seconds),
  }
}

function parseLinuxDisks(lines: string[]): TerminalStatusDisk[] {
  return lines
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const values = line.split(/\s+/)
      const mountPoint = values.slice(5).join(' ')
      const totalBytes = toNumber(values[1]) * 1024
      const freeBytes = toNumber(values[3]) * 1024
      const usedBytes = Math.max(0, totalBytes - freeBytes)

      return {
        id: values[0],
        name: values[0],
        mountPoint,
        totalBytes,
        freeBytes,
        usedBytes,
        usagePercent: usagePercent(usedBytes, totalBytes),
        isPrimary: mountPoint === '/',
      }
    })
    .filter(disk => disk.totalBytes > 0)
}

async function sampleLinuxStatus(sessionId: string): Promise<TerminalStatusSample> {
  const command = [
    `printf '${SECTION_MARKERS.cpu}\\n'`,
    'head -n 1 /proc/stat',
    `printf '${SECTION_MARKERS.mem}\\n'`,
    "grep -E '^(MemTotal|MemAvailable|MemFree):' /proc/meminfo",
    `printf '${SECTION_MARKERS.net}\\n'`,
    'cat /proc/net/dev',
    `printf '${SECTION_MARKERS.diskIo}\\n'`,
    'cat /proc/diskstats',
    `printf '${SECTION_MARKERS.df}\\n'`,
    'df -kP',
  ].join('; ')

  const result = await executeSshSessionCommand(sessionId, command, undefined, 5000)
  if (result.exitCode !== null && result.exitCode !== 0) {
    throw new Error(result.stderr.trim() || 'SSH status command failed')
  }

  const sections = splitSections(result.stdout)
  const currentCounters: CounterSnapshot = {
    cpu: parseLinuxCpu(sections[SECTION_MARKERS.cpu] ?? []),
    network: parseLinuxNetwork(sections[SECTION_MARKERS.net] ?? []),
    diskIo: parseLinuxDiskIo(sections[SECTION_MARKERS.diskIo] ?? []),
  }
  const previousCounters = previousCountersBySession.get(sessionId) ?? {
    cpu: null,
    network: null,
    diskIo: null,
  }
  previousCountersBySession.set(sessionId, currentCounters)

  const memory = parseLinuxMemory(sections[SECTION_MARKERS.mem] ?? [])
  const disks = parseLinuxDisks(sections[SECTION_MARKERS.df] ?? [])
  const primaryDisk = disks.find(disk => disk.isPrimary) ?? disks[0] ?? null

  return {
    timestamp: Date.now(),
    cpu: {
      usagePercent: calculateCpuUsage(previousCounters.cpu, currentCounters.cpu),
    },
    memory,
    network: calculateNetworkRates(previousCounters.network, currentCounters.network),
    diskIo: calculateDiskIoRates(previousCounters.diskIo, currentCounters.diskIo),
    primaryDisk,
    disks,
  }
}

export async function sampleSshTerminalStatus(
  sessionId: string,
  remoteOs: RemoteOs | null,
): Promise<TerminalStatusSample> {
  if (remoteOs !== 'linux') {
    throw new Error('SSH status monitoring is currently supported only for Linux hosts')
  }

  return sampleLinuxStatus(sessionId)
}

export function clearSshTerminalStatusState(sessionId: string): void {
  previousCountersBySession.delete(sessionId)
}
