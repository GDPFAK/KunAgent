import { describe, expect, it, vi } from 'vitest'
import {
  designAutoRepairPayloadKey,
  requestDesignQualityRepairDispatch
} from './design-quality-repair-dispatch'
import type {
  DesignHtmlQualityFinding,
  DesignRuntimeQualityPayload
} from './design-html-quality'
import type { DesignArtifact } from './design-types'
import { useDesignWorkspaceStore } from './design-workspace-store'

const finding: DesignHtmlQualityFinding = {
  code: 'TEXT_OVERFLOW',
  severity: 'critical',
  message: 'Text overflows its button',
  suggestion: 'Shorten or wrap the label'
}

const payload: DesignRuntimeQualityPayload = {
  artifactId: 'screen_home',
  artifactRelativePath: '.kun-design/doc/screen_home/v1.html',
  shapeId: 'frame_home',
  findings: [finding]
}

const boardArtifact: DesignArtifact = {
  id: 'board',
  kind: 'canvas',
  title: 'Board',
  relativePath: '.kun-design/doc/board/canvas.json',
  createdAt: '2026-07-02T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  versions: []
}

function fakeDesignState() {
  return {
    artifacts: [boardArtifact],
    designContext: { designTarget: 'web' },
    pagesRun: null,
    setActiveArtifact: vi.fn(),
    setDesignIntentMode: vi.fn()
  } as unknown as ReturnType<typeof useDesignWorkspaceStore.getState>
}

function readyState() {
  return {
    route: 'design',
    runtimeConnection: 'ready',
    busy: false,
    pagesRunActive: false
  }
}

describe('design quality repair dispatch', () => {
  it('keys payloads by artifact, relative path, then shape', () => {
    expect(designAutoRepairPayloadKey(payload)).toBe('artifact:screen_home')
    expect(designAutoRepairPayloadKey({
      ...payload,
      artifactId: '',
      artifactRelativePath: ' .kun-design/page.html '
    })).toBe('path:.kun-design/page.html')
    expect(designAutoRepairPayloadKey({
      ...payload,
      artifactId: '',
      artifactRelativePath: '',
      shapeId: ' frame_1 '
    })).toBe('shape:frame_1')
  })

  it('ignores automatic repair requests so quality checks cannot edit without consent', () => {
    const designState = fakeDesignState()
    const selectCanvasShapes = vi.fn()
    const sendDesignPrompt = vi.fn()
    const setTimeout = vi.fn((callback: () => void) => {
      callback()
      return 1
    })
    const autoRepairSentRef = { current: new Set<string>() }

    requestDesignQualityRepairDispatch({
      payload,
      findings: [finding],
      mode: 'auto',
      autoRepairSentRef,
      pendingTimersRef: { current: new Map() },
      manualLastSentRef: { current: new Map() },
      runtimeState: readyState,
      sendDesignPrompt,
      getDesignState: () => designState,
      selectCanvasShapes,
      timerApi: { setTimeout, now: () => 10_000 }
    })

    expect(autoRepairSentRef.current.has('artifact:screen_home')).toBe(false)
    expect(designState.setActiveArtifact).not.toHaveBeenCalled()
    expect(selectCanvasShapes).not.toHaveBeenCalled()
    expect(designState.setDesignIntentMode).not.toHaveBeenCalled()
    expect(sendDesignPrompt).not.toHaveBeenCalled()
  })

  it('activates the target and sends a manual repair prompt when requested', () => {
    const designState = fakeDesignState()
    const selectCanvasShapes = vi.fn()
    const sendDesignPrompt = vi.fn()
    const setTimeout = vi.fn((callback: () => void) => {
      callback()
      return 1
    })
    const autoRepairSentRef = { current: new Set<string>() }

    requestDesignQualityRepairDispatch({
      payload,
      findings: [finding],
      mode: 'manual',
      autoRepairSentRef,
      pendingTimersRef: { current: new Map() },
      manualLastSentRef: { current: new Map() },
      runtimeState: readyState,
      sendDesignPrompt,
      getDesignState: () => designState,
      selectCanvasShapes,
      timerApi: { setTimeout, now: () => 10_000 }
    })

    expect(autoRepairSentRef.current.has('artifact:screen_home')).toBe(true)
    expect(designState.setActiveArtifact).toHaveBeenCalledWith('board')
    expect(selectCanvasShapes).toHaveBeenCalledWith(['frame_home'])
    expect(designState.setDesignIntentMode).toHaveBeenCalledWith('modify')
    expect(sendDesignPrompt).toHaveBeenCalledWith(expect.stringContaining('TEXT_OVERFLOW'), {
      displayText: 'Repair design quality: TEXT_OVERFLOW',
      source: 'manual-quality-repair'
    })
  })

  it('queues repair until the design runtime can accept the turn', () => {
    const pendingTimersRef = { current: new Map<string, number>() }
    const setTimeout = vi.fn(() => 42)
    const sendDesignPrompt = vi.fn()

    requestDesignQualityRepairDispatch({
      payload,
      findings: [finding],
      mode: 'manual',
      autoRepairSentRef: { current: new Set() },
      pendingTimersRef,
      manualLastSentRef: { current: new Map() },
      runtimeState: () => ({ ...readyState(), busy: true }),
      sendDesignPrompt,
      timerApi: { setTimeout }
    })

    expect(pendingTimersRef.current.get('manual:artifact:screen_home|TEXT_OVERFLOW')).toBe(42)
    expect(sendDesignPrompt).not.toHaveBeenCalled()
  })

  it('skips duplicate auto repairs and throttled manual repairs', () => {
    const sendDesignPrompt = vi.fn()

    requestDesignQualityRepairDispatch({
      payload,
      findings: [finding],
      mode: 'auto',
      autoRepairSentRef: { current: new Set(['artifact:screen_home']) },
      pendingTimersRef: { current: new Map() },
      manualLastSentRef: { current: new Map() },
      runtimeState: readyState,
      sendDesignPrompt
    })

    requestDesignQualityRepairDispatch({
      payload,
      findings: [finding],
      mode: 'manual',
      autoRepairSentRef: { current: new Set() },
      pendingTimersRef: { current: new Map() },
      manualLastSentRef: {
        current: new Map([['manual:artifact:screen_home|TEXT_OVERFLOW', 9_500]])
      },
      runtimeState: readyState,
      sendDesignPrompt,
      timerApi: { now: () => 10_000 }
    })

    expect(sendDesignPrompt).not.toHaveBeenCalled()
  })
})
