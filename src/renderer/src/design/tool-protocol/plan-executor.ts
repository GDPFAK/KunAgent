import { summarizeAgentNotes } from '../agent-notes/agent-note-shapes'
import { summarizeCanvasOperationJournal } from '../graph/canvas-operation-journal'
import type { DesignToolInvocation, DesignToolInvocationResult } from './protocol-types'
import { readDesignToolState } from './tool-state'
import { buildDesignPlanStrategy, type PlanCounts } from './plan-strategy'

function countGraphObjectsByKind(objects: ReturnType<typeof readDesignToolState>['graph']['objects'], kind: string): number {
  return Object.values(objects).filter((object) => object.kind === kind).length
}

function planCounts(): PlanCounts {
  const state = readDesignToolState()
  const bindings = state.canvasDocument.codeBindings ?? []
  const notes = summarizeAgentNotes(state.canvasDocument, 1000)
  return {
    objectCount: Object.keys(state.graph.objects).length,
    frameCount: countGraphObjectsByKind(state.graph.objects, 'frame'),
    htmlFrameCount: countGraphObjectsByKind(state.graph.objects, 'html-frame'),
    runningAppFrameCount: countGraphObjectsByKind(state.graph.objects, 'running-app-frame'),
    directionCount: state.directionManager.activeCount,
    tokenCount: state.graph.designSystem?.tokenCount ?? 0,
    componentCount: state.graph.designSystem?.componentCount ?? 0,
    activeBindingCount: bindings.filter((binding) => binding.status === 'active').length,
    staleBindingCount: bindings.filter((binding) => binding.status === 'stale').length,
    missingBindingCount: bindings.filter((binding) => binding.status === 'missing').length,
    unresolvedNoteCount: notes.filter((note) => !note.resolved).length,
    journalEntryCount: state.canvasDocument.operationJournal?.length ?? 0
  }
}

export function executeDesignPlanInvocation(invocation: DesignToolInvocation): DesignToolInvocationResult {
  const state = readDesignToolState()
  const counts = planCounts()
  const strategy = buildDesignPlanStrategy(counts, state.designContext)
  const recentJournal = summarizeCanvasOperationJournal(state.canvasDocument, 5)
  const directions = state.directionManager.directions.map((direction) => ({
    id: direction.id,
    name: direction.name,
    status: direction.status,
    screenCount: direction.screenCount,
    scorecard: direction.scorecard
      ? {
          readiness: direction.scorecard.readiness,
          score: direction.scorecard.score,
          implementationCost: direction.scorecard.implementationCost,
          risks: direction.scorecard.risks
        }
      : undefined
  }))
  return {
    ok: true,
    toolId: invocation.toolId,
    status: 'ready',
    affectedIds: [],
    errors: [],
    output: {
      projectId: state.projectId,
      title: state.document?.title ?? 'Untitled design board',
      counts,
      directions,
      recentJournal,
      nextTools: strategy.nextTools,
      strategy
    },
    summaryLines: [
      `${invocation.toolId}: ${counts.objectCount} graph object(s), ${counts.directionCount} direction(s)`,
      `screens: ${counts.htmlFrameCount} html, ${counts.runningAppFrameCount} running app`,
      `system: ${counts.tokenCount} token(s), ${counts.componentCount} component(s)`,
      `mode: ${strategy.mode}`,
      `next: ${strategy.nextTools.join(' -> ')}`
    ]
  }
}
