const { execFileSync } = require('node:child_process')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const rootDir = join(__dirname, '..')

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(rootDir, relativePath), 'utf8'))
}

function readGitHead() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim()
}

function resolveBuildHash() {
  const explicit = (process.env.KUN_BUILD_HASH || process.env.GITHUB_SHA || '').trim()
  if (explicit) return explicit
  return readGitHead()
}

function assertCommitHash(value) {
  if (!/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error(`KUN_BUILD_HASH must be a 40-character git commit hash, got: ${value}`)
  }
  return value.toLowerCase()
}

function writeGeneratedFile(relativePath, content) {
  writeFileSync(join(rootDir, relativePath), content, 'utf8')
}

function tsString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

const guiVersion = readJson('package.json').version
const runtimeVersion = readJson('kun/package.json').version
const buildHash = assertCommitHash(resolveBuildHash())

writeGeneratedFile(
  'src/shared/build-identity.ts',
  [
    '// 此文件由 scripts/generate-build-identity.cjs 生成。',
    `export const KUN_GUI_VERSION = ${tsString(guiVersion)}`,
    `export const KUN_GUI_BUILD_HASH = ${tsString(buildHash)}`,
    ''
  ].join('\n')
)

writeGeneratedFile(
  'kun/src/version.ts',
  [
    '// 此文件由 ../scripts/generate-build-identity.cjs 生成。',
    `export const KUN_RUNTIME_VERSION = ${tsString(runtimeVersion)}`,
    `export const KUN_RUNTIME_BUILD_HASH = ${tsString(buildHash)}`,
    ''
  ].join('\n')
)

console.log(`[build-identity] generated ${buildHash}`)
