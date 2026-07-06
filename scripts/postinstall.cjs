const { spawnSync } = require('node:child_process')
const { existsSync } = require('node:fs')
const { join, resolve } = require('node:path')

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options
  })
}

// ---- Electron cache setup ----------------------------------------------
// Point both ELECTRON_CACHE (for @electron/get) and electron_config_cache
// (for electron install.js) to the project-local cache directory.
const ROOT = resolve(__dirname, '..')
const PROJECT_ELECTRON_CACHE = join(ROOT, '.cache', 'electron')
if (!process.env.ELECTRON_CACHE) {
  process.env.ELECTRON_CACHE = PROJECT_ELECTRON_CACHE
}
if (!process.env.electron_config_cache) {
  process.env.electron_config_cache = PROJECT_ELECTRON_CACHE
}

// Ensure electron binary exists in node_modules/electron/dist.
// If the package's own install.js failed (e.g. network issue), extract
// from the project-local cache so 'npm run dev' can proceed.
const ELECTRON_DIST = join(ROOT, 'node_modules', 'electron', 'dist')
const ELECTRON_PKG = join(ROOT, 'node_modules', 'electron')
const HAS_ELECTRON_BINARY = existsSync(join(ELECTRON_DIST, 'electron.exe'))

if (!HAS_ELECTRON_BINARY) {
  console.log('[postinstall] Electron binary missing in node_modules/electron/dist.')

  // Search for cached electron zip (flat or in hashed subdirectories)
  const { readdirSync } = require('node:fs')
  let cachedZip = null
  if (existsSync(PROJECT_ELECTRON_CACHE)) {
    // Search recursively through hashed subdirs
    const entries = readdirSync(PROJECT_ELECTRON_CACHE, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(PROJECT_ELECTRON_CACHE, entry.name)
      if (entry.isDirectory()) {
        const subFiles = readdirSync(fullPath)
        const zipFile = subFiles.find(f => f.endsWith('.zip') && f.startsWith('electron-v'))
        if (zipFile) {
          cachedZip = join(fullPath, zipFile)
          break
        }
      } else if (entry.name.endsWith('.zip') && entry.name.startsWith('electron-v')) {
        cachedZip = fullPath
      }
    }
  }

  if (cachedZip) {
    console.log('[postinstall] Extracting Electron from cache:', cachedZip)
    const { writeFileSync } = require('node:fs')
    const tryExtract = () => {
      const extractZip = require('extract-zip')
      return extractZip(cachedZip, { dir: ELECTRON_DIST }).then(() => {
        writeFileSync(join(ELECTRON_PKG, 'path.txt'), 'electron.exe')
        console.log('[postinstall] ✓ Electron extracted from cache.')
      })
    }
    tryExtract().catch((extractErr) => {
      console.warn('[postinstall] Could not extract from cache:', extractErr.message)
      // Fallback: use @electron/get to download
      try {
        const { downloadArtifact } = require('@electron/get')
        if (!process.env.ELECTRON_MIRROR) {
          process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
        }
        downloadArtifact({
          version: require(join(ELECTRON_PKG, 'package.json')).version,
          artifactName: 'electron',
          cacheRoot: PROJECT_ELECTRON_CACHE,
          platform: process.platform,
          arch: process.arch
        }).then((zipPath) => {
          const extractZip = require('extract-zip')
          return extractZip(zipPath, { dir: ELECTRON_DIST })
        }).then(() => {
          writeFileSync(join(ELECTRON_PKG, 'path.txt'), 'electron.exe')
          console.log('[postinstall] ✓ Electron downloaded and extracted.')
        }).catch((dlErr) => {
          console.warn('[postinstall] @electron/get download also failed:', dlErr.message)
          console.log('[postinstall] Try: node scripts/fetch-electron.cjs')
        })
      } catch (dlErr) {
        console.warn('[postinstall] @electron/get not available:', dlErr.message)
      }
    })
  } else {
    console.log('[postinstall] No Electron zip in project cache.')
    console.log('[postinstall] To pre-download Electron from a Chinese mirror, run:')
    console.log('[postinstall]   node scripts/fetch-electron.cjs')
    console.log('[postinstall] Or set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/')
    console.log('[postinstall] and run: node node_modules/electron/install.js')
  }
}

require('./ensure-kun-install.cjs')

const buildKun = run('npm', ['--prefix', 'kun', 'run', 'build'])
if (buildKun.status !== 0) {
  process.exit(buildKun.status || 1)
}

// Kun is spawned with the Electron binary (ELECTRON_RUN_AS_NODE) and resolves
// better-sqlite3 from the root node_modules, so the native module must match
// Electron's ABI — the node-ABI prebuild that `npm install` fetches cannot be
// loaded there and Kun would silently fall back to JSONL scanning. Best
// effort: a failure (e.g. offline) keeps the JSONL fallback working.
try {
  const electronVersion = require('electron/package.json').version
  const result = run('npx', [
    '--yes',
    'prebuild-install',
    `--runtime=electron`,
    `--target=${electronVersion}`
  ], { cwd: join(__dirname, '..', 'node_modules', 'better-sqlite3') })
  if (result.status !== 0) {
    console.warn('[postinstall] better-sqlite3 electron prebuild failed; Kun will use the JSONL fallback')
  }
} catch (error) {
  console.warn('[postinstall] skipped better-sqlite3 electron prebuild:', error.message)
}

// node-pty is a native module used by the built-in terminal and is always
// loaded inside the Electron main process. It ships its own prebuilt
// `pty.node` + `spawn-helper` binaries under prebuilds/<plat>-<arch>/, but
// npm does not always preserve the executable bit on `spawn-helper`, which
// node-pty execs to fork the child — without it `posix_spawnp` fails. Best
// effort: re-chmod the helper for every bundled platform so the terminal
// works out of the box. A failure is non-fatal.
try {
  const { readdirSync, chmodSync } = require('node:fs')
  const prebuildsDir = join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds')
  if (existsSync(prebuildsDir)) {
    for (const folder of readdirSync(prebuildsDir)) {
      const helper = join(prebuildsDir, folder, 'spawn-helper')
      if (existsSync(helper)) {
        try {
          chmodSync(helper, 0o755)
        } catch (error) {
          console.warn(`[postinstall] could not chmod node-pty spawn-helper (${folder}):`, error.message)
        }
      }
    }
  }
} catch (error) {
  console.warn('[postinstall] skipped node-pty spawn-helper chmod:', error.message)
}

// Some environments also need an Electron-ABI rebuild (no Node prebuild
// matches). This is best-effort; the bundled prebuilds already target an
// ABI-compatible Node build for current Electron versions, so a failure here
// is usually harmless and leaves the terminal working.
try {
  const electronVersion = require('electron/package.json').version
  const result = run('npx', [
    '--yes',
    'prebuild-install',
    `--runtime=electron`,
    `--target=${electronVersion}`
  ], { cwd: join(__dirname, '..', 'node_modules', 'node-pty') })
  if (result.status !== 0) {
    console.warn('[postinstall] node-pty electron prebuild fell back to bundled binaries')
  }
} catch (error) {
  console.warn('[postinstall] skipped node-pty electron prebuild:', error.message)
}
