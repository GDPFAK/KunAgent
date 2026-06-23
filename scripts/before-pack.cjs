const { execFileSync } = require('node:child_process')
const { existsSync, readdirSync, rmSync } = require('node:fs')
const { join } = require('node:path')

const WHISPER_RESOURCES_DIR = join(__dirname, '..', 'resources', 'whisper')

function normalizePlatform(platform) {
  if (platform === 'mac') return 'darwin'
  if (platform === 'win') return 'win32'
  return platform
}

function normalizeArch(arch) {
  if (arch === 'x64' || arch === 1) return 'x64'
  if (arch === 'arm64' || arch === 3) return 'arm64'
  throw new Error(`[before-pack] Unsupported Whisper runner arch: ${arch}`)
}

function pruneWhisperResources(platform, arch) {
  if (!existsSync(WHISPER_RESOURCES_DIR)) return

  const keep = `${platform}-${arch}`
  for (const entry of readdirSync(WHISPER_RESOURCES_DIR)) {
    if (entry === keep || entry === 'LICENSE.whisper.cpp') continue

    rmSync(join(WHISPER_RESOURCES_DIR, entry), { recursive: true, force: true })
    console.log(`[before-pack] Removed non-target Whisper resource: ${entry}`)
  }
}

async function beforePack(context) {
  const platform = normalizePlatform(context.electronPlatformName)
  const arch = normalizeArch(context.arch)
  if (process.env.KUN_SKIP_WHISPER_RUNNER === '1') {
    console.warn(`[before-pack] Skipping bundled Whisper runner for ${platform}-${arch}.`)
    return
  }
  execFileSync(
    process.execPath,
    [
      join(__dirname, 'prepare-whisper-runner.cjs'),
      '--platform',
      platform,
      '--arch',
      arch
    ],
    {
      cwd: join(__dirname, '..'),
      stdio: 'inherit'
    }
  )
  pruneWhisperResources(platform, arch)
}

exports._internals = {
  normalizePlatform,
  normalizeArch,
  pruneWhisperResources
}
exports.default = beforePack
