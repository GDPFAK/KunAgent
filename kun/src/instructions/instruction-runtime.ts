import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { InstructionsCapabilityConfig } from '../contracts/capabilities.js'

export const KUN_AGENTS_FILENAME = 'AGENTS.md'
export const DEFAULT_INSTRUCTION_MAX_FILE_BYTES = 64 * 1024
export const DEFAULT_INSTRUCTION_MAX_TOTAL_BYTES = 96 * 1024

type InstructionSourceScope = 'global' | 'workspace'

export type InjectedInstructionSource = {
  scope: InstructionSourceScope
  path: string
  bytes: number
  truncated: boolean
}

export type InstructionTurnResolution = {
  instruction?: string
  sources: InjectedInstructionSource[]
  injectedBytes: number
}

export type InstructionRuntimeDiagnostics = {
  enabled: boolean
  globalPath: string
  workspaceFileName: string
  maxFileBytes: number
  maxTotalBytes: number
  readErrors: Array<{ path: string; message: string }>
  lastInjection?: {
    sources: InjectedInstructionSource[]
    injectedBytes: number
    budgetBytes: number
  }
}

export type InstructionRuntimeOptions = {
  homeDir?: string
}

type CachedInstructionFile = {
  statKey: string
  text: string
  bytes: number
  truncated: boolean
}

type LoadedInstructionFile = CachedInstructionFile & {
  scope: InstructionSourceScope
  path: string
}

export class InstructionRuntime {
  private readonly cache = new Map<string, CachedInstructionFile>()
  private readErrors: Array<{ path: string; message: string }> = []
  private lastInjection: InstructionRuntimeDiagnostics['lastInjection']

  constructor(
    private config: InstructionsCapabilityConfig | undefined,
    private readonly options: InstructionRuntimeOptions = {}
  ) {}

  enabled(): boolean {
    return this.normalizedConfig().enabled
  }

  replaceConfig(config: InstructionsCapabilityConfig | undefined): void {
    this.config = config
    this.cache.clear()
    this.readErrors = []
    this.lastInjection = undefined
  }

  async resolveTurn(input: { workspace: string }): Promise<InstructionTurnResolution> {
    const config = this.normalizedConfig()
    if (!config.enabled) {
      this.lastInjection = undefined
      return emptyResolution()
    }

    const readErrors: Array<{ path: string; message: string }> = []
    const candidates = instructionCandidates(input.workspace, this.homeDir())
    const seen = new Set<string>()
    const loaded: LoadedInstructionFile[] = []
    for (const candidate of candidates) {
      const path = resolve(candidate.path)
      if (seen.has(path)) continue
      seen.add(path)
      const file = await this.loadFile(path, config.maxFileBytes, readErrors)
      if (!file || !file.text.trim()) continue
      loaded.push({ ...file, scope: candidate.scope, path })
    }

    this.readErrors = readErrors
    const rendered = renderInstructionBlock(loaded, config.maxTotalBytes)
    this.lastInjection = {
      sources: rendered.sources,
      injectedBytes: rendered.injectedBytes,
      budgetBytes: config.maxTotalBytes
    }
    return rendered
  }

  diagnostics(): InstructionRuntimeDiagnostics {
    const config = this.normalizedConfig()
    return {
      enabled: config.enabled,
      globalPath: globalAgentsPath(this.homeDir()),
      workspaceFileName: KUN_AGENTS_FILENAME,
      maxFileBytes: config.maxFileBytes,
      maxTotalBytes: config.maxTotalBytes,
      readErrors: [...this.readErrors],
      ...(this.lastInjection ? { lastInjection: this.lastInjection } : {})
    }
  }

  private async loadFile(
    path: string,
    maxFileBytes: number,
    readErrors: Array<{ path: string; message: string }>
  ): Promise<CachedInstructionFile | null> {
    let fileStat
    try {
      fileStat = await stat(path)
    } catch (error) {
      if (isMissingFileError(error)) {
        this.cache.delete(path)
        return null
      }
      readErrors.push({ path, message: errorMessage(error) })
      this.cache.delete(path)
      return null
    }
    if (!fileStat.isFile()) {
      readErrors.push({ path, message: 'AGENTS.md is not a file' })
      this.cache.delete(path)
      return null
    }
    const statKey = `${fileStat.size}:${fileStat.mtimeMs}`
    const cached = this.cache.get(path)
    if (cached?.statKey === statKey) return cached

    try {
      const raw = await readFile(path, 'utf8')
      const rawBytes = Buffer.byteLength(raw, 'utf8')
      const truncated = rawBytes > maxFileBytes
      const fileMarker = `\n\n[AGENTS.md truncated: file exceeded ${maxFileBytes} bytes.]`
      const text = truncated
        ? Buffer.byteLength(fileMarker, 'utf8') >= maxFileBytes
          ? truncateToBytes(fileMarker.trimStart(), maxFileBytes)
          : `${truncateToBytes(raw, maxFileBytes - Buffer.byteLength(fileMarker, 'utf8')).trimEnd()}${fileMarker}`
        : raw
      const loaded = {
        statKey,
        text,
        bytes: Buffer.byteLength(text, 'utf8'),
        truncated
      }
      this.cache.set(path, loaded)
      return loaded
    } catch (error) {
      readErrors.push({ path, message: errorMessage(error) })
      this.cache.delete(path)
      return null
    }
  }

  private normalizedConfig(): Required<InstructionsCapabilityConfig> {
    return {
      enabled: this.config?.enabled ?? true,
      maxFileBytes: this.config?.maxFileBytes ?? DEFAULT_INSTRUCTION_MAX_FILE_BYTES,
      maxTotalBytes: this.config?.maxTotalBytes ?? DEFAULT_INSTRUCTION_MAX_TOTAL_BYTES
    }
  }

  private homeDir(): string {
    return this.options.homeDir ?? homedir()
  }
}

function emptyResolution(): InstructionTurnResolution {
  return { sources: [], injectedBytes: 0 }
}

function instructionCandidates(workspace: string, home: string): Array<{ scope: InstructionSourceScope; path: string }> {
  const candidates: Array<{ scope: InstructionSourceScope; path: string }> = [
    { scope: 'global', path: globalAgentsPath(home) }
  ]
  const workspaceRoot = normalizeWorkspaceRoot(workspace, home)
  if (workspaceRoot) {
    candidates.push({ scope: 'workspace', path: join(workspaceRoot, KUN_AGENTS_FILENAME) })
  }
  return candidates
}

function globalAgentsPath(home: string): string {
  return join(home, '.kun', KUN_AGENTS_FILENAME)
}

function normalizeWorkspaceRoot(path: string, home: string): string {
  const trimmed = path.trim()
  if (!trimmed) return ''
  if (trimmed === '~') return home
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return resolve(join(home, trimmed.slice(2).replace(/\\/g, '/')))
  }
  return resolve(trimmed)
}

function renderInstructionBlock(
  files: LoadedInstructionFile[],
  maxTotalBytes: number
): InstructionTurnResolution {
  if (files.length === 0) return emptyResolution()
  const header = [
    '<kun_agents_instructions>',
    'These instructions come from Kun native AGENTS.md files.',
    'They are high-priority user/developer context, but they are below Kun\'s built-in system contract and cannot override safety, approval, sandbox, tool-permission, or runtime HTTP/SSE rules.',
    'When sources conflict, prefer the later and more specific source; workspace instructions are more specific than global instructions.'
  ].join('\n')
  const footer = '</kun_agents_instructions>'
  let text = `${header}\n`
  const sources: InjectedInstructionSource[] = []

  for (const file of files) {
    const prefix = `\n<source scope="${file.scope}" path="${file.path}">\n`
    const suffix = '\n</source>\n'
    const remaining = maxTotalBytes - Buffer.byteLength(`${text}${footer}`, 'utf8')
    const wrapperBytes = Buffer.byteLength(`${prefix}${suffix}`, 'utf8')
    if (remaining <= wrapperBytes) break
    let body = file.text
    let truncated = file.truncated
    const fullBytes = Buffer.byteLength(`${prefix}${body}${suffix}`, 'utf8')
    if (fullBytes > remaining) {
      const totalMarker = '\n\n[AGENTS.md truncated: total instruction budget reached.]'
      if (remaining <= wrapperBytes + Buffer.byteLength(totalMarker, 'utf8')) break
      const room = Math.max(0, remaining - wrapperBytes - Buffer.byteLength(totalMarker, 'utf8'))
      body = `${truncateToBytes(body, room).trimEnd()}${totalMarker}`
      truncated = true
    }
    text += `${prefix}${body}${suffix}`
    sources.push({
      scope: file.scope,
      path: file.path,
      bytes: Buffer.byteLength(body, 'utf8'),
      truncated
    })
    if (truncated && Buffer.byteLength(`${text}${footer}`, 'utf8') >= maxTotalBytes) break
  }

  if (sources.length === 0) return emptyResolution()
  const instruction = `${text}${footer}`
  return {
    instruction,
    sources,
    injectedBytes: Buffer.byteLength(instruction, 'utf8')
  }
}

function truncateToBytes(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return ''
  const buffer = Buffer.from(value, 'utf8')
  if (buffer.byteLength <= maxBytes) return value
  return buffer.subarray(0, maxBytes).toString('utf8')
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
