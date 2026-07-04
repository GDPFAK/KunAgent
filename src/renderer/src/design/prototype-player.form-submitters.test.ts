import { describe, expect, it, vi } from 'vitest'
import {
  buildPrototypeNavigationCaptureScript,
  extractPrototypeHashRouteHref,
  extractPrototypeNavigationHref,
  hasPrototypePlayback,
  isPrototypeBackNavigation,
  prototypeBackNavigationSteps,
  prototypeMissingScreenPromptValues,
  prototypePlayerGoBack,
  prototypePlayerNavigateTo,
  resolveInitialPrototypeArtifactId,
  resolvePreferredPrototypeArtifactId,
  resolvePrototypeNavigationTarget,
  resolvePrototypeLinks,
  resolvePrototypeScreens,
  resolvePrototypeViewportFrame,
  suggestedPrototypeScreenTitleFromHref,
  shouldInitializePrototypePlayerCurrentId,
  shouldCapturePrototypeNavigationHref
} from './prototype-player'
import type { DesignArtifact } from './design-types'

const now = '2026-06-29T00:00:00.000Z'

function artifact(id: string, title: string, extra: Partial<DesignArtifact> = {}): DesignArtifact {
  const relativePath = `.kun-design/doc/${id}/v1.html`
  return {
    id,
    kind: 'html',
    title,
    relativePath,
    createdAt: now,
    updatedAt: now,
    versions: [{ id: `${id}-v1`, relativePath, createdAt: now, summary: '' }],
    ...extra
  }
}

type PrototypeCaptureEvent = {
  target: unknown
  key?: string
  submitter?: unknown
  preventDefault: () => void
  stopPropagation: () => void
}

type PrototypeCaptureListener = (event: PrototypeCaptureEvent) => void

type PrototypeCaptureListeners = Partial<Record<'click' | 'keydown' | 'submit', PrototypeCaptureListener>>

type PrototypeHistoryMethod = (state: unknown, title: string, url?: string | URL | null) => unknown

function withInjectedPrototypeCapture<T>(
  script: string,
  baseURI: string,
  run: (ctx: {
    fakeWindow: {
      location: { hash: string }
      open: ReturnType<typeof vi.fn>
      history: {
        pushState: PrototypeHistoryMethod
        replaceState: PrototypeHistoryMethod
        back: () => unknown
        go: (delta?: number) => unknown
      }
    }
    listeners: PrototypeCaptureListeners
  }) => T,
  options: { anchorIds?: readonly string[]; anchorNames?: readonly string[] } = {}
): T {
  const originalWindow = (globalThis as { window?: unknown }).window
  const originalDocument = (globalThis as { document?: unknown }).document
  const originalNode = (globalThis as { Node?: unknown }).Node
  const listeners: PrototypeCaptureListeners = {}
  const fakeWindow = {
    location: { hash: '' },
    open: vi.fn(),
    history: {
      pushState: vi.fn(),
      replaceState: vi.fn(),
      back: vi.fn(),
      go: vi.fn()
    }
  }
  const fakeDocument = {
    baseURI,
    addEventListener(type: string, listener: unknown) {
      if (type === 'click' || type === 'keydown' || type === 'submit') {
        listeners[type] = listener as PrototypeCaptureListener
      }
    },
    getElementById(id: string) {
      return options.anchorIds?.includes(id) ? { id } : null
    },
    getElementsByName(name: string) {
      return options.anchorNames?.includes(name) ? [{ name }] : []
    }
  }
  ;(globalThis as { window?: unknown }).window = fakeWindow
  ;(globalThis as { document?: unknown }).document = fakeDocument
  ;(globalThis as { Node?: unknown }).Node = { ELEMENT_NODE: 1 }
  try {
    Function(script)()
    return run({ fakeWindow, listeners })
  } finally {
    ;(globalThis as { window?: unknown }).window = originalWindow
    ;(globalThis as { document?: unknown }).document = originalDocument
    ;(globalThis as { Node?: unknown }).Node = originalNode
  }
}

describe("prototype-player form submitter capture", () => {
    it('prefers submitter prototype targets over the form target', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const draft = artifact('draft', 'Draft')
      const checkout = artifact('checkout', 'Checkout')
      const links = resolvePrototypeLinks(home, [home, draft, checkout])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow, listeners }) => {
          const form = {
            matches() {
              return true
            },
            getAttribute(name: string) {
              return name === 'data-prototype-target' ? 'Draft' : null
            }
          }
          const submitter = {
            getAttribute(name: string) {
              return name === 'data-prototype-target' ? 'Checkout' : null
            }
          }
          const event = {
            target: form,
            submitter,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
          }
          const listener = listeners.submit
          expect(listener).toBeTypeOf('function')
          if (!listener) throw new Error('Expected injected submit listener to be installed')
          listener(event)
  
          expect(event.preventDefault).toHaveBeenCalled()
          expect(event.stopPropagation).toHaveBeenCalled()
          expect(fakeWindow.location.hash).toBe('kun-proto-nav=Checkout')
          expect(
            resolvePrototypeNavigationTarget(
              `${currentFileUrl}#${fakeWindow.location.hash}`,
              currentFileUrl,
              links
            )?.targetArtifactId
          ).toBe('checkout')
        }
      )
    })
    it('captures submitter prototype targets even when the form has no action', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const checkout = artifact('checkout', 'Checkout')
      const links = resolvePrototypeLinks(home, [home, checkout])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow, listeners }) => {
          const form = {
            matches(selector: string) {
              return selector === 'form'
            },
            getAttribute() {
              return null
            }
          }
          const submitter = {
            getAttribute(name: string) {
              return name === 'data-prototype-target' ? 'Checkout' : null
            },
            formAction: ''
          }
          const event = {
            target: form,
            submitter,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
          }
          const listener = listeners.submit
          expect(listener).toBeTypeOf('function')
          if (!listener) throw new Error('Expected injected submit listener to be installed')
          listener(event)
  
          expect(event.preventDefault).toHaveBeenCalled()
          expect(event.stopPropagation).toHaveBeenCalled()
          expect(fakeWindow.location.hash).toBe('kun-proto-nav=Checkout')
          expect(
            resolvePrototypeNavigationTarget(
              `${currentFileUrl}#${fakeWindow.location.hash}`,
              currentFileUrl,
              links
            )?.targetArtifactId
          ).toBe('checkout')
        }
      )
    })
})
