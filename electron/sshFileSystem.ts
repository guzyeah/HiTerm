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
 * SSH 文件系统能力。
 * 统一封装远端目录快照、递归增删改，以及基于 SFTP 的上传下载。
 */

import fsPromises from 'node:fs/promises'
import path from 'node:path'
import type {
  FileEntryWithStats,
  SFTPWrapper,
  Stats,
  TransferOptions,
} from 'ssh2'
import { getTerminalSessionSftp } from './terminalSession'
import type {
  TerminalFileEntry,
  TerminalFilesCreateEntryResult,
  TerminalFilesDeleteEntriesResult,
  TerminalFilesSnapshot,
  TerminalFilesTransferDirection,
  TerminalFilesTransferState,
} from '../src/shared/terminalFilesTypes'

const REMOTE_PATH = path.posix
const PROGRESS_INTERVAL_MS = 80

interface SshSubscriptionContext {
  sessionId: string
  rootPath: string
  homeDir: string
}

interface SshFileOperation {
  sourcePath: string
  destinationPath: string
  size: number
}

interface SshTransferPlan {
  name: string
  destinationPath: string
  directoryPaths: string[]
  fileOperations: SshFileOperation[]
  totalBytes: number
}

interface ProgressSnapshot {
  currentItemName: string | null
  completedItems: number
  copiedBytes: number
  totalBytes: number | null
  status: TerminalFilesTransferState['status']
  errorMessage?: string
}

type TransferStateReporter = (state: TerminalFilesTransferState) => void

function normalizeRemotePath(targetPath: string): string {
  const normalizedPath = REMOTE_PATH.normalize(targetPath.replace(/\\/g, '/'))
  if (!normalizedPath || normalizedPath === '.') return '/'
  return normalizedPath
}

function normalizeComparableRemotePath(targetPath: string): string {
  const normalizedPath = normalizeRemotePath(targetPath)
  if (normalizedPath === '/') return normalizedPath
  return normalizedPath.replace(/\/$/, '')
}

function isRemotePathWithinRoot(rootPath: string, candidatePath: string): boolean {
  const normalizedRootPath = normalizeComparableRemotePath(rootPath)
  const normalizedCandidatePath = normalizeComparableRemotePath(candidatePath)
  if (normalizedRootPath === normalizedCandidatePath) return true

  const relativePath = REMOTE_PATH.relative(normalizedRootPath, normalizedCandidatePath)
  return relativePath !== ''
    && !relativePath.startsWith('..')
    && !REMOTE_PATH.isAbsolute(relativePath)
}

function isSameRemotePath(leftPath: string, rightPath: string): boolean {
  return normalizeComparableRemotePath(leftPath) === normalizeComparableRemotePath(rightPath)
}

function resolveRemoteInputPath(context: SshSubscriptionContext, requestedPath: string): string {
  const trimmedPath = requestedPath.trim()
  if (!trimmedPath) {
    throw new Error('Directory path is required')
  }

  if (trimmedPath === '~') {
    return context.homeDir
  }

  if (trimmedPath.startsWith('~/')) {
    return normalizeRemotePath(REMOTE_PATH.resolve(context.homeDir, trimmedPath.slice(2)))
  }

  if (REMOTE_PATH.isAbsolute(trimmedPath)) {
    return normalizeRemotePath(trimmedPath)
  }

  return normalizeRemotePath(REMOTE_PATH.resolve(context.rootPath, trimmedPath))
}

function formatRemotePermissions(mode: number | undefined, isDirectory: boolean): string {
  if (typeof mode !== 'number' || !Number.isFinite(mode)) {
    return isDirectory ? 'd---------' : '----------'
  }

  const scopeMasks = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001]
  const scopeSymbols = ['r', 'w', 'x', 'r', 'w', 'x', 'r', 'w', 'x']
  const bits = scopeMasks.map((mask, index) => ((mode & mask) === mask ? scopeSymbols[index] : '-')).join('')
  return (isDirectory ? 'd' : '-') + bits
}

function toTerminalFileEntry(parentPath: string, entry: FileEntryWithStats): TerminalFileEntry | null {
  const kind = entry.attrs.isDirectory()
    ? 'directory'
    : entry.attrs.isFile()
      ? 'file'
      : null

  if (!kind) return null

  return {
    name: entry.filename,
    absolutePath: normalizeRemotePath(REMOTE_PATH.join(parentPath, entry.filename)),
    kind,
    permissions: formatRemotePermissions(entry.attrs.mode, kind === 'directory'),
    modifiedAtMs: Math.max(0, (entry.attrs.mtime ?? 0) * 1000),
  }
}

function sortEntries(entries: TerminalFileEntry[]): TerminalFileEntry[] {
  return [...entries].sort((leftEntry, rightEntry) => {
    if (leftEntry.kind !== rightEntry.kind) {
      return leftEntry.kind === 'directory' ? -1 : 1
    }

    return leftEntry.name.localeCompare(rightEntry.name)
  })
}

function getTopLevelItemName(targetPath: string): string {
  const basename = REMOTE_PATH.basename(normalizeRemotePath(targetPath))
  return basename || 'root'
}

function normalizeLocalTransferSourcePaths(sourcePaths: string[]): string[] {
  const seenPaths = new Set<string>()
  const normalizedPaths: string[] = []

  sourcePaths.forEach(sourcePath => {
    const resolvedPath = path.resolve(sourcePath)
    const comparablePath = process.platform === 'win32'
      ? resolvedPath.toLowerCase()
      : resolvedPath

    if (seenPaths.has(comparablePath)) return

    seenPaths.add(comparablePath)
    normalizedPaths.push(resolvedPath)
  })

  return normalizedPaths
}

function normalizeRemoteTransferSourcePaths(sourcePaths: string[]): string[] {
  const seenPaths = new Set<string>()
  const normalizedPaths: string[] = []

  sourcePaths.forEach(sourcePath => {
    const normalizedPath = normalizeRemotePath(sourcePath)
    const comparablePath = normalizeComparableRemotePath(normalizedPath)
    if (seenPaths.has(comparablePath)) return

    seenPaths.add(comparablePath)
    normalizedPaths.push(normalizedPath)
  })

  return normalizedPaths
}

function validateEntryName(name: string): string {
  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error('Name is required')
  }

  if (trimmedName === '.' || trimmedName === '..') {
    throw new Error('Invalid name')
  }

  if (trimmedName.includes('/') || trimmedName.includes('\\')) {
    throw new Error('Name cannot include path separators')
  }

  return trimmedName
}

function createProgressReporter(
  taskId: string,
  direction: TerminalFilesTransferDirection,
  destinationPath: string,
  totalItems: number,
  publishState: TransferStateReporter,
): (state: ProgressSnapshot, force?: boolean) => void {
  let lastProgressAt = 0

  return (state, force = false) => {
    const now = Date.now()
    if (!force && now - lastProgressAt < PROGRESS_INTERVAL_MS) {
      return
    }

    lastProgressAt = now
    const percent = typeof state.totalBytes === 'number' && state.totalBytes > 0
      ? Math.min(100, Math.max(0, (state.copiedBytes / state.totalBytes) * 100))
      : totalItems > 0
        ? Math.min(100, Math.max(0, (state.completedItems / totalItems) * 100))
        : null

    publishState({
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
    })
  }
}

function sftpLstat(sftp: SFTPWrapper, targetPath: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    sftp.lstat(targetPath, (error, stats) => {
      if (error || !stats) {
        reject(error ?? new Error('Failed to read remote file attributes'))
        return
      }

      resolve(stats)
    })
  })
}

async function sftpLstatOrNull(sftp: SFTPWrapper, targetPath: string): Promise<Stats | null> {
  try {
    return await sftpLstat(sftp, targetPath)
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException)?.code
    if (String(errorCode) === '2' || errorCode === 'ENOENT') {
      return null
    }

    throw error
  }
}

function sftpReaddir(sftp: SFTPWrapper, targetPath: string): Promise<FileEntryWithStats[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(targetPath, (error, entries) => {
      if (error || !entries) {
        reject(error ?? new Error('Failed to read remote directory'))
        return
      }

      resolve(entries)
    })
  })
}

function sftpMkdir(sftp: SFTPWrapper, targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.mkdir(targetPath, error => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpWriteFile(sftp: SFTPWrapper, targetPath: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.writeFile(targetPath, content, error => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpUnlink(sftp: SFTPWrapper, targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.unlink(targetPath, error => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpRmdir(sftp: SFTPWrapper, targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rmdir(targetPath, error => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpFastPut(
  sftp: SFTPWrapper,
  localPath: string,
  remotePath: string,
  options?: TransferOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (options) {
      sftp.fastPut(localPath, remotePath, options, error => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
      return
    }

    sftp.fastPut(localPath, remotePath, error => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpFastGet(
  sftp: SFTPWrapper,
  remotePath: string,
  localPath: string,
  options?: TransferOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (options) {
      sftp.fastGet(remotePath, localPath, options, error => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
      return
    }

    sftp.fastGet(remotePath, localPath, error => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

async function ensureRemoteDirectory(sftp: SFTPWrapper, targetPath: string): Promise<void> {
  const targetStats = await sftpLstatOrNull(sftp, targetPath)
  if (!targetStats) {
    throw new Error('Directory does not exist')
  }

  if (!targetStats.isDirectory()) {
    throw new Error('Path is not a directory')
  }
}

async function ensureRemoteDirectoryRecursive(sftp: SFTPWrapper, targetPath: string): Promise<void> {
  const normalizedTargetPath = normalizeRemotePath(targetPath)
  if (normalizedTargetPath === '/') return

  const pathSegments = normalizedTargetPath.split('/').filter(Boolean)
  let currentPath = '/'

  for (const segment of pathSegments) {
    currentPath = normalizeRemotePath(REMOTE_PATH.join(currentPath, segment))
    const existingStats = await sftpLstatOrNull(sftp, currentPath)
    if (existingStats?.isDirectory()) continue
    if (existingStats) {
      throw new Error('Cannot overwrite a file with a directory')
    }

    await sftpMkdir(sftp, currentPath)
  }
}

async function deleteRemotePathRecursive(sftp: SFTPWrapper, targetPath: string): Promise<void> {
  const targetStats = await sftpLstat(sftp, targetPath)
  if (targetStats.isDirectory()) {
    const entries = await sftpReaddir(sftp, targetPath)
    for (const entry of entries) {
      if (entry.filename === '.' || entry.filename === '..') continue
      await deleteRemotePathRecursive(
        sftp,
        normalizeRemotePath(REMOTE_PATH.join(targetPath, entry.filename)),
      )
    }

    await sftpRmdir(sftp, targetPath)
    return
  }

  await sftpUnlink(sftp, targetPath)
}

async function collectLocalDirectoryUploadPlan(
  sftp: SFTPWrapper,
  sourcePath: string,
  destinationPath: string,
  directoryPaths: string[],
  fileOperations: SshFileOperation[],
): Promise<void> {
  const directoryEntries = await fsPromises.readdir(sourcePath, { withFileTypes: true })

  for (const entry of directoryEntries) {
    const childSourcePath = path.join(sourcePath, entry.name)
    const childDestinationPath = normalizeRemotePath(REMOTE_PATH.join(destinationPath, entry.name))

    if (entry.isDirectory()) {
      const existingDestinationStats = await sftpLstatOrNull(sftp, childDestinationPath)
      if (existingDestinationStats && !existingDestinationStats.isDirectory()) {
        throw new Error('Cannot overwrite a file with a directory')
      }

      directoryPaths.push(childDestinationPath)
      await collectLocalDirectoryUploadPlan(
        sftp,
        childSourcePath,
        childDestinationPath,
        directoryPaths,
        fileOperations,
      )
      continue
    }

    if (!entry.isFile()) {
      throw new Error('Unsupported file type in transfer selection')
    }

    const existingDestinationStats = await sftpLstatOrNull(sftp, childDestinationPath)
    if (existingDestinationStats && existingDestinationStats.isDirectory()) {
      throw new Error('Cannot overwrite a directory with a file')
    }

    const childStats = await fsPromises.stat(childSourcePath)
    fileOperations.push({
      sourcePath: childSourcePath,
      destinationPath: childDestinationPath,
      size: Math.max(0, childStats.size),
    })
  }
}

async function buildUploadPlan(
  sftp: SFTPWrapper,
  sourcePath: string,
  destinationRootPath: string,
): Promise<SshTransferPlan> {
  const sourceStats = await fsPromises.lstat(sourcePath)
  const itemName = path.basename(sourcePath) || 'root'
  const destinationPath = normalizeRemotePath(REMOTE_PATH.join(destinationRootPath, itemName))

  if (sourceStats.isDirectory()) {
    const existingDestinationStats = await sftpLstatOrNull(sftp, destinationPath)
    if (existingDestinationStats && !existingDestinationStats.isDirectory()) {
      throw new Error('Cannot overwrite a file with a directory')
    }

    const directoryPaths = [destinationPath]
    const fileOperations: SshFileOperation[] = []
    await collectLocalDirectoryUploadPlan(
      sftp,
      sourcePath,
      destinationPath,
      directoryPaths,
      fileOperations,
    )

    return {
      name: itemName,
      destinationPath,
      directoryPaths,
      fileOperations,
      totalBytes: fileOperations.reduce((total, fileOperation) => total + fileOperation.size, 0),
    }
  }

  if (!sourceStats.isFile()) {
    throw new Error('Only files and directories can be transferred')
  }

  const existingDestinationStats = await sftpLstatOrNull(sftp, destinationPath)
  if (existingDestinationStats?.isDirectory()) {
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

async function collectRemoteDirectoryDownloadPlan(
  sftp: SFTPWrapper,
  sourcePath: string,
  destinationPath: string,
  directoryPaths: string[],
  fileOperations: SshFileOperation[],
): Promise<void> {
  const directoryEntries = await sftpReaddir(sftp, sourcePath)

  for (const entry of directoryEntries) {
    if (entry.filename === '.' || entry.filename === '..') continue

    const childSourcePath = normalizeRemotePath(REMOTE_PATH.join(sourcePath, entry.filename))
    const childDestinationPath = path.join(destinationPath, entry.filename)

    if (entry.attrs.isDirectory()) {
      const existingDestinationStats = await fsPromises.lstat(childDestinationPath).catch(() => null)
      if (existingDestinationStats && !existingDestinationStats.isDirectory()) {
        throw new Error('Cannot overwrite a file with a directory')
      }

      directoryPaths.push(childDestinationPath)
      await collectRemoteDirectoryDownloadPlan(
        sftp,
        childSourcePath,
        childDestinationPath,
        directoryPaths,
        fileOperations,
      )
      continue
    }

    if (!entry.attrs.isFile()) {
      throw new Error('Unsupported file type in transfer selection')
    }

    const existingDestinationStats = await fsPromises.lstat(childDestinationPath).catch(() => null)
    if (existingDestinationStats?.isDirectory()) {
      throw new Error('Cannot overwrite a directory with a file')
    }

    fileOperations.push({
      sourcePath: childSourcePath,
      destinationPath: childDestinationPath,
      size: Math.max(0, entry.attrs.size ?? 0),
    })
  }
}

async function buildDownloadPlan(
  sftp: SFTPWrapper,
  sourcePath: string,
  destinationRootPath: string,
): Promise<SshTransferPlan> {
  const sourceStats = await sftpLstat(sftp, sourcePath)
  const itemName = getTopLevelItemName(sourcePath)
  const destinationPath = path.join(destinationRootPath, itemName)

  if (sourceStats.isDirectory()) {
    const existingDestinationStats = await fsPromises.lstat(destinationPath).catch(() => null)
    if (existingDestinationStats && !existingDestinationStats.isDirectory()) {
      throw new Error('Cannot overwrite a file with a directory')
    }

    const directoryPaths = [destinationPath]
    const fileOperations: SshFileOperation[] = []
    await collectRemoteDirectoryDownloadPlan(
      sftp,
      sourcePath,
      destinationPath,
      directoryPaths,
      fileOperations,
    )

    return {
      name: itemName,
      destinationPath,
      directoryPaths,
      fileOperations,
      totalBytes: fileOperations.reduce((total, fileOperation) => total + fileOperation.size, 0),
    }
  }

  if (!sourceStats.isFile()) {
    throw new Error('Only files and directories can be transferred')
  }

  const existingDestinationStats = await fsPromises.lstat(destinationPath).catch(() => null)
  if (existingDestinationStats?.isDirectory()) {
    throw new Error('Cannot overwrite a directory with a file')
  }

  return {
    name: itemName,
    destinationPath,
    directoryPaths: [],
    fileOperations: [{
      sourcePath,
      destinationPath,
      size: Math.max(0, sourceStats.size ?? 0),
    }],
    totalBytes: Math.max(0, sourceStats.size ?? 0),
  }
}

async function listRemoteDirectoryEntries(sessionId: string, targetPath: string): Promise<TerminalFileEntry[]> {
  const sftp = await getTerminalSessionSftp(sessionId)
  const entries = await sftpReaddir(sftp, targetPath)

  return sortEntries(
    entries
      .filter(entry => entry.filename !== '.' && entry.filename !== '..')
      .map(entry => toTerminalFileEntry(targetPath, entry))
      .filter((entry): entry is TerminalFileEntry => Boolean(entry)),
  )
}

export async function createSshSnapshot(
  sessionId: string,
  rootPath: string,
  homeDir: string,
): Promise<TerminalFilesSnapshot> {
  await ensureRemoteDirectory(await getTerminalSessionSftp(sessionId), rootPath)
  const entries = await listRemoteDirectoryEntries(sessionId, rootPath)
  return {
    cwd: rootPath,
    homeDir,
    entries,
  }
}

export async function readSshDirectory(
  sessionId: string,
  parentPath: string,
): Promise<{ parentPath: string; entries: TerminalFileEntry[] }> {
  return {
    parentPath,
    entries: await listRemoteDirectoryEntries(sessionId, parentPath),
  }
}

export async function resolveSshRootPath(
  context: SshSubscriptionContext,
  requestedPath: string,
): Promise<string> {
  const nextRootPath = resolveRemoteInputPath(context, requestedPath)
  const sftp = await getTerminalSessionSftp(context.sessionId)
  await ensureRemoteDirectory(sftp, nextRootPath)
  return nextRootPath
}

export async function createSshFile(
  sessionId: string,
  rootPath: string,
  parentPath: string,
  name: string,
): Promise<TerminalFilesCreateEntryResult> {
  const normalizedParentPath = normalizeRemotePath(parentPath)
  if (!isRemotePathWithinRoot(rootPath, normalizedParentPath)) {
    throw new Error('Target directory is outside the current root path')
  }

  const entryName = validateEntryName(name)
  const sftp = await getTerminalSessionSftp(sessionId)
  await ensureRemoteDirectory(sftp, normalizedParentPath)

  const createdPath = normalizeRemotePath(REMOTE_PATH.join(normalizedParentPath, entryName))
  const existingStats = await sftpLstatOrNull(sftp, createdPath)
  if (existingStats) {
    throw new Error('File or directory already exists')
  }

  await sftpWriteFile(sftp, createdPath, '')
  return { createdPath }
}

export async function createSshDirectory(
  sessionId: string,
  rootPath: string,
  parentPath: string,
  name: string,
): Promise<TerminalFilesCreateEntryResult> {
  const normalizedParentPath = normalizeRemotePath(parentPath)
  if (!isRemotePathWithinRoot(rootPath, normalizedParentPath)) {
    throw new Error('Target directory is outside the current root path')
  }

  const entryName = validateEntryName(name)
  const sftp = await getTerminalSessionSftp(sessionId)
  await ensureRemoteDirectory(sftp, normalizedParentPath)

  const createdPath = normalizeRemotePath(REMOTE_PATH.join(normalizedParentPath, entryName))
  const existingStats = await sftpLstatOrNull(sftp, createdPath)
  if (existingStats) {
    throw new Error('File or directory already exists')
  }

  await sftpMkdir(sftp, createdPath)
  return { createdPath }
}

export async function deleteSshEntries(
  sessionId: string,
  rootPath: string,
  targetPaths: string[],
): Promise<TerminalFilesDeleteEntriesResult> {
  const normalizedTargetPaths = normalizeRemoteTransferSourcePaths(targetPaths)
  if (normalizedTargetPaths.length === 0) {
    throw new Error('No files or directories were selected for deletion')
  }

  for (const targetPath of normalizedTargetPaths) {
    if (!isRemotePathWithinRoot(rootPath, targetPath)) {
      throw new Error('Delete target is outside the current root path')
    }
    if (isSameRemotePath(rootPath, targetPath)) {
      throw new Error('The current root directory cannot be deleted')
    }
  }

  const sftp = await getTerminalSessionSftp(sessionId)
  for (const targetPath of normalizedTargetPaths) {
    await deleteRemotePathRecursive(sftp, targetPath)
  }

  return {
    deletedPaths: normalizedTargetPaths,
  }
}

async function transferUploadFiles(
  sftp: SFTPWrapper,
  plans: SshTransferPlan[],
  reportProgress: ReturnType<typeof createProgressReporter>,
  totalItems: number,
): Promise<void> {
  const totalBytes = plans.reduce((total, plan) => total + plan.totalBytes, 0)
  const progressState = {
    currentItemName: plans[0]?.name ?? null,
    completedItems: 0,
    copiedBytes: 0,
    totalBytes,
    status: 'transferring' as const,
  }

  reportProgress(progressState, true)

  for (const plan of plans) {
    progressState.currentItemName = plan.name
    reportProgress(progressState, true)

    for (const directoryPath of plan.directoryPaths) {
      await ensureRemoteDirectoryRecursive(sftp, directoryPath)
    }

    for (const fileOperation of plan.fileOperations) {
      let transferredBytes = 0
      await sftpFastPut(sftp, fileOperation.sourcePath, fileOperation.destinationPath, {
        concurrency: 32,
        chunkSize: 32768,
        fileSize: fileOperation.size,
        step(totalBytesTransferred) {
          const deltaBytes = Math.max(0, totalBytesTransferred - transferredBytes)
          transferredBytes = totalBytesTransferred
          progressState.copiedBytes += deltaBytes
          reportProgress(progressState)
        },
      })

      if (transferredBytes < fileOperation.size) {
        progressState.copiedBytes += fileOperation.size - transferredBytes
      }
    }

    progressState.completedItems += 1
    reportProgress(progressState, true)
  }

  reportProgress({
    currentItemName: null,
    completedItems: totalItems,
    copiedBytes: totalBytes,
    totalBytes,
    status: 'completed',
  }, true)
}

async function transferDownloadFiles(
  sftp: SFTPWrapper,
  plans: SshTransferPlan[],
  reportProgress: ReturnType<typeof createProgressReporter>,
  totalItems: number,
): Promise<void> {
  const totalBytes = plans.reduce((total, plan) => total + plan.totalBytes, 0)
  const progressState = {
    currentItemName: plans[0]?.name ?? null,
    completedItems: 0,
    copiedBytes: 0,
    totalBytes,
    status: 'transferring' as const,
  }

  reportProgress(progressState, true)

  for (const plan of plans) {
    progressState.currentItemName = plan.name
    reportProgress(progressState, true)

    for (const directoryPath of plan.directoryPaths) {
      await fsPromises.mkdir(directoryPath, { recursive: true })
    }

    for (const fileOperation of plan.fileOperations) {
      await fsPromises.mkdir(path.dirname(fileOperation.destinationPath), { recursive: true })
      let transferredBytes = 0
      await sftpFastGet(sftp, fileOperation.sourcePath, fileOperation.destinationPath, {
        concurrency: 32,
        chunkSize: 32768,
        fileSize: fileOperation.size,
        step(totalBytesTransferred) {
          const deltaBytes = Math.max(0, totalBytesTransferred - transferredBytes)
          transferredBytes = totalBytesTransferred
          progressState.copiedBytes += deltaBytes
          reportProgress(progressState)
        },
      })

      if (transferredBytes < fileOperation.size) {
        progressState.copiedBytes += fileOperation.size - transferredBytes
      }
    }

    progressState.completedItems += 1
    reportProgress(progressState, true)
  }

  reportProgress({
    currentItemName: null,
    completedItems: totalItems,
    copiedBytes: totalBytes,
    totalBytes,
    status: 'completed',
  }, true)
}

export async function uploadSshFiles(
  sessionId: string,
  rootPath: string,
  destinationPath: string,
  sourcePaths: string[],
  taskId: string,
  publishState: TransferStateReporter,
): Promise<void> {
  const normalizedSourcePaths = normalizeLocalTransferSourcePaths(sourcePaths)
  if (normalizedSourcePaths.length === 0) {
    throw new Error('No upload sources were provided')
  }

  if (!isRemotePathWithinRoot(rootPath, destinationPath)) {
    throw new Error('Upload target is outside the current root path')
  }

  const sftp = await getTerminalSessionSftp(sessionId)
  await ensureRemoteDirectory(sftp, destinationPath)

  const reportProgress = createProgressReporter(
    taskId,
    'upload',
    destinationPath,
    normalizedSourcePaths.length,
    publishState,
  )

  reportProgress({
    currentItemName: null,
    completedItems: 0,
    copiedBytes: 0,
    totalBytes: null,
    status: 'scanning',
  }, true)

  const plans: SshTransferPlan[] = []
  for (const sourcePath of normalizedSourcePaths) {
    plans.push(await buildUploadPlan(sftp, sourcePath, destinationPath))
  }

  await transferUploadFiles(sftp, plans, reportProgress, normalizedSourcePaths.length)
}

export async function downloadSshFiles(
  sessionId: string,
  rootPath: string,
  destinationPath: string,
  sourcePaths: string[],
  taskId: string,
  publishState: TransferStateReporter,
): Promise<void> {
  const normalizedSourcePaths = normalizeRemoteTransferSourcePaths(sourcePaths)
  if (normalizedSourcePaths.length === 0) {
    throw new Error('No download sources were provided')
  }

  const destinationStats = await fsPromises.stat(destinationPath).catch(() => null)
  if (!destinationStats?.isDirectory()) {
    throw new Error('Transfer target directory does not exist')
  }

  const hasOutOfRootSource = normalizedSourcePaths.some(sourcePath => !isRemotePathWithinRoot(rootPath, sourcePath))
  if (hasOutOfRootSource) {
    throw new Error('Download source is outside the current root path')
  }

  const sftp = await getTerminalSessionSftp(sessionId)
  const reportProgress = createProgressReporter(
    taskId,
    'download',
    destinationPath,
    normalizedSourcePaths.length,
    publishState,
  )

  reportProgress({
    currentItemName: null,
    completedItems: 0,
    copiedBytes: 0,
    totalBytes: null,
    status: 'scanning',
  }, true)

  const plans: SshTransferPlan[] = []
  for (const sourcePath of normalizedSourcePaths) {
    plans.push(await buildDownloadPlan(sftp, sourcePath, destinationPath))
  }

  await transferDownloadFiles(sftp, plans, reportProgress, normalizedSourcePaths.length)
}

export {
  isRemotePathWithinRoot,
  normalizeRemotePath,
  resolveRemoteInputPath,
}
