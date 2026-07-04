/**
 * Durable design-artifact metadata. The in-memory artifact list is mirrored to
 * a per-artifact `.kun-design/<id>/meta.json` sidecar so the list survives a
 * reload/restart (the HTML/canvas files alone can't recover title / versions /
 * implement provenance). On load the store rehydrates from these sidecars,
 * falling back to reconstructing from the on-disk files when a sidecar is
 * missing (artifacts created before this existed, or hand-authored dirs).
 */
import type { WorkspaceEntry } from '@shared/workspace-file'
import {
  defaultDesignArtifactNode,
  type DesignArtifact,
  type DesignDirection,
  type DesignArtifactNode,
  type DesignArtifactVersion,
  type DesignPrototypeLink
} from './design-types'

const DESIGN_DIR = '.kun-design'

// --- Construction helpers: build paths for an artifact nested under its 设计稿.
export function artifactDirPath(docId: string, artifactId: string): string {
  return `${DESIGN_DIR}/${docId}/${artifactId}`
}

export function artifactMetaPath(docId: string, artifactId: string): string {
  return `${artifactDirPath(docId, artifactId)}/meta.json`
}

export function artifactDesignMdPath(docId: string, artifactId: string): string {
  return `${artifactDirPath(docId, artifactId)}/DESIGN.md`
}

// --- Derivation helpers: recover sibling paths from an artifact's stored
// relativePath. Works uniformly for nested (.kun-design/<doc>/<id>/v1.html) and
// legacy-flat (.kun-design/<id>/v1.html) artifacts, so persistence/deletion need
// no docId — the path already encodes where the files live.
export function artifactDirOf(relativePath: string): string {
  const i = relativePath.lastIndexOf('/')
  return i <= 0 ? DESIGN_DIR : relativePath.slice(0, i)
}

export function artifactMetaPathOf(relativePath: string): string {
  return `${artifactDirOf(relativePath)}/meta.json`
}

export function artifactDesignMdPathOf(relativePath: string): string {
  return `${artifactDirOf(relativePath)}/DESIGN.md`
}

export function serializeArtifactMeta(artifact: DesignArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function parseNode(value: unknown): DesignArtifactNode | undefined {
  if (!value || typeof value !== 'object') return undefined
  const node = value as Record<string, unknown>
  if (!isNum(node.x) || !isNum(node.y) || !isNum(node.width) || !isNum(node.height)) {
    return undefined
  }
  const viewMode =
    node.viewMode === 'code' || node.viewMode === 'live' || node.viewMode === 'preview'
      ? node.viewMode
      : undefined
  return {
    x: node.x,
    y: node.y,
    width: Math.max(240, node.width),
    height: Math.max(180, node.height),
    ...(node.sizeMode === 'auto' || node.sizeMode === 'manual' || node.sizeMode === 'manual-width-auto-height'
      ? { sizeMode: node.sizeMode }
      : {}),
    ...(typeof node.favorite === 'boolean' ? { favorite: node.favorite } : {}),
    ...(typeof node.boardHidden === 'boolean' ? { boardHidden: node.boardHidden } : {}),
    ...(viewMode ? { viewMode } : {})
  }
}

function parsePrototypeLinks(value: unknown): DesignPrototypeLink[] | undefined {
  if (!Array.isArray(value)) return undefined
  const links = value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const targetTitle = isStr(item.targetTitle) ? item.targetTitle.trim() : ''
      const targetArtifactId = isStr(item.targetArtifactId) ? item.targetArtifactId.trim() : ''
      const href = isStr(item.href) ? item.href.trim() : ''
      const label = isStr(item.label) ? item.label.trim() : ''
      if (!targetTitle && !targetArtifactId) return null
      return {
        targetTitle: targetTitle || targetArtifactId,
        ...(targetArtifactId ? { targetArtifactId } : {}),
        ...(href ? { href } : {}),
        ...(label ? { label } : {})
      }
    })
    .filter((item): item is DesignPrototypeLink => item !== null)
  return links.length > 0 ? links : undefined
}

function parseDirection(value: unknown): DesignDirection | undefined {
  if (!value || typeof value !== 'object') return undefined
  const item = value as Record<string, unknown>
  const id = isStr(item.id) ? item.id.trim() : ''
  const name = isStr(item.name) ? item.name.trim() : ''
  if (!id || !name) return undefined
  const status =
    item.status === 'active' || item.status === 'accepted' || item.status === 'archived'
      ? item.status
      : undefined
  const createdAt = isStr(item.createdAt) ? item.createdAt : ''
  return {
    id,
    name,
    ...(status ? { status } : {}),
    ...(createdAt ? { createdAt } : {})
  }
}

function versionIdForRelativePath(artifactId: string, relativePath: string): string {
  const match = /\/v(\d+)\.html$/i.exec(relativePath)
  return match ? `${artifactId}-v${match[1]}` : artifactId
}

function versionsWithCurrentPresent(
  artifactId: string,
  relativePath: string,
  createdAt: string,
  versions: DesignArtifactVersion[]
): DesignArtifactVersion[] {
  const fallback = {
    id: versionIdForRelativePath(artifactId, relativePath),
    relativePath,
    createdAt,
    summary: ''
  }
  const list = versions.length > 0 ? versions : [fallback]
  const currentIndex = list.findIndex((version) => version.relativePath === relativePath)
  return currentIndex < 0 ? [fallback, ...list] : list
}

/** Parse a persisted meta.json into a DesignArtifact, defaulting from the dir id. */
export function parseArtifactMeta(raw: string, dirId: string): DesignArtifact | null {
  let o: Record<string, unknown>
  try {
    o = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
  const relativePath = isStr(o.relativePath) ? o.relativePath : ''
  if (!relativePath) return null
  const id = isStr(o.id) ? o.id : dirId
  const createdAt = isStr(o.createdAt) ? o.createdAt : new Date(0).toISOString()
  const updatedAt = isStr(o.updatedAt) ? o.updatedAt : createdAt
  const versions = Array.isArray(o.versions)
    ? o.versions
        .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
        .map((v) => ({
          id: isStr(v.id) ? v.id : id,
          relativePath: isStr(v.relativePath) ? v.relativePath : relativePath,
          createdAt: isStr(v.createdAt) ? v.createdAt : createdAt,
          summary: isStr(v.summary) ? v.summary : ''
        }))
    : []
  const parsedNode = parseNode(o.node)
  const kind: DesignArtifact['kind'] = o.kind === 'canvas' ? 'canvas' : 'html'
  const previewStatus =
    o.previewStatus === 'pending' || o.previewStatus === 'ready' || o.previewStatus === 'error'
      ? o.previewStatus
      : undefined
  const role = o.role === 'design-system' || o.role === 'logo' ? o.role : undefined
  const prototypeLinks = parsePrototypeLinks(o.prototypeLinks)
  const direction = parseDirection(o.direction)
  const normalizedVersions = versionsWithCurrentPresent(id, relativePath, createdAt, versions)
  return {
    id,
    kind,
    title: isStr(o.title) ? o.title : dirId,
    relativePath,
    createdAt,
    updatedAt,
    versions: normalizedVersions,
    ...(kind === 'html' ? { designMdPath: isStr(o.designMdPath) ? o.designMdPath : artifactDesignMdPathOf(relativePath) } : {}),
    ...(previewStatus ? { previewStatus } : {}),
    ...(parsedNode ? { node: parsedNode } : {}),
    ...(prototypeLinks ? { prototypeLinks } : {}),
    ...(direction ? { direction } : {}),
    implementedAt: isStr(o.implementedAt) ? o.implementedAt : undefined,
    implementedThreadId: isStr(o.implementedThreadId) ? o.implementedThreadId : undefined,
    implementedDesignSystemHash: isStr(o.implementedDesignSystemHash) ? o.implementedDesignSystemHash : undefined,
    ...(role ? { role } : {})
  }
}

/**
 * Reconstruct an artifact from on-disk files when no meta.json sidecar exists.
 * `artifactDir` is the artifact's full workspace-relative directory (nested:
 * `.kun-design/<docId>/<id>`, or legacy-flat: `.kun-design/<id>`).
 */
export function reconstructArtifact(artifactDir: string, entries: WorkspaceEntry[]): DesignArtifact | null {
  const normalizedDir = artifactDir.startsWith(`${DESIGN_DIR}/`) ? artifactDir : `${DESIGN_DIR}/${artifactDir}`
  const dirId = normalizedDir.slice(normalizedDir.lastIndexOf('/') + 1)
  const files = entries.filter((e) => e.type === 'file')
  const hasCanvas = files.some((f) => f.name === 'canvas.json')
  const htmlVersions = files
    .map((f) => /^v(\d+)\.html$/.exec(f.name))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => b - a)
  if (!hasCanvas && htmlVersions.length === 0) return null
  const now = new Date().toISOString()
  const kind: DesignArtifact['kind'] = hasCanvas ? 'canvas' : 'html'
  const relativePath = hasCanvas
    ? `${normalizedDir}/canvas.json`
    : `${normalizedDir}/v${htmlVersions[0]}.html`
  const versions =
    kind === 'html'
      ? htmlVersions.map((n) => ({
          id: `${dirId}-v${n}`,
          relativePath: `${normalizedDir}/v${n}.html`,
          createdAt: now,
          summary: ''
        }))
      : [{ id: dirId, relativePath, createdAt: now, summary: '' }]
  return {
    id: dirId,
    kind,
    title: dirId,
    relativePath,
    createdAt: now,
    updatedAt: now,
    versions,
    ...(kind === 'html' ? { designMdPath: `${normalizedDir}/DESIGN.md` } : {}),
    node: defaultDesignArtifactNode(0)
  }
}

/** Fire-and-forget write of an artifact's meta.json sidecar (alongside its files). */
export function persistArtifactMeta(workspaceRoot: string, artifact: DesignArtifact): void {
  if (!workspaceRoot || typeof window.kunGui?.writeWorkspaceFile !== 'function') return
  void window.kunGui
    .writeWorkspaceFile({
      path: artifactMetaPathOf(artifact.relativePath),
      workspaceRoot,
      content: serializeArtifactMeta(artifact)
    })
    .catch(() => undefined)
}

/** Fire-and-forget delete of an artifact's whole on-disk dir (keeps disk in sync with the list). */
export function deleteArtifactDir(workspaceRoot: string, relativePath: string): void {
  if (!workspaceRoot || typeof window.kunGui?.deleteWorkspaceEntry !== 'function') return
  void window.kunGui
    .deleteWorkspaceEntry({ path: artifactDirOf(relativePath), workspaceRoot })
    .catch(() => undefined)
}
