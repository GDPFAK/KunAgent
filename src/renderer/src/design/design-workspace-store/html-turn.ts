import { defaultPreviewNodeSizeForDesignTarget, normalizeDesignTarget } from '../design-context'
import {
  artifactDesignMdPath,
  artifactDesignMdPathOf,
  artifactDirPath,
  persistArtifactMeta
} from '../design-artifact-persistence'
import {
  createDesignArtifactId,
  currentDesignArtifactVersion,
  defaultDesignArtifactNode
} from '../design-types'
import type { DesignArtifact } from '../design-types'
import type { DesignWorkspaceState } from '../design-workspace-store-types'
import { applyToActiveDoc } from './helpers'

type SetDesignWorkspaceState = (
  partial:
    | Partial<DesignWorkspaceState>
    | ((state: DesignWorkspaceState) => Partial<DesignWorkspaceState>)
) => void

type PrepareHtmlTurnOptions = {
  forceNew?: boolean
  artifactId?: string
  activate?: boolean
  reusePendingInitial?: boolean
}

type PrepareHtmlTurnArgs = {
  brief: string
  options?: PrepareHtmlTurnOptions
  get: () => DesignWorkspaceState
  set: SetDesignWorkspaceState
  persistIndex: () => void
}

type PreparedHtmlTurn = {
  artifactId: string
  relativePath: string
  basePath?: string
  designMdPath: string
}

function createHtmlArtifactTitle(text: string): string {
  return text.length > 48 ? `${text.slice(0, 48)}...` : text || 'Untitled design'
}

function buildInitialHtmlArtifact(
  docId: string,
  artifactId: string,
  text: string,
  createdAt: string,
  index: number,
  designTarget: DesignWorkspaceState['designContext']['designTarget']
): DesignArtifact {
  const relativePath = `${artifactDirPath(docId, artifactId)}/v1.html`
  const designMdPath = artifactDesignMdPath(docId, artifactId)
  return {
    id: artifactId,
    kind: 'html',
    title: createHtmlArtifactTitle(text),
    relativePath,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${artifactId}-v1`, relativePath, createdAt, summary: text }],
    designMdPath,
    previewStatus: 'pending',
    node: {
      ...defaultDesignArtifactNode(index),
      ...defaultPreviewNodeSizeForDesignTarget(normalizeDesignTarget(designTarget ?? 'web'))
    }
  }
}

export function prepareDesignHtmlTurn({
  brief,
  options = {},
  get,
  set,
  persistIndex
}: PrepareHtmlTurnArgs): PreparedHtmlTurn {
  const text = brief.trim()
  const docId = get().ensureActiveDocument()
  const state = get()
  const active = state.artifacts.find((item) => item.id === state.activeArtifactId) ?? null
  const target = options.artifactId
    ? state.artifacts.find((item) => item.id === options.artifactId) ?? null
    : active
  const activeHtml = !options.forceNew && target?.kind === 'html' ? target : null
  const createdAt = new Date().toISOString()

  if (
    activeHtml &&
    options.reusePendingInitial &&
    activeHtml.previewStatus === 'pending' &&
    activeHtml.versions.length === 1 &&
    activeHtml.versions[0]?.relativePath === activeHtml.relativePath
  ) {
    const designMdPath = activeHtml.designMdPath ?? artifactDesignMdPathOf(activeHtml.relativePath)
    set((state) =>
      applyToActiveDoc(state, (artifacts) =>
        artifacts.map((item) =>
          item.id === activeHtml.id
            ? {
                ...item,
                updatedAt: createdAt,
                designMdPath,
                previewStatus: 'pending' as const,
                versions: item.versions.map((version) =>
                  version.id === activeHtml.versions[0]?.id ? { ...version, summary: text } : version
                )
              }
            : item
        )
      )
    )
    if (options.activate !== false) get().setActiveArtifact(activeHtml.id)
    const updated = get().artifacts.find((item) => item.id === activeHtml.id)
    if (updated) persistArtifactMeta(get().workspaceRoot, updated)
    persistIndex()
    return { artifactId: activeHtml.id, relativePath: activeHtml.relativePath, designMdPath }
  }

  if (activeHtml) {
    const versionN = activeHtml.versions.length + 1
    const dir = activeHtml.relativePath.slice(0, activeHtml.relativePath.lastIndexOf('/'))
    const relativePath = `${dir}/v${versionN}.html`
    const designMdPath = activeHtml.designMdPath ?? `${dir}/DESIGN.md`
    get().addArtifactVersion(activeHtml.id, {
      id: `${activeHtml.id}-v${versionN}`,
      relativePath,
      createdAt,
      summary: text
    })
    if (options.activate !== false) get().setActiveArtifact(activeHtml.id)
    return { artifactId: activeHtml.id, relativePath, basePath: activeHtml.relativePath, designMdPath }
  }

  const artifactId = createDesignArtifactId()
  const artifact = buildInitialHtmlArtifact(
    docId,
    artifactId,
    text,
    createdAt,
    state.artifacts.length,
    state.designContext.designTarget
  )
  get().upsertArtifact(artifact)
  if (options.activate === false) set({ activeArtifactId: state.activeArtifactId })
  return {
    artifactId,
    relativePath: artifact.relativePath,
    designMdPath: artifact.designMdPath ?? artifactDesignMdPath(docId, artifactId)
  }
}

export async function duplicateHtmlArtifact(
  artifactId: string,
  get: () => DesignWorkspaceState
): Promise<void> {
  const state = get()
  const source = state.artifacts.find((item) => item.id === artifactId)
  const workspaceRoot = state.workspaceRoot
  if (
    !source ||
    source.kind !== 'html' ||
    !workspaceRoot ||
    typeof window.kunGui?.readWorkspaceFile !== 'function' ||
    typeof window.kunGui?.writeWorkspaceFile !== 'function'
  ) {
    return
  }

  const read = await window.kunGui
    .readWorkspaceFile({ path: source.relativePath, workspaceRoot })
    .catch(() => null)
  if (!read || !read.ok) return

  const docId = get().ensureActiveDocument()
  const createdAt = new Date().toISOString()
  const copyId = createDesignArtifactId()
  const relativePath = `${artifactDirPath(docId, copyId)}/v1.html`
  const designMdPath = artifactDesignMdPath(docId, copyId)
  const write = await window.kunGui
    .writeWorkspaceFile({ path: relativePath, workspaceRoot, content: read.content })
    .catch(() => null)
  if (!write || !write.ok) return

  const sourceDesignMdPath = source.designMdPath ?? artifactDesignMdPathOf(source.relativePath)
  const designNotes = await window.kunGui
    .readWorkspaceFile({ path: sourceDesignMdPath, workspaceRoot })
    .catch(() => null)
  if (designNotes?.ok) {
    await window.kunGui
      .writeWorkspaceFile({ path: designMdPath, workspaceRoot, content: designNotes.content })
      .catch(() => null)
  }

  const sourceNode =
    source.node ?? defaultDesignArtifactNode(state.artifacts.findIndex((item) => item.id === source.id))
  const sourceSummary = currentDesignArtifactVersion(source)?.summary ?? ''
  get().upsertArtifact({
    id: copyId,
    kind: 'html',
    title: `${source.title} copy`,
    relativePath,
    createdAt,
    updatedAt: createdAt,
    versions: [{ id: `${copyId}-v1`, relativePath, createdAt, summary: sourceSummary }],
    designMdPath,
    previewStatus: 'ready',
    node: { ...sourceNode, x: sourceNode.x + 44, y: sourceNode.y + 44, boardHidden: false }
  })
}
