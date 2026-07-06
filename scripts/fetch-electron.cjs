/**
 * Pre-download the Electron binary to the project-local cache
 * (`.cache/electron/`) so `npm install` can find it without
 * hitting GitHub over a blocked or slow network.
 *
 * Usage:  node scripts/fetch-electron.cjs [version]
 *         (version defaults to the locked version in package-lock.json)
 *
 * Environment variables respected:
 *   ELECTRON_CACHE       — override cache directory (default: .cache/electron)
 *   ELECTRON_MIRROR      — override mirror URL  (default: npmmirror.com)
 *   npm_config_electron_mirror — fallback mirror from .npmrc
 */

const { existsSync, mkdirSync, createWriteStream, readFileSync, writeFileSync } = require('node:fs')
const { join, resolve } = require('node:path')
const https = require('node:https')
const http = require('node:http')
const { createHash } = require('node:crypto')

const ROOT = resolve(__dirname, '..')

// ---- helpers -----------------------------------------------------------

function getMirrorUrl() {
  // Priority: env var > npm_config_ from .npmrc
  const mirror = process.env.ELECTRON_MIRROR
    || process.env.npm_config_electron_mirror
    || 'https://npmmirror.com/mirrors/electron/'
  return mirror.replace(/\/+$/, '')
}

function getCacheDir() {
  const dir = process.env.ELECTRON_CACHE || join(ROOT, '.cache', 'electron')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getElectronVersion(desired) {
  if (desired) return desired
  // Try lockfile first
  try {
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'))
    const pkg = lock.packages?.['node_modules/electron']
    if (pkg?.version) return pkg.version
  } catch { /* fall through */ }
  // Try installed electron package
  try {
    return require(join(ROOT, 'node_modules', 'electron', 'package.json')).version
  } catch { /* fall through */ }
  // Try package.json
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    const dep = pkg.devDependencies?.electron || pkg.dependencies?.electron
    if (dep) return dep.replace(/^\^|~|>=?|<=?/g, '')
  } catch { /* fall through */ }
  console.error('[fetch-electron] Could not determine Electron version from lockfile, package.json, or node_modules.')
  process.exit(1)
}

function archName() {
  return process.arch === 'x64' ? 'x64' : process.arch
}

function platformName() {
  if (process.platform === 'win32') return 'win32'
  if (process.platform === 'darwin') return 'darwin'
  return 'linux'
}

function binaryFilename(version) {
  // electron-v{VERSION}-{PLATFORM}-{ARCH}.zip
  // macOS has additional variants: darwin-x64, darwin-arm64
  if (process.platform === 'darwin') {
    return `electron-v${version}-darwin-${archName()}.zip`
  }
  return `electron-v${version}-${platformName()}-${archName()}.zip`
}

function downloadUrl(version) {
  const mirror = getMirrorUrl()
  const filename = binaryFilename(version)
  // @electron/get uses v-prefixed version in the URL path (e.g. v34.5.8)
  return `${mirror}/v${version}/${filename}`
}

function egetCacheDirname(version) {
  // @electron/get caches files in {cacheRoot}/{sha256(url)}/{filename}
  // where the URL is the mirror URL with v-prefixed version
  const mirror = getMirrorUrl()
  const filename = binaryFilename(version)
  const url = `${mirror}/v${version}/${filename}`
  return createHash('sha256').update(url).digest('hex')
}

function shasumsUrl(version) {
  const mirror = getMirrorUrl()
  return `${mirror}/${version}/SHASUMS256.txt`
}

function downloadFile(url, destPath) {
  return new Promise((resolvePromise, reject) => {
    const transporter = url.startsWith('https:') ? https : http
    console.log(`[fetch-electron] Downloading:\n  ${url}`)
    transporter.get(url, (response) => {
      // handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        resolvePromise(downloadFile(response.headers.location, destPath))
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`))
        return
      }
      const file = createWriteStream(destPath)
      response.pipe(file)
      file.on('finish', () => file.close(resolvePromise))
      file.on('error', reject)
    }).on('error', reject)
  })
}

function computeSha256(filePath) {
  const data = readFileSync(filePath)
  return createHash('sha256').update(data).digest('hex')
}

function fetchShasums(version) {
  const url = shasumsUrl(version)
  return new Promise((resolvePromise, reject) => {
    const transporter = url.startsWith('https:') ? https : http
    console.log(`[fetch-electron] Fetching SHASUMS256.txt:\n  ${url}`)
    let data = ''
    transporter.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        resolvePromise(fetchShasumsFromUrl(response.headers.location))
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for SHASUMS256.txt`))
        return
      }
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => resolvePromise(data))
      response.on('error', reject)
    }).on('error', reject)
  })
}

function fetchShasumsFromUrl(url) {
  return new Promise((resolvePromise, reject) => {
    const transporter = url.startsWith('https:') ? https : http
    let data = ''
    transporter.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for SHASUMS256.txt`))
        return
      }
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => resolvePromise(data))
      response.on('error', reject)
    }).on('error', reject)
  })
}

function parseShasums(text) {
  const map = {}
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 2) {
      map[parts[1]] = parts[0]
    }
  }
  return map
}

// ---- main --------------------------------------------------------------

async function main() {
  const desiredVersion = process.argv[2]
  const version = getElectronVersion(desiredVersion)
  const cacheDir = getCacheDir()
  const filename = binaryFilename(version)
  const destPath = join(cacheDir, filename)

  console.log(`[fetch-electron] Target: Electron v${version} (${platformName()}-${archName()})`)
  console.log(`[fetch-electron] Cache:  ${destPath}`)

  // Check if already cached
  if (existsSync(destPath)) {
    console.log('[fetch-electron] Already cached, verifying checksum...')
    try {
      const shasumsText = await fetchShasums(version)
      const sums = parseShasums(shasumsText)
      const expected = sums[filename]
      if (expected) {
        const actual = computeSha256(destPath)
        if (actual === expected.toLowerCase()) {
          console.log('[fetch-electron] ✓ Checksum verified, nothing to do.')
          return
        }
        console.warn('[fetch-electron] ⚠ Cached file checksum mismatch, re-downloading...')
      }
    } catch (err) {
      console.warn(`[fetch-electron] ⚠ Could not verify checksum (${err.message}), skipping verification.`)
      return
    }
  }

  // Download binary
  const url = downloadUrl(version)
  await downloadFile(url, destPath)
  console.log(`[fetch-electron] ✓ Downloaded to ${destPath}`)

  // Verify checksum
  try {
    const shasumsText = await fetchShasums(version)
    const sums = parseShasums(shasumsText)
    const expected = sums[filename]
    if (expected) {
      const actual = computeSha256(destPath)
      if (actual === expected.toLowerCase()) {
        console.log('[fetch-electron] ✓ Checksum verified.')
      } else {
        console.error(`[fetch-electron] ✗ Checksum mismatch!\n  Expected: ${expected}\n  Actual:   ${actual}`)
        process.exit(1)
      }
    } else {
      console.warn(`[fetch-electron] ⚠ No SHA256 for ${filename} in SHASUMS256.txt, skipping verification.`)
    }
  } catch (err) {
    console.warn(`[fetch-electron] ⚠ Could not fetch SHASUMS256.txt (${err.message}); using downloaded file as-is.`)
  }

  // Write a marker so postinstall.cjs knows the cache is ready
  writeFileSync(join(cacheDir, '.cache-ready'), `electron-v${version}-${platformName()}-${archName()}.zip\n`)

  // Also create the hashed subdirectory that @electron/get expects,
  // so electron's install.js finds the cached zip immediately.
  const hashDirname = egetCacheDirname(version)
  const hashDir = join(cacheDir, hashDirname)
  if (!existsSync(hashDir)) mkdirSync(hashDir, { recursive: true })
  const hashDestPath = join(hashDir, filename)
  // Copy (not move) so the flat cache also remains for postinstall.cjs
  if (!existsSync(hashDestPath)) {
    const { copyFileSync } = require('node:fs')
    copyFileSync(destPath, hashDestPath)
    console.log(`[fetch-electron] ✓ Also cached for @electron/get at ${hashDirname}/${filename}`)
  }

  console.log('[fetch-electron] ✓ Cache ready.')
}

main().catch((err) => {
  console.error('[fetch-electron] ✗ Failed:', err.message)
  process.exit(1)
})
