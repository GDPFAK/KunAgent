import { describe, expect, it } from 'vitest'
import { composerReferencesToUserFileReferences } from './workbench-composer-prompts'

describe('workbench composer prompt helpers', () => {
  it('maps composer file references to the Kun request contract', () => {
    expect(composerReferencesToUserFileReferences([
      {
        path: '/repo/src/renderer/App.tsx',
        relativePath: 'src/renderer/App.tsx',
        name: 'App.tsx',
        type: 'file'
      },
      {
        path: '/repo/src/renderer',
        relativePath: 'src/renderer',
        name: 'renderer',
        type: 'directory'
      }
    ])).toEqual([
      {
        path: '/repo/src/renderer/App.tsx',
        relativePath: 'src/renderer/App.tsx',
        name: 'App.tsx',
        kind: 'file'
      },
      {
        path: '/repo/src/renderer',
        relativePath: 'src/renderer',
        name: 'renderer',
        kind: 'directory'
      }
    ])
  })
})
