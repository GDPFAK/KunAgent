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

describe("prototype-player selection, state, and links", () => {
    it('starts from the preferred HTML artifact when available', () => {
      const artifacts = [
        artifact('home', 'Home'),
        artifact('signup', 'Signup', { prototypeLinks: [{ targetTitle: 'Home', targetArtifactId: 'home' }] })
      ]
  
      expect(resolveInitialPrototypeArtifactId(artifacts, 'home')).toBe('home')
    })
    it('otherwise starts from the first linked HTML artifact, then first HTML artifact', () => {
      expect(resolveInitialPrototypeArtifactId([artifact('home', 'Home'), artifact('flow', 'Flow', {
        prototypeLinks: [{ targetTitle: 'Home', targetArtifactId: 'home' }]
      })])).toBe('flow')
      expect(resolveInitialPrototypeArtifactId([artifact('home', 'Home')])).toBe('home')
      expect(resolveInitialPrototypeArtifactId([{ ...artifact('board', 'Board'), kind: 'canvas' }])).toBeNull()
    })
    it('lists only HTML artifacts for the prototype screen map', () => {
      expect(resolvePrototypeScreens([
        artifact('home', 'Home', { relativePath: '.kun-design/doc/home/v1.html' }),
        { ...artifact('board', 'Board', { relativePath: '.kun-design/doc/board.json' }), kind: 'canvas' as const },
        artifact('settings', 'Settings', { relativePath: '.kun-design/doc/settings/v1.html' })
      ])).toEqual([
        {
          id: 'home',
          title: 'Home',
          relativePath: '.kun-design/doc/home/v1.html'
        },
        {
          id: 'settings',
          title: 'Settings',
          relativePath: '.kun-design/doc/settings/v1.html'
        }
      ])
    })
    it('prefers the selected HTML screen, then the active HTML screen for opening playback', () => {
      const artifacts = [
        artifact('home', 'Home'),
        artifact('settings', 'Settings'),
        { ...artifact('board', 'Board', { relativePath: '.kun-design/doc/board.json' }), kind: 'canvas' as const }
      ]
  
      expect(resolvePreferredPrototypeArtifactId(artifacts, 'settings', 'home')).toBe('settings')
      expect(resolvePreferredPrototypeArtifactId(artifacts, null, 'home')).toBe('home')
      expect(resolvePreferredPrototypeArtifactId(artifacts, 'missing', 'board')).toBeNull()
    })
    it('initializes playback only on open or when the current screen is missing', () => {
      expect(
        shouldInitializePrototypePlayerCurrentId({ open: true, wasOpen: false, currentId: 'settings' })
      ).toBe(true)
      expect(
        shouldInitializePrototypePlayerCurrentId({ open: true, wasOpen: true, currentId: 'settings' })
      ).toBe(false)
      expect(
        shouldInitializePrototypePlayerCurrentId({ open: true, wasOpen: true, currentId: null })
      ).toBe(true)
      expect(
        shouldInitializePrototypePlayerCurrentId({ open: false, wasOpen: true, currentId: null })
      ).toBe(false)
    })
    it('tracks side-rail navigation history and back behavior', () => {
      const home = { currentId: 'home', history: [], missingHref: '../missing/v1.html' }
      const settings = prototypePlayerNavigateTo(home, 'settings')
  
      expect(settings).toEqual({
        currentId: 'settings',
        history: ['home'],
        missingHref: ''
      })
      expect(prototypePlayerNavigateTo(settings, 'settings')).toBe(settings)
      expect(prototypePlayerNavigateTo(settings, '   ')).toBe(settings)
  
      const checkout = prototypePlayerNavigateTo(settings, 'checkout')
      expect(checkout).toEqual({
        currentId: 'checkout',
        history: ['home', 'settings'],
        missingHref: ''
      })
  
      const backToSettings = prototypePlayerGoBack({ ...checkout, missingHref: '../missing/v2.html' })
      expect(backToSettings).toEqual({
        currentId: 'settings',
        history: ['home'],
        missingHref: ''
      })
      expect(prototypePlayerGoBack(checkout, 2)).toEqual({
        currentId: 'home',
        history: [],
        missingHref: ''
      })
      expect(prototypePlayerGoBack(checkout, 10)).toEqual({
        currentId: 'home',
        history: [],
        missingHref: ''
      })
      expect(prototypePlayerGoBack({ currentId: 'home', history: [], missingHref: '../missing/v3.html' })).toEqual({
        currentId: 'home',
        history: [],
        missingHref: ''
      })
    })
    it('builds missing-screen prompt values with the source HTML path', () => {
      expect(prototypeMissingScreenPromptValues(artifact('home', 'Home'), ' ../checkout/v1.html ')).toEqual({
        current: 'Home',
        href: '../checkout/v1.html',
        sourcePath: '.kun-design/doc/home/v1.html',
        suggestedTitle: 'Checkout'
      })
      expect(prototypeMissingScreenPromptValues(artifact('home', 'Home'), '   ')).toBeNull()
      expect(
        prototypeMissingScreenPromptValues(
          { ...artifact('board', 'Board', { relativePath: '.kun-design/doc/board.json' }), kind: 'canvas' },
          '../checkout/v1.html'
        )
      ).toBeNull()
    })
    it('suggests missing-screen titles from prototype hrefs', () => {
      expect(suggestedPrototypeScreenTitleFromHref('../checkout/v1.html')).toBe('Checkout')
      expect(suggestedPrototypeScreenTitleFromHref('/account-settings')).toBe('Account Settings')
      expect(suggestedPrototypeScreenTitleFromHref('#/billing-history')).toBe('Billing History')
      expect(suggestedPrototypeScreenTitleFromHref('Signup')).toBe('Signup')
      expect(suggestedPrototypeScreenTitleFromHref('.kun-design/doc/APIKeys/index.html')).toBe('API Keys')
      expect(suggestedPrototypeScreenTitleFromHref('   ')).toBe('New screen')
    })
    it('resolves prototype playback viewport from current target when no explicit frame exists', () => {
      expect(resolvePrototypeViewportFrame(artifact('home', 'Home'))).toEqual({
        width: 1280,
        height: 800,
        orientation: 'landscape'
      })
      expect(resolvePrototypeViewportFrame(artifact('home', 'Home'), 'app')).toEqual({
        width: 390,
        height: 844,
        orientation: 'portrait'
      })
    })
    it('treats implicit and auto-measured nodes as target defaults for playback', () => {
      const screen = artifact('home', 'Home', {
        node: { x: 160, y: 150, width: 300, height: 640, sizeMode: 'auto' }
      })
      const measuredLongPage = artifact('feed', 'Feed', {
        node: { x: 160, y: 150, width: 2340, height: 4745, sizeMode: 'auto' }
      })
  
      expect(resolvePrototypeViewportFrame(screen, 'app')).toEqual({
        width: 390,
        height: 844,
        orientation: 'portrait'
      })
      expect(resolvePrototypeViewportFrame(measuredLongPage, 'web')).toEqual({
        width: 1280,
        height: 800,
        orientation: 'landscape'
      })
    })
    it('retargets target-managed screen frames to the selected playback mode', () => {
      const previousWebDefault = artifact('home', 'Home', {
        node: { x: 80, y: 120, width: 1280, height: 800, sizeMode: 'auto' }
      })
      const previousAppDefault = artifact('home', 'Home', {
        node: { x: 80, y: 120, width: 390, height: 844, sizeMode: 'auto' }
      })
      const manualWebSized = artifact('home', 'Home', {
        node: { x: 80, y: 120, width: 1280, height: 800, sizeMode: 'manual' }
      })
  
      expect(resolvePrototypeViewportFrame(previousWebDefault, 'app')).toEqual({
        width: 390,
        height: 844,
        orientation: 'portrait'
      })
      expect(resolvePrototypeViewportFrame(previousAppDefault, 'web')).toEqual({
        width: 1280,
        height: 800,
        orientation: 'landscape'
      })
      expect(resolvePrototypeViewportFrame(manualWebSized, 'app')).toEqual({
        width: 390,
        height: 844,
        orientation: 'portrait'
      })
    })
    it('falls back from unreasonable manual document sizes during playback', () => {
      const highDpiOrDocumentSize = artifact('home', 'Home', {
        node: { x: 20, y: 40, width: 2340, height: 4745, sizeMode: 'manual' }
      })

      expect(resolvePrototypeViewportFrame(highDpiOrDocumentSize, 'app')).toEqual({
        width: 390,
        height: 844,
        orientation: 'portrait'
      })
    })
    it('respects manually sized prototype frames during playback', () => {
      const screen = artifact('kiosk', 'Kiosk', {
        node: { x: 20, y: 40, width: 1024, height: 1366, sizeMode: 'manual' }
      })
  
      expect(resolvePrototypeViewportFrame(screen, 'web')).toEqual({
        width: 1024,
        height: 1366,
        orientation: 'portrait'
      })
    })
    it('enables playback for any HTML artifact, including single-screen prototypes', () => {
      expect(hasPrototypePlayback([
        artifact('home', 'Home', { prototypeLinks: [{ targetTitle: 'Signup' }] }),
        artifact('signup', 'Signup')
      ])).toBe(true)
      expect(hasPrototypePlayback([
        artifact('home', 'Home'),
        artifact('signup', 'Signup')
      ])).toBe(true)
      expect(hasPrototypePlayback([
        artifact('home', 'Home', { prototypeLinks: [{ targetTitle: 'Missing' }] })
      ])).toBe(true)
      expect(hasPrototypePlayback([
        artifact('home', 'Home', { prototypeLinks: [{ targetTitle: 'Home', targetArtifactId: 'home' }] })
      ])).toBe(true)
      expect(hasPrototypePlayback([
        { ...artifact('board', 'Board', { relativePath: '.kun-design/doc/board.json' }), kind: 'canvas' as const }
      ])).toBe(false)
    })
    it('resolves links by id or normalized title and drops duplicate/self/missing targets', () => {
      const home = artifact('home', 'Home', {
        prototypeLinks: [
          { targetTitle: 'Signup', targetArtifactId: 'signup', label: 'Start trial' },
          { targetTitle: '  DASHBOARD  ' },
          { targetTitle: 'Dashboard' },
          { targetTitle: 'Home', targetArtifactId: 'home' },
          { targetTitle: 'Missing' }
        ]
      })
      const links = resolvePrototypeLinks(home, [
        home,
        artifact('signup', 'Signup'),
        artifact('dashboard', 'Dashboard')
      ])
  
      expect(links).toEqual([
        expect.objectContaining({
          targetArtifactId: 'signup',
          targetTitle: 'Signup',
          label: 'Start trial'
        }),
        expect.objectContaining({
          targetArtifactId: 'dashboard',
          targetTitle: 'Dashboard'
        })
      ])
    })
    it('resolves metadata links through a unique fuzzy page title match', () => {
      const home = artifact('home', 'Home', {
        prototypeLinks: [
          { targetTitle: 'Stats', label: 'Review stats' },
          { targetTitle: 'Settings' }
        ]
      })
      const links = resolvePrototypeLinks(home, [
        home,
        artifact('stats', 'Weekly Stats'),
        artifact('settings', 'Account Settings')
      ])
  
      expect(links).toEqual([
        expect.objectContaining({
          targetArtifactId: 'stats',
          targetTitle: 'Weekly Stats',
          label: 'Review stats'
        }),
        expect.objectContaining({
          targetArtifactId: 'settings',
          targetTitle: 'Account Settings'
        })
      ])
    })
    it('does not resolve metadata links through ambiguous fuzzy page titles', () => {
      const home = artifact('home', 'Home', {
        prototypeLinks: [{ targetTitle: 'Stats' }]
      })
      const links = resolvePrototypeLinks(home, [
        home,
        artifact('weekly', 'Weekly Stats'),
        artifact('monthly', 'Monthly Stats')
      ])
  
      expect(links.map((link) => link.targetArtifactId)).toEqual(['weekly', 'monthly'])
    })
    it('does not resolve metadata links through duplicate exact page titles', () => {
      const home = artifact('home', 'Home', {
        prototypeLinks: [{ targetTitle: 'Settings' }]
      })
      const links = resolvePrototypeLinks(home, [
        home,
        artifact('account-settings', 'Settings'),
        artifact('project-settings', 'Settings')
      ])
  
      expect(links).toEqual([
        expect.objectContaining({
          targetArtifactId: 'account-settings',
          href: '../account-settings/v1.html',
          label: 'Settings'
        }),
        expect.objectContaining({
          targetArtifactId: 'project-settings',
          href: '../project-settings/v1.html',
          label: 'Settings'
        })
      ])
    })
    it('synthesizes fallback links to sibling HTML pages when metadata is missing', () => {
      const home = artifact('home', 'Home', { relativePath: '.kun-design/doc/home/v1.html' })
      const signup = artifact('signup', 'Signup', { relativePath: '.kun-design/doc/signup/v1.html' })
      const dashboard = artifact('dashboard', 'Dashboard', { relativePath: '.kun-design/doc/dashboard/v1.html' })
  
      expect(resolvePrototypeLinks(home, [home, signup, dashboard])).toEqual([
        {
          targetArtifactId: 'signup',
          targetTitle: 'Signup',
          targetRelativePath: '.kun-design/doc/signup/v1.html',
          href: '../signup/v1.html',
          label: 'Signup'
        },
        {
          targetArtifactId: 'dashboard',
          targetTitle: 'Dashboard',
          targetRelativePath: '.kun-design/doc/dashboard/v1.html',
          href: '../dashboard/v1.html',
          label: 'Dashboard'
        }
      ])
    })
    it('uses current artifact versions for prototype links while resolving older version hrefs', () => {
      const homeV1 = '.kun-design/doc/home/v1.html'
      const homeV2 = '.kun-design/doc/home/v2.html'
      const threadsV1 = '.kun-design/doc/threads/v1.html'
      const threadsV2 = '.kun-design/doc/threads/v2.html'
      const home = artifact('home', 'Home', {
        relativePath: homeV2,
        versions: [
          { id: 'home-v2', relativePath: homeV2, createdAt: now, summary: 'New home' },
          { id: 'home-v1', relativePath: homeV1, createdAt: now, summary: 'Old home' }
        ]
      })
      const threads = artifact('threads', 'Threads', {
        relativePath: threadsV2,
        versions: [
          { id: 'threads-v2', relativePath: threadsV2, createdAt: now, summary: 'New threads' },
          { id: 'threads-v1', relativePath: threadsV1, createdAt: now, summary: 'Old threads' }
        ]
      })
      const links = resolvePrototypeLinks(home, [home, threads])

      expect(resolvePrototypeScreens([home, threads])).toEqual([
        { id: 'home', title: 'Home', relativePath: homeV2 },
        { id: 'threads', title: 'Threads', relativePath: threadsV2 }
      ])
      expect(links).toEqual([
        {
          targetArtifactId: 'threads',
          targetTitle: 'Threads',
          targetRelativePath: threadsV2,
          targetRelativePaths: [threadsV2, threadsV1],
          href: '../threads/v2.html',
          label: 'Threads'
        }
      ])
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v2.html#kun-proto-nav=..%2Fthreads%2Fv1.html',
          'file:///workspace/.kun-design/doc/home/v2.html',
          links
        )?.targetArtifactId
      ).toBe('threads')
    })
    it('keeps explicit prototype links first and appends fallback sibling pages', () => {
      const home = artifact('home', 'Home', {
        prototypeLinks: [{ targetTitle: 'Signup', targetArtifactId: 'signup', label: 'Start trial' }]
      })
      const signup = artifact('signup', 'Signup')
      const dashboard = artifact('dashboard', 'Dashboard')
  
      expect(resolvePrototypeLinks(home, [home, signup, dashboard])).toEqual([
        expect.objectContaining({
          targetArtifactId: 'signup',
          label: 'Start trial'
        }),
        expect.objectContaining({
          targetArtifactId: 'dashboard',
          href: '../dashboard/v1.html',
          label: 'Dashboard'
        })
      ])
    })
    it('resolves prototype navigation from captured href hashes or absolute urls', () => {
      const home = artifact('home', 'Home', {
        prototypeLinks: [
          {
            targetTitle: 'Signup',
            targetArtifactId: 'signup',
            href: '../signup/v1.html',
            label: 'Start trial'
          }
        ]
      })
      const links = resolvePrototypeLinks(home, [home, artifact('signup', 'Signup')])
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
  
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=..%2Fsignup%2Fv1.html',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('signup')
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/signup/v1.html?rev=2',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('signup')
      expect(resolvePrototypeNavigationTarget('https://example.com', currentFileUrl, links)).toBeNull()
    })
    it('resolves captured workspace-relative paths through fallback sibling links', () => {
      const home = artifact('home', 'Home', { relativePath: '.kun-design/doc/home/v1.html' })
      const signup = artifact('signup', 'Signup', { relativePath: '.kun-design/doc/signup/v1.html' })
      const links = resolvePrototypeLinks(home, [home, signup])
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
  
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=.kun-design%2Fdoc%2Fsignup%2Fv1.html',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('signup')
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=%2Fsignup%2Fv1.html%3Ffrom%3Dhome',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('signup')
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=signup%2Fv1.html',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('signup')
    })
    it('resolves captured prototype target titles to sibling pages', () => {
      const home = artifact('home', 'Home')
      const signup = artifact('signup', 'Signup')
      const links = resolvePrototypeLinks(home, [home, signup])
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
  
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=Signup',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('signup')
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#kun-proto-nav=%20%20signup%20%20',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('signup')
    })
    it('resolves plain hash target titles to sibling pages when they are unique', () => {
      const home = artifact('home', 'Home')
      const checkout = artifact('checkout', 'Checkout')
      const accountSettings = artifact('account-settings', 'Account Settings')
      const links = resolvePrototypeLinks(home, [home, checkout, accountSettings])
      const currentFileUrl = 'file:///workspace/.kun-design/doc/home/v1.html'
  
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#Checkout',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('checkout')
      expect(
        resolvePrototypeNavigationTarget(
          'file:///workspace/.kun-design/doc/home/v1.html#account-settings',
          currentFileUrl,
          links
        )?.targetArtifactId
      ).toBe('account-settings')
    })
})
