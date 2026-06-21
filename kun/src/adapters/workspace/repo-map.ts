import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const MAX_FILES = 800
const MAX_FILE_BYTES = 384 * 1024
const MAX_INDEXED_CONTENT_CHARS = 96_000
const MAX_TERMS_PER_FILE = 2_500
const INDEX_REVALIDATE_MS = 30_000
const RECENT_COMMIT_COUNT = 8

const SOURCE_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.cs', '.css', '.go', '.h', '.hpp', '.html', '.java',
  '.js', '.jsx', '.json', '.kt', '.kts', '.md', '.mjs', '.php', '.py', '.rb',
  '.rs', '.scss', '.sh', '.sql', '.swift', '.toml', '.ts', '.tsx', '.vue',
  '.xml', '.yaml', '.yml'
])

export type RepoMapEntry = {
  path: string
  size: number
  mtimeMs: number
  hash: string
  symbols: string[]
  dependencies: string[]
  terms: string[]
  recent: boolean
}

export type RepoMapSearchResult = {
  path: string
  score: number
  symbols: string[]
  dependencies: string[]
  recent: boolean
}

type WorkspaceIndex = {
  entries: Map<string, RepoMapEntry>
  filesSignature: string
  indexedAt: number
}

const indexes = new Map<string, WorkspaceIndex>()
const inflightIndexes = new Map<string, Promise<WorkspaceIndex>>()

export async function searchRepoMap(input: {
  workspace: string
  query: string
  limit?: number
  refresh?: boolean
}): Promise<{ indexedFiles: number; indexedAt: string; results: RepoMapSearchResult[] }> {
  const workspace = resolve(input.workspace)
  const index = await loadRepoMap(workspace, input.refresh === true)
  return {
    indexedFiles: index.entries.size,
    indexedAt: new Date(index.indexedAt).toISOString(),
    results: rankRepoMapEntries([...index.entries.values()], input.query, input.limit)
  }
}

async function loadRepoMap(workspace: string, force: boolean): Promise<WorkspaceIndex> {
  const previous = indexes.get(workspace)
  if (!force && previous && Date.now() - previous.indexedAt < INDEX_REVALIDATE_MS) return previous
  const inflightKey = `${workspace}\0${force ? 'force' : 'normal'}`
  const inflight = inflightIndexes.get(inflightKey)
  if (inflight) return inflight
  const task = updateRepoMap(workspace, force)
  inflightIndexes.set(inflightKey, task)
  try {
    return await task
  } finally {
    inflightIndexes.delete(inflightKey)
  }
}

async function updateRepoMap(workspace: string, force: boolean): Promise<WorkspaceIndex> {
  const previous = indexes.get(workspace)
  if (!force && previous && Date.now() - previous.indexedAt < INDEX_REVALIDATE_MS) return previous

  const [files, recentFiles] = await Promise.all([
    listRepositoryFiles(workspace),
    listRecentFiles(workspace)
  ])
  const filesSignature = createHash('sha256')
    .update([...files, ...[...recentFiles].sort()].join('\n'))
    .digest('hex')
  if (!force && previous?.filesSignature === filesSignature) {
    const unchanged = await allEntriesUnchanged(workspace, previous.entries, recentFiles)
    if (unchanged) return previous
  }

  const entries = new Map<string, RepoMapEntry>()
  for (const path of files.slice(0, MAX_FILES)) {
    const absolutePath = resolve(workspace, path)
    const fileStat = await stat(absolutePath).catch(() => null)
    if (!fileStat?.isFile() || fileStat.size > MAX_FILE_BYTES) continue
    const recent = recentFiles.has(path)
    const cached = previous?.entries.get(path)
    if (
      !force && cached && cached.size === fileStat.size &&
      cached.mtimeMs === fileStat.mtimeMs && cached.recent === recent
    ) {
      entries.set(path, cached)
      continue
    }
    const content = await readFile(absolutePath, 'utf8').catch(() => null)
    if (content === null || content.includes('\0')) continue
    entries.set(path, buildRepoMapEntry(path, content, {
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      recent
    }))
  }

  const index = { entries, filesSignature, indexedAt: Date.now() }
  indexes.set(workspace, index)
  return index
}

async function allEntriesUnchanged(
  workspace: string,
  entries: ReadonlyMap<string, RepoMapEntry>,
  recentFiles: ReadonlySet<string>
): Promise<boolean> {
  const values = [...entries.values()]
  for (let index = 0; index < values.length; index += 64) {
    const batch = values.slice(index, index + 64)
    const unchanged = await Promise.all(batch.map(async (entry) => {
      const fileStat = await stat(resolve(workspace, entry.path)).catch(() => null)
      return Boolean(
        fileStat &&
        fileStat.size === entry.size &&
        fileStat.mtimeMs === entry.mtimeMs &&
        entry.recent === recentFiles.has(entry.path)
      )
    }))
    if (unchanged.some((value) => !value)) return false
  }
  return true
}

async function listRepositoryFiles(workspace: string): Promise<string[]> {
  const gitFiles = await runGit(workspace, ['ls-files', '--cached', '--others', '--exclude-standard'])
  return gitFiles
    .split(/\r?\n/)
    .map((path) => path.trim().replaceAll('\\', '/'))
    .filter((path) => path && SOURCE_EXTENSIONS.has(extname(path).toLowerCase()))
    .sort((left, right) => left.localeCompare(right))
}

async function listRecentFiles(workspace: string): Promise<Set<string>> {
  const output = await runGit(
    workspace,
    ['log', `-${RECENT_COMMIT_COUNT}`, '--name-only', '--pretty=format:'],
    true
  )
  return new Set(output.split(/\r?\n/).map((path) => path.trim().replaceAll('\\', '/')).filter(Boolean))
}

async function runGit(workspace: string, args: string[], allowFailure = false): Promise<string> {
  try {
    const result = await execFileAsync('git', args, {
      cwd: workspace,
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true
    })
    return result.stdout
  } catch (error) {
    if (allowFailure) return ''
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to build repo map: ${message}`)
  }
}

export function buildRepoMapEntry(
  path: string,
  content: string,
  metadata: { size: number; mtimeMs: number; recent: boolean }
): RepoMapEntry {
  const symbols = extractRepoSymbols(content)
  const dependencies = extractDependencies(content)
  return {
    path,
    ...metadata,
    hash: createHash('sha256').update(content).digest('hex').slice(0, 16),
    symbols,
    dependencies,
    terms: tokenizeRepoText(
      `${path}\n${symbols.join(' ')}\n${dependencies.join(' ')}\n${content.slice(0, MAX_INDEXED_CONTENT_CHARS)}`
    ).slice(0, MAX_TERMS_PER_FILE)
  }
}

export function extractRepoSymbols(content: string): string[] {
  const symbols = new Set<string>()
  const patterns = [
    /\b(?:class|interface|type|enum|function|def|struct|trait)\s+([A-Za-z_$][\w$]*)/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?=[:=])/g,
    /\b(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^\n)]*\)\s*(?:=>|\{)/g
  ]
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[1] && !RESERVED_SYMBOLS.has(match[1])) symbols.add(match[1])
      if (symbols.size >= 200) return [...symbols]
    }
  }
  return [...symbols]
}

function extractDependencies(content: string): string[] {
  const dependencies = new Set<string>()
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /^\s*(?:from|import)\s+([A-Za-z0-9_.]+)/gm
  ]
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) dependencies.add(match[1])
      if (dependencies.size >= 100) return [...dependencies]
    }
  }
  return [...dependencies]
}

export function rankRepoMapEntries(
  entries: readonly RepoMapEntry[],
  query: string,
  limit = 12
): RepoMapSearchResult[] {
  const queryTerms = [...new Set(tokenizeRepoText(query))]
  if (queryTerms.length === 0 || entries.length === 0) return []
  const documentFrequency = new Map<string, number>()
  let totalTerms = 0
  for (const entry of entries) {
    totalTerms += entry.terms.length
    for (const term of new Set(entry.terms)) {
      if (queryTerms.includes(term)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
    }
  }
  const averageLength = Math.max(1, totalTerms / entries.length)
  const normalizedQuery = query.toLowerCase()
  return entries
    .map((entry) => {
      const frequencies = termFrequencies(entry.terms)
      let score = 0
      for (const term of queryTerms) {
        const frequency = frequencies.get(term) ?? 0
        if (frequency === 0) continue
        const docsWithTerm = documentFrequency.get(term) ?? 0
        const inverseFrequency = Math.log(1 + (entries.length - docsWithTerm + 0.5) / (docsWithTerm + 0.5))
        score += inverseFrequency * (frequency * 2.2) /
          (frequency + 1.2 * (0.25 + 0.75 * entry.terms.length / averageLength))
      }
      const matchedSymbols = entry.symbols.filter((symbol) => {
        const symbolTerms = tokenizeRepoText(symbol)
        return symbol.toLowerCase().includes(normalizedQuery) ||
          queryTerms.some((term) => symbolTerms.includes(term))
      })
      if (matchedSymbols.length > 0) score += 4 + matchedSymbols.length
      if (entry.path.toLowerCase().includes(normalizedQuery)) score += 5
      if (entry.recent) score *= 1.15
      return { path: entry.path, score, symbols: matchedSymbols, dependencies: entry.dependencies, recent: entry.recent }
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, Math.max(1, Math.min(50, Math.floor(limit))))
}

function tokenizeRepoText(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter((term) => term.length > 1 && term.length < 80)
}

function termFrequencies(terms: readonly string[]): Map<string, number> {
  const result = new Map<string, number>()
  for (const term of terms) result.set(term, (result.get(term) ?? 0) + 1)
  return result
}

const RESERVED_SYMBOLS = new Set([
  'catch', 'else', 'finally', 'for', 'if', 'return', 'switch', 'while'
])
