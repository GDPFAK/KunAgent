import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { existsSync } from 'node:fs'

// ── Types ────────────────────────────────────────────────────────

export interface ProjectContext {
  /** Merged content of CLAUDE.md + AGENT.md (with section headers). */
  content: string
  /** SHA256 hex digest of `content`. */
  hash: string
}

export interface ProjectContextFileStatus {
  claude: 'generated' | 'exists_unchanged' | 'exists_modified' | 'skipped'
  agent: 'generated' | 'exists_fresh' | 'exists_stale_regenerated' | 'skipped'
}

// ── File names ───────────────────────────────────────────────────

const CLAUDE_MD = 'CLAUDE.md'
const AGENT_MD = 'AGENT.md'
const KUN_DIR = '.kun'
const CLAUDE_HASH_FILE = join(KUN_DIR, '.claude_hash')

/**
 * Read CLAUDE.md and AGENT.md from the workspace root, merge them,
 * and return the combined content + hash.
 *
 * Silently returns empty content when neither file exists.
 * This is fast: only two file reads, no directory scanning.
 */
export async function readProjectContext(workspace: string): Promise<ProjectContext> {
  const parts: string[] = []

  const claudePath = join(workspace, CLAUDE_MD)
  const agentPath = join(workspace, AGENT_MD)

  if (existsSync(claudePath)) {
    const content = await readFile(claudePath, 'utf8')
    parts.push(`[Project Context from CLAUDE.md]\n${content.trim()}`)
  }

  if (existsSync(agentPath)) {
    const content = await readFile(agentPath, 'utf8')
    parts.push(`[Project Context from AGENT.md]\n${content.trim()}`)
  }

  const content = parts.join('\n\n')
  const hash = content ? createHash('sha256').update(content, 'utf8').digest('hex') : ''
  return { content, hash }
}

/**
 * Ensure CLAUDE.md and AGENT.md exist in the workspace.
 *
 * - **CLAUDE.md**: generated only when missing. Once generated, its
 *   content hash is saved to `.kun/.claude_hash`; if the file is later
 *   edited by the user (hash mismatch) it is **never** overwritten.
 * - **AGENT.md**: generated when missing.  Regeneration when the
 *   project changes is handled separately via `refreshAgentMd()`.
 *
 * This function is intentionally lightweight when files already exist:
 * it only does `existsSync` checks + two file reads, no directory scan.
 */
export async function ensureProjectContextFiles(
  workspace: string
): Promise<ProjectContextFileStatus> {
  const status: ProjectContextFileStatus = {
    claude: 'skipped',
    agent: 'skipped'
  }

  if (!workspace || !existsSync(workspace)) return status

  await mkdir(join(workspace, KUN_DIR), { recursive: true })

  // ── CLAUDE.md ──────────────────────────────────────────────
  const claudePath = join(workspace, CLAUDE_MD)
  if (!existsSync(claudePath)) {
    const content = await generateClaudeMd(workspace)
    await writeFile(claudePath, content, 'utf8')
    const hash = createHash('sha256').update(content, 'utf8').digest('hex')
    await writeFile(join(workspace, CLAUDE_HASH_FILE), hash, 'utf8')
    status.claude = 'generated'
  } else {
    // Check if the user has modified it (hash mismatch with our record)
    const existingContent = await readFile(claudePath, 'utf8')
    const existingHash = createHash('sha256').update(existingContent, 'utf8').digest('hex')
    const recordedHash = await readHashFile(join(workspace, CLAUDE_HASH_FILE))
    if (recordedHash === null) {
      status.claude = 'exists_modified'
    } else if (existingHash === recordedHash) {
      status.claude = 'exists_unchanged'
    } else {
      status.claude = 'exists_modified'
    }
  }

    // ── AGENT.md ───────────────────────────────────────────────
  const agentPath = join(workspace, AGENT_MD)

  if (!existsSync(agentPath)) {
    // First encounter: scan workspace and generate
    const fresh = await generateAgentMd(workspace)
    await writeFile(agentPath, fresh, 'utf8')
    status.agent = 'generated'
  }
  // AGENT.md already exists: trust it. No re-scan needed here.
  // Regeneration happens via refreshAgentMd() called after file mutations.

  return status
}


// ── Content generators ───────────────────────────────────────────

async function generateClaudeMd(workspace: string): Promise<string> {
  const lines: string[] = []
  lines.push('# CLAUDE.md — 项目说明')
  lines.push('')
  lines.push('> 此文件由 Kun 自动生成，你可根据项目需要修改完善。')
  lines.push('')

  // Try to extract project name and description from common config files
  const pkgJsonPath = join(workspace, 'package.json')
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgJsonPath, 'utf8'))
      if (pkg.name) lines.push(`## 项目名称\n\n${pkg.name}\n`)
      if (pkg.description) lines.push(`## 项目描述\n\n${pkg.description}\n`)
      if (pkg.dependencies) {
        const techs = [...new Set(Object.keys(pkg.dependencies).map((d) => d.split('/')[0]!))]
        if (techs.length > 0) {
          lines.push(`## 技术栈\n\n- ${techs.join('\n- ')}\n`)
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // Try Cargo.toml
  const cargoPath = join(workspace, 'Cargo.toml')
  if (!existsSync(pkgJsonPath) && existsSync(cargoPath)) {
    try {
      const cargo = await readFile(cargoPath, 'utf8')
      const nameMatch = cargo.match(/^name\s*=\s*"([^"]+)"/m)
      const descMatch = cargo.match(/^description\s*=\s*"([^"]+)"/m)
      if (nameMatch) lines.push(`## 项目名称\n\n${nameMatch[1]}\n`)
      if (descMatch) lines.push(`## 项目描述\n\n${descMatch[1]}\n`)
    } catch { /* ignore */ }
  }

  // Try pyproject.toml
  const pyprojectPath = join(workspace, 'pyproject.toml')
  if (!existsSync(pkgJsonPath) && !existsSync(cargoPath) && existsSync(pyprojectPath)) {
    try {
      const py = await readFile(pyprojectPath, 'utf8')
      const nameMatch = py.match(/^name\s*=\s*"([^"]+)"/m)
      const descMatch = py.match(/^description\s*=\s*"([^"]+)"/m)
      if (nameMatch) lines.push(`## 项目名称\n\n${nameMatch[1]}\n`)
      if (descMatch) lines.push(`## 项目描述\n\n${descMatch[1]}\n`)
    } catch { /* ignore */ }
  }

  // Try README.md
  const readmePath = join(workspace, 'README.md')
  if (existsSync(readmePath)) {
    try {
      const readme = await readFile(readmePath, 'utf8')
      const paragraphs = readme
        .replace(/^#\s+.*$/m, '')
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
      if (paragraphs.length > 0) {
        lines.push(`## README 摘要\n\n${paragraphs[0]!.slice(0, 500)}\n`)
      }
    } catch { /* ignore */ }
  }

  lines.push('## 架构决策')
  lines.push('')
  lines.push('（请记录项目的关键架构决策、技术选型理由和注意事项。）')
  lines.push('')

  lines.push('## 编码约定')
  lines.push('')
  lines.push('（请根据项目实际情况补充编码规范、命名约定和代码风格。）')
  lines.push('')

  lines.push('## 功能说明')
  lines.push('')
  lines.push('（请描述项目的主要功能模块和各模块的职责边界。）')
  lines.push('')

  return lines.join('\n')
}

async function generateAgentMd(workspace: string): Promise<string> {
  const lines: string[] = []
  lines.push('# AGENT.md — 项目结构快照')
  lines.push('')
  lines.push('> 此文件由 Kun 自动维护，反映当前项目状态。')
  lines.push('> 此文件由 Kun 自动维护，反映当前项目状态。请勿手动编辑，编辑内容会被下次自动刷新覆盖。')
  lines.push('')

  // Project name and tech stack
  const pkgJsonPath = join(workspace, 'package.json')
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgJsonPath, 'utf8'))
      lines.push('## 项目信息')
      if (pkg.name) lines.push(`- 名称: ${pkg.name}`)
      if (pkg.description) lines.push(`- 描述: ${pkg.description}`)
      const deps = [...new Set([
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {})
      ].map((d) => d.split('/')[0]!))]
      if (deps.length > 0) lines.push(`- 技术栈: ${deps.join(', ')}`)
      lines.push('')
    } catch { /* ignore */ }
  }

  // Directory tree
  lines.push('## 目录结构')
  lines.push('```')
  const treeLines = await buildDirectoryTree(workspace, workspace, 2)
  lines.push(...treeLines)
  lines.push('```')
  lines.push('')

  // Build & run commands
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgJsonPath, 'utf8'))
      const scripts = pkg.scripts as Record<string, string> | undefined
      if (scripts) {
        lines.push('## 构建 & 运行')
        for (const [name, cmd] of Object.entries(scripts)) {
          if (['dev', 'build', 'test', 'start', 'lint', 'typecheck'].includes(name)) {
            lines.push(`- \`npm run ${name}\` — ${cmd}`)
          }
        }
        lines.push('')
      }
    } catch { /* ignore */ }
  }

  return lines.join('\n')
}

async function buildDirectoryTree(
  root: string,
  current: string,
  maxDepth: number,
  prefix = ''
): Promise<string[]> {
  if (maxDepth <= 0) return [`${prefix}└── ...`]

  const result: string[] = []
  try {
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(current, { withFileTypes: true })

    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'target')
      .sort((a, b) => a.name.localeCompare(b.name))

    const files = entries
      .filter((e) => e.isFile())
      .sort((a, b) => a.name.localeCompare(b.name))

    const all = [...dirs, ...files]
    for (let i = 0; i < all.length; i++) {
      const entry = all[i]!
      const isLast = i === all.length - 1
      const connector = isLast ? '└── ' : '├── '

      if (entry.isDirectory()) {
        result.push(`${prefix}${connector}${entry.name}/`)
        const subPrefix = prefix + (isLast ? '    ' : '│   ')
        const sub = await buildDirectoryTree(root, join(current, entry.name), maxDepth - 1, subPrefix)
        result.push(...sub)
      } else {
        result.push(`${prefix}${connector}${entry.name}`)
      }
    }
  } catch { /* ignore permission errors */ }

  return result
}

// ── Helpers ──────────────────────────────────────────────────────

async function readHashFile(path: string): Promise<string | null> {
  try {
    return (await readFile(path, 'utf8')).trim()
  } catch {
    return null
  }
}

/**
 * Force-regenerate AGENT.md after file mutations (write/edit/delete).
 * Call this after any file_change tool completes so the directory tree
 * in AGENT.md stays current.
 */
export async function refreshAgentMd(workspace: string): Promise<void> {
  if (!workspace) return
  const agentPath = join(workspace, AGENT_MD)
  if (!existsSync(agentPath)) return
  const fresh = await generateAgentMd(workspace)
  await writeFile(agentPath, fresh, 'utf8')
}

/**
 * Determine if a workspace has existing CLAUDE.md or AGENT.md files.
 */
export function hasProjectContextFiles(workspace: string): boolean {
  if (!workspace) return false
  return existsSync(join(workspace, CLAUDE_MD)) || existsSync(join(workspace, AGENT_MD))
}
