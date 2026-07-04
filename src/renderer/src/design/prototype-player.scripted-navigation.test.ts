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

describe("prototype-player scripted navigation capture", () => {
    it('captures page-title targets and resolves them to a prototype screen', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const signup = artifact('signup', 'Signup')
      const links = resolvePrototypeLinks(home, [home, signup])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow, listeners }) => {
          const button = {
            nodeType: 1,
            tagName: 'BUTTON',
            parentElement: null,
            hasAttribute(name: string) {
              return name === 'data-prototype-target'
            },
            getAttribute(name: string) {
              return name === 'data-prototype-target' ? 'Signup' : null
            },
            closest() {
              return this
            }
          }
          const event = {
            target: button,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
          }
          const listener = listeners.click
          expect(listener).toBeTypeOf('function')
          if (!listener) throw new Error('Expected injected click listener to be installed')
          listener(event)
  
          expect(event.preventDefault).toHaveBeenCalled()
          expect(event.stopPropagation).toHaveBeenCalled()
          expect(fakeWindow.location.hash).toBe('kun-proto-nav=Signup')
          expect(
            resolvePrototypeNavigationTarget(
              `${currentFileUrl}#${fakeWindow.location.hash}`,
              currentFileUrl,
              links
            )?.targetArtifactId
          ).toBe('signup')
        }
      )
    })
    it('captures keyboard activation on non-native prototype cards', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const details = artifact('details', 'Details')
      const links = resolvePrototypeLinks(home, [home, details])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow, listeners }) => {
          const card = {
            nodeType: 1,
            tagName: 'DIV',
            parentElement: null,
            hasAttribute(name: string) {
              return name === 'data-prototype-target'
            },
            getAttribute(name: string) {
              return name === 'data-prototype-target' ? 'Details' : null
            },
            closest() {
              return this
            }
          }
          const event = {
            target: card,
            key: 'Enter',
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
          }
          const listener = listeners.keydown
          expect(listener).toBeTypeOf('function')
          if (!listener) throw new Error('Expected injected keydown listener to be installed')
          listener(event)
  
          expect(event.preventDefault).toHaveBeenCalled()
          expect(event.stopPropagation).toHaveBeenCalled()
          expect(fakeWindow.location.hash).toBe('kun-proto-nav=Details')
          expect(
            resolvePrototypeNavigationTarget(
              `${currentFileUrl}#${fakeWindow.location.hash}`,
              currentFileUrl,
              links
            )?.targetArtifactId
          ).toBe('details')
        }
      )
    })
    it('captures space-key activation on non-native prototype cards', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const details = artifact('details', 'Details')
      const links = resolvePrototypeLinks(home, [home, details])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow, listeners }) => {
          const card = {
            nodeType: 1,
            tagName: 'DIV',
            parentElement: null,
            hasAttribute(name: string) {
              return name === 'data-prototype-target'
            },
            getAttribute(name: string) {
              return name === 'data-prototype-target' ? 'Details' : null
            },
            closest() {
              return this
            }
          }
          const event = {
            target: card,
            key: ' ',
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
          }
          const listener = listeners.keydown
          expect(listener).toBeTypeOf('function')
          if (!listener) throw new Error('Expected injected keydown listener to be installed')
          listener(event)
  
          expect(event.preventDefault).toHaveBeenCalled()
          expect(event.stopPropagation).toHaveBeenCalled()
          expect(fakeWindow.location.hash).toBe('kun-proto-nav=Details')
          expect(
            resolvePrototypeNavigationTarget(
              `${currentFileUrl}#${fakeWindow.location.hash}`,
              currentFileUrl,
              links
            )?.targetArtifactId
          ).toBe('details')
        }
      )
    })
    it('captures window.open prototype navigation calls', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const checkout = artifact('checkout', 'Checkout')
      const links = resolvePrototypeLinks(home, [home, checkout])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow }) => {
          const originalOpen = (fakeWindow as { __kunPrototypeOriginalOpen?: ReturnType<typeof vi.fn> }).__kunPrototypeOriginalOpen
          const open = fakeWindow.open as unknown as (url?: string, target?: string, features?: string) => unknown
          const result = open('Checkout', '_blank')
  
          expect(result).toBeNull()
          expect(originalOpen).toBeDefined()
          expect(originalOpen).not.toHaveBeenCalled()
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
    it('captures inline location.href prototype navigation handlers', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const checkout = artifact('checkout', 'Checkout')
      const links = resolvePrototypeLinks(home, [home, checkout])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow, listeners }) => {
          const button = {
            nodeType: 1,
            tagName: 'BUTTON',
            parentElement: null,
            hasAttribute(name: string) {
              return name === 'onclick'
            },
            getAttribute(name: string) {
              return name === 'onclick' ? "location.href = 'Checkout'" : null
            },
            closest() {
              return this
            }
          }
          const event = {
            target: button,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
          }
          const listener = listeners.click
          expect(listener).toBeTypeOf('function')
          if (!listener) throw new Error('Expected injected click listener to be installed')
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
    it('captures inline history.back prototype navigation handlers', () => {
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript([]),
        'file:///workspace/.kun-design/doc/settings/v1.html',
        ({ fakeWindow, listeners }) => {
          const button = {
            nodeType: 1,
            tagName: 'BUTTON',
            parentElement: null,
            hasAttribute(name: string) {
              return name === 'onclick'
            },
            getAttribute(name: string) {
              return name === 'onclick' ? 'history.back()' : null
            },
            closest() {
              return this
            }
          }
          const event = {
            target: button,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
          }
          const listener = listeners.click
          expect(listener).toBeTypeOf('function')
          if (!listener) throw new Error('Expected injected click listener to be installed')
          listener(event)
  
          expect(event.preventDefault).toHaveBeenCalled()
          expect(event.stopPropagation).toHaveBeenCalled()
          expect(fakeWindow.location.hash).toMatch(/^kun-proto-back=/)
        }
      )
    })
    it('captures inline history.go(-2) prototype navigation handlers with steps', () => {
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript([]),
        'file:///workspace/.kun-design/doc/settings/v1.html',
        ({ fakeWindow, listeners }) => {
          const button = {
            nodeType: 1,
            tagName: 'BUTTON',
            parentElement: null,
            hasAttribute(name: string) {
              return name === 'onclick'
            },
            getAttribute(name: string) {
              return name === 'onclick' ? 'history.go(-2)' : null
            },
            closest() {
              return this
            }
          }
          const event = {
            target: button,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
          }
          const listener = listeners.click
          expect(listener).toBeTypeOf('function')
          if (!listener) throw new Error('Expected injected click listener to be installed')
          listener(event)
  
          expect(event.preventDefault).toHaveBeenCalled()
          expect(event.stopPropagation).toHaveBeenCalled()
          expect(fakeWindow.location.hash).toMatch(/^kun-proto-back=steps%3D2%26t%3D/)
        }
      )
    })
    it('captures inline location.hash prototype navigation handlers', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const checkout = artifact('checkout', 'Checkout')
      const links = resolvePrototypeLinks(home, [home, checkout])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow, listeners }) => {
          const button = {
            nodeType: 1,
            tagName: 'BUTTON',
            parentElement: null,
            hasAttribute(name: string) {
              return name === 'onclick'
            },
            getAttribute(name: string) {
              return name === 'onclick' ? "location.hash = '#/checkout'" : null
            },
            closest() {
              return this
            }
          }
          const event = {
            target: button,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
          }
          const listener = listeners.click
          expect(listener).toBeTypeOf('function')
          if (!listener) throw new Error('Expected injected click listener to be installed')
          listener(event)
  
          expect(event.preventDefault).toHaveBeenCalled()
          expect(event.stopPropagation).toHaveBeenCalled()
          expect(fakeWindow.location.hash).toBe('kun-proto-nav=%2Fcheckout')
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
    it('captures form submits and resolves them to a prototype screen', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const checkout = artifact('checkout', 'Checkout')
      const links = resolvePrototypeLinks(home, [home, checkout])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow, listeners }) => {
          const form = {
            matches() {
              return true
            },
            getAttribute(name: string) {
              return name === 'data-prototype-target' ? 'Checkout' : null
            }
          }
          const event = {
            target: form,
            submitter: null,
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
    it('captures form onsubmit prototype navigation handlers', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const checkout = artifact('checkout', 'Checkout')
      const links = resolvePrototypeLinks(home, [home, checkout])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow, listeners }) => {
          const form = {
            matches() {
              return true
            },
            getAttribute(name: string) {
              return name === 'onsubmit' ? "window.location.assign('Checkout')" : null
            }
          }
          const event = {
            target: form,
            submitter: null,
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
