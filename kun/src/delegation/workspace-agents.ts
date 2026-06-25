import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SubagentProfileConfig, type SubagentMode, type SubagentToolPolicy } from '../contracts/capabilities.js'

/**
 * Workspace-level agent overlay.
 *
 * Loads `<workspace>/.kun/agents/*.md` and produces a profile map that
 * the delegation runtime overlays on top of (`internal < GUI < workspace`).
 * Frontmatter format:
 *
 *     ---
 *     id: code-reviewer       # optional, defaults to filename stem
 *     name: Code Reviewer
 *     description: One-line "when to use"
 *     mode: subagent          # subagent | primary | all
 *     model: deepseek-chat
 *     providerId: deepseek
 *     toolPolicy: inherit     # readOnly | inherit (default: inherit = follow main agent)
 *     allowedTools: [read, grep]
 *     color: "#3b82f6"
 *     ---
 *     Body becomes the systemPrompt verbatim (kun's base prompt is
 *     prepended unless omit_base_prompt: true).
 *
 * Files with invalid frontmatter or missing required fields are dropped
 * silently so a single broken file doesn't take down delegation.
 */
export type WorkspaceAgentProfile = {
  id: string
  source: 'workspace'
  filePath: string
  profile: SubagentProfileConfig
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export async function loadWorkspaceAgentProfiles(workspace: string): Promise<WorkspaceAgentProfile[]> {
  if (!workspace) return []
  const dir = join(workspace, '.kun', 'agents')
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    if ((error as NodeJS.ErrnoException).code === 'ENOTDIR') return []
    throw error
  }
  const results: WorkspaceAgentProfile[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    const filePath = join(dir, entry)
    try {
      const text = await readFile(filePath, 'utf8')
      const parsed = parseAgentMarkdown(text, entry.replace(/\.md$/i, ''))
      if (parsed) results.push({ ...parsed, filePath, source: 'workspace' })
    } catch {
      // Skip unreadable / malformed files; do not bubble — overlay should
      // never break the parent delegate_task call.
    }
  }
  return results
}

function parseAgentMarkdown(text: string, defaultId: string): { id: string; profile: SubagentProfileConfig } | null {
  const match = FRONTMATTER_RE.exec(text)
  if (!match) return null
  const yamlRaw = match[1] ?? ''
  const body = text.slice(match[0].length).trim()
  const fields = parseSimpleYaml(yamlRaw)
  const id = fields.id?.trim() || defaultId
  if (!id) return null
  const omitBase = boolField(fields, 'omit_base_prompt') === true || boolField(fields, 'omitBasePrompt') === true
  const systemPromptFromBody = body || undefined
  const raw: Record<string, unknown> = {
    ...(fields.name ? { name: fields.name } : {}),
    ...(fields.description ? { description: fields.description } : {}),
    ...(fields.color ? { color: fields.color } : {}),
    mode: normalizeMode(fields.mode),
    ...(fields.model ? { model: fields.model } : {}),
    ...(fields.providerId ? { providerId: fields.providerId } : {}),
    ...(fields.systemPrompt ? { systemPrompt: fields.systemPrompt } : systemPromptFromBody ? { systemPrompt: systemPromptFromBody } : {}),
    ...(fields.promptPreamble ? { promptPreamble: fields.promptPreamble } : {}),
    toolPolicy: normalizeToolPolicy(fields.toolPolicy),
    ...(parseListField(fields, 'allowedTools') ? { allowedTools: parseListField(fields, 'allowedTools') } : {}),
    ...(parseListField(fields, 'blockedTools') ? { blockedTools: parseListField(fields, 'blockedTools') } : {}),
    ...(parseListField(fields, 'blockedMcpServers') ? { blockedMcpServers: parseListField(fields, 'blockedMcpServers') } : {}),
    ...(parseListField(fields, 'blockedSkills') ? { blockedSkills: parseListField(fields, 'blockedSkills') } : {}),
    // Reasoning depth (off|low|medium|high|max). SubagentProfileConfig validates;
    // an invalid value would fail safeParse, so only known values survive.
    ...(fields.reasoningEffort ? { reasoningEffort: fields.reasoningEffort } : {})
  }
  // omit_base_prompt is a hint to the augment strategy; we model it as a
  // marker the runtime can check if it ever needs to. For now we just keep
  // the systemPrompt as-is and let the executor's augment-base behavior
  // append the base prefix.
  void omitBase
  const parsed = SubagentProfileConfig.safeParse(raw)
  if (!parsed.success) return null
  return { id, profile: parsed.data }
}

function normalizeMode(value: string | undefined): SubagentMode {
  if (value === 'primary' || value === 'all') return value
  return 'subagent'
}

function normalizeToolPolicy(value: string | undefined): SubagentToolPolicy {
  // Default follows the main agent (inherit); an overlay must say
  // `toolPolicy: readOnly` explicitly to restrict the child.
  if (value === 'readOnly') return 'readOnly'
  return 'inherit'
}

function boolField(fields: Record<string, string>, key: string): boolean | undefined {
  const raw = fields[key]?.trim().toLowerCase()
  if (raw === 'true' || raw === 'yes') return true
  if (raw === 'false' || raw === 'no') return false
  return undefined
}

function parseListField(fields: Record<string, string>, key: string): string[] | undefined {
  const raw = fields[key]?.trim()
  if (!raw) return undefined
  // Support both inline `[a, b, c]` and comma-separated `a, b, c`.
  const stripped = raw.replace(/^\[/, '').replace(/\]$/, '')
  const items = stripped.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
  return items.length ? items : undefined
}

/**
 * Lean YAML key:value parser. Only supports flat scalars, lists, and
 * double-quoted strings — sufficient for agent frontmatter without pulling
 * in a YAML dependency.
 */
function parseSimpleYaml(raw: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim()
    if (!line || line.startsWith('#')) continue
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key = line.slice(0, colon).trim()
    let value = line.slice(colon + 1).trim()
    if (!key) continue
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
    result[key] = value
  }
  return result
}
