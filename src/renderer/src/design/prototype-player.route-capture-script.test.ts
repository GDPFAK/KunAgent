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

describe("prototype-player route capture script", () => {
    it('does not resolve captured target titles when multiple links share the same title', () => {
      const home = artifact('home', 'Home')
      const links = resolvePrototypeLinks(home, [
        home,
        artifact('account-settings', 'Settings'),
        artifact('project-settings', 'Settings')
      ])
  
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=Settings',
          'file:///workspace/.kun-design/doc/home/v1.html',
          links
        )
      ).toBeNull()
    })
    it('resolves captured target titles through a unique fuzzy match', () => {
      const home = artifact('home', 'Home')
      const links = resolvePrototypeLinks(home, [
        home,
        artifact('stats', 'Weekly Stats'),
        artifact('settings', 'Account Settings')
      ])
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
  
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=Stats',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('stats')
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=Account',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('settings')
    })
    it('does not resolve captured target titles through ambiguous fuzzy matches', () => {
      const home = artifact('home', 'Home')
      const links = resolvePrototypeLinks(home, [
        home,
        artifact('weekly', 'Weekly Stats'),
        artifact('monthly', 'Monthly Stats')
      ])
  
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=Stats',
          'file:///workspace/.kun-design/doc/home/v1.html',
          links
        )
      ).toBeNull()
    })
    it('resolves route-style prototype href slugs to unique sibling pages', () => {
      const home = artifact('home', 'Home')
      const settings = artifact('settings', 'Account Settings', {
        relativePath: '.kun-design/doc/account-settings/v1.html'
      })
      const stats = artifact('weekly-stats', 'Weekly Stats', {
        relativePath: '.kun-design/doc/weekly-stats/v1.html'
      })
      const links = resolvePrototypeLinks(home, [home, settings, stats])
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
  
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=%2Fsettings',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('settings')
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=..%2Faccount-settings%2F',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('settings')
      expect(
        resolvePrototypeNavigationTarget('/weekly-stats?from=home', currentFileUrl, links)?.targetArtifactId
      ).toBe('weekly-stats')
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#/settings',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('settings')
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=%23%2Fweekly-stats',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('weekly-stats')
    })
    it('does not resolve ambiguous route-style prototype href slugs', () => {
      const home = artifact('home', 'Home')
      const links = resolvePrototypeLinks(home, [
        home,
        artifact('account-settings', 'Account Settings'),
        artifact('project-settings', 'Project Settings')
      ])
  
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=%2Fsettings',
          'file:///workspace/.kun-design/doc/home/v1.html',
          links
        )
      ).toBeNull()
    })
    it('does not resolve ambiguous bare filenames to sibling prototype pages', () => {
      const home = artifact('home', 'Home', { relativePath: '.kun-design/doc/home/v1.html' })
      const signup = artifact('signup', 'Signup', { relativePath: '.kun-design/doc/signup/v1.html' })
      const settings = artifact('settings', 'Settings', { relativePath: '.kun-design/doc/settings/v1.html' })
      const links = resolvePrototypeLinks(home, [home, signup, settings])
  
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=v1.html',
          'file:///workspace/.kun-design/doc/home/v1.html',
          links
        )
      ).toBeNull()
    })
    it('does not resolve ambiguous short relative paths to the first matching page', () => {
      const home = artifact('home', 'Home', { relativePath: '.kun-design/doc/home/v1.html' })
      const accountSettings = artifact('account-settings', 'Account Settings', {
        relativePath: '.kun-design/doc/account/settings/v1.html'
      })
      const projectSettings = artifact('project-settings', 'Project Settings', {
        relativePath: '.kun-design/doc/project/settings/v1.html'
      })
      const links = resolvePrototypeLinks(home, [home, accountSettings, projectSettings])
  
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=settings%2Fv1.html',
          'file:///workspace/.kun-design/doc/home/v1.html',
          links
        )
      ).toBeNull()
    })
    it('extracts captured prototype hrefs and leaves ordinary hashes alone', () => {
      expect(extractPrototypeNavigationHref('#kun-proto-nav=..%2Fsignup%2Fv1.html')).toBe('../signup/v1.html')
      expect(extractPrototypeNavigationHref('file:///x.html#section')).toBeNull()
    })
    it('detects captured prototype back navigation signals', () => {
      expect(isPrototypeBackNavigation('#kun-proto-back=123')).toBe(true)
      expect(isPrototypeBackNavigation('file:///workspace/home.html#kun-proto-back=123')).toBe(true)
      expect(isPrototypeBackNavigation('#kun-proto-nav=..%2Fsignup%2Fv1.html')).toBe(false)
      expect(isPrototypeBackNavigation('#/settings')).toBe(false)
      expect(prototypeBackNavigationSteps('#kun-proto-back=123')).toBe(1)
      expect(prototypeBackNavigationSteps('#kun-proto-back=steps%3D2%26t%3D99')).toBe(2)
      expect(prototypeBackNavigationSteps('file:///workspace/home.html#kun-proto-back=steps%3D3%26t%3D99')).toBe(3)
      expect(prototypeBackNavigationSteps('#kun-proto-nav=..%2Fsignup%2Fv1.html')).toBeNull()
    })
    it('extracts hash-route prototype hrefs without treating plain anchors as routes', () => {
      expect(extractPrototypeHashRouteHref('#/settings')).toBe('/settings')
      expect(extractPrototypeHashRouteHref('#!/settings')).toBe('/settings')
      expect(extractPrototypeHashRouteHref('#..%2Fsettings%2Fv1.html')).toBe('../settings/v1.html')
      expect(extractPrototypeHashRouteHref('file:///workspace/home.html#/settings')).toBe('/settings')
      expect(extractPrototypeHashRouteHref('#settings')).toBeNull()
      expect(extractPrototypeHashRouteHref('#/assets/logo.png')).toBeNull()
      expect(extractPrototypeHashRouteHref('#kun-proto-nav=..%2Fsettings%2Fv1.html')).toBeNull()
    })
    it('captures unknown local prototype hrefs but lets anchors and external links behave normally', () => {
      const base = 'file:///workspace/.kun-design/doc/home/v1.html'
  
      expect(shouldCapturePrototypeNavigationHref('../billing/v1.html', base)).toBe(true)
      expect(shouldCapturePrototypeNavigationHref('/settings', base)).toBe(true)
      expect(shouldCapturePrototypeNavigationHref('#/settings', base)).toBe(true)
      expect(shouldCapturePrototypeNavigationHref('#../settings/v1.html', base)).toBe(true)
      expect(shouldCapturePrototypeNavigationHref('file:///workspace/proto/settings', base)).toBe(true)
      expect(shouldCapturePrototypeNavigationHref('/workspace/proto/settings.html', base)).toBe(true)
      expect(shouldCapturePrototypeNavigationHref('file:///workspace/proto/settings.html', base)).toBe(true)
      expect(shouldCapturePrototypeNavigationHref('#pricing', base)).toBe(false)
      expect(shouldCapturePrototypeNavigationHref('#/assets/logo.png', base)).toBe(false)
      expect(shouldCapturePrototypeNavigationHref('?tab=settings', base)).toBe(false)
      expect(shouldCapturePrototypeNavigationHref('mailto:hello@example.com', base)).toBe(false)
      expect(shouldCapturePrototypeNavigationHref('../assets/logo.png', base)).toBe(false)
      expect(shouldCapturePrototypeNavigationHref('/styles/app.css', base)).toBe(false)
      expect(shouldCapturePrototypeNavigationHref('file:///workspace/proto/report.pdf', base)).toBe(false)
      expect(shouldCapturePrototypeNavigationHref('https://example.com/demo', base)).toBe(false)
    })
    it('builds a capture script scoped to known flow hrefs', () => {
      const script = buildPrototypeNavigationCaptureScript([
        {
          targetTitle: 'Signup',
          targetArtifactId: 'signup',
          href: '../signup/v1.html'
        }
      ])
  
      expect(script).toContain('../signup/v1.html')
      expect(script).toContain('kun-proto-nav=')
      expect(script).toContain('allowed.add')
      expect(script).toContain('const currentAllowed')
      expect(script).toContain('window[key] instanceof Set')
      expect(script).toContain('__kunPrototypeNavCaptureTitles')
      expect(script).toContain('targetTitles')
      expect(script).toContain('fuzzyTitleMatch')
      expect(script).toContain('hasUniqueFuzzyTargetTitle')
      expect(script).toContain('currentTitleAllowed()')
      expect(script).toContain('isKnownTargetTitle')
      expect(script).toContain('hrefFromElement')
      expect(script).toContain('shouldNavigateElement')
      expect(script).toContain('const liveAllowed = currentAllowed()')
      expect(script).toContain('liveAllowed.has(raw)')
      expect(script).toContain('__kunPrototypeOriginalOpen')
      expect(script).toContain('__kunPrototypeWindowOpenPatched')
      expect(script).toContain('window.open = function(url, target, features)')
      expect(script).toContain("navigate(raw, { preventDefault() {}, stopPropagation() {} })")
      expect(script).toContain('__kunPrototypeOriginalPushState')
      expect(script).toContain('__kunPrototypePushStatePatched')
      expect(script).toContain("patchHistoryMethod('pushState'")
      expect(script).toContain("patchHistoryMethod('replaceState'")
      expect(script).toContain('kun-proto-back=')
      expect(script).toContain('__kunPrototypeBackPatched')
      expect(script).toContain('window.history.back = function()')
      expect(script).toContain('window.history.go = function(delta)')
      expect(script).toContain('backStepsFromInlineHandler')
      expect(script).toContain("'steps=' + count")
      expect(script).toContain('signalBackFromElement')
      expect(script).toContain('shouldCapture')
      expect(script).toContain('hashRouteHref')
      expect(script).toContain('plainHashTargetTitle')
      expect(script).toContain('hasSamePageAnchor')
      expect(script).toContain("const navHref = raw.startsWith('#') ? (hashRouteHref(raw) || plainHashTargetTitle(raw)) : raw")
      expect(script).toContain("encodeURIComponent(navHref)")
      expect(script).toContain('isPageLikePrototypePath')
      expect(script.indexOf("el.getAttribute('data-prototype-href')")).toBeLessThan(
        script.indexOf("el.getAttribute('href')")
      )
      expect(script).toContain('[data-prototype-target]')
      expect(script).toContain("[data-target]")
      expect(script).toContain('[onclick]')
      expect(script).toContain('hrefFromInlineHandler')
      expect(script).toContain("document.addEventListener('keydown'")
      expect(script).toContain("event.key !== 'Enter' && event.key !== ' '")
      expect(script).toContain('/^(?:a|button|input|select|textarea)$/i.test(el.tagName)')
      expect(script).toContain("submitter.getAttribute('data-prototype-target')")
      expect(script).toContain("submitter.getAttribute('data-target')")
      expect(script).toContain('looksLikePrototypePath')
      expect(script).toContain("event.target.matches('form')")
      expect(script).toContain("getAttribute('action')")
      expect(script).toContain("hrefFromInlineHandler(form.getAttribute('onsubmit'))")
      expect(script).toContain("document.addEventListener('submit'")
      expect(script).toContain('event.submitter')
    })
    it('captures history.pushState prototype navigation from scripted routers', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const checkout = artifact('checkout', 'Checkout')
      const links = resolvePrototypeLinks(home, [home, checkout])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow }) => {
          fakeWindow.history.pushState({}, '', '../checkout/v1.html')
  
          expect(fakeWindow.location.hash).toBe('kun-proto-nav=..%2Fcheckout%2Fv1.html')
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
    it('captures history.back and history.go(-1) prototype navigation from scripted routers', () => {
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript([]),
        'file:///workspace/.kun-design/doc/settings/v1.html',
        ({ fakeWindow }) => {
          fakeWindow.history.back()
          expect(fakeWindow.location.hash).toMatch(/^kun-proto-back=/)
  
          fakeWindow.location.hash = ''
          fakeWindow.history.go(-1)
          expect(fakeWindow.location.hash).toMatch(/^kun-proto-back=steps%3D1%26t%3D/)
  
          fakeWindow.location.hash = ''
          fakeWindow.history.go(-2)
          expect(fakeWindow.location.hash).toMatch(/^kun-proto-back=steps%3D2%26t%3D/)
  
          fakeWindow.location.hash = ''
          fakeWindow.history.go(1)
          expect(fakeWindow.location.hash).toBe('')
        }
      )
    })
    it('captures button hash routes in the injected navigation script', () => {
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript([
          { targetTitle: 'Signup', targetArtifactId: 'signup', href: '../signup/v1.html' }
        ]),
        'file:///workspace/.kun-design/doc/home/v1.html',
        ({ fakeWindow, listeners }) => {
          const button = {
            nodeType: 1,
            tagName: 'BUTTON',
            parentElement: null,
            hasAttribute(name: string) {
              return name === 'data-href'
            },
            getAttribute(name: string) {
              return name === 'data-href' ? '#/signup' : null
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
          expect(fakeWindow.location.hash).toBe('kun-proto-nav=%2Fsignup')
        }
      )
    })
    it('captures plain hash links when they uniquely match a prototype screen', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const checkout = artifact('checkout', 'Checkout')
      const links = resolvePrototypeLinks(home, [home, checkout])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow, listeners }) => {
          const link = {
            nodeType: 1,
            tagName: 'A',
            parentElement: null,
            hasAttribute(name: string) {
              return name === 'href'
            },
            getAttribute(name: string) {
              return name === 'href' ? '#Checkout' : null
            },
            closest() {
              return this
            }
          }
          const event = {
            target: link,
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
    it('lets real same-page hash anchors behave normally in the injected navigation script', () => {
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
      const home = artifact('home', 'Home')
      const checkout = artifact('checkout', 'Checkout')
      const links = resolvePrototypeLinks(home, [home, checkout])
      withInjectedPrototypeCapture(
        buildPrototypeNavigationCaptureScript(links),
        currentFileUrl,
        ({ fakeWindow, listeners }) => {
          const link = {
            nodeType: 1,
            tagName: 'A',
            parentElement: null,
            hasAttribute(name: string) {
              return name === 'href'
            },
            getAttribute(name: string) {
              return name === 'href' ? '#Checkout' : null
            },
            closest() {
              return this
            }
          }
          const event = {
            target: link,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn()
          }
          const listener = listeners.click
          expect(listener).toBeTypeOf('function')
          if (!listener) throw new Error('Expected injected click listener to be installed')
          listener(event)
  
          expect(event.preventDefault).not.toHaveBeenCalled()
          expect(event.stopPropagation).not.toHaveBeenCalled()
          expect(fakeWindow.location.hash).toBe('')
        },
        { anchorIds: ['Checkout'] }
      )
    })
})
