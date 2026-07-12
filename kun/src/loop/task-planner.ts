import type { ToolCallLike } from '../ports/tool-host.js'

// ── Types ────────────────────────────────────────────────────────

export interface Task {
  /** Unique identifier for this task. */
  id: string
  /** Target file path relative to workspace root. */
  file: string
  /** Description of what this task involves. */
  description: string
  /** Task IDs that must complete before this one. */
  dependencies: string[]
}

export interface TaskPlan {
  tasks: Task[]
}

// ── Detection helpers ────────────────────────────────────────────

const NEW_PROJECT_PATTERNS = [
  /(?:create|build|set\s*up|start|new|搭建|创建|新建|初始化)\s+(?:a|an|一个)?\s*(?:\w+\s+)?(?:project|app|system|site|blog|api|server|website|平台|系统|项目|应用|站点)/i,
  /(?:写|开发|实现|implement|develop|write)\s+(?:一个)?\s*(?:\w+\s+)?(?:系统|平台|项目|应用|app|system)/i
]

const NEW_MODULE_PATTERNS = [
  /(?:add|add\s*new|新增|添加|增加)\s+(?:a|an|一个)?\s*(?:\w+\s+)?(?:module|feature|route|page|component|功能|模块|页面|组件)/i,
  /(?:创|创建|新建|implement)\s+(?:\w+\s+)?(?:功能|模块|service|controller|route)/i
]

function isNewProject(prompt: string): boolean {
  return NEW_PROJECT_PATTERNS.some((re) => re.test(prompt))
}

function isNewModule(prompt: string): boolean {
  return NEW_MODULE_PATTERNS.some((re) => re.test(prompt))
}

// ── Common file templates ────────────────────────────────────────

const PROJECT_FILES: Record<string, Task[]> = {
  node_express: [
    { id: 'package', file: 'package.json', description: 'Create package.json with dependencies', dependencies: [] },
    { id: 'config', file: '.env', description: 'Create environment config', dependencies: [] },
    { id: 'entry', file: 'src/app.js', description: 'Create Express app entry point', dependencies: [] },
    { id: 'models', file: 'src/models/', description: 'Create data model files', dependencies: [] },
    { id: 'routes', file: 'src/routes/', description: 'Create API route handlers', dependencies: ['models'] },
    { id: 'views', file: 'src/views/', description: 'Create view templates (if applicable)', dependencies: [] },
    { id: 'test', file: 'tests/', description: 'Create test files', dependencies: ['routes'] }
  ],
  default: [
    { id: 'readme', file: 'README.md', description: 'Create project README', dependencies: [] },
    { id: 'main', file: 'index.js', description: 'Create main entry point', dependencies: [] },
    { id: 'lib', file: 'lib/', description: 'Create library modules', dependencies: ['main'] },
    { id: 'test', file: 'test/', description: 'Create test files', dependencies: ['main'] }
  ]
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Analyze a user prompt and produce a task plan for file creation.
 *
 * Returns `null` for simple requests (bug fix, single file change) —
 * the agent runs normally without decomposition.
 */
export function planExecution(prompt: string): TaskPlan | null {
  if (!isNewProject(prompt) && !isNewModule(prompt)) {
    return null
  }

  // Detect project type from tech keywords
  const projectType = detectProjectType(prompt)
  const template = PROJECT_FILES[projectType] ?? PROJECT_FILES.default

  return {
    tasks: template.map((t) => ({ ...t }))
  }
}

/**
 * Format a TaskPlan into a human-readable string for context injection.
 */
export function formatTaskPlan(plan: TaskPlan): string {
  if (plan.tasks.length === 0) return ''

  const maxDepth = Math.max(...plan.tasks.map((t) => t.dependencies.length))
  const phases: string[][] = []

  // Group by dependency depth
  for (let depth = 0; depth <= maxDepth; depth++) {
    const phase = plan.tasks.filter(
      (t) => t.dependencies.length === depth
    )
    if (phase.length > 0) phases.push(phase.map((t) => t.file))
  }

  const lines: string[] = ['[Task Plan — Parallel File Creation]']
  lines.push(
    'This request involves creating multiple files. Independent files can be created in parallel.'
  )
  lines.push('')

  for (let i = 0; i < phases.length; i++) {
    const prefix = i === 0 ? 'Independent (can be parallel):' : `Phase ${i + 1} (after dependencies resolved):`
    lines.push(`  ${prefix}`)
    for (const file of phases[i]) {
      lines.push(`    - ${file}`)
    }
    lines.push('')
  }

  lines.push(
    'Tip: generate code for multiple independent files in a single response,',
    'then use parallel tool calls to write them simultaneously.'
  )

  return lines.join('\n')
}

/**
 * Check which tasks from the plan have been completed based on tool calls.
 * Returns true when all tasks are done.
 */
export function isPlanComplete(
  plan: TaskPlan,
  toolCalls: readonly ToolCallLike[]
): boolean {
  if (plan.tasks.length === 0) return true

  const createdFiles = new Set<string>()
  for (const call of toolCalls) {
    if (call.toolName === 'write' || call.toolName === 'edit') {
      const path = call.arguments.path ?? call.arguments.relative_path
      if (typeof path === 'string' && path.trim()) {
        createdFiles.add(path.trim())
      }
    }
  }

  return plan.tasks.every((t) => createdFiles.has(t.file))
}

// ── Internals ────────────────────────────────────────────────────

function detectProjectType(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (
    lower.includes('express') ||
    lower.includes('node') ||
    lower.includes('javascript') ||
    lower.includes('js') ||
    lower.includes('博客') ||
    lower.includes('api') ||
    lower.includes('server')
  ) {
    return 'node_express'
  }
  return 'default'
}
