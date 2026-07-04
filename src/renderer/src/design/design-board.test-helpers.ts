import { useDesignWorkspaceStore } from './design-workspace-store'
import type { DesignArtifact, DesignDocument } from './design-types'

export const createdAt = '2026-06-20T00:00:00.000Z'

export function artifact(
  id: string,
  kind: DesignArtifact['kind'],
  extra: Partial<DesignArtifact> = {}
): DesignArtifact {
  const relativePath =
    kind === 'canvas' ? `.kun-design/doc/${id}/canvas.json` : `.kun-design/doc/${id}/v1.html`
  return {
    id,
    kind,
    title: id,
    relativePath,
    createdAt,
    updatedAt: extra.updatedAt ?? createdAt,
    versions: [{ id: `${id}-v1`, relativePath, createdAt, summary: '' }],
    ...extra
  }
}

export function installDesignDocument(artifacts: DesignArtifact[], activeArtifactId: string | null): void {
  const doc: DesignDocument = {
    id: 'doc',
    title: 'Doc',
    createdAt,
    updatedAt: createdAt,
    order: 0,
    artifacts,
    activeArtifactId
  }
  useDesignWorkspaceStore.setState({
    workspaceRoot: '/workspace',
    documents: [doc],
    activeDocumentId: 'doc',
    artifacts,
    activeArtifactId,
    designContext: { designTarget: 'web' },
    fileError: null
  })
}
