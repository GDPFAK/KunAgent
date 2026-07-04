import type { CanvasDocument } from '../canvas/canvas-types'
import type { DesignSystem, DesignTokenKind } from '../canvas/design-system-types'
import type { DesignArtifact, DesignDocument, DesignPrototypeLink } from '../design-types'
import { buildDesignGraphFromCanvasDocument } from '../graph/design-graph-from-canvas'
import { collectCanvasImageAssets } from '../assets/design-asset-inventory'

export const PENPOT_HANDOFF_PACKAGE_PATH = '.kun-design/penpot-package.json'

export type PenpotHandoffToken = {
  name: string
  kind: DesignTokenKind
  value: unknown
}

export type PenpotHandoffComponent = {
  id: string
  name: string
  version: number
  rootShapeCount: number
  slotCount: number
}

export type PenpotHandoffFrame = {
  id: string
  name: string
  kind: 'frame' | 'html-frame'
  bounds?: { x: number; y: number; width: number; height: number }
  htmlArtifactId?: string
  htmlPath?: string
  designMdPath?: string
  direction?: { id: string; name: string; status: string }
  prototypeLinks?: DesignPrototypeLink[]
}

export type PenpotHandoffAsset = {
  id: string
  name: string
  kind: 'image'
  path: string
  bounds?: { x: number; y: number; width: number; height: number }
}

export type PenpotHandoffPackage = {
  version: 1
  kind: 'kun.penpot.handoff'
  source: 'kun-design-mode'
  updatedAt: string
  document: {
    id: string
    title: string
    artifactCount: number
  }
  graph: {
    projectId: string
    objectCount: number
    rootObjectCount: number
    directionCount: number
    tokenObjectCount: number
    componentObjectCount: number
  }
  tokens: PenpotHandoffToken[]
  components: PenpotHandoffComponent[]
  frames: PenpotHandoffFrame[]
  assets: PenpotHandoffAsset[]
}

export type BuildPenpotHandoffPackageOptions = {
  document: DesignDocument | null
  canvasDocument: CanvasDocument
  designSystem: DesignSystem
  artifacts?: readonly DesignArtifact[]
  updatedAt?: string
}

function artifactMap(artifacts: readonly DesignArtifact[]): Map<string, DesignArtifact> {
  return new Map(artifacts.map((artifact) => [artifact.id, artifact]))
}

function buildTokens(system: DesignSystem): PenpotHandoffToken[] {
  return Object.values(system.tokens)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((token) => ({
      name: token.name,
      kind: token.kind,
      value: token.value
    }))
}

function buildComponents(system: DesignSystem): PenpotHandoffComponent[] {
  return Object.values(system.components)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((component) => ({
      id: component.id,
      name: component.name,
      version: component.version,
      rootShapeCount: component.tree.length,
      slotCount: component.slots.length
    }))
}

function buildFrames(options: BuildPenpotHandoffPackageOptions): PenpotHandoffFrame[] {
  const artifacts = options.artifacts ?? options.document?.artifacts ?? []
  const artifactsById = artifactMap(artifacts)
  const graph = buildDesignGraphFromCanvasDocument(options.canvasDocument, {
    projectId: options.document?.id ?? options.canvasDocument.graph?.projectId ?? 'kun-design',
    artifacts: [...artifacts],
    designSystem: options.designSystem,
    updatedAt: options.updatedAt
  })
  return Object.values(graph.objects)
    .filter((object) => object.kind === 'frame' || object.kind === 'html-frame')
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((object) => {
      const artifact = object.source?.htmlArtifactId ? artifactsById.get(object.source.htmlArtifactId) : undefined
      return {
        id: object.id,
        name: object.name,
        kind: object.kind === 'html-frame' ? 'html-frame' : 'frame',
        ...(object.bounds ? { bounds: object.bounds } : {}),
        ...(object.source?.htmlArtifactId ? { htmlArtifactId: object.source.htmlArtifactId } : {}),
        ...(artifact?.relativePath ? { htmlPath: artifact.relativePath } : {}),
        ...(artifact?.designMdPath ? { designMdPath: artifact.designMdPath } : {}),
        ...(artifact?.direction ? { direction: {
          id: artifact.direction.id,
          name: artifact.direction.name,
          status: artifact.direction.status ?? 'active'
        } } : {}),
        ...(artifact?.prototypeLinks?.length ? { prototypeLinks: artifact.prototypeLinks } : {})
      }
    })
}

function buildAssets(options: BuildPenpotHandoffPackageOptions): PenpotHandoffAsset[] {
  return collectCanvasImageAssets(options.canvasDocument)
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: 'image',
      path: asset.path,
      bounds: asset.bounds
    }))
}

export function buildPenpotHandoffPackage(options: BuildPenpotHandoffPackageOptions): PenpotHandoffPackage {
  const artifacts = options.artifacts ?? options.document?.artifacts ?? []
  const graph = buildDesignGraphFromCanvasDocument(options.canvasDocument, {
    projectId: options.document?.id ?? options.canvasDocument.graph?.projectId ?? 'kun-design',
    artifacts: [...artifacts],
    designSystem: options.designSystem,
    updatedAt: options.updatedAt
  })
  return {
    version: 1,
    kind: 'kun.penpot.handoff',
    source: 'kun-design-mode',
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    document: {
      id: options.document?.id ?? 'kun-design',
      title: options.document?.title ?? 'Kun design project',
      artifactCount: artifacts.length
    },
    graph: {
      projectId: graph.projectId,
      objectCount: Object.keys(graph.objects).length,
      rootObjectCount: graph.rootObjectIds.length,
      directionCount: Object.keys(graph.directions).length,
      tokenObjectCount: graph.designSystem?.tokenCount ?? 0,
      componentObjectCount: graph.designSystem?.componentCount ?? 0
    },
    tokens: buildTokens(options.designSystem),
    components: buildComponents(options.designSystem),
    frames: buildFrames(options),
    assets: buildAssets(options)
  }
}

export function serializePenpotHandoffPackage(pkg: PenpotHandoffPackage): string {
  return `${JSON.stringify(pkg, null, 2)}\n`
}
