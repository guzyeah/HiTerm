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
export const LOCAL_FILES_TRANSFER_WORKER_SOURCE = String.raw`
const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const path = require('node:path')
const { parentPort } = require('node:worker_threads')

const PROGRESS_INTERVAL_MS = 80

function normalizeComparablePath(targetPath) {
  const resolvedPath = path.resolve(targetPath)
  return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath
}

function isSamePath(leftPath, rightPath) {
  return normalizeComparablePath(leftPath) === normalizeComparablePath(rightPath)
}

function isPathWithinRoot(rootPath, candidatePath) {
  const normalizedRootPath = normalizeComparablePath(rootPath)
  const normalizedCandidatePath = normalizeComparablePath(candidatePath)
  if (normalizedRootPath === normalizedCandidatePath) return true

  const relativePath = path.relative(normalizedRootPath, normalizedCandidatePath)
  return relativePath !== ''
    && !relativePath.startsWith('..')
    && !path.isAbsolute(relativePath)
}

function getTopLevelItemName(sourcePath) {
  const basename = path.basename(sourcePath)
  if (basename) {
    return basename
  }

  const rootName = path.parse(sourcePath).root.replace(/[\\\\/:]+/g, '')
  return rootName || 'root'
}

async function statOrNull(targetPath) {
  try {
    return await fsPromises.lstat(targetPath)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null
    }

    throw error
  }
}

async function collectDirectoryPlan(sourcePath, destinationPath, directoryPaths, fileOperations) {
  const directoryEntries = await fsPromises.readdir(sourcePath, { withFileTypes: true })

  for (const entry of directoryEntries) {
    const childSourcePath = path.join(sourcePath, entry.name)
    const childDestinationPath = path.join(destinationPath, entry.name)

    if (entry.isDirectory()) {
      const existingDestinationStats = await statOrNull(childDestinationPath)
      if (existingDestinationStats && !existingDestinationStats.isDirectory()) {
        throw new Error('Cannot overwrite a file with a directory')
      }

      directoryPaths.push(childDestinationPath)
      await collectDirectoryPlan(
        childSourcePath,
        childDestinationPath,
        directoryPaths,
        fileOperations,
      )
      continue
    }

    if (entry.isFile()) {
      const existingDestinationStats = await statOrNull(childDestinationPath)
      if (existingDestinationStats && existingDestinationStats.isDirectory()) {
        throw new Error('Cannot overwrite a directory with a file')
      }

      const childStats = await fsPromises.stat(childSourcePath)
      fileOperations.push({
        sourcePath: childSourcePath,
        destinationPath: childDestinationPath,
        size: Math.max(0, childStats.size),
      })
      continue
    }

    throw new Error('Unsupported file type in transfer selection')
  }
}

async function buildTopLevelPlan(sourcePath, destinationRootPath) {
  const sourceStats = await fsPromises.lstat(sourcePath)
  const itemName = getTopLevelItemName(sourcePath)
  const destinationPath = path.join(destinationRootPath, itemName)

  if (sourceStats.isDirectory()) {
    if (isPathWithinRoot(sourcePath, destinationPath)) {
      throw new Error('Cannot copy a directory into itself')
    }

    const existingDestinationStats = await statOrNull(destinationPath)
    if (existingDestinationStats && !existingDestinationStats.isDirectory()) {
      throw new Error('Cannot overwrite a file with a directory')
    }

    const directoryPaths = [destinationPath]
    const fileOperations = []
    await collectDirectoryPlan(sourcePath, destinationPath, directoryPaths, fileOperations)

    return {
      name: itemName,
      destinationPath,
      directoryPaths,
      fileOperations,
      totalBytes: fileOperations.reduce((total, fileOperation) => total + fileOperation.size, 0),
    }
  }

  if (sourceStats.isFile()) {
    if (isSamePath(sourcePath, destinationPath)) {
      throw new Error('Cannot copy a file onto itself')
    }

    const existingDestinationStats = await statOrNull(destinationPath)
    if (existingDestinationStats && existingDestinationStats.isDirectory()) {
      throw new Error('Cannot overwrite a directory with a file')
    }

    return {
      name: itemName,
      destinationPath,
      directoryPaths: [],
      fileOperations: [{
        sourcePath,
        destinationPath,
        size: Math.max(0, sourceStats.size),
      }],
      totalBytes: Math.max(0, sourceStats.size),
    }
  }

  throw new Error('Only files and directories can be transferred')
}

async function copyFileWithProgress(sourcePath, destinationPath, onBytesCopied) {
  await fsPromises.mkdir(path.dirname(destinationPath), { recursive: true })

  await new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(sourcePath)
    const writeStream = fs.createWriteStream(destinationPath, { flags: 'w' })
    let settled = false

    const finish = error => {
      if (settled) return
      settled = true
      if (error) {
        reject(error)
        return
      }

      resolve()
    }

    readStream.on('data', chunk => {
      onBytesCopied(chunk.length)
    })
    readStream.on('error', finish)
    writeStream.on('error', finish)
    writeStream.on('finish', () => finish())
    readStream.pipe(writeStream)
  })
}

function createProgressReporter(taskId, direction, destinationPath, totalItems) {
  let lastProgressAt = 0

  return (state, force = false) => {
    const now = Date.now()
    if (!force && now - lastProgressAt < PROGRESS_INTERVAL_MS) {
      return
    }

    lastProgressAt = now
    let percent = null
    if (typeof state.totalBytes === 'number' && state.totalBytes > 0) {
      percent = Math.min(100, Math.max(0, (state.copiedBytes / state.totalBytes) * 100))
    } else if (totalItems > 0) {
      percent = Math.min(100, Math.max(0, (state.completedItems / totalItems) * 100))
    }

    parentPort.postMessage({
      type: 'transferState',
      state: {
        taskId,
        direction,
        destinationPath,
        currentItemName: state.currentItemName,
        completedItems: state.completedItems,
        totalItems,
        copiedBytes: state.copiedBytes,
        totalBytes: state.totalBytes,
        percent,
        status: state.status,
        errorMessage: state.errorMessage,
      },
    })
  }
}

async function handleTransfer(message) {
  const destinationStats = await statOrNull(message.destinationPath)
  if (!destinationStats || !destinationStats.isDirectory()) {
    throw new Error('Transfer target directory does not exist')
  }

  const uniqueSourcePaths = []
  const seenPaths = new Set()
  for (const sourcePath of message.sourcePaths) {
    const resolvedPath = path.resolve(sourcePath)
    const comparablePath = normalizeComparablePath(resolvedPath)
    if (seenPaths.has(comparablePath)) continue
    seenPaths.add(comparablePath)
    uniqueSourcePaths.push(resolvedPath)
  }

  if (uniqueSourcePaths.length === 0) {
    throw new Error('No files or directories were selected for transfer')
  }

  const reportProgress = createProgressReporter(
    message.taskId,
    message.direction,
    message.destinationPath,
    uniqueSourcePaths.length,
  )

  reportProgress({
    currentItemName: null,
    completedItems: 0,
    copiedBytes: 0,
    totalBytes: null,
    status: 'scanning',
  }, true)

  const plans = []
  for (const sourcePath of uniqueSourcePaths) {
    plans.push(await buildTopLevelPlan(sourcePath, message.destinationPath))
  }

  const totalBytes = plans.reduce((total, plan) => total + plan.totalBytes, 0)
  const progressState = {
    currentItemName: plans[0]?.name ?? null,
    completedItems: 0,
    copiedBytes: 0,
    totalBytes,
    status: 'transferring',
  }

  reportProgress(progressState, true)

  for (const plan of plans) {
    progressState.currentItemName = plan.name
    progressState.status = 'transferring'
    reportProgress(progressState, true)

    for (const directoryPath of plan.directoryPaths) {
      await fsPromises.mkdir(directoryPath, { recursive: true })
    }

    for (const fileOperation of plan.fileOperations) {
      await copyFileWithProgress(
        fileOperation.sourcePath,
        fileOperation.destinationPath,
        copiedChunkBytes => {
          progressState.copiedBytes += copiedChunkBytes
          reportProgress(progressState)
        },
      )
    }

    progressState.completedItems += 1
    reportProgress(progressState, true)
  }

  reportProgress({
    currentItemName: null,
    completedItems: uniqueSourcePaths.length,
    copiedBytes: totalBytes,
    totalBytes,
    status: 'completed',
  }, true)
}

parentPort.on('message', message => {
  if (!message || typeof message !== 'object') return

  if (message.type === 'stop') {
    process.exit(0)
  }

  if (message.type !== 'transfer') return

  void handleTransfer(message).catch(error => {
    parentPort.postMessage({
      type: 'transferState',
      state: {
        taskId: message.taskId,
        direction: message.direction === 'download' ? 'download' : 'upload',
        destinationPath: message.destinationPath,
        currentItemName: null,
        completedItems: 0,
        totalItems: Array.isArray(message.sourcePaths) ? message.sourcePaths.length : 0,
        copiedBytes: 0,
        totalBytes: null,
        percent: null,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    })
  })
})
`
