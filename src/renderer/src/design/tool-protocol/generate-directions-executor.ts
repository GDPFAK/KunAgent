import type { DevicePreset } from '../canvas/canvas-types'
import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import {
  defaultDevicePresetForDesignTarget,
  normalizeDesignTarget,
  type DesignContext,
  type DesignTarget
} from '../design-context'
import { useDesignWorkspaceStore } from '../design-workspace-store'
import { applyToActiveDoc } from '../design-workspace-store/helpers'
import {
  defaultDesignArtifactNode,
  type DesignDirection
} from '../design-types'
import { persistArtifactMeta } from '../design-artifact-persistence'
import {
  invocationInputRecord,
  type DesignToolInvocation,
  type DesignToolInvocationResult
} from './protocol-types'
import { latestJournalEntry } from './ops-executor'
import { createGeneratedScreenFrames } from './screen-generation-support'
import { queueGeneratedScreenDraftWrite } from './generate-screen-draft-writer'

type DirectionSpec = {
  name: string
  brief: string
  devicePreset?: DevicePreset
}

function stringInput(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function numberInput(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
}

function defaultDirectionNames(count: number): string[] {
  const names = ['Focused flow', 'Expressive brand', 'Systematic product', 'Editorial story', 'Dense operator']
  return Array.from({ length: count }, (_, index) => names[index] ?? `Direction ${index + 1}`)
}

function designTargetInput(value: unknown): DesignTarget | undefined {
  return value === 'app' || value === 'web' ? normalizeDesignTarget(value) : undefined
}

function devicePresetInput(value: unknown): DevicePreset | undefined {
  return value === 'mobile' || value === 'tablet' || value === 'desktop' ? value : undefined
}

function directionSpecList(input: unknown): DirectionSpec[] {
  const record = invocationInputRecord(input)
  const rawPrompt = stringInput(record?.prompt ?? record?.brief ?? record?.goal)
  const rawDirections = Array.isArray(record?.directions) ? record.directions : null
  if (rawDirections) {
    return rawDirections
      .map((item, index): DirectionSpec | null => {
        if (typeof item === 'string') {
          const name = item.trim()
          return name ? { name, brief: rawPrompt || name } : null
        }
        const itemRecord = invocationInputRecord(item)
        const name = stringInput(itemRecord?.name ?? itemRecord?.title) || `Direction ${index + 1}`
        const brief = stringInput(itemRecord?.brief ?? itemRecord?.prompt ?? itemRecord?.rationale) || rawPrompt || name
        return { name, brief }
      })
      .filter((item): item is DirectionSpec => Boolean(item))
      .slice(0, 6)
  }
  const count = Math.max(1, Math.min(6, Math.round(numberInput(record?.count, 3))))
  return defaultDirectionNames(count).map((name) => ({
    name,
    brief: rawPrompt
      ? `${rawPrompt}\n\nDirection focus: ${name}.`
      : `Explore ${name} as a distinct UI direction.`
  }))
}

function directionInput(input: unknown): {
  specs: DirectionSpec[]
  designContext: DesignContext
} {
  const record = invocationInputRecord(input)
  const workspaceContext = useDesignWorkspaceStore.getState().designContext
  const target = designTargetInput(record?.designTarget ?? record?.target)
  const devicePreset = devicePresetInput(record?.devicePreset ?? record?.viewport) ??
    (target ? defaultDevicePresetForDesignTarget(target) : undefined)
  return {
    specs: directionSpecList(input).map((spec) => ({
      ...spec,
      ...(devicePreset ? { devicePreset } : {})
    })),
    designContext: {
      ...workspaceContext,
      ...(target ? { designTarget: target } : {})
    }
  }
}

function assignDirections(artifactIds: readonly string[], specs: readonly DirectionSpec[]): DesignDirection[] {
  const createdAt = new Date().toISOString()
  const directions = specs.map((spec, index): DesignDirection => ({
    id: `dir_${slug(spec.name) || index + 1}_${createdAt.replace(/[^0-9]/g, '').slice(8, 14)}`,
    name: spec.name,
    status: 'active',
    createdAt
  }))
  const changed = new Set(artifactIds)
  useDesignWorkspaceStore.setState((state) =>
    applyToActiveDoc(state, (artifacts) =>
      artifacts.map((artifact) => {
        const artifactIndex = artifactIds.indexOf(artifact.id)
        if (artifactIndex < 0) return artifact
        return {
          ...artifact,
          direction: directions[artifactIndex],
          node: artifact.node ?? defaultDesignArtifactNode(artifactIndex),
          updatedAt: createdAt
        }
      })
    )
  )
  const state = useDesignWorkspaceStore.getState()
  for (const artifact of state.artifacts) {
    if (changed.has(artifact.id)) persistArtifactMeta(state.workspaceRoot, artifact)
  }
  return directions
}

export function executeGenerateDirectionsInvocation(
  invocation: DesignToolInvocation
): DesignToolInvocationResult {
  const { specs, designContext } = directionInput(invocation.input)
  const { board, result, artifactIds, frameIds, journalEntryChanged } = createGeneratedScreenFrames(
    invocation,
    specs,
    'design.generate_directions'
  )
  const directions = assignDirections(artifactIds, specs.slice(0, artifactIds.length))
  const journalEntry = latestJournalEntry()
  const workspace = useDesignWorkspaceStore.getState()
  const canvas = useCanvasShapeStore.getState().document
  const draftWrites = directions.map((direction, index) => {
    const artifactId = artifactIds[index]
    const frameId = frameIds[index]
    const artifact = workspace.artifacts.find((item) => item.id === artifactId)
    return queueGeneratedScreenDraftWrite({
      workspaceRoot: workspace.workspaceRoot,
      artifact,
      designMdPath: artifact?.designMdPath,
      spec: specs[index] ?? { name: direction.name },
      frame: frameId ? canvas.objects[frameId] : undefined,
      designContext,
      ...(artifactId
        ? {
            onReady: () => useDesignWorkspaceStore.getState().setArtifactPreviewStatus(artifactId, 'ready'),
            onError: () => useDesignWorkspaceStore.getState().setArtifactPreviewStatus(artifactId, 'error')
          }
        : {})
    })
  })

  return {
    ok: result.ok && artifactIds.length > 0,
    toolId: invocation.toolId,
    status: result.ok ? 'applied' : 'partial',
    affectedIds: frameIds,
    errors: result.errors.map((error) => ({ ...error })),
    ...(journalEntryChanged ? { journalEntry } : {}),
    output: {
      boardArtifactId: board.id,
      directions: directions.map((direction, index) => ({
        ...direction,
        artifactId: artifactIds[index],
        frameId: frameIds[index],
        draftWrite: draftWrites[index]
      }))
    },
    summaryLines: [
      `${invocation.toolId}: created ${artifactIds.length} direction frame(s)`,
      `board: ${board.id}`,
      `directions: ${directions.map((direction) => direction.name).join(', ') || 'none'}`,
      `drafts: ${draftWrites.filter((write) => write.status === 'queued').length} queued`
    ]
  }
}
