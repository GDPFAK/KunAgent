import type { WorkflowV1 } from './app-settings-types'
import { normalizeWorkflow } from './app-settings-workflow'

/** Portable Create Loop document (DSV = "Deep loop Schema Version"). */
export type WorkflowDslV1 = {
  dsv: 1
  kind: 'workflow'
  app: string
  exportedAt: string
  workflow: WorkflowV1
}

/** Blank out secret-typed env values so exported files never carry credentials. */
function stripSecrets(workflow: WorkflowV1): WorkflowV1 {
  return {
    ...workflow,
    env: workflow.env.map((entry) => (entry.type === 'secret' ? { ...entry, value: '' } : entry))
  }
}

/**
 * Snapshot a workflow into a portable document: secrets blanked, run history and
 * volatile scheduling/status fields dropped, disabled by default.
 */
export function exportWorkflowDsl(workflow: WorkflowV1, app: string, exportedAt: string): WorkflowDslV1 {
  const clean = stripSecrets(workflow)
  return {
    dsv: 1,
    kind: 'workflow',
    app,
    exportedAt,
    workflow: {
      ...clean,
      enabled: false,
      callableByAgent: false,
      lastRunAt: '',
      nextRunAt: '',
      lastStatus: 'idle',
      lastMessage: '',
      runs: []
    }
  }
}

export function serializeWorkflowDsl(workflow: WorkflowV1, app: string, exportedAt: string): string {
  return JSON.stringify(exportWorkflowDsl(workflow, app, exportedAt), null, 2)
}

export type WorkflowImportResult =
  | { ok: true; workflow: WorkflowV1 }
  | { ok: false; error: 'invalid-json' | 'unsupported' | 'empty' }

/**
 * Parse + validate a DSL document into a fully-normalized workflow. The caller is
 * responsible for assigning a fresh top-level id and a name collision suffix.
 */
export function parseWorkflowDsl(text: string, now: string): WorkflowImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'invalid-json' }
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'unsupported' }
  const doc = parsed as Partial<WorkflowDslV1> & { nodes?: unknown }
  // Accept either a wrapped DSL document or a bare workflow object.
  const raw =
    doc.kind === 'workflow' && doc.workflow && typeof doc.workflow === 'object'
      ? (doc.workflow as Partial<WorkflowV1>)
      : Array.isArray(doc.nodes)
        ? (parsed as Partial<WorkflowV1>)
        : null
  if (!raw) return { ok: false, error: 'unsupported' }
  const normalized = normalizeWorkflow(raw, 0, now)
  if (normalized.nodes.length === 0) return { ok: false, error: 'empty' }
  return {
    ok: true,
    workflow: {
      ...normalized,
      enabled: false,
      callableByAgent: false,
      lastRunAt: '',
      nextRunAt: '',
      lastStatus: 'idle',
      lastMessage: '',
      runs: []
    }
  }
}
