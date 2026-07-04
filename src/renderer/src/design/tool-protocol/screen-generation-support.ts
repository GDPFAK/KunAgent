import { createLinkedHtmlScreen } from '../canvas/screen-lifecycle'
import { getScreenCreationFactory, setScreenCreationFactory } from '../canvas/screen-artifact-bridge'
import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import { executeOps } from '../canvas/shape-ops'
import type { DevicePreset } from '../canvas/canvas-types'
import { findDesignBoardArtifact } from '../design-board'
import { useDesignWorkspaceStore } from '../design-workspace-store'
import { createDesignArtifactId, type DesignArtifact } from '../design-types'
import { labelForInvocation, type DesignToolInvocation } from './protocol-types'
import { latestJournalEntry } from './ops-executor'

export type GeneratedScreenSpec = {
  name: string
  brief?: string
  width?: number
  height?: number
  x?: number
  y?: number
  devicePreset?: DevicePreset
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function ensureBoardArtifact(): DesignArtifact & { kind: 'canvas' } {
  const store = useDesignWorkspaceStore.getState()
  const existing = findDesignBoardArtifact(store.artifacts)
  if (existing) return existing
  const docId = store.ensureActiveDocument()
  const createdAt = new Date().toISOString()
  const artifactId = createDesignArtifactId()
  const relativePath = `.kun-design/${docId}/${artifactId}/canvas.json`
  const board: DesignArtifact & { kind: 'canvas' } = {
    id: artifactId,
    kind: 'canvas',
    title: 'Design board',
    relativePath,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${artifactId}-v1`, relativePath, createdAt, summary: '' }]
  }
  useDesignWorkspaceStore.getState().upsertArtifact(board)
  return board
}

export function withScreenFactory<T>(boardArtifactId: string, run: () => T): T {
  const existing = getScreenCreationFactory()
  if (existing) return run()
  setScreenCreationFactory((request) => {
    const created = createLinkedHtmlScreen({
      boardArtifactId,
      name: request.name,
      brief: request.brief,
      x: request.x,
      y: request.y,
      width: request.width,
      height: request.height,
      targetFrameId: request.targetFrameId,
      devicePreset: request.devicePreset,
      preparePreview: request.preparePreview,
      sizeMode: request.sizeMode
    })
    return created ? { artifactId: created.artifactId, shapeId: created.shape.id } : null
  })
  try {
    return run()
  } finally {
    setScreenCreationFactory(null)
  }
}

export function createGeneratedScreenFrames(
  invocation: DesignToolInvocation,
  specs: readonly GeneratedScreenSpec[],
  fallbackLabel: string
): {
  board: DesignArtifact & { kind: 'canvas' }
  result: ReturnType<typeof executeOps>
  artifactIds: string[]
  frameIds: string[]
  journalEntryChanged: boolean
} {
  const board = ensureBoardArtifact()
  const beforeJournalId = latestJournalEntry()?.id
  const addScreenSpecs = specs.map((spec) => ({
    name: spec.name,
    ...(spec.brief ? { brief: spec.brief } : {}),
    ...(finiteNumber(spec.x) ? { x: spec.x } : {}),
    ...(finiteNumber(spec.y) ? { y: spec.y } : {}),
    ...(finiteNumber(spec.width) ? { width: spec.width } : {}),
    ...(finiteNumber(spec.height) ? { height: spec.height } : {}),
    ...(spec.devicePreset ? { devicePreset: spec.devicePreset } : {})
  }))
  const result = withScreenFactory(board.id, () =>
    executeOps(
      [{
        op: 'add-screens',
        specs: addScreenSpecs
      }],
      labelForInvocation(invocation, fallbackLabel)
    )
  )
  const doc = useCanvasShapeStore.getState().document
  const artifactIds = result.affectedIds
    .map((id) => doc.objects[id]?.htmlArtifactId)
    .filter((id): id is string => Boolean(id))
  const journalEntry = latestJournalEntry()
  return {
    board,
    result,
    artifactIds,
    frameIds: result.affectedIds,
    journalEntryChanged: Boolean(journalEntry && journalEntry.id !== beforeJournalId)
  }
}
