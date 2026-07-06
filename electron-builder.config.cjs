const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

function envWithLegacyFallback(kunName, legacyName) {
  const value = process.env[kunName]
  if (value !== undefined && value !== '') return value
  return process.env[legacyName]
}

function loadLocalReleaseEnv() {
  const candidates = [
    envWithLegacyFallback('KUN_RELEASE_ENV', 'DEEPSEEK_GUI_RELEASE_ENV'),
    join(__dirname, 'scripts', 'release.local.env'),
    join(__dirname, 'release.local.env')
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    for (const rawLine of readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!match) continue
      let value = match[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[match[1]]) process.env[match[1]] = value
    }
    break
  }
}

loadLocalReleaseEnv()

const hasExplicitMacSigningIdentity = Boolean(
  process.env.CSC_LINK ||
    process.env.CSC_NAME ||
    process.env.CSC_KEY_PASSWORD ||
    process.env.MAC_SIGN === '1'
)

const hasNotaryToolCredentials = Boolean(
  process.env.APPLE_API_KEY_ID &&
    process.env.APPLE_API_ISSUER &&
    (process.env.APPLE_API_KEY || process.env.APPLE_API_KEY_BASE64)
)

const releaseAppVersion = (
  envWithLegacyFallback('KUN_APP_VERSION', 'DEEPSEEK_GUI_APP_VERSION') || ''
).trim()
const releaseArtifactVersion = (
  envWithLegacyFallback('KUN_ARTIFACT_VERSION', 'DEEPSEEK_GUI_ARTIFACT_VERSION') || ''
).trim()
const artifactVersion = releaseArtifactVersion || releaseAppVersion || '${version}'
const semverVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const artifactVersionPattern = /^[0-9A-Za-z][0-9A-Za-z._-]*$/

if (releaseAppVersion && !semverVersionPattern.test(releaseAppVersion)) {
  throw new Error(
    `KUN_APP_VERSION (or legacy DEEPSEEK_GUI_APP_VERSION) must be a valid semver for electron-updater, got: ${releaseAppVersion}`
  )
}

if (releaseArtifactVersion && !artifactVersionPattern.test(releaseArtifactVersion)) {
  throw new Error(
    `KUN_ARTIFACT_VERSION (or legacy DEEPSEEK_GUI_ARTIFACT_VERSION) must use only letters, numbers, dots, dashes, and underscores, got: ${releaseArtifactVersion}`
  )
}

module.exports = {
  appId: 'com.xingyuzhong.deepseekgui',
  productName: 'Kun',
  asar: true,
  asarUnpack: [
    '**/kun/dist/**/*',
    '**/kun/package*.json',
    '**/kun/node_modules/**/*',
    '**/node_modules/better-sqlite3/**/*',
    '**/node_modules/node-pty/**/*',
    '**/node_modules/bindings/**/*',
    '**/node_modules/file-uri-to-path/**/*',
    '**/node_modules/@computer-use/**/*'
  ],
  npmRebuild: true,
  directories: {
    output: envWithLegacyFallback('KUN_DIST_DIR', 'DEEPSEEK_GUI_DIST_DIR') || 'dist'
  },
  files: [
    'out/**/*',
    'package.json',
    'kun/dist/**/*',
    'kun/package.json',
    'kun/package-lock.json',
    'kun/node_modules/**/*',
    '!kun/node_modules/@anthropic-ai/claude-agent-sdk-*/**',
    '!**/*.map',
    '!**/*.d.ts',
    '!**/*.ts',
    '!**/tsconfig*.json',
    '!**/README*',
    '!**/CHANGELOG*'
  ],
  extraResources: [
    {
      from: 'resources/whisper',
      to: 'whisper',
      filter: ['**/*']
    }
  ],
  artifactName: `Kun-${artifactVersion}-\${os}-\${arch}.\${ext}`,
  publish: [
    {
      provider: 'github',
      owner: 'GDPFAK',
      repo: 'KunAgent'
    }
  ],
  beforePack: './scripts/before-pack.cjs',
  afterPack: './scripts/after-pack.cjs',
  afterSign: './scripts/mac-notarize.cjs',
  mac: {
    category: 'public.app-category.developer-tools',
    identity: hasExplicitMacSigningIdentity ? undefined : null,
    notarize: false,
    hardenedRuntime: hasExplicitMacSigningIdentity,
    forceCodeSigning: hasExplicitMacSigningIdentity,
    timestamp: hasExplicitMacSigningIdentity ? 'http://timestamp.apple.com/ts01' : null,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.inherit.plist',
    extendInfo: {
      NSMicrophoneUsageDescription: 'Kun uses the microphone for voice-to-text input.'
    },
    icon: './src/asset/img/kun_mac.png',
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] }
    ]
  },
  dmg: {
    sign: hasExplicitMacSigningIdentity
  },
  win: {
    icon: './build/icon.ico',
    target: [{ target: 'nsis', arch: ['x64'] }]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: false,
    allowElevation: true,
    selectPerMachineByDefault: false,
    include: 'build/installer.nsh',
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
    shortcutName: 'Kun',
    uninstallDisplayName: 'Kun',
    deleteAppDataOnUninstall: false
  },
  linux: {
    category: 'Development',
    icon: './src/asset/img/kun.png',
    target: [{ target: 'AppImage', arch: ['x64'] }]
  },
  extraMetadata: {
    ...(releaseAppVersion ? { version: releaseAppVersion } : {}),
    buildHints: {
      macSigningEnabled: hasExplicitMacSigningIdentity,
      notarizationEnabled: hasNotaryToolCredentials
    }
  }
}
