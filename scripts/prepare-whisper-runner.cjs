#!/usr/bin/env node

const { execFileSync } = require('node:child_process')
const { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } = require('node:fs')
const { basename, dirname, join, resolve } = require('node:path')

const WHISPER_CPP_REPO = 'https://github.com/ggml-org/whisper.cpp.git'
const DEFAULT_WHISPER_CPP_REF = 'v1.9.1'
const ROOT = resolve(__dirname, '..')
const CACHE_DIR = join(ROOT, '.cache', 'whisper-runner')
const RESOURCES_DIR = join(ROOT, 'resources', 'whisper')

function usage() {
  console.log(`Usage:
  node scripts/prepare-whisper-runner.cjs [--platform darwin|win32|linux] [--arch arm64|x64] [--force]

Environment:
  KUN_WHISPER_CPP_REF=${DEFAULT_WHISPER_CPP_REF}
`)
}

function readArgs(argv) {
  const flags = new Map()
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      flags.set('help', true)
      continue
    }
    if (arg === '--force') {
      flags.set('force', true)
      continue
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`)
    flags.set(arg.slice(2), value)
    i += 1
  }
  return flags
}

function normalizePlatform(value) {
  const platform = String(value || process.platform).trim()
  if (platform === 'mac') return 'darwin'
  if (platform === 'win') return 'win32'
  if (platform === 'darwin' || platform === 'win32' || platform === 'linux') return platform
  throw new Error(`Unsupported Whisper runner platform: ${platform}`)
}

function normalizeArch(value) {
  const arch = String(value || process.arch).trim()
  if (arch === 'x64' || arch === 'arm64') return arch
  throw new Error(`Unsupported Whisper runner arch: ${arch}`)
}

function targetDir(platform, arch) {
  return join(RESOURCES_DIR, `${platform}-${arch}`)
}

function targetExecutable(platform, arch) {
  return join(targetDir(platform, arch), platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli')
}

function assertNativeBuildTarget(platform, arch) {
  if (platform !== process.platform) {
    throw new Error(
      `[prepare-whisper-runner] Cross-platform Whisper runner build is not supported from ${process.platform} to ${platform}. Build on the target OS or place the runner in ${targetDir(platform, arch)} first.`
    )
  }
  if (platform !== 'darwin' && arch !== process.arch) {
    throw new Error(
      `[prepare-whisper-runner] Cross-arch Whisper runner build is not supported for ${platform}. Build on ${platform}-${arch} or place the runner in ${targetDir(platform, arch)} first.`
    )
  }
}

function assertCommand(command, installHint) {
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore' })
  } catch {
    throw new Error(`[prepare-whisper-runner] Missing ${command}. ${installHint}`)
  }
}

function whisperRef() {
  return (process.env.KUN_WHISPER_CPP_REF || DEFAULT_WHISPER_CPP_REF).trim()
}

function sourceDir() {
  return join(CACHE_DIR, `whisper.cpp-${whisperRef().replace(/[^A-Za-z0-9._-]+/g, '_')}`)
}

function ensureSource() {
  const dir = sourceDir()
  if (existsSync(join(dir, 'CMakeLists.txt'))) return dir
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dirname(dir), { recursive: true })
  console.log(`[prepare-whisper-runner] Cloning whisper.cpp ${whisperRef()}`)
  execFileSync('git', ['clone', '--depth', '1', '--branch', whisperRef(), WHISPER_CPP_REPO, dir], {
    cwd: ROOT,
    stdio: 'inherit'
  })
  return dir
}

function cmakeArchValue(platform, arch) {
  if (platform !== 'darwin') return ''
  return arch === 'arm64' ? 'arm64' : 'x86_64'
}

function buildRunner(platform, arch) {
  assertCommand('git', 'Install Git before building the bundled Whisper runner.')
  assertCommand('cmake', 'Install CMake before building the bundled Whisper runner.')

  const source = ensureSource()
  const build = join(CACHE_DIR, 'build', `${platform}-${arch}`)
  mkdirSync(build, { recursive: true })
  const configureArgs = [
    '-S',
    source,
    '-B',
    build,
    '-DCMAKE_BUILD_TYPE=Release',
    '-DBUILD_SHARED_LIBS=OFF',
    '-DWHISPER_BUILD_TESTS=OFF',
    '-DWHISPER_BUILD_SERVER=OFF'
  ]
  const osxArch = cmakeArchValue(platform, arch)
  if (osxArch) configureArgs.push(`-DCMAKE_OSX_ARCHITECTURES=${osxArch}`)
  if (platform === 'linux') configureArgs.push('-DGGML_OPENMP=OFF')

  console.log(`[prepare-whisper-runner] Configuring whisper.cpp for ${platform}-${arch}`)
  execFileSync('cmake', configureArgs, { cwd: ROOT, stdio: 'inherit' })
  console.log(`[prepare-whisper-runner] Building whisper-cli for ${platform}-${arch}`)
  execFileSync('cmake', ['--build', build, '--config', 'Release', '--target', 'whisper-cli', '--parallel'], {
    cwd: ROOT,
    stdio: 'inherit'
  })
  return findBuiltRunner(build, platform)
}

function findBuiltRunner(buildDir, platform) {
  const names = platform === 'win32' ? ['whisper-cli.exe'] : ['whisper-cli']
  const queue = [buildDir]
  while (queue.length > 0) {
    const current = queue.shift()
    for (const entry of readdirSync(current)) {
      const path = join(current, entry)
      const info = statSync(path)
      if (info.isDirectory()) {
        queue.push(path)
        continue
      }
      if (names.includes(basename(path))) return path
    }
  }
  throw new Error(`[prepare-whisper-runner] Built whisper-cli was not found under ${buildDir}`)
}

function installRunner(platform, arch, builtRunner) {
  const out = targetExecutable(platform, arch)
  mkdirSync(dirname(out), { recursive: true })
  copyFileSync(builtRunner, out)
  if (platform !== 'win32') chmodSync(out, 0o755)
  const source = sourceDir()
  const license = join(source, 'LICENSE')
  if (existsSync(license)) {
    copyFileSync(license, join(RESOURCES_DIR, 'LICENSE.whisper.cpp'))
  }
  writeFileSync(
    join(dirname(out), 'runner.json'),
    JSON.stringify({
      runner: basename(out),
      source: WHISPER_CPP_REPO,
      ref: whisperRef(),
      platform,
      arch,
      builtAt: new Date().toISOString()
    }, null, 2),
    'utf8'
  )
  console.log(`[prepare-whisper-runner] Installed ${out}`)
}

function main() {
  const flags = readArgs(process.argv.slice(2))
  if (flags.get('help')) {
    usage()
    return
  }
  const platform = normalizePlatform(flags.get('platform'))
  const arch = normalizeArch(flags.get('arch'))
  const out = targetExecutable(platform, arch)
  if (existsSync(out) && !flags.get('force')) {
    console.log(`[prepare-whisper-runner] Reusing existing ${out}`)
    return
  }
  assertNativeBuildTarget(platform, arch)
  const builtRunner = buildRunner(platform, arch)
  installRunner(platform, arch, builtRunner)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
