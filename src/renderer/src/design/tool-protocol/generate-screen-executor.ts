import type { DevicePreset } from '../canvas/canvas-types'
import { useCanvasShapeStore } from '../canvas/canvas-shape-store'
import {
  defaultDevicePresetForDesignTarget,
  normalizeDesignTarget,
  type DesignContext,
  type DesignTarget
} from '../design-context'
import { useDesignWorkspaceStore } from '../design-workspace-store'
import { queueGeneratedScreenDraftWrite } from './generate-screen-draft-writer'
import { latestJournalEntry } from './ops-executor'
import {
  invocationInputRecord,
  type DesignToolInvocation,
  type DesignToolInvocationResult
} from './protocol-types'
import { createGeneratedScreenFrames, type GeneratedScreenSpec } from './screen-generation-support'

function stringInput(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function positiveNumberInput(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function finiteNumberInput(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function titleFromText(value: string): string {
  const collapsed = value.replace(/\s+/g, ' ').trim()
  if (!collapsed) return ''
  return collapsed.length > 48 ? `${collapsed.slice(0, 45)}...` : collapsed
}

function designTargetInput(value: unknown): DesignTarget | undefined {
  return value === 'app' || value === 'web' ? normalizeDesignTarget(value) : undefined
}

function devicePresetInput(value: unknown): DevicePreset | undefined {
  return value === 'mobile' || value === 'tablet' || value === 'desktop' ? value : undefined
}

function screenInputFromInvocation(invocation: DesignToolInvocation): {
  spec: GeneratedScreenSpec
  designContext: DesignContext
} {
  const record = invocationInputRecord(invocation.input)
  const prompt = stringInput(record?.prompt ?? record?.goal ?? record?.description)
  const brief = stringInput(record?.brief) || prompt
  const explicitName = stringInput(record?.name ?? record?.title ?? record?.screenName)
  const workspaceContext = useDesignWorkspaceStore.getState().designContext
  const target = designTargetInput(record?.designTarget ?? record?.target)
  const devicePreset = devicePresetInput(record?.devicePreset ?? record?.viewport) ??
    (target ? defaultDevicePresetForDesignTarget(target) : undefined)
  const width = positiveNumberInput(record?.width)
  const height = positiveNumberInput(record?.height)
  const x = finiteNumberInput(record?.x)
  const y = finiteNumberInput(record?.y)

  return {
    spec: {
      name: explicitName || titleFromText(brief || prompt) || 'Generated screen',
      ...(brief ? { brief } : {}),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(x !== undefined ? { x } : {}),
      ...(y !== undefined ? { y } : {}),
      ...(devicePreset ? { devicePreset } : {})
    },
    designContext: {
      ...workspaceContext,
      ...(target ? { designTarget: target } : {})
    }
  }
}

export function executeGenerateScreenInvocation(
  invocation: DesignToolInvocation
): DesignToolInvocationResult {
  const { spec, designContext } = screenInputFromInvocation(invocation)
  const { board, result, artifactIds, frameIds, journalEntryChanged } = createGeneratedScreenFrames(
    invocation,
    [spec],
    'design.generate_screen'
  )
  const journalEntry = latestJournalEntry()
  const artifactId = artifactIds[0]
  const frameId = frameIds[0]
  const artifact = artifactId
    ? useDesignWorkspaceStore.getState().artifacts.find((item) => item.id === artifactId)
    : undefined
  const frame = frameId ? useCanvasShapeStore.getState().document.objects[frameId] : undefined
  const workspace = useDesignWorkspaceStore.getState()
  const draftWrite = queueGeneratedScreenDraftWrite({
    workspaceRoot: workspace.workspaceRoot,
    artifact,
    designMdPath: artifact?.designMdPath,
    spec,
    frame,
    designContext,
    ...(artifactId
      ? {
          onReady: () => useDesignWorkspaceStore.getState().setArtifactPreviewStatus(artifactId, 'ready'),
          onError: () => useDesignWorkspaceStore.getState().setArtifactPreviewStatus(artifactId, 'error')
        }
      : {})
  })
  const ok = result.ok && Boolean(artifactId && frameId)

  return {
    ok,
    toolId: invocation.toolId,
    status: ok ? 'applied' : 'partial',
    affectedIds: frameIds,
    errors: result.errors.map((error) => ({ ...error })),
    ...(journalEntryChanged ? { journalEntry } : {}),
    output: {
      boardArtifactId: board.id,
      artifactId,
      frameId,
      screen: {
        name: artifact?.title ?? spec.name,
        brief: spec.brief,
        artifactId,
        frameId
      },
      draftWrite
    },
    summaryLines: [
      `${invocation.toolId}: created ${artifactId ? 1 : 0} screen frame`,
      `board: ${board.id}`,
      `screen: ${artifact?.title ?? spec.name}`
    ]
  }
}
