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
import { execSync } from 'node:child_process'
import { readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

const PLATFORM_MAP = {
  win: 'win',
  windows: 'win',
  linux: 'linux',
  mac: 'mac',
  darwin: 'mac',
}

const ARCH_MAP = {
  x64: 'x64',
  x86: 'ia32',
  ia32: 'ia32',
  arm64: 'arm64',
  applesilicon: 'arm64',
}

const ARCH_RENAME_MAP = {
  ia32: 'x86',
  x64: 'x64',
  arm64: 'arm64',
}

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { platform: null, arch: null }
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--platform=')) opts.platform = args[i].split('=')[1]
    else if (args[i].startsWith('--arch=')) opts.arch = args[i].split('=')[1]
    else if (args[i] === '--platform' && args[i + 1]) opts.platform = args[++i]
    else if (args[i] === '--arch' && args[i + 1]) opts.arch = args[++i]
  }
  return opts
}

function getProductInfo() {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
  try {
    const json5Content = readFileSync(join(process.cwd(), 'electron-builder.json5'), 'utf-8')
    const jsonMatch = json5Content.match(/"productName"\s*:\s*"([^"]+)"/)
    if (jsonMatch) return { name: jsonMatch[1], version: pkg.version }
  } catch {}
  return { name: pkg.productName || pkg.name, version: pkg.version }
}

function getElectronBuilderArch(arch) {
  return ARCH_MAP[arch] || arch
}

async function runElectronBuilder(platform, arch) {
  const ebPlatform = PLATFORM_MAP[platform] || platform
  const ebArch = getElectronBuilderArch(arch)

  let cmd = `pnpm exec electron-builder --${ebPlatform} --${ebArch}`
  console.log(`\n🔧 Running: ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd(), shell: true })
}

function detectArchFromFilename(filename, productName, version) {
  const patterns = [
    new RegExp(`-${version}-windows-ia32`),
    new RegExp(`-${version}-windows-x64`),
    new RegExp(`-${version}-windows-arm64`),
    new RegExp(`-${version}-mac-ia32`),
    new RegExp(`-${version}-mac-x64`),
    new RegExp(`-${version}-mac-arm64`),
    new RegExp(`-${version}-linux-ia32`),
    new RegExp(`-${version}-linux-x64`),
    new RegExp(`-${version}-linux-arm64`),
  ]
  for (const p of patterns) {
    const match = filename.match(p)
    if (match) return match[0].split('-').pop()
  }
  // 多架构 NSIS 包无 arch 标记（如 HiTerm-0.0.1-windows-installer.exe）
  if (filename.includes('-installer.exe') && !filename.match(/-x64|-ia32|-arm64/)) {
    return 'multi-arch'
  }
  return null
}

async function renameArtifacts(platform) {
  const { name, version } = getProductInfo()
  const releaseDir = join(process.cwd(), 'release', version)

  let files
  try {
    files = await readdir(releaseDir)
  } catch {
    console.error(`❌ Release directory not found: ${releaseDir}`)
    return
  }

  const SKIP_EXTENSIONS = ['.yml', '.yaml', '.json', '.blockmap', '.exe.blockmap']
  const renameMap = []

  for (const file of files) {
    if (SKIP_EXTENSIONS.some(ext => file.endsWith(ext))) continue

    const ext = file.split('.').pop()
    const fileArch = detectArchFromFilename(file, name, version)
    const displayArch = fileArch ? (ARCH_RENAME_MAP[fileArch] || fileArch) : null

    if (platform === 'win' || platform === 'windows') {
      if (fileArch === 'multi-arch') continue
      if (!fileArch) continue
      if (ext === 'exe' && file.includes('-installer')) {
        const newName = `${name}-${version}-windows-${displayArch}-installer.${ext}`
        if (newName !== file) renameMap.push({ old: file, new: newName })
      } else if (ext === 'exe') {
        const newName = `${name}-${version}-windows-${displayArch}-installer.${ext}`
        if (newName !== file) renameMap.push({ old: file, new: newName })
      } else if (ext === 'zip') {
        const newName = `${name}-${version}-windows-${displayArch}-portable.${ext}`
        if (newName !== file) renameMap.push({ old: file, new: newName })
      }
    } else if (platform === 'mac' || platform === 'darwin') {
      if (!fileArch) continue
      const macDisplayArch = fileArch === 'arm64' ? 'applesilicon' : displayArch
      const newName = `${name}-${version}-mac-${macDisplayArch}.${ext}`
      if (newName !== file) renameMap.push({ old: file, new: newName })
    } else if (platform === 'linux') {
      if (!fileArch) continue
      const newName = `${name}-${version}-linux-${displayArch}.${ext}`
      if (newName !== file) renameMap.push({ old: file, new: newName })
    }
  }

  for (const { old, new: newName } of renameMap) {
    const oldPath = join(releaseDir, old)
    const newPath = join(releaseDir, newName)
    await rename(oldPath, newPath)
    console.log(`📦 Renamed: ${old} → ${newName}`)
  }

  if (renameMap.length === 0) {
    console.log('✅ All artifacts already match naming convention')
  }
}

async function main() {
  const opts = parseArgs()
  const platform = opts.platform
  const arch = opts.arch

  if (!platform) {
    console.error('❌ --platform is required (win/linux/mac)')
    process.exit(1)
  }
  if (!arch) {
    console.error('❌ --arch is required (x64/x86/arm64/applesilicon)')
    process.exit(1)
  }

  const { name, version } = getProductInfo()
  console.log(`\n🚀 Dist: ${platform}-${arch}`)
  console.log(`   Product: ${name} v${version}`)

  await runElectronBuilder(platform, arch)
  await renameArtifacts(platform)

  console.log('\n✅ Dist complete!')
}

main().catch(err => {
  console.error('❌ Dist failed:', err)
  process.exit(1)
})