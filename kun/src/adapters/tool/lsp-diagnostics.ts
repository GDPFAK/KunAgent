import { findLanguageServerForFile } from './lsp-servers.js'
import {
  acquireLspSession,
  lspCloseDocument,
  lspGetDiagnostics,
  lspOpenDocument
} from './lsp-client.js'

export type LspDiagnosticsResult = {
  status: 'ok' | 'not_available' | 'timeout' | 'skipped'
  diagnostics: { message: string; severity: number; source?: string }[]
  serverName: string
  serverKey: string
}

const CODE_FILE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.cts', '.cjs',
  '.py', '.pyi',
  '.rs',
  '.go',
  '.c', '.h', '.cc', '.cpp', '.cxx', '.hh', '.hpp', '.hxx',
  '.json', '.jsonc',
  '.yaml', '.yml'
])

export function isCodeFile(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return CODE_FILE_EXTENSIONS.has(lower) || [...CODE_FILE_EXTENSIONS].some((ext) => lower.endsWith(ext))
}

/**
 * Best-effort LSP diagnostics fetch for the read tool.
 *
 * Returns {@link LspDiagnosticsResult} with a `status` field so callers can
 * distinguish "no errors" from "server not installed" without parsing error
 * messages. Never throws — all failures are mapped to a `status` value.
 */
export async function tryGetLspDiagnostics(
  filePath: string,
  workspaceRoot: string
): Promise<LspDiagnosticsResult> {
  try {
    const server = findLanguageServerForFile(filePath)
    if (!server) {
      return { status: 'skipped', diagnostics: [], serverName: '', serverKey: '' }
    }

    let session
    try {
      session = await acquireLspSession(workspaceRoot, server.key)
    } catch {
      return { status: 'not_available', diagnostics: [], serverName: server.displayName, serverKey: server.key }
    }

    try {
      // Open the document so the server computes diagnostics.
      await lspOpenDocument(session, filePath, '', server.languageIdForFile(filePath))

      const result = await lspGetDiagnostics(session, filePath)
      return {
        status: 'ok',
        diagnostics: (result.diagnostics ?? []) as { message: string; severity: number; source?: string }[],
        serverName: server.displayName,
        serverKey: server.key
      }
    } catch {
      return { status: 'timeout', diagnostics: [], serverName: server.displayName, serverKey: server.key }
    } finally {
      // Close the document but keep the session alive for subsequent lsp tool calls.
      // The server is cleaned up after CLEANUP_DELAY (30s) of inactivity via the
      // reference-counting mechanism in lsp-client.ts.
      try { await lspCloseDocument(session, filePath) } catch { /* ignore */ }
    }
  } catch {
    return { status: 'not_available', diagnostics: [], serverName: '', serverKey: '' }
  }
}

/** Result shape for tryGetLspHover. */
export type LspHoverResult = {
  type: string
  definition?: string
}

/**
 * Best-effort LSP hover info for a file position. Returns the type signature
 * and definition location if available. Never throws.
 */
export async function tryGetLspHover(
  filePath: string,
  line: number,
  workspaceRoot: string
): Promise<LspHoverResult | null> {
  try {
    const server = findLanguageServerForFile(filePath)
    if (!server) return null

    const session = await acquireLspSession(workspaceRoot, server.key)
    try {
      await lspOpenDocument(session, filePath, '', server.languageIdForFile(filePath))
      // lsp-client uses 0-based positions internally; line from grep is 1-based.
      const result = await import('./lsp-client.js').then((m) =>
        m.lspHover(session, filePath, Math.max(0, line - 1), 0)
      )
      const hoverResult = result as { contents?: Array<{ value?: string }> | string } | undefined
      if (!hoverResult) return null

      // Try to extract type info from hover contents.
      const contents = hoverResult.contents
      if (Array.isArray(contents)) {
        const text = contents.map((c) => (typeof c === 'object' ? c.value ?? '' : String(c))).filter(Boolean).join('\n')
        if (text) return { type: text }
      } else if (typeof contents === 'string') {
        return { type: contents }
      }
      return null
    } finally {
      try { await lspCloseDocument(session, filePath) } catch { /* ignore */ }
    }
  } catch {
    return null
  }
}
