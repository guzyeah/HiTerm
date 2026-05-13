export const LOCAL_STATUS_WORKER_SOURCE = String.raw`
const { parentPort } = require('node:worker_threads')
const os = require('node:os')
const fs = require('node:fs')
const childProcess = require('node:child_process')

const SAMPLE_INTERVAL_MS = 1000
const DISK_CACHE_TTL_MS = 10000

let previousCpu = readCpuCounters()
let previousNetwork = readNetworkCounters()
let previousDiskIo = readDiskIoCounters()
let cachedDisks = []
let diskCacheTime = 0

function clampPercent(value) {
  if (!Number.isFinite(value)) return null
  return Math.min(100, Math.max(0, value))
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function usagePercent(used, total) {
  if (!total) return null
  return clampPercent((used / total) * 100)
}

function readCpuCounters() {
  const cpus = os.cpus()
  let idle = 0
  let total = 0

  cpus.forEach(cpu => {
    idle += cpu.times.idle
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle
  })

  return { idle, total }
}

function calculateCpuUsage(previous, current) {
  if (!previous || !current) return null
  const idleDelta = current.idle - previous.idle
  const totalDelta = current.total - previous.total
  if (totalDelta <= 0) return null
  return clampPercent(((totalDelta - idleDelta) / totalDelta) * 100)
}

function execPowerShell(command) {
  return childProcess.execFileSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { encoding: 'utf8', timeout: 2500, windowsHide: true },
  ).trim()
}

function parseJsonArray(text) {
  if (!text) return []
  const parsed = JSON.parse(text)
  return Array.isArray(parsed) ? parsed : [parsed]
}

function readWindowsNetworkCounters() {
  const rows = parseJsonArray(execPowerShell(
    'Get-NetAdapterStatistics | Select-Object ReceivedBytes,SentBytes | ConvertTo-Json -Compress',
  ))

  return rows.reduce((total, row) => ({
    receivedBytes: total.receivedBytes + toNumber(row.ReceivedBytes),
    sentBytes: total.sentBytes + toNumber(row.SentBytes),
    timestamp: Date.now(),
  }), { receivedBytes: 0, sentBytes: 0, timestamp: Date.now() })
}

function readLinuxNetworkCounters() {
  const content = fs.readFileSync('/proc/net/dev', 'utf8')
  let receivedBytes = 0
  let sentBytes = 0

  content.split('\n').forEach(line => {
    const [namePart, valuesPart] = line.split(':')
    if (!valuesPart) return
    const name = namePart.trim()
    if (!name || name === 'lo') return

    const values = valuesPart.trim().split(/\s+/).map(Number)
    receivedBytes += values[0] || 0
    sentBytes += values[8] || 0
  })

  return { receivedBytes, sentBytes, timestamp: Date.now() }
}

function readDarwinNetworkCounters() {
  const output = childProcess.execFileSync('netstat', ['-ibn'], {
    encoding: 'utf8',
    timeout: 2000,
  })
  const lines = output.trim().split('\n')
  const header = lines.shift()?.trim().split(/\s+/) || []
  const nameIndex = header.indexOf('Name')
  const ibytesIndex = header.indexOf('Ibytes')
  const obytesIndex = header.indexOf('Obytes')
  const seen = new Set()
  let receivedBytes = 0
  let sentBytes = 0

  lines.forEach(line => {
    const values = line.trim().split(/\s+/)
    const name = values[nameIndex]
    if (!name || name === 'lo0' || seen.has(name)) return
    seen.add(name)
    receivedBytes += toNumber(values[ibytesIndex])
    sentBytes += toNumber(values[obytesIndex])
  })

  return { receivedBytes, sentBytes, timestamp: Date.now() }
}

function readNetworkCounters() {
  try {
    if (process.platform === 'win32') return readWindowsNetworkCounters()
    if (process.platform === 'linux') return readLinuxNetworkCounters()
    if (process.platform === 'darwin') return readDarwinNetworkCounters()
  } catch {}

  return null
}

function calculateNetworkRates(previous, current) {
  if (!previous || !current) {
    return { uploadBytesPerSecond: null, downloadBytesPerSecond: null }
  }

  const seconds = (current.timestamp - previous.timestamp) / 1000
  if (seconds <= 0) {
    return { uploadBytesPerSecond: null, downloadBytesPerSecond: null }
  }

  return {
    uploadBytesPerSecond: Math.max(0, (current.sentBytes - previous.sentBytes) / seconds),
    downloadBytesPerSecond: Math.max(0, (current.receivedBytes - previous.receivedBytes) / seconds),
  }
}

function readWindowsDiskIoRates() {
  const rows = parseJsonArray(execPowerShell(
    'Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -Filter "Name=\'_Total\'" | Select-Object DiskReadBytesPersec,DiskWriteBytesPersec | ConvertTo-Json -Compress',
  ))
  const row = rows[0]

  if (!row) return null
  return {
    readBytesPerSecond: toNumber(row.DiskReadBytesPersec),
    writeBytesPerSecond: toNumber(row.DiskWriteBytesPersec),
  }
}

function readLinuxDiskIoCounters() {
  const content = fs.readFileSync('/proc/diskstats', 'utf8')
  let readBytes = 0
  let writeBytes = 0

  content.split('\n').forEach(line => {
    const values = line.trim().split(/\s+/)
    const name = values[2]
    if (!name || /^(loop|ram|fd)/.test(name)) return
    if (/\d$/.test(name) && !/^nvme\d+n\d+$/.test(name)) return

    readBytes += toNumber(values[5]) * 512
    writeBytes += toNumber(values[9]) * 512
  })

  return { readBytes, writeBytes, timestamp: Date.now() }
}

function readDarwinDiskIoCounters() {
  const output = childProcess.execFileSync('iostat', ['-Id', '-K', '-c', '1'], {
    encoding: 'utf8',
    timeout: 2000,
  })
  const lines = output.trim().split('\n').filter(Boolean)
  const headerIndex = lines.findIndex(line => /\bKB\/t\b/.test(line) || /\btps\b/.test(line))
  if (headerIndex < 0) return null

  let readBytes = 0
  let writeBytes = 0
  lines.slice(headerIndex + 1).forEach(line => {
    const values = line.trim().split(/\s+/)
    readBytes += toNumber(values[2]) * 1024
    writeBytes += toNumber(values[3]) * 1024
  })

  return { readBytes, writeBytes, timestamp: Date.now() }
}

function readDiskIoCounters() {
  try {
    if (process.platform === 'linux') return readLinuxDiskIoCounters()
    if (process.platform === 'darwin') return readDarwinDiskIoCounters()
  } catch {}

  return null
}

function calculateDiskIoRates(previous, current) {
  if (process.platform === 'win32') {
    try {
      const rates = readWindowsDiskIoRates()
      if (rates) return rates
    } catch {}
  }

  if (!previous || !current) {
    return { readBytesPerSecond: null, writeBytesPerSecond: null }
  }

  const seconds = (current.timestamp - previous.timestamp) / 1000
  if (seconds <= 0) {
    return { readBytesPerSecond: null, writeBytesPerSecond: null }
  }

  return {
    readBytesPerSecond: Math.max(0, (current.readBytes - previous.readBytes) / seconds),
    writeBytesPerSecond: Math.max(0, (current.writeBytes - previous.writeBytes) / seconds),
  }
}

function normalizeDisk(disk, primaryMount) {
  const totalBytes = toNumber(disk.totalBytes)
  const freeBytes = toNumber(disk.freeBytes)
  const usedBytes = Math.max(0, totalBytes - freeBytes)
  const mountPoint = String(disk.mountPoint || '')

  return {
    id: String(disk.id || mountPoint),
    name: String(disk.name || disk.id || mountPoint),
    mountPoint,
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: usagePercent(usedBytes, totalBytes),
    isPrimary: mountPoint.toLowerCase() === primaryMount.toLowerCase(),
  }
}

function readWindowsDisks() {
  const rows = parseJsonArray(execPowerShell(
    'Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,VolumeName,Size,FreeSpace | ConvertTo-Json -Compress',
  ))
  const primaryMount = process.env.SystemDrive || 'C:'

  return rows.map(row => normalizeDisk({
    id: row.DeviceID,
    name: row.VolumeName || row.DeviceID,
    mountPoint: row.DeviceID,
    totalBytes: row.Size,
    freeBytes: row.FreeSpace,
  }, primaryMount))
}

function readPosixDisks() {
  const output = childProcess.execFileSync('df', ['-kP'], {
    encoding: 'utf8',
    timeout: 2000,
  })
  const primaryMount = '/'

  return output.trim().split('\n').slice(1).map(line => {
    const values = line.trim().split(/\s+/)
    const mountPoint = values.slice(5).join(' ')

    return normalizeDisk({
      id: values[0],
      name: values[0],
      mountPoint,
      totalBytes: toNumber(values[1]) * 1024,
      freeBytes: toNumber(values[3]) * 1024,
    }, primaryMount)
  }).filter(disk => disk.totalBytes > 0)
}

function readDisks() {
  try {
    if (process.platform === 'win32') return readWindowsDisks()
    return readPosixDisks()
  } catch {
    return []
  }
}

function getCachedDisks() {
  const now = Date.now()
  if (now - diskCacheTime > DISK_CACHE_TTL_MS) {
    cachedDisks = readDisks()
    diskCacheTime = now
  }

  return cachedDisks
}

function buildSample() {
  const timestamp = Date.now()
  const cpuCounters = readCpuCounters()
  const cpuUsagePercent = calculateCpuUsage(previousCpu, cpuCounters)
  previousCpu = cpuCounters

  const totalBytes = os.totalmem()
  const freeBytes = os.freemem()
  const usedBytes = Math.max(0, totalBytes - freeBytes)

  const networkCounters = readNetworkCounters()
  const network = calculateNetworkRates(previousNetwork, networkCounters)
  previousNetwork = networkCounters

  const diskIoCounters = readDiskIoCounters()
  const diskIo = calculateDiskIoRates(previousDiskIo, diskIoCounters)
  previousDiskIo = diskIoCounters

  const disks = getCachedDisks()
  const primaryDisk = disks.find(disk => disk.isPrimary) || disks[0] || null

  return {
    timestamp,
    cpu: {
      usagePercent: cpuUsagePercent,
    },
    memory: {
      totalBytes,
      freeBytes,
      usedBytes,
      usagePercent: usagePercent(usedBytes, totalBytes),
    },
    network,
    diskIo,
    primaryDisk,
    disks,
  }
}

function postSample() {
  try {
    parentPort.postMessage({ type: 'sample', sample: buildSample() })
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

const interval = setInterval(postSample, SAMPLE_INTERVAL_MS)
postSample()

parentPort.on('message', message => {
  if (message && message.type === 'stop') {
    clearInterval(interval)
    process.exit(0)
  }
})
`
