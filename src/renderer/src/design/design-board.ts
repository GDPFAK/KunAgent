import { artifactDesignMdPath } from './design-artifact-persistence'
import {
  createEmptyDocument,
  createHtmlFrameShape,
  isHtmlFrame,
  shapeBounds,
  type CanvasDocument,
  type CanvasShape,
  type Rect
} from './canvas/canvas-types'
import {
  BOARD_HTML_FRAME_MIN_HEIGHT,
  BOARD_HTML_FRAME_MIN_WIDTH,
  layoutRectsInViewport,
  placeRectInViewportAvoiding,
  rectsAlmostEqual
} from './canvas/canvas-placement'
import { useCanvasSelectionStore } from './canvas/canvas-selection-store'
import { useCanvasShapeStore } from './canvas/canvas-shape-store'
import { useCanvasViewportStore } from './canvas/canvas-viewport-store'
import { serializeCanvasDocument } from './canvas/canvas-persistence'
import { createDesignArtifactId, defaultDesignArtifactNode, type DesignArtifact, type DesignArtifactNode } from './design-types'
import { useDesignWorkspaceStore } from './design-workspace-store'

export type SyncHtmlArtifactsToBoardResult = {
  document: CanvasDocument
  addedFrameIds: string[]
  updatedFrameIds: string[]
}

export type CreateScreenFrameArtifactResult = {
  artifactId: string
  relativePath: string
  designMdPath: string
  shape: CanvasShape
}

export function findDesignBoardArtifact(
  artifacts: readonly DesignArtifact[]
): (DesignArtifact & { kind: 'canvas' }) | null {
  const boards = artifacts.filter((artifact): artifact is DesignArtifact & { kind: 'canvas' } =>
    artifact.kind === 'canvas'
  )
  if (boards.length === 0) return null
  return [...boards].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt)
  )[0] ?? null
}

function cloneDocument(doc: CanvasDocument): CanvasDocument {
  return {
    ...doc,
    objects: Object.fromEntries(
      Object.entries(doc.objects).map(([id, shape]) => [id, { ...shape, children: [...shape.children] }])
    )
  }
}

function linkedHtmlFrames(doc: CanvasDocument): Map<string, CanvasShape> {
  const frames = new Map<string, CanvasShape>()
  for (const shape of Object.values(doc.objects)) {
    if (shape && isHtmlFrame(shape) && shape.htmlArtifactId) frames.set(shape.htmlArtifactId, shape)
  }
  return frames
}

function nodeRect(node: DesignArtifactNode): Rect {
  return { x: node.x, y: node.y, width: node.width, height: node.height }
}

function artifactNodeIsDefault(node: DesignArtifactNode | undefined, index: number): boolean {
  if (!node) return false
  if (rectsAlmostEqual(nodeRect(node), defaultDesignArtifactNode(index))) return true
  // Persisted preview-card defaults can survive artifact reordering. Treat any
  // of the legacy default grid slots as implicit so they don't shrink board
  // screens to the old 420x340 card size.
  for (let i = 0; i < 60; i += 1) {
    if (i !== index && rectsAlmostEqual(nodeRect(node), defaultDesignArtifactNode(i))) return true
  }
  return false
}

function shouldUseArtifactNode(node: DesignArtifactNode | undefined, index: number): node is DesignArtifactNode {
  return Boolean(node && !artifactNodeIsDefault(node, index))
}

function frameNodePatch(shape: CanvasShape): DesignArtifactNode | null {
  if (!shape.htmlArtifactId || shape.width < BOARD_HTML_FRAME_MIN_WIDTH || shape.height < BOARD_HTML_FRAME_MIN_HEIGHT) {
    return null
  }
  return {
    x: Math.round(shape.x),
    y: Math.round(shape.y),
    width: Math.round(shape.width),
    height: Math.round(shape.height),
    sizeMode: 'manual',
    viewMode: 'preview'
  }
}

function frameMatchesNode(shape: CanvasShape, node: DesignArtifactNode): boolean {
  return rectsAlmostEqual(
    { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
    nodeRect(node)
  )
}

export function syncHtmlArtifactsToBoardDocument(
  doc: CanvasDocument,
  artifacts: readonly DesignArtifact[]
): SyncHtmlArtifactsToBoardResult {
  const root = doc.objects[doc.rootId]
  if (!root) return { document: doc, addedFrameIds: [], updatedFrameIds: [] }

  const htmlArtifacts = artifacts.filter((artifact) => artifact.kind === 'html')
  const addedFrameIds: string[] = []
  const updatedFrameIds: string[] = []
  let next: CanvasDocument | null = null
  const framesByArtifactId = linkedHtmlFrames(doc)
  const autoPlaceArtifacts = htmlArtifacts.filter((artifact, index) =>
    !framesByArtifactId.has(artifact.id) && !shouldUseArtifactNode(artifact.node, index)
  )
  const autoRects = layoutRectsInViewport(
    autoPlaceArtifacts.map(() => ({ width: 1280, height: 800 })),
    useCanvasViewportStore.getState().vbox
  )
  const occupiedAutoRects: Rect[] = Array.from(framesByArtifactId.values()).map((shape) => ({
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height
  }))
  const placedAutoRects: Rect[] = []
  let autoIndex = 0

  htmlArtifacts.forEach((artifact, index) => {
    const existing = framesByArtifactId.get(artifact.id)
    const customNode = shouldUseArtifactNode(artifact.node, index) ? artifact.node : null
    if (existing) {
      const patch: Partial<CanvasShape> = {}
      const nextName = artifact.title || existing.name
      if (existing.name !== nextName) patch.name = nextName
      if (customNode && !frameMatchesNode(existing, customNode)) {
        Object.assign(patch, nodeRect(customNode))
      }
      if (Object.keys(patch).length > 0) {
        if (!next) next = cloneDocument(doc)
        next.objects[existing.id] = { ...next.objects[existing.id], ...patch }
        updatedFrameIds.push(existing.id)
      }
      return
    }

    if (!next) next = cloneDocument(doc)
    const nextRoot = next.objects[next.rootId]
    if (!nextRoot) return

    const rect = customNode
      ? nodeRect(customNode)
      : occupiedAutoRects.length === 0
        ? autoRects[autoIndex++] ?? { x: 0, y: 0, width: 1280, height: 800 }
        : placeRectInViewportAvoiding(
            { width: 1280, height: 800 },
            useCanvasViewportStore.getState().vbox,
            [...occupiedAutoRects, ...placedAutoRects]
          )
    const frame = createHtmlFrameShape(artifact.title || 'Screen', rect.x, rect.y, artifact.id, 'desktop')
    frame.width = rect.width
    frame.height = rect.height
    frame.name = artifact.title || frame.name
    if (customNode) occupiedAutoRects.push({ x: frame.x, y: frame.y, width: frame.width, height: frame.height })
    else placedAutoRects.push({ x: frame.x, y: frame.y, width: frame.width, height: frame.height })

    next.objects[frame.id] = frame
    next.objects[next.rootId] = {
      ...nextRoot,
      children: [...nextRoot.children, frame.id]
    }
    addedFrameIds.push(frame.id)
  })

  return { document: next ?? doc, addedFrameIds, updatedFrameIds }
}

export function syncHtmlFrameNodesToArtifacts(doc: CanvasDocument): void {
  const designStore = useDesignWorkspaceStore.getState()
  for (const shape of Object.values(doc.objects)) {
    if (!shape || !isHtmlFrame(shape) || !shape.htmlArtifactId) continue
    const artifact = designStore.artifacts.find((item) => item.id === shape.htmlArtifactId)
    if (!artifact) continue
    const patch = frameNodePatch(shape)
    if (!patch) continue
    const nextNode = { ...patch, viewMode: artifact.node?.viewMode ?? patch.viewMode }
    const current = artifact.node
    if (
      current &&
      rectsAlmostEqual(nodeRect(current), nodeRect(nextNode)) &&
      (current.viewMode ?? 'preview') === (nextNode.viewMode ?? 'preview') &&
      current.sizeMode === nextNode.sizeMode
    ) {
      continue
    }
    designStore.updateArtifactNode(artifact.id, nextNode)
  }
}

export async function ensureDesignBoardArtifact(
  workspaceRoot: string
): Promise<(DesignArtifact & { kind: 'canvas' }) | null> {
  const trimmedRoot = workspaceRoot.trim()
  if (!trimmedRoot) return null

  const store = useDesignWorkspaceStore.getState()
  const existing = findDesignBoardArtifact(store.artifacts)
  if (existing) {
    if (store.activeArtifactId !== existing.id) store.setActiveArtifact(existing.id)
    return existing
  }

  const docId = store.ensureActiveDocument()
  const createdAt = new Date().toISOString()
  const artifactId = createDesignArtifactId()
  const relativePath = `.kun-design/${docId}/${artifactId}/canvas.json`
  const artifact: DesignArtifact & { kind: 'canvas' } = {
    id: artifactId,
    kind: 'canvas',
    title: 'Design board',
    relativePath,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${artifactId}-v1`, relativePath, createdAt, summary: '' }]
  }

  if (typeof window.kunGui?.writeWorkspaceFile === 'function') {
    const write = await window.kunGui
      .writeWorkspaceFile({
        path: relativePath,
        workspaceRoot: trimmedRoot,
        content: serializeCanvasDocument(createEmptyDocument())
      })
      .catch((error: unknown) => ({
        ok: false as const,
        message: error instanceof Error ? error.message : String(error)
      }))
    if (!write.ok) useDesignWorkspaceStore.getState().setFileError(write.message)
  }

  useDesignWorkspaceStore.getState().upsertArtifact(artifact)
  return artifact
}

export function createScreenFrameArtifact(options: {
  boardArtifactId: string
  brief?: string
  title?: string
  width?: number
  height?: number
  x?: number
  y?: number
}): CreateScreenFrameArtifactResult {
  const state = useDesignWorkspaceStore.getState()
  const docId = state.ensureActiveDocument()
  const createdAt = new Date().toISOString()
  const artifactId = createDesignArtifactId()
  const relativePath = `.kun-design/${docId}/${artifactId}/v1.html`
  const designMdPath = artifactDesignMdPath(docId, artifactId)
  const brief = options.brief?.trim() ?? ''
  const titleSource = options.title?.trim() || brief || 'Screen'
  const title = titleSource.length > 48 ? `${titleSource.slice(0, 48)}...` : titleSource
  const width = Math.max(240, options.width ?? 1280)
  const height = Math.max(180, options.height ?? 800)
  const vbox = useCanvasViewportStore.getState().vbox
  const occupied = Object.values(useCanvasShapeStore.getState().document.objects)
    .filter((shape): shape is CanvasShape => Boolean(shape) && shape.visible !== false && isHtmlFrame(shape))
    .map(shapeBounds)
  const rect = placeRectInViewportAvoiding({ width, height }, vbox, occupied)
  const x = options.x ?? rect.x
  const y = options.y ?? rect.y

  state.upsertArtifact({
    id: artifactId,
    kind: 'html',
    title,
    relativePath,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${artifactId}-v1`, relativePath, createdAt, summary: brief }],
    designMdPath,
    previewStatus: 'pending',
    node: { x, y, width, height, sizeMode: 'manual', viewMode: 'preview' }
  })
  useDesignWorkspaceStore.getState().setActiveArtifact(options.boardArtifactId)

  const shape = createHtmlFrameShape(title, x, y, artifactId, 'desktop')
  shape.width = width
  shape.height = height
  useCanvasShapeStore.getState().addShape(shape)
  useCanvasSelectionStore.getState().select([shape.id])
  useCanvasViewportStore.getState().setActiveTool('select')

  return { artifactId, relativePath, designMdPath, shape }
}
