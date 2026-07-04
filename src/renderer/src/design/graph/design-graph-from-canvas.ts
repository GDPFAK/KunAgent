import type { CanvasDocument, CanvasShape } from '../canvas/canvas-types'
import type { DesignSystem } from '../canvas/design-system-types'
import type { DesignArtifact, DesignDirectionStatus } from '../design-types'
import type { DesignGraph, DesignGraphObject, DesignGraphObjectKind } from './design-graph-types'
import { codeBindingsForObject } from '../code-binding/code-binding-summary'
import { designSystemToGraphObjects, summarizeDesignSystemForGraph } from './design-system-graph'
import { canvasAssetByShapeId } from '../assets/design-asset-inventory'
import { groupDesignArtifacts } from '../design-artifact-actions'
import { buildDesignDirectionScorecards } from '../directions/direction-scorecard'

type BuildDesignGraphOptions = {
  projectId: string
  artifacts?: DesignArtifact[]
  designSystem?: DesignSystem
  updatedAt?: string
}

function graphKindForShape(shape: CanvasShape): DesignGraphObjectKind {
  if (shape.agentNote) return 'agent-note'
  if (shape.type === 'frame' && shape.runningApp?.url) return 'running-app-frame'
  if (shape.type === 'frame' && shape.htmlArtifactId) return 'html-frame'
  if (shape.type === 'frame') return 'frame'
  if (shape.type === 'image' && shape.imageUrl?.trim()) return 'asset'
  return 'shape'
}

function artifactById(artifacts: DesignArtifact[] | undefined): Map<string, DesignArtifact> {
  return new Map((artifacts ?? []).map((artifact) => [artifact.id, artifact]))
}

function directionStatus(artifact: DesignArtifact): DesignDirectionStatus {
  return artifact.direction?.status ?? 'active'
}

function shapeToGraphObject(
  document: CanvasDocument,
  shape: CanvasShape,
  artifacts: Map<string, DesignArtifact>
): DesignGraphObject {
  const artifact = shape.htmlArtifactId ? artifacts.get(shape.htmlArtifactId) : undefined
  const codeBindings = codeBindingsForObject(document, shape.id)
  const asset = shape.type === 'image' ? canvasAssetByShapeId(document, shape.id) : undefined
  return {
    id: shape.id,
    kind: graphKindForShape(shape),
    name: artifact?.title ?? shape.name,
    parentId: shape.parentId,
    children: [...shape.children],
    bounds: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
    visible: shape.visible,
    locked: shape.locked,
    source: {
      canvasShapeId: shape.id,
      htmlArtifactId: shape.htmlArtifactId,
      runningAppUrl: shape.runningApp?.url,
      componentId: shape.componentId,
      assetPath: asset?.path
    },
    style: {
      fills: shape.fills,
      strokes: shape.strokes,
      opacity: shape.opacity,
      cornerRadius: shape.cornerRadius
    },
    text: shape.type === 'text'
      ? {
          content: shape.textContent,
          fontSize: shape.fontSize,
          fontFamily: shape.fontFamily,
          fontWeight: shape.fontWeight,
          color: shape.fontColor
        }
      : undefined,
    metadata: {
      canvasType: shape.type,
      rotation: shape.rotation,
      devicePreset: shape.devicePreset,
      tokenBindings: shape.tokenBindings,
      componentVersion: shape.componentVersion,
      htmlArtifactPath: artifact?.relativePath,
      htmlDesignMdPath: artifact?.designMdPath,
      prototypeLinks: artifact?.prototypeLinks,
      runningApp: shape.runningApp,
      asset,
      imageUrl: shape.type === 'image' ? shape.imageUrl : undefined,
      agentNote: shape.agentNote,
      codeBindings: codeBindings.map((binding) => ({
        id: binding.id,
        kind: binding.kind,
        status: binding.status,
        sourceFile: binding.target.sourceFile,
        componentName: binding.target.componentName,
        domId: binding.target.domId,
        onlookId: binding.target.onlookId,
        routePath: binding.target.routePath
      }))
    }
  }
}

export function buildDesignGraphFromCanvasDocument(
  document: CanvasDocument,
  options: BuildDesignGraphOptions
): DesignGraph {
  const artifactList = options.artifacts ?? []
  const artifacts = artifactById(artifactList)
  const groupedArtifacts = groupDesignArtifacts(artifactList)
  const directionScorecards = buildDesignDirectionScorecards(
    [...groupedArtifacts.directions, ...groupedArtifacts.archivedDirections],
    document
  )
  const objects: DesignGraph['objects'] = {}
  const rootObjectIds: string[] = []
  const directions: DesignGraph['directions'] = {}

  for (const shape of Object.values(document.objects)) {
    if (shape.id === document.rootId) {
      rootObjectIds.push(...shape.children)
      continue
    }

    const object = shapeToGraphObject(document, shape, artifacts)
    objects[object.id] = object

    const artifact = shape.htmlArtifactId ? artifacts.get(shape.htmlArtifactId) : undefined
    if (!artifact?.direction) continue
    const existing = directions[artifact.direction.id]
    const nextObjectIds = existing ? [...existing.objectIds, shape.id] : [shape.id]
    directions[artifact.direction.id] = {
      id: artifact.direction.id,
      name: artifact.direction.name,
      status: directionStatus(artifact),
      createdAt: artifact.direction.createdAt,
      objectIds: nextObjectIds,
      scorecard: directionScorecards[artifact.direction.id]
    }
  }

  Object.assign(objects, designSystemToGraphObjects(options.designSystem, document))

  return {
    version: 1,
    projectId: options.projectId,
    rootObjectIds,
    objects,
    directions,
    designSystem: summarizeDesignSystemForGraph(options.designSystem, document),
    updatedAt: options.updatedAt
  }
}
