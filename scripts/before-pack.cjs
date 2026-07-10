const { execFileSync } = require('node:child_process')
const { existsSync, readdirSync, rmSync, statSync } = require('node:fs')
const { join, sep } = require('node:path')

const KUN_NM = join(__dirname, '..', 'kun', 'node_modules')
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

/**
 * Recursively walk a directory tree and remove every directory whose basename
 * matches `name`.  Returns the count of removed dirs.
 *
 * This catches circular symlink chains such as
 *   kun/node_modules/kun-gui/kun/node_modules/kun-gui/…
 * that npm install/prune may create when a transitive dependency resolves to
 * the root package (name: "kun-gui").  A single-level rmSync is not enough
 * because the nesting can be arbitrarily deep on Windows where symlinks get
 * resolved during file copy.
 */
function removeAllByName(root, name) {
  if (!existsSync(root)) return 0
  let removed = 0
  try {
    const entries = readdirSync(root, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(root, entry.name)
      try {
        if (entry.name === name) {
          rmSync(fullPath, { recursive: true, force: true })
          removed += 1
          continue
        }
        if (entry.isDirectory()) {
          // Skip reparse points / junctions that would cause infinite recursion
          const stats = statSync(fullPath)
          if (stats.isDirectory()) {
            removed += removeAllByName(fullPath, name)
          }
        }
      } catch {
        // Best-effort: if we can't stat/read an entry, skip it.
      }
    }
  } catch {
    // Best-effort: if we can't read the directory, skip it.
  }
  return removed
}

function removeCircularKunGui(context) {
  // The kun runtime may transitively pull in kun-gui (the root package) as
  // a dependency, creating a circular bundle (kun → … → kun-gui → kun → …).
  // Electron-builder glob exclusions (!kun/node_modules/kun-gui/**) are
  // unreliable here — physically remove every kun-gui directory at any depth
  // before packing so after-pack validation passes.
  const roots = [
    join(__dirname, '..', 'kun', 'node_modules'),
    // During pack (appOutDir is set by electron-builder).
    ...(context.appOutDir
      ? [join(context.appOutDir, 'resources', 'app.asar.unpacked', 'kun', 'node_modules')]
      : [])
  ]
  let total = 0
  for (const nmDir of roots) {
    total += removeAllByName(nmDir, 'kun-gui')
  }
  if (total > 0) {
    console.log(`[before-pack] Removed ${total} circular kun-gui director${total === 1 ? 'y' : 'ies'}.`)
  }
}

async function beforePack(context) {
  removeCircularKunGui(context)

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
  pruneWhisperResources,
  removeAllByName,
  removeCircularKunGui
}
exports.default = beforePack
