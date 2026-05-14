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
export const LOCAL_FILES_WORKER_SOURCE = String.raw`
const { parentPort } = require('node:worker_threads')
const fs = require('node:fs/promises')
const path = require('node:path')

function formatPermissions(mode, isDirectory) {
  const scopeMasks = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001]
  const scopeSymbols = ['r', 'w', 'x', 'r', 'w', 'x', 'r', 'w', 'x']
  const bits = scopeMasks.map((mask, index) => ((mode & mask) === mask ? scopeSymbols[index] : '-')).join('')
  return (isDirectory ? 'd' : '-') + bits
}

function sortEntries(entries) {
  return entries.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'directory' ? -1 : 1
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  })
}

async function readDirectoryEntries(targetPath) {
  const directoryEntries = await fs.readdir(targetPath, { withFileTypes: true })
  const entries = await Promise.all(directoryEntries.map(async directoryEntry => {
    const absolutePath = path.join(targetPath, directoryEntry.name)
    const stats = await fs.lstat(absolutePath)
    const kind = stats.isDirectory() ? 'directory' : 'file'

    return {
      name: directoryEntry.name,
      absolutePath,
      kind,
      permissions: formatPermissions(stats.mode, kind === 'directory'),
      modifiedAtMs: Math.round(stats.mtimeMs),
    }
  }))

  return sortEntries(entries)
}

async function createSnapshot(cwd, homeDir) {
  return {
    cwd,
    homeDir,
    entries: await readDirectoryEntries(cwd),
  }
}

async function handleMessage(message) {
  if (!message || typeof message !== 'object') return

  try {
    if (message.type === 'snapshot') {
      const snapshot = await createSnapshot(message.cwd, message.homeDir)
      parentPort.postMessage({
        type: 'snapshot',
        requestId: message.requestId,
        snapshot,
      })
      return
    }

    if (message.type === 'directory') {
      const entries = await readDirectoryEntries(message.path)
      parentPort.postMessage({
        type: 'directory',
        requestId: message.requestId,
        parentPath: message.path,
        entries,
      })
      return
    }

    if (message.type === 'stop') {
      process.exit(0)
    }
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      requestId: message.requestId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

parentPort.on('message', message => {
  void handleMessage(message)
})
`
