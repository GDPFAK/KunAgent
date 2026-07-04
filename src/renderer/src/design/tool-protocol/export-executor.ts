import { buildStitchDesignMarkdown, STITCH_DESIGN_MD_PATH } from '../design-md-compat'
import { buildDesignExportPackage } from './export-package'
import {
  invalidToolResult,
  invocationInputRecord,
  type DesignToolInvocation,
  type DesignToolInvocationResult
} from './protocol-types'
import { readDesignToolState } from './tool-state'

type ExportFormat = 'design-md' | 'graph' | 'summary' | 'package'

function exportFormat(value: unknown): ExportFormat | null {
  if (value === undefined || value === null || value === '') return 'design-md'
  if (value === 'design-md' || value === 'graph' || value === 'summary' || value === 'package') return value
  return null
}

function maybeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function executeDesignExportInvocation(invocation: DesignToolInvocation): DesignToolInvocationResult {
  const record = invocationInputRecord(invocation.input)
  const format = exportFormat(record?.format ?? record?.kind)
  if (!format) {
    return invalidToolResult(invocation, {
      code: 'INVALID_INPUT',
      message: 'design.export format must be one of design-md, graph, summary, or package.'
    })
  }

  const state = readDesignToolState()
  const title = maybeString(record?.title) ?? state.document?.title ?? 'Kun design project'
  const updatedAt = new Date().toISOString()
  const designSystemMdPath = '.kun-design/DESIGN_SYSTEM.md'
  const projectBriefPath = maybeString(record?.projectBriefPath)
  const markdown = buildStitchDesignMarkdown({
    title,
    brief: maybeString(record?.brief),
    designContext: state.designContext,
    designSystem: state.designSystem,
    artifacts: state.artifacts,
    updatedAt,
    designSystemMdPath,
    projectBriefPath
  })
  const pkg = buildDesignExportPackage(state, {
    title,
    brief: maybeString(record?.brief),
    updatedAt,
    designSystemMdPath,
    ...(projectBriefPath ? { projectBriefPath } : {})
  })
  const output =
    format === 'package'
      ? pkg
      : format === 'graph'
      ? { format, graph: state.graph }
      : format === 'summary'
        ? {
            format,
            projectId: state.projectId,
            title,
            counts: pkg.counts,
            resourceCount: pkg.resources.length,
            directionCount: pkg.counts.directions,
            codeBindingCount: pkg.counts.codeBindings
          }
        : {
            format,
            path: STITCH_DESIGN_MD_PATH,
            markdown
          }

  return {
    ok: true,
    toolId: invocation.toolId,
    status: 'ready',
    affectedIds: [],
    errors: [],
    output,
    summaryLines: [
      `${invocation.toolId}: prepared ${format}`,
      `objects: ${Object.keys(state.graph.objects).length}`,
      `directions: ${Object.keys(state.graph.directions).length}`,
      `tokens: ${state.graph.designSystem?.tokenCount ?? 0}`
    ]
  }
}
