/**
 * Durable 设计稿 (design document) index. The in-memory `documents` list is
 * mirrored to a single `.kun-design/documents.json` index that records each
 * 设计稿's metadata + ordering + the active pointers. Artifact membership is NOT
 * stored here — it is implied by directory nesting (`.kun-design/<docId>/<id>/`)
 * and recovered by scanning each 设计稿 dir on rehydrate. Presence of this file
 * also marks "the legacy → nested migration has run" (see the store).
 */
import type { DesignDocument } from './design-types'

const DESIGN_DIR = '.kun-design'

export function documentsIndexPath(): string {
  return `${DESIGN_DIR}/documents.json`
}

export function documentDirPath(docId: string): string {
  return `${DESIGN_DIR}/${docId}`
}

/** Persisted per-设计稿 metadata (no artifacts — those live on disk by nesting). */
export type DesignDocumentIndexEntry = {
  id: string
  title: string
  order: number
  createdAt: string
  updatedAt: string
  activeArtifactId: string | null
}

export type DesignDocumentsIndex = {
  version: 1
  activeDocumentId: string | null
  documents: DesignDocumentIndexEntry[]
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function toIndexEntry(doc: DesignDocument): DesignDocumentIndexEntry {
  return {
    id: doc.id,
    title: doc.title,
    order: doc.order,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    activeArtifactId: doc.activeArtifactId
  }
}

export function serializeDocumentsIndex(
  documents: readonly DesignDocument[],
  activeDocumentId: string | null
): string {
  const index: DesignDocumentsIndex = {
    version: 1,
    activeDocumentId,
    documents: documents.map(toIndexEntry)
  }
  return `${JSON.stringify(index, null, 2)}\n`
}

/** Tolerant parse of documents.json; returns null when nothing usable parses. */
export function parseDocumentsIndex(raw: string): DesignDocumentsIndex | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const source = parsed as Record<string, unknown>
  if (!Array.isArray(source.documents)) return null
  const documents: DesignDocumentIndexEntry[] = []
  source.documents.forEach((value, fallbackOrder) => {
    if (!value || typeof value !== 'object') return
    const o = value as Record<string, unknown>
    if (!isStr(o.id) || !o.id) return
    const createdAt = isStr(o.createdAt) ? o.createdAt : new Date(0).toISOString()
    documents.push({
      id: o.id,
      title: isStr(o.title) ? o.title : o.id,
      order: isNum(o.order) ? o.order : fallbackOrder,
      createdAt,
      updatedAt: isStr(o.updatedAt) ? o.updatedAt : createdAt,
      activeArtifactId: isStr(o.activeArtifactId) ? o.activeArtifactId : null
    })
  })
  if (documents.length === 0) return null
  const activeDocumentId =
    isStr(source.activeDocumentId) && documents.some((d) => d.id === source.activeDocumentId)
      ? source.activeDocumentId
      : documents[0].id
  return { version: 1, activeDocumentId, documents }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null

function writeDocumentsIndex(workspaceRoot: string, content: string): Promise<void> {
  if (typeof window.kunGui?.writeWorkspaceFile !== 'function') return Promise.resolve()
  return window.kunGui
    .writeWorkspaceFile({ path: documentsIndexPath(), workspaceRoot, content })
    .then(() => undefined)
    .catch(() => undefined)
}

/** Fire-and-forget, debounced write of the documents index (one hot file). */
export function persistDocumentsIndex(
  workspaceRoot: string,
  documents: readonly DesignDocument[],
  activeDocumentId: string | null
): void {
  if (!workspaceRoot || typeof window.kunGui?.writeWorkspaceFile !== 'function') return
  const content = serializeDocumentsIndex(documents, activeDocumentId)
  if (_saveTimer) clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    void writeDocumentsIndex(workspaceRoot, content)
  }, 400)
}

/**
 * Immediate, non-debounced write of the documents index. Cancels any pending
 * debounced write so a structural change (e.g. deleting a 设计稿) lands on disk
 * right away and can't be resurrected by a reload that reads a stale index
 * before the 400ms debounce flushes.
 */
export function flushDocumentsIndex(
  workspaceRoot: string,
  documents: readonly DesignDocument[],
  activeDocumentId: string | null
): Promise<void> {
  if (!workspaceRoot || typeof window.kunGui?.writeWorkspaceFile !== 'function') return Promise.resolve()
  if (_saveTimer) {
    clearTimeout(_saveTimer)
    _saveTimer = null
  }
  return writeDocumentsIndex(workspaceRoot, serializeDocumentsIndex(documents, activeDocumentId))
}

/** Fire-and-forget delete of a 设计稿's whole on-disk dir (and all its 画布). */
export function deleteDocumentDir(workspaceRoot: string, docId: string): Promise<void> {
  if (!workspaceRoot || typeof window.kunGui?.deleteWorkspaceEntry !== 'function') return Promise.resolve()
  return window.kunGui
    .deleteWorkspaceEntry({ path: documentDirPath(docId), workspaceRoot })
    .then(() => undefined)
    .catch(() => undefined)
}
