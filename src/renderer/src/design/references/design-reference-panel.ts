import { isDirectImageUrl } from '../canvas/canvas-image-source'
import type { CanvasDocument, CanvasShape } from '../canvas/canvas-types'
import { isHtmlFrame } from '../canvas/canvas-types'
import type { DesignArtifact, DesignIntentMode } from '../design-types'

export type DesignReferenceImageSource = 'workspace' | 'remote' | 'inline' | 'session'

export type DesignReferenceImageItem = {
  id: string
  name: string
  imageUrl: string
  source: DesignReferenceImageSource
  width: number
  height: number
  parentName?: string
  active: boolean
}

export type DesignReferenceScreenItem = {
  id: string
  title: string
  relativePath: string
  frameId?: string
  designMdPath?: string
  directionName?: string
  role?: DesignArtifact['role']
  prototypeLinkCount: number
  active: boolean
}

export type DesignReferenceAction = {
  id: 'use-reference-context'
  labelKey: string
  detailKey: string
  intentMode: DesignIntentMode
  prompt: string
  disabledReasonKey?: string
}

export type DesignReferencePanelModel = {
  images: DesignReferenceImageItem[]
  screens: DesignReferenceScreenItem[]
  action: DesignReferenceAction
  imageCount: number
  screenCount: number
  noteCount: number
  designMdCount: number
  workspaceImageCount: number
  selectedCount: number
  totalCount: number
}

export type BuildDesignReferencePanelModelInput = {
  artifacts: readonly DesignArtifact[]
  doc: CanvasDocument
  selectedIds?: ReadonlySet<string>
}

function imageSource(url: string): DesignReferenceImageSource {
  if (!isDirectImageUrl(url)) return 'workspace'
  if (/^data:/i.test(url)) return 'inline'
  if (/^blob:/i.test(url)) return 'session'
  return 'remote'
}

function selectedHtmlArtifactIds(doc: CanvasDocument, selectedIds: ReadonlySet<string> | undefined): Set<string> {
  const ids = new Set<string>()
  if (!selectedIds) return ids
  for (const id of selectedIds) {
    const shape = doc.objects[id]
    if (shape && isHtmlFrame(shape) && shape.htmlArtifactId) ids.add(shape.htmlArtifactId)
  }
  return ids
}

function visibleHtmlFrames(doc: CanvasDocument): Map<string, CanvasShape> {
  const frames = new Map<string, CanvasShape>()
  for (const shape of Object.values(doc.objects)) {
    if (!shape || shape.visible === false || !isHtmlFrame(shape) || !shape.htmlArtifactId) continue
    frames.set(shape.htmlArtifactId, shape)
  }
  return frames
}

function imageItems(doc: CanvasDocument, selectedIds: ReadonlySet<string> | undefined): DesignReferenceImageItem[] {
  const selected = selectedIds ?? new Set<string>()
  return Object.values(doc.objects)
    .filter((shape): shape is CanvasShape => Boolean(shape))
    .filter((shape) => shape.type === 'image' && shape.visible !== false && Boolean(shape.imageUrl?.trim()))
    .map((shape) => {
      const url = shape.imageUrl!.trim()
      const parent = shape.parentId ? doc.objects[shape.parentId] : undefined
      return {
        id: shape.id,
        name: shape.name || 'Image',
        imageUrl: url,
        source: imageSource(url),
        width: shape.width,
        height: shape.height,
        ...(parent && parent.id !== doc.rootId ? { parentName: parent.name } : {}),
        active: selected.has(shape.id)
      }
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
}

function screenItems(
  artifacts: readonly DesignArtifact[],
  doc: CanvasDocument,
  selectedIds: ReadonlySet<string> | undefined
): DesignReferenceScreenItem[] {
  const frames = visibleHtmlFrames(doc)
  const activeArtifactIds = selectedHtmlArtifactIds(doc, selectedIds)
  return artifacts
    .filter((artifact) => artifact.kind === 'html')
    .map((artifact) => {
      const frame = frames.get(artifact.id)
      return {
        id: artifact.id,
        title: artifact.title,
        relativePath: artifact.relativePath,
        ...(frame ? { frameId: frame.id } : {}),
        ...(artifact.designMdPath ? { designMdPath: artifact.designMdPath } : {}),
        ...(artifact.direction?.name ? { directionName: artifact.direction.name } : {}),
        ...(artifact.role ? { role: artifact.role } : {}),
        prototypeLinkCount: artifact.prototypeLinks?.length ?? 0,
        active: activeArtifactIds.has(artifact.id)
      }
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || a.title.localeCompare(b.title))
}

function noteCount(doc: CanvasDocument): number {
  return Object.values(doc.objects).filter((shape) => shape?.agentNote && !shape.agentNote.resolved).length
}

function formatImageLine(item: DesignReferenceImageItem): string {
  const size = `${Math.round(item.width)}x${Math.round(item.height)}`
  const parent = item.parentName ? ` in ${item.parentName}` : ''
  return `- ${item.name} (${item.source}, ${size}${parent}): ${item.imageUrl}`
}

function formatScreenLine(item: DesignReferenceScreenItem): string {
  const parts = [
    item.relativePath,
    item.designMdPath ? `DESIGN.md=${item.designMdPath}` : '',
    item.directionName ? `direction=${item.directionName}` : '',
    item.role ? `role=${item.role}` : '',
    item.prototypeLinkCount ? `${item.prototypeLinkCount} prototype link(s)` : ''
  ].filter(Boolean)
  return `- ${item.title}: ${parts.join(' · ')}`
}

function actionPrompt(model: Omit<DesignReferencePanelModel, 'action'>): string {
  const images = model.images.slice(0, 8).map(formatImageLine)
  const screens = model.screens.slice(0, 8).map(formatScreenLine)
  return [
    'Use the current project memory while continuing this design.',
    `Reference context: ${model.imageCount} image(s), ${model.screenCount} screen artifact(s), ${model.designMdCount} DESIGN.md note(s), ${model.noteCount} open canvas note(s), ${model.selectedCount} selected reference(s).`,
    images.length > 0 ? 'Reference images:' : 'Reference images: none.',
    ...images,
    screens.length > 0 ? 'Screen artifacts:' : 'Screen artifacts: none.',
    ...screens,
    '',
    'Preserve visual decisions that are already established by these references. Reuse workspace image paths instead of inventing new assets when they fit the request. Cite relevant DESIGN.md paths or screen titles in your reasoning, then mutate the canvas through validated design.ops so the operation journal remains replayable.'
  ].join('\n')
}

export function buildDesignReferencePanelModel({
  artifacts,
  doc,
  selectedIds
}: BuildDesignReferencePanelModelInput): DesignReferencePanelModel {
  const images = imageItems(doc, selectedIds)
  const screens = screenItems(artifacts, doc, selectedIds)
  const openNoteCount = noteCount(doc)
  const selectedCount = images.filter((item) => item.active).length + screens.filter((item) => item.active).length
  const model = {
    images,
    screens,
    imageCount: images.length,
    screenCount: screens.length,
    noteCount: openNoteCount,
    designMdCount: screens.filter((item) => Boolean(item.designMdPath)).length,
    workspaceImageCount: images.filter((item) => item.source === 'workspace').length,
    selectedCount,
    totalCount: images.length + screens.length + openNoteCount
  }
  return {
    ...model,
    action: {
      id: 'use-reference-context',
      labelKey: 'designReferencesUse',
      detailKey: 'designReferencesUseDetail',
      intentMode: 'modify',
      prompt: actionPrompt(model),
      ...(model.totalCount > 0 ? {} : { disabledReasonKey: 'designReferencesNeedsContext' })
    }
  }
}
