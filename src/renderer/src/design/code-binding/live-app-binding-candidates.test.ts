import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../canvas/canvas-types'
import { createRunningAppFrameShape } from '../canvas/running-app-frame'
import type { DomSourceSnapshot } from './dom-source-adapter'
import {
  applyLiveAppBindingCandidatesToCanvasDocument,
  formatLiveAppBindingCandidateSummary,
  liveAppBindingMatchesFromCandidates,
  summarizeLiveAppBindingCandidates
} from './live-app-binding-candidates'

function addFrame(doc = createEmptyDocument()) {
  const frame = createRunningAppFrameShape({
    x: 0,
    y: 0,
    url: 'localhost:5173/orders',
    title: 'Orders live',
    routePath: '/orders',
    sourceFile: 'src/app/orders/page.tsx',
    componentName: 'OrdersPage'
  })!
  doc.objects[frame.id] = { ...frame, parentId: doc.rootId }
  doc.objects[doc.rootId] = { ...doc.objects[doc.rootId], children: [...doc.objects[doc.rootId].children, frame.id] }
  return { doc, frame }
}

describe('live app binding candidates', () => {
  it('creates a metadata candidate from a running app frame', () => {
    const { doc } = addFrame()

    const summary = summarizeLiveAppBindingCandidates({ doc })

    expect(summary).toMatchObject({
      frameCount: 1,
      candidateCount: 1,
      highConfidenceCount: 0
    })
    expect(summary.candidates[0]).toMatchObject({
      frameName: 'Orders live',
      confidence: 'medium',
      reason: 'component-metadata',
      target: {
        routePath: '/orders',
        sourceFile: 'src/app/orders/page.tsx',
        componentName: 'OrdersPage'
      }
    })
    expect(formatLiveAppBindingCandidateSummary(summary)).toContain('source=src/app/orders/page.tsx')
  })

  it('uses selected running app frames and DOM source snapshots for high confidence matches', () => {
    const first = addFrame()
    const second = addFrame(first.doc)
    second.frame.name = 'Settings live'
    second.frame.runningApp = {
      ...second.frame.runningApp!,
      url: 'http://localhost:5173/settings',
      routePath: '/settings',
      sourceFile: 'src/app/settings/page.tsx'
    }
    first.doc.objects[second.frame.id] = { ...second.frame, parentId: first.doc.rootId }
    const snapshot: DomSourceSnapshot = {
      capturedAt: '2026-07-02T12:00:00.000Z',
      routePath: '/settings',
      sourceFile: 'src/app/settings/page.tsx',
      nodes: [{
        tagName: 'button',
        text: 'Save settings',
        onlookId: 'settings-save',
        sourceFile: 'src/app/settings/page.tsx',
        componentName: 'SettingsSaveButton',
        rect: { left: 20, top: 40, width: 160, height: 44 }
      }]
    }

    const summary = summarizeLiveAppBindingCandidates({
      doc: first.doc,
      selectedIds: new Set([second.frame.id]),
      snapshotsByFrameId: { [second.frame.id]: snapshot }
    })

    expect(summary.frameCount).toBe(1)
    expect(summary.candidateCount).toBe(2)
    expect(summary.highConfidenceCount).toBe(1)
    expect(summary.candidates[0]).toMatchObject({
      frameId: second.frame.id,
      confidence: 'high',
      reason: 'dom-source-id',
      tagName: 'button',
      target: {
        onlookId: 'settings-save',
        sourceFile: 'src/app/settings/page.tsx',
        componentName: 'SettingsSaveButton'
      }
    })
    expect(liveAppBindingMatchesFromCandidates(summary.candidates)[0]?.node).toMatchObject({
      onlookId: 'settings-save',
      routePath: '/settings'
    })
  })

  it('applies candidates as code bindings and marks scoped stale bindings', () => {
    const { doc, frame } = addFrame()
    doc.codeBindings = [{
      id: 'binding_old',
      designObjectId: frame.id,
      kind: 'dom-node',
      status: 'active',
      createdAt: '2026-07-02T11:00:00.000Z',
      target: { onlookId: 'old', sourceFile: 'src/app/old.tsx' }
    }]

    const next = applyLiveAppBindingCandidatesToCanvasDocument(doc, {
      capturedAt: '2026-07-02T12:00:00.000Z'
    })

    expect(next.codeBindings?.some((binding) => binding.status === 'stale' && binding.id === 'binding_old')).toBe(true)
    expect(next.codeBindings?.some((binding) => (
      binding.status === 'active' &&
      binding.designObjectId === frame.id &&
      binding.target.routePath === '/orders' &&
      binding.target.sourceFile === 'src/app/orders/page.tsx'
    ))).toBe(true)
  })
})
