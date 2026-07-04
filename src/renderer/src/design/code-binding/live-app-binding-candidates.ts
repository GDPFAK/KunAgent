import { isRunningAppFrame, type CanvasDocument, type CanvasShape } from '../canvas/canvas-types'
import type { DesignCodeBindingTarget } from './code-binding-types'
import {
  bindingsFromDomSourceSnapshot,
  type DomSourceBindingMatch,
  type DomSourceSnapshot,
  type DomSourceSnapshotNode
} from './dom-source-adapter'

export type LiveAppBindingCandidateConfidence = 'high' | 'medium' | 'low'

export type LiveAppBindingCandidateReason =
  | 'dom-source-id'
  | 'component-metadata'
  | 'source-metadata'
  | 'route-metadata'
  | 'url-route'

export type LiveAppBindingCandidate = {
  id: string
  frameId: string
  frameName: string
  url: string
  confidence: LiveAppBindingCandidateConfidence
  reason: LiveAppBindingCandidateReason
  target: DesignCodeBindingTarget
  tagName?: string
  text?: string
  rect?: DomSourceSnapshotNode['rect']
  node?: DomSourceSnapshotNode
}

export type LiveAppBindingCandidateSummary = {
  frameCount: number
  candidateCount: number
  highConfidenceCount: number
  candidates: LiveAppBindingCandidate[]
  omitted: number
}

export type LiveAppBindingCandidateInput = {
  doc: CanvasDocument
  selectedIds?: ReadonlySet<string>
  snapshotsByFrameId?: Readonly<Record<string, DomSourceSnapshot | null | undefined>>
  limit?: number
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function urlRoute(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : undefined
  } catch {
    return undefined
  }
}

function targetHasBindingSignal(target: DesignCodeBindingTarget): boolean {
  return Boolean(
    target.sourceFile ||
    target.componentName ||
    target.exportName ||
    target.domId ||
    target.onlookId ||
    target.astPath ||
    target.routePath
  )
}

function candidateId(frameId: string, target: DesignCodeBindingTarget): string {
  const raw = [
    frameId,
    target.onlookId,
    target.domId,
    target.sourceFile,
    target.componentName,
    target.routePath,
    target.astPath
  ].filter(Boolean).join(':')
  return `live_candidate_${raw.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 96)}`
}

function flattenNodes(nodes: readonly DomSourceSnapshotNode[]): DomSourceSnapshotNode[] {
  const flat: DomSourceSnapshotNode[] = []
  const visit = (node: DomSourceSnapshotNode): void => {
    flat.push(node)
    for (const child of node.children ?? []) visit(child)
  }
  for (const node of nodes) visit(node)
  return flat
}

function nodeScore(node: DomSourceSnapshotNode): number {
  const area = node.rect ? Math.max(0, node.rect.width) * Math.max(0, node.rect.height) : 0
  return (
    (node.onlookId ? 100 : 0) +
    (node.domId ? 80 : 0) +
    (node.sourceFile ? 65 : 0) +
    (node.componentName ? 50 : 0) +
    (node.astPath ? 35 : 0) +
    (node.routePath ? 25 : 0) +
    Math.min(20, area / 24_000)
  )
}

function confidenceForTarget(target: DesignCodeBindingTarget): LiveAppBindingCandidateConfidence {
  if ((target.onlookId || target.domId) && (target.sourceFile || target.componentName || target.astPath)) return 'high'
  if (target.onlookId || target.domId || target.sourceFile || target.componentName || target.astPath) return 'medium'
  return 'low'
}

function reasonForTarget(target: DesignCodeBindingTarget, fallbackReason: LiveAppBindingCandidateReason): LiveAppBindingCandidateReason {
  if (target.onlookId || target.domId) return 'dom-source-id'
  if (target.componentName) return 'component-metadata'
  if (target.sourceFile || target.astPath) return 'source-metadata'
  if (target.routePath) return fallbackReason
  return 'url-route'
}

function runningAppFrames(doc: CanvasDocument, selectedIds?: ReadonlySet<string>): CanvasShape[] {
  const frames = Object.values(doc.objects).filter((shape): shape is CanvasShape => Boolean(shape && isRunningAppFrame(shape)))
  const selected = selectedIds && selectedIds.size > 0
    ? frames.filter((shape) => selectedIds.has(shape.id))
    : []
  return selected.length > 0 ? selected : frames
}

function frameCandidate(shape: CanvasShape): LiveAppBindingCandidate | null {
  const app = shape.runningApp
  if (!app?.url) return null
  const target: DesignCodeBindingTarget = {
    ...(clean(app.sourceFile) ? { sourceFile: clean(app.sourceFile) } : {}),
    ...(clean(app.componentName) ? { componentName: clean(app.componentName) } : {}),
    ...(clean(app.routePath) || urlRoute(app.url) ? { routePath: clean(app.routePath) ?? urlRoute(app.url) } : {})
  }
  if (!targetHasBindingSignal(target)) return null
  const reason: LiveAppBindingCandidateReason = clean(app.routePath) ? 'route-metadata' : 'url-route'
  return {
    id: candidateId(shape.id, target),
    frameId: shape.id,
    frameName: shape.name,
    url: app.url,
    confidence: confidenceForTarget(target),
    reason: reasonForTarget(target, reason),
    target,
    tagName: 'iframe'
  }
}

function targetForNode(
  shape: CanvasShape,
  snapshot: DomSourceSnapshot,
  node: DomSourceSnapshotNode
): DesignCodeBindingTarget {
  const app = shape.runningApp
  return {
    ...(clean(node.sourceFile) || clean(snapshot.sourceFile) || clean(app?.sourceFile)
      ? { sourceFile: clean(node.sourceFile) ?? clean(snapshot.sourceFile) ?? clean(app?.sourceFile) }
      : {}),
    ...(clean(node.componentName) || clean(app?.componentName)
      ? { componentName: clean(node.componentName) ?? clean(app?.componentName) }
      : {}),
    ...(clean(node.exportName) ? { exportName: clean(node.exportName) } : {}),
    ...(clean(node.domId) ? { domId: clean(node.domId) } : {}),
    ...(clean(node.onlookId) ? { onlookId: clean(node.onlookId) } : {}),
    ...(clean(node.astPath) ? { astPath: clean(node.astPath) } : {}),
    ...(clean(node.routePath) || clean(snapshot.routePath) || clean(app?.routePath) || urlRoute(app?.url ?? '')
      ? { routePath: clean(node.routePath) ?? clean(snapshot.routePath) ?? clean(app?.routePath) ?? urlRoute(app?.url ?? '') }
      : {}),
    ...(typeof node.line === 'number' ? { line: node.line } : {}),
    ...(typeof node.column === 'number' ? { column: node.column } : {})
  }
}

function snapshotCandidates(
  shape: CanvasShape,
  snapshot: DomSourceSnapshot,
  perFrameLimit: number
): LiveAppBindingCandidate[] {
  return flattenNodes(snapshot.nodes)
    .filter((node) => targetHasBindingSignal(targetForNode(shape, snapshot, node)))
    .sort((a, b) => nodeScore(b) - nodeScore(a))
    .slice(0, Math.max(0, perFrameLimit))
    .map((node) => {
      const target = targetForNode(shape, snapshot, node)
      return {
        id: candidateId(shape.id, target),
        frameId: shape.id,
        frameName: shape.name,
        url: shape.runningApp!.url,
        confidence: confidenceForTarget(target),
        reason: reasonForTarget(target, 'route-metadata'),
        target,
        tagName: node.tagName,
        ...(node.text ? { text: node.text.slice(0, 180) } : {}),
        ...(node.rect ? { rect: node.rect } : {}),
        node: {
          ...node,
          ...target
        }
      }
    })
}

export function summarizeLiveAppBindingCandidates({
  doc,
  selectedIds,
  snapshotsByFrameId,
  limit = 8
}: LiveAppBindingCandidateInput): LiveAppBindingCandidateSummary {
  const frames = runningAppFrames(doc, selectedIds)
  const candidates = frames.flatMap((shape) => {
    const snapshot = snapshotsByFrameId?.[shape.id]
    const fromFrame = frameCandidate(shape)
    const fromSnapshot = snapshot ? snapshotCandidates(shape, snapshot, 5) : []
    return [fromFrame, ...fromSnapshot].filter((candidate): candidate is LiveAppBindingCandidate => Boolean(candidate))
  })
  const sorted = candidates.sort((a, b) => {
    const confidence = confidenceWeight(b.confidence) - confidenceWeight(a.confidence)
    return confidence || a.frameName.localeCompare(b.frameName) || a.id.localeCompare(b.id)
  })
  const visible = sorted.slice(0, Math.max(0, limit))
  return {
    frameCount: frames.length,
    candidateCount: sorted.length,
    highConfidenceCount: sorted.filter((candidate) => candidate.confidence === 'high').length,
    candidates: visible,
    omitted: Math.max(0, sorted.length - visible.length)
  }
}

function confidenceWeight(confidence: LiveAppBindingCandidateConfidence): number {
  if (confidence === 'high') return 2
  if (confidence === 'medium') return 1
  return 0
}

function nodeFromCandidate(candidate: LiveAppBindingCandidate): DomSourceSnapshotNode {
  return candidate.node ?? {
    tagName: candidate.tagName ?? 'iframe',
    text: candidate.text ?? candidate.frameName,
    ...candidate.target
  }
}

export function liveAppBindingMatchesFromCandidates(
  candidates: readonly LiveAppBindingCandidate[]
): DomSourceBindingMatch[] {
  return candidates.map((candidate) => ({
    designObjectId: candidate.frameId,
    node: nodeFromCandidate(candidate)
  }))
}

export function applyLiveAppBindingCandidatesToCanvasDocument(
  doc: CanvasDocument,
  input: Omit<LiveAppBindingCandidateInput, 'doc'> & { capturedAt?: string } = {}
): CanvasDocument {
  const summary = summarizeLiveAppBindingCandidates({ ...input, doc, limit: Number.MAX_SAFE_INTEGER })
  const matches = liveAppBindingMatchesFromCandidates(summary.candidates)
  const scopeDesignObjectIds = [...new Set(summary.candidates.map((candidate) => candidate.frameId))]
  return {
    ...doc,
    codeBindings: bindingsFromDomSourceSnapshot({
      existingBindings: doc.codeBindings ?? [],
      matches,
      capturedAt: input.capturedAt,
      scopeDesignObjectIds
    })
  }
}

function targetParts(target: DesignCodeBindingTarget): string[] {
  return [
    target.onlookId ? `onlook=${target.onlookId}` : '',
    target.domId ? `dom=${target.domId}` : '',
    target.routePath ? `route=${target.routePath}` : '',
    target.sourceFile ? `source=${target.sourceFile}` : '',
    target.componentName ? `component=${target.componentName}` : '',
    target.astPath ? `ast=${target.astPath}` : ''
  ].filter(Boolean)
}

export function formatLiveAppBindingCandidateSummary(summary: LiveAppBindingCandidateSummary): string {
  if (summary.frameCount === 0) return 'No live app frames.'
  if (summary.candidateCount === 0) return 'No live app code binding candidates.'
  const lines = summary.candidates.map((candidate) => {
    const parts = targetParts(candidate.target)
    return `- ${candidate.frameName} (${candidate.confidence}, ${candidate.reason}) · ${parts.join(' · ')}`
  })
  if (summary.omitted > 0) lines.push(`- ${summary.omitted} more candidate(s) omitted.`)
  return `Live app binding candidates:\n${lines.join('\n')}`
}
