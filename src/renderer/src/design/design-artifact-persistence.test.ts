import { describe, expect, it } from 'vitest'
import {
  parseArtifactMeta,
  reconstructArtifact,
  serializeArtifactMeta
} from './design-artifact-persistence'
import { currentDesignArtifactVersion, defaultDesignArtifactNode, type DesignArtifact } from './design-types'

describe('design artifact persistence', () => {
  it('keeps old artifact meta valid when node placement is absent', () => {
    const artifact = parseArtifactMeta(
      JSON.stringify({
        id: 'draft',
        kind: 'html',
        title: 'Draft',
        relativePath: '.kun-design/draft/v1.html',
        createdAt: '2026-06-20T00:00:00.000Z',
        updatedAt: '2026-06-20T00:00:00.000Z',
        versions: []
      }),
      'draft'
    )

    expect(artifact?.id).toBe('draft')
    expect(artifact?.designMdPath).toBe('.kun-design/draft/DESIGN.md')
    expect(artifact?.node).toBeUndefined()
  })

  it('round-trips Stitch project-canvas node placement', () => {
    const createdAt = '2026-06-20T00:00:00.000Z'
    const artifact: DesignArtifact = {
      id: 'draft',
      kind: 'html',
      title: 'Draft',
      relativePath: '.kun-design/draft/v1.html',
      createdAt,
      updatedAt: createdAt,
      versions: [{ id: 'draft-v1', relativePath: '.kun-design/draft/v1.html', createdAt, summary: '' }],
      designMdPath: '.kun-design/draft/DESIGN.md',
      previewStatus: 'ready',
      node: {
        x: 120,
        y: 240,
        width: 512,
        height: 384,
        sizeMode: 'auto',
        favorite: true,
        boardHidden: true,
        viewMode: 'code'
      },
      prototypeLinks: [
        {
          targetTitle: 'Signup',
          targetArtifactId: 'signup',
          href: '../signup/v1.html',
          label: 'Start trial'
        }
      ],
      direction: {
        id: 'dir_1',
        name: 'Signup exploration',
        status: 'active',
        createdAt
      }
    }

    const parsed = parseArtifactMeta(serializeArtifactMeta(artifact), 'draft')

    expect(parsed?.node).toEqual(artifact.node)
    expect(parsed?.prototypeLinks).toEqual(artifact.prototypeLinks)
    expect(parsed?.direction).toEqual(artifact.direction)
    expect(parsed?.designMdPath).toBe('.kun-design/draft/DESIGN.md')
    expect(parsed?.previewStatus).toBe('ready')
  })

  it('keeps persisted version order while exposing the current relativePath version', () => {
    const createdAt = '2026-06-20T00:00:00.000Z'
    const parsed = parseArtifactMeta(
      JSON.stringify({
        id: 'draft',
        kind: 'html',
        title: 'Draft',
        relativePath: '.kun-design/draft/v1.html',
        createdAt,
        updatedAt: createdAt,
        versions: [
          {
            id: 'draft-v2',
            relativePath: '.kun-design/draft/v2.html',
            createdAt: '2026-06-20T01:00:00.000Z',
            summary: 'Newer experiment'
          },
          {
            id: 'draft-v1',
            relativePath: '.kun-design/draft/v1.html',
            createdAt,
            summary: 'Selected stable version'
          }
        ]
      }),
      'draft'
    )

    expect(parsed?.versions.map((version) => version.id)).toEqual(['draft-v2', 'draft-v1'])
    expect(parsed ? currentDesignArtifactVersion(parsed)?.summary : '').toBe('Selected stable version')
  })

  it('adds a current version entry when old meta omits the active relativePath', () => {
    const createdAt = '2026-06-20T00:00:00.000Z'
    const parsed = parseArtifactMeta(
      JSON.stringify({
        id: 'draft',
        kind: 'html',
        title: 'Draft',
        relativePath: '.kun-design/draft/v3.html',
        createdAt,
        updatedAt: createdAt,
        versions: [
          {
            id: 'draft-v2',
            relativePath: '.kun-design/draft/v2.html',
            createdAt,
            summary: 'Old version'
          }
        ]
      }),
      'draft'
    )

    expect(parsed?.versions[0]).toMatchObject({
      id: 'draft-v3',
      relativePath: '.kun-design/draft/v3.html',
      summary: ''
    })
    expect(parsed?.versions[1]?.id).toBe('draft-v2')
  })

  it('adds a default node when reconstructing legacy artifact folders', () => {
    const artifact = reconstructArtifact('legacy', [
      { name: 'v1.html', path: '.kun-design/legacy/v1.html', type: 'file', ext: '.html' },
      { name: 'meta.json', path: '.kun-design/legacy/meta.json', type: 'file', ext: '.json' }
    ])

    expect(artifact?.node).toEqual(defaultDesignArtifactNode(0))
    expect(artifact?.designMdPath).toBe('.kun-design/legacy/DESIGN.md')
  })
})
