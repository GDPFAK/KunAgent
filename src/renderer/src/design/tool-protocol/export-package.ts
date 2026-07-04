import { summarizeCodeBindingsForSnapshot } from '../code-binding/code-binding-summary'
import { buildStitchDesignMarkdown, STITCH_DESIGN_MD_PATH } from '../design-md-compat'
import { summarizeDirectionForAgent } from '../directions/direction-manager'
import type { DesignArtifact } from '../design-types'
import type { DesignToolState } from './tool-state'

export type DesignExportResourceKind =
  | 'project-design-md'
  | 'design-system-md'
  | 'canvas'
  | 'html'
  | 'screen-design-md'
  | 'graph-json'

export type DesignExportResource = {
  kind: DesignExportResourceKind
  path: string
  artifactId?: string
  frameId?: string
  title?: string
  directionId?: string
  role?: DesignArtifact['role']
}

export type DesignExportPackageOptions = {
  title: string
  brief?: string
  updatedAt: string
  designSystemMdPath: string
  projectBriefPath?: string
}

function frameIdForArtifact(state: DesignToolState, artifactId: string): string | undefined {
  return Object.values(state.graph.objects).find((object) => object.source?.htmlArtifactId === artifactId)?.id
}

function artifactResources(state: DesignToolState): DesignExportResource[] {
  const resources: DesignExportResource[] = []
  for (const artifact of state.artifacts) {
    if (artifact.kind === 'canvas') {
      resources.push({
        kind: 'canvas',
        path: artifact.relativePath,
        artifactId: artifact.id,
        title: artifact.title
      })
      continue
    }
    const frameId = frameIdForArtifact(state, artifact.id)
    resources.push({
      kind: 'html',
      path: artifact.relativePath,
      artifactId: artifact.id,
      ...(frameId ? { frameId } : {}),
      title: artifact.title,
      ...(artifact.direction?.id ? { directionId: artifact.direction.id } : {}),
      ...(artifact.role ? { role: artifact.role } : {})
    })
    if (artifact.designMdPath) {
      resources.push({
        kind: 'screen-design-md',
        path: artifact.designMdPath,
        artifactId: artifact.id,
        ...(frameId ? { frameId } : {}),
        title: `${artifact.title} DESIGN.md`,
        ...(artifact.direction?.id ? { directionId: artifact.direction.id } : {}),
        ...(artifact.role ? { role: artifact.role } : {})
      })
    }
  }
  return resources
}

function packageCounts(state: DesignToolState): Record<string, number> {
  return {
    objects: Object.keys(state.graph.objects).length,
    screens: state.artifacts.filter((artifact) => artifact.kind === 'html').length,
    canvasArtifacts: state.artifacts.filter((artifact) => artifact.kind === 'canvas').length,
    directions: Object.keys(state.graph.directions).length,
    tokens: state.graph.designSystem?.tokenCount ?? 0,
    components: state.graph.designSystem?.componentCount ?? 0,
    codeBindings: state.canvasDocument.codeBindings?.length ?? 0
  }
}

export function buildDesignExportPackage(
  state: DesignToolState,
  options: DesignExportPackageOptions
) {
  const markdown = buildStitchDesignMarkdown({
    title: options.title,
    brief: options.brief,
    designContext: state.designContext,
    designSystem: state.designSystem,
    artifacts: state.artifacts,
    updatedAt: options.updatedAt,
    designSystemMdPath: options.designSystemMdPath,
    projectBriefPath: options.projectBriefPath
  })
  const resources: DesignExportResource[] = [
    { kind: 'project-design-md', path: STITCH_DESIGN_MD_PATH, title: options.title },
    { kind: 'design-system-md', path: options.designSystemMdPath, title: 'DESIGN_SYSTEM.md' },
    { kind: 'graph-json', path: '.kun-design/design-graph.json', title: 'Design Graph' },
    ...artifactResources(state)
  ]

  return {
    format: 'package' as const,
    version: 1,
    projectId: state.projectId,
    title: options.title,
    updatedAt: options.updatedAt,
    paths: {
      designMd: STITCH_DESIGN_MD_PATH,
      designSystemMd: options.designSystemMdPath,
      ...(options.projectBriefPath ? { projectBrief: options.projectBriefPath } : {})
    },
    counts: packageCounts(state),
    markdown,
    graph: state.graph,
    resources,
    directions: state.directionManager.directions.map(summarizeDirectionForAgent),
    archivedDirections: state.directionManager.archivedDirections.map(summarizeDirectionForAgent),
    codeBindings: summarizeCodeBindingsForSnapshot(state.canvasDocument, undefined, 20)
  }
}
