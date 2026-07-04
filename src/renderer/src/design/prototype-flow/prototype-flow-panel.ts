import type { CanvasDocument, CanvasShape } from '../canvas/canvas-types'
import { isHtmlFrame } from '../canvas/canvas-types'
import { computePrototypeFlowEdges } from '../canvas/prototype-flow'
import type { DesignArtifact, DesignIntentMode, DesignPrototypeLink } from '../design-types'

export type PrototypeFlowPanelEdge = {
  id: string
  sourceArtifactId: string
  targetArtifactId: string
  sourceFrameId?: string
  targetFrameId?: string
  sourceTitle: string
  targetTitle: string
  label?: string
  href?: string
  kind: 'explicit' | 'fallback'
}

export type PrototypeFlowMissingLink = {
  sourceArtifactId: string
  sourceTitle: string
  targetTitle: string
  href?: string
  label?: string
}

export type PrototypeFlowToolAction = {
  id: 'connect-prototype-flow'
  labelKey: string
  detailKey: string
  intentMode: DesignIntentMode
  prompt: string
  disabledReasonKey?: string
}

export type PrototypeFlowPanelModel = {
  edges: PrototypeFlowPanelEdge[]
  missingLinks: PrototypeFlowMissingLink[]
  action: PrototypeFlowToolAction
  screenCount: number
  explicitLinkCount: number
  fallbackEdgeCount: number
}

export type BuildPrototypeFlowPanelModelInput = {
  artifacts: readonly DesignArtifact[]
  doc: CanvasDocument
}

function visibleHtmlFramesByArtifactId(doc: CanvasDocument): Map<string, CanvasShape> {
  const frames = new Map<string, CanvasShape>()
  for (const shape of Object.values(doc.objects)) {
    if (!shape || shape.visible === false || !isHtmlFrame(shape) || !shape.htmlArtifactId) continue
    frames.set(shape.htmlArtifactId, shape)
  }
  return frames
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

function resolveTargetArtifact(
  link: DesignPrototypeLink,
  htmlArtifacts: readonly DesignArtifact[]
): DesignArtifact | undefined {
  if (link.targetArtifactId) {
    const byId = htmlArtifacts.find((artifact) => artifact.id === link.targetArtifactId)
    if (byId) return byId
  }
  const targetTitle = normalizeTitle(link.targetTitle)
  if (!targetTitle) return undefined
  const matches = htmlArtifacts.filter((artifact) => normalizeTitle(artifact.title) === targetTitle)
  return matches.length === 1 ? matches[0] : undefined
}

function explicitEdgeKeys(artifacts: readonly DesignArtifact[]): Set<string> {
  const htmlArtifacts = artifacts.filter((artifact) => artifact.kind === 'html')
  const keys = new Set<string>()
  for (const artifact of htmlArtifacts) {
    for (const link of artifact.prototypeLinks ?? []) {
      const target = resolveTargetArtifact(link, htmlArtifacts)
      if (target) keys.add(`${artifact.id}->${target.id}`)
    }
  }
  return keys
}

function missingLinks(artifacts: readonly DesignArtifact[]): PrototypeFlowMissingLink[] {
  const htmlArtifacts = artifacts.filter((artifact) => artifact.kind === 'html')
  const missing: PrototypeFlowMissingLink[] = []
  for (const artifact of htmlArtifacts) {
    for (const link of artifact.prototypeLinks ?? []) {
      if (resolveTargetArtifact(link, htmlArtifacts)) continue
      missing.push({
        sourceArtifactId: artifact.id,
        sourceTitle: artifact.title,
        targetTitle: link.targetTitle,
        ...(link.href ? { href: link.href } : {}),
        ...(link.label ? { label: link.label } : {})
      })
    }
  }
  return missing
}

function flowPrompt(model: Omit<PrototypeFlowPanelModel, 'action'>): string {
  const edges = model.edges.slice(0, 8).map((edge) => (
    `- ${edge.sourceTitle} -> ${edge.targetTitle}${edge.label ? ` (${edge.label})` : ''}${edge.kind === 'fallback' ? ' [fallback]' : ''}`
  ))
  const missing = model.missingLinks.slice(0, 6).map((link) => (
    `- ${link.sourceTitle} -> ${link.targetTitle}${link.href ? ` (${link.href})` : ''}`
  ))
  return [
    'Connect the existing screens into a coherent clickable prototype flow.',
    `Current flow: ${model.screenCount} screen(s), ${model.explicitLinkCount} explicit link(s), ${model.fallbackEdgeCount} fallback edge(s), ${model.missingLinks.length} missing target(s).`,
    edges.length > 0 ? 'Visible flow edges:' : 'No visible flow edges yet.',
    ...edges,
    missing.length > 0 ? 'Missing or unresolved links:' : '',
    ...missing,
    '',
    'Repair HTML navigation with data-prototype-href, data-prototype-target, data-href, or real local hrefs. Update artifact prototypeLinks when a screen has an intended transition. Add back/close paths and current navigation states where needed. Keep screen titles and hrefs stable so prototype playback can resolve them.'
  ].filter(Boolean).join('\n')
}

export function buildPrototypeFlowPanelModel({
  artifacts,
  doc
}: BuildPrototypeFlowPanelModelInput): PrototypeFlowPanelModel {
  const frames = visibleHtmlFramesByArtifactId(doc)
  const explicitKeys = explicitEdgeKeys(artifacts)
  const edges: PrototypeFlowPanelEdge[] = computePrototypeFlowEdges(artifacts, doc.objects).map((edge) => {
    const sourceFrame = frames.get(edge.sourceArtifactId)
    const targetFrame = frames.get(edge.targetArtifactId)
    const key = `${edge.sourceArtifactId}->${edge.targetArtifactId}`
    return {
      id: edge.id,
      sourceArtifactId: edge.sourceArtifactId,
      targetArtifactId: edge.targetArtifactId,
      ...(sourceFrame ? { sourceFrameId: sourceFrame.id } : {}),
      ...(targetFrame ? { targetFrameId: targetFrame.id } : {}),
      sourceTitle: edge.sourceTitle,
      targetTitle: edge.targetTitle,
      ...(edge.label ? { label: edge.label } : {}),
      ...(edge.href ? { href: edge.href } : {}),
      kind: explicitKeys.has(key) ? 'explicit' : 'fallback'
    }
  })
  const explicitLinkCount = artifacts.reduce((sum, artifact) => sum + (artifact.prototypeLinks?.length ?? 0), 0)
  const model = {
    edges,
    missingLinks: missingLinks(artifacts),
    screenCount: frames.size,
    explicitLinkCount,
    fallbackEdgeCount: edges.filter((edge) => edge.kind === 'fallback').length
  }
  return {
    ...model,
    action: {
      id: 'connect-prototype-flow',
      labelKey: 'designPrototypeFlowConnect',
      detailKey: 'designPrototypeFlowConnectDetail',
      intentMode: 'modify',
      prompt: flowPrompt(model),
      ...(frames.size >= 2 ? {} : { disabledReasonKey: 'designPrototypeFlowNeedsScreens' })
    }
  }
}
