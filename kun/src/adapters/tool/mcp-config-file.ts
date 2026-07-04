import { readFile, watch } from 'node:fs'
import type { McpCapabilityConfig, McpServerConfig } from '../../contracts/capabilities.js'
import { redactSecretText } from '../../config/secret-redaction.js'

/**
 * MCP config file parse result.
 * Supports two formats:
 *   1. { servers: {...}, search: {...} }  (flat MCP section)
 *   2. { capabilities: { mcp: { servers: {...} } } }  (full kun config)
 */
export type McpConfigFileParseResult =
  | { ok: true; config: McpCapabilityConfig; servers: Record<string, McpServerConfig> }
  | { ok: false; errors: McpConfigError[] }

export type McpConfigError = {
  message: string
  line?: number
  column?: number
  path?: string
  severity: 'error' | 'warning'
}

/**
 * Read and parse an MCP JSON config file with line-number-aware Zod validation.
 */
export async function readMcpConfigFile(filePath: string): Promise<McpConfigFileParseResult> {
  let rawText: string
  try {
    rawText = await readFileUtf8(filePath)
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === 'ENOENT') {
      return {
        ok: true,
        config: { enabled: false, servers: {} } as McpCapabilityConfig,
        servers: {},
      }
    }
    return {
      ok: false,
      errors: [{
        message: `Failed to read MCP config file: ${errorMessage(error)}`,
        severity: 'error',
      }],
    }
  }
  return parseMcpConfigText(rawText, filePath)
}

/**
 * Parse MCP config from raw text. Exported for testing and GUI live editor.
 */
export function parseMcpConfigText(
  rawText: string,
  filePath = '<config>'
): McpConfigFileParseResult {
  const trimmed = rawText.trim()
  if (trimmed === '') {
    return {
      ok: true,
      config: { enabled: false, servers: {} } as McpCapabilityConfig,
      servers: {},
    }
  }

  // Step 1: Parse JSON with position tracking
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (error) {
    const pos = extractJsonErrorPosition(error, trimmed)
    return {
      ok: false,
      errors: [{
        message: `JSON parse error in ${filePath}: ${errorMessage(error)}`,
        line: pos.line,
        column: pos.column,
        severity: 'error',
      }],
    }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      errors: [{
        message: `MCP config must be a JSON object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`,
        line: 1,
        severity: 'error',
      }],
    }
  }

  // Step 2: Extract MCP section (supports flat and capabilities.mcp formats)
  const root = parsed as Record<string, unknown>
  const rawMcpSection = extractMcpSection(root)

  // Step 3: Validate transport/trust inference
  const mcpSection = normalizeMcpConfigSection(rawMcpSection)

  // Step 4: Validate structure and return
  const servers = extractServers(mcpSection)
  const config = {
    enabled: (mcpSection as Record<string, unknown>)?.enabled !== false,
    servers,
    search: (mcpSection as Record<string, unknown>)?.search ?? { enabled: false },
  } as unknown as McpCapabilityConfig

  return { ok: true, config, servers }
}

/**
 * Watch an MCP config file for changes. Returns a stop function.
 * Debounces rapid changes (editor saves).
 */
export function watchMcpConfigFile(
  filePath: string,
  onChange: (result: McpConfigFileParseResult) => void,
  options: { debounceMs?: number } = {}
): () => void {
  const debounceMs = options.debounceMs ?? 300
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const trigger = (): void => {
    if (stopped) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      if (stopped) return
      void readMcpConfigFile(filePath).then(onChange).catch(() => undefined)
    }, debounceMs)
  }

  try {
    const watcher = watch(filePath, { persistent: false }, (eventType) => {
      if (eventType === 'change' || eventType === 'rename') trigger()
    })
    watcher.on('error', () => { /* non-fatal */ })

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      watcher.close()
    }
  } catch {
    // File may not exist yet; return no-op stop function
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileUtf8(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile(path, 'utf8', (err, data) => { if (err) reject(err); else resolve(data) })
  })
}

function errorMessage(error: unknown): string {
  return redactSecretText(error instanceof Error ? error.message : String(error))
}

function extractJsonErrorPosition(
  error: unknown,
  source: string
): { line?: number; column?: number } {
  const message = error instanceof Error ? error.message : String(error)
  const posMatch = message.match(/at position (\d+)/i)
  if (posMatch) return positionToLineColumn(source, Number.parseInt(posMatch[1], 10))
  const lineMatch = message.match(/line (\d+)/i)
  const colMatch = message.match(/column (\d+)/i)
  if (lineMatch) return { line: Number.parseInt(lineMatch[1], 10), column: colMatch ? Number.parseInt(colMatch[1], 10) : undefined }
  return {}
}

function positionToLineColumn(text: string, position: number): { line: number; column: number } {
  const safePos = Math.max(0, Math.min(position, text.length))
  const lines = text.slice(0, safePos).split('\n')
  return { line: lines.length, column: lines[lines.length - 1].length + 1 }
}

function extractMcpSection(root: Record<string, unknown>): unknown {
  // Flat format: top-level servers
  if (root.servers !== undefined) {
    return {
      enabled: root.enabled !== false,
      servers: root.servers,
      search: root.search ?? {},
      ...(root.timeouts ? { timeouts: root.timeouts } : {}),
    }
  }
  // Full kun config format: capabilities.mcp
  const capabilities = isRecord(root.capabilities) ? root.capabilities : {}
  const mcp = isRecord(capabilities.mcp) ? capabilities.mcp : {}
  if (mcp.servers !== undefined) return mcp
  return { enabled: false, servers: {} }
}

function normalizeMcpConfigSection(raw: unknown): unknown {
  if (!isRecord(raw)) return raw
  const next: Record<string, unknown> = { ...raw }
  if (isRecord(raw.servers)) {
    const normalizedServers: Record<string, unknown> = {}
    for (const [serverId, server] of Object.entries(raw.servers)) {
      normalizedServers[serverId] = normalizeMcpServerConfig(server)
    }
    next.servers = normalizedServers
  }
  return next
}

function normalizeMcpServerConfig(raw: unknown): unknown {
  if (!isRecord(raw)) return raw
  const out: Record<string, unknown> = { ...raw }
  const command = typeof raw.command === 'string' ? raw.command : undefined
  const url = typeof raw.url === 'string' ? raw.url : undefined
  const trustedWorkspaceRoots = Array.isArray(raw.trustedWorkspaceRoots)
    ? raw.trustedWorkspaceRoots
    : undefined

  // Remove disabled alias before Zod validation
  delete out.disabled

  // Infer transport from command/url
  if (raw.transport === undefined) {
    if (command) out.transport = 'stdio'
    else if (url) out.transport = 'streamable-http'
  }

  // Infer trustScope from trustedWorkspaceRoots
  if (raw.trustScope === undefined) {
    out.trustScope = trustedWorkspaceRoots && trustedWorkspaceRoots.length > 0
      ? 'workspace' : 'user'
  }

  // Handle disabled alias
  if (raw.disabled === true && raw.enabled === undefined) out.enabled = false
  if (out.enabled === undefined) out.enabled = true

  return out
}

function extractServers(mcpSection: unknown): Record<string, McpServerConfig> {
  if (!isRecord(mcpSection)) return {}
  const rawServers = mcpSection.servers
  if (!isRecord(rawServers)) return {}
  const result: Record<string, McpServerConfig> = {}
  for (const [id, server] of Object.entries(rawServers)) {
    if (isRecord(server)) {
      result[id] = server as unknown as McpServerConfig
    }
  }
  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
