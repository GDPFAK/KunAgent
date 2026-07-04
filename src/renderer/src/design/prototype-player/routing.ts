import type { DesignArtifact, DesignPrototypeLink } from "../design-types"
import {
  defaultFrameSizeForDesignTarget,
  defaultPreviewNodeSizeForDesignTarget
} from "../design-context"

export type PrototypePlayerLink = DesignPrototypeLink & {
  targetArtifactId: string
  targetTitle: string
  targetRelativePath?: string
  targetRelativePaths?: readonly string[]
}

export type PrototypePlayerScreen = {
  id: string
  title: string
  relativePath: string
}

export type PrototypePlayerViewportFrame = {
  width: number
  height: number
  orientation: 'landscape' | 'portrait'
}

export type PrototypePlayerNavigationState = {
  currentId: string | null
  history: readonly string[]
  missingHref: string
}

export type PrototypeMissingScreenPromptValues = {
  current: string
  href: string
  sourcePath: string
  suggestedTitle: string
}

export const PROTOTYPE_NAV_HASH_PREFIX = 'kun-proto-nav='

export const PROTOTYPE_BACK_HASH_PREFIX = 'kun-proto-back='

export const PROTOTYPE_NAV_SELECTOR =
  'a[href],[data-prototype-href],[data-href],[data-prototype-target],[data-target],[onclick],button[data-href],button[data-prototype-href],button[data-prototype-target],button[data-target]'

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function titleTokens(title: string): string[] {
  return normalizeTitle(title).split(' ').filter(Boolean)
}

export function fuzzyTitleMatch(query: string, candidate: string): boolean {
  const queryTokens = titleTokens(query)
  const candidateTokens = titleTokens(candidate)
  if (queryTokens.length === 0 || candidateTokens.length === 0) return false
  return (
    queryTokens.every((token) => candidateTokens.includes(token)) ||
    candidateTokens.every((token) => queryTokens.includes(token))
  )
}

export function uniqueFuzzyLinkTitleMatch(
  query: string,
  links: readonly PrototypePlayerLink[]
): PrototypePlayerLink | null {
  const matches = links.filter((link) => fuzzyTitleMatch(query, link.targetTitle))
  return matches.length === 1 ? matches[0] : null
}

export function uniqueExactLinkTitleMatch(
  query: string,
  links: readonly PrototypePlayerLink[]
): PrototypePlayerLink | null {
  const normalized = normalizeTitle(query)
  if (!normalized) return null
  const matches = links.filter((link) => normalizeTitle(link.targetTitle) === normalized)
  return matches.length === 1 ? matches[0] : null
}

export function normalizeUrlForCompare(value: string, baseUrl: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed, baseUrl)
    url.hash = ''
    url.search = ''
    return url.href
  } catch {
    return trimmed
  }
}

export function normalizePathForCompare(value: string): string {
  return cleanPrototypePath(value).toLowerCase()
}

export function cleanPrototypePath(value: string): string {
  return value.trim().replaceAll('\\', '/').replace(/[?#].*$/, '').replace(/^\/+/, '')
}

export function isPageLikePrototypePath(value: string): boolean {
  const path = value.trim().replaceAll('\\', '/').replace(/[?#].*$/, '').replace(/^\/+/, '')
  if (!path || path === '.' || path === '..') return false
  return /\.(?:html|htm)$/i.test(path) || !/\.[a-z0-9]{2,8}$/i.test(path)
}

export function extractPrototypeHashRouteHref(navigationUrl: string): string | null {
  let hash = extractPrototypeHashValue(navigationUrl)
  if (!hash || hash.startsWith(PROTOTYPE_NAV_HASH_PREFIX)) return null
  if (hash.startsWith('!')) hash = hash.slice(1)
  const routeLike =
    /^(?:\/|\.\/|\.\.\/)/.test(hash) ||
    /\.(?:html|htm)(?:[?#].*)?$/i.test(hash)
  return routeLike && isPageLikePrototypePath(hash) ? hash : null
}

export function extractPrototypeHashValue(navigationUrl: string): string | null {
  const raw = navigationUrl.trim()
  if (!raw) return null
  let hash = ''
  if (raw.startsWith('#')) {
    hash = raw.slice(1)
  } else {
    try {
      hash = new URL(raw).hash.slice(1)
    } catch {
      return null
    }
  }
  if (!hash) return null
  try {
    return decodeURIComponent(hash)
  } catch {
    return hash
  }
}

export function extractPrototypePlainHashTarget(navigationUrl: string): string | null {
  let hash = extractPrototypeHashValue(navigationUrl)
  if (!hash || hash.startsWith(PROTOTYPE_NAV_HASH_PREFIX) || hash.startsWith(PROTOTYPE_BACK_HASH_PREFIX)) {
    return null
  }
  if (extractPrototypeHashRouteHref(navigationUrl)) return null
  if (hash.startsWith('!')) hash = hash.slice(1)
  const cleaned = hash.replace(/[?#].*$/, '').replace(/^\/+/, '').trim()
  return cleaned ? humanizeRouteSegment(cleaned) : null
}

export function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function humanizeRouteSegment(segment: string): string {
  const cleaned = decodePathSegment(segment)
    .replace(/\.(?:html?|xhtml)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  return cleaned
    .split(' ')
    .map((word) => (/^[A-Z0-9]{2,}$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(' ')
}

export function normalizeRouteSlug(value: string): string {
  return normalizeTitle(value.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '))
}

export function routeSlugCandidates(value: string, baseUrl: string): string[] {
  const raw = value.trim()
  if (!raw) return []
  let path = raw
  try {
    path = new URL(raw, baseUrl).pathname
  } catch {
    // Keep the raw relative value when it is not parseable as a URL.
  }
  const segments = cleanPrototypePath(path).split('/').filter(Boolean).map(decodePathSegment)
  if (segments.length === 0) return []
  const last = segments[segments.length - 1]
  const lastSlug = normalizeRouteSlug(last)
  const sourceSegments =
    /^(?:index|v\d+)$/i.test(lastSlug) && segments.length > 1
      ? [segments[segments.length - 2]]
      : [last]
  const slugs = sourceSegments
    .map(normalizeRouteSlug)
    .filter((slug) => slug && !/^(?:index|v\d+)$/.test(slug))
  return Array.from(new Set(slugs))
}

export function uniqueRouteSlugLinkMatch(
  href: string,
  currentFileUrl: string,
  links: readonly PrototypePlayerLink[]
): PrototypePlayerLink | null {
  const slugs = routeSlugCandidates(href, currentFileUrl)
  if (slugs.length === 0) return null
  const matches = links.filter((link) => {
    const linkIdSlug = normalizeRouteSlug(link.targetArtifactId)
    const linkPathSlugs = link.targetRelativePath ? routeSlugCandidates(link.targetRelativePath, currentFileUrl) : []
    return slugs.some((slug) => (
      slug === linkIdSlug ||
      linkPathSlugs.includes(slug) ||
      fuzzyTitleMatch(slug, link.targetTitle)
    ))
  })
  return matches.length === 1 ? matches[0] : null
}

export function uniqueRelativePathLinkMatch(
  href: string,
  links: readonly PrototypePlayerLink[]
): PrototypePlayerLink | null {
  const normalizedPath = normalizePathForCompare(href)
  if (!normalizedPath) return null
  const pathHasDirectory = normalizedPath.includes('/')
  const matches = links.filter((link) => {
    const targetPaths = [
      ...(link.targetRelativePath ? [link.targetRelativePath] : []),
      ...(link.targetRelativePaths ?? [])
    ]
    return targetPaths.some((path) => {
      const targetPath = normalizePathForCompare(path)
      return (
        normalizedPath === targetPath ||
        normalizedPath.endsWith(`/${targetPath}`) ||
        (pathHasDirectory && targetPath.endsWith(`/${normalizedPath}`))
      )
    })
  })
  return matches.length === 1 ? matches[0] : null
}

export function buildRelativePrototypeHref(fromHtmlPath: string, toHtmlPath: string): string {
  const fromParts = cleanPrototypePath(fromHtmlPath).split('/').filter(Boolean)
  const targetParts = cleanPrototypePath(toHtmlPath).split('/').filter(Boolean)
  fromParts.pop()
  let shared = 0
  while (
    shared < fromParts.length &&
    shared < targetParts.length &&
    fromParts[shared] === targetParts[shared]
  ) {
    shared += 1
  }
  const up = fromParts.slice(shared).map(() => '..')
  const down = targetParts.slice(shared)
  return [...up, ...down].join('/') || './'
}

export function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function sameSize(
  actual: { width: number; height: number },
  expected: { width: number; height: number }
): boolean {
  return Math.abs(actual.width - expected.width) <= 0.5 && Math.abs(actual.height - expected.height) <= 0.5
}

export function viewportFrameFromSize(size: { width: number; height: number }): PrototypePlayerViewportFrame {
  const width = Math.max(1, Math.round(size.width))
  const height = Math.max(1, Math.round(size.height))
  return {
    width,
    height,
    orientation: height > width ? 'portrait' : 'landscape'
  }
}

export function isReasonablePrototypeViewportSize(size: { width: number; height: number }): boolean {
  const width = Math.round(size.width)
  const height = Math.round(size.height)
  return (
    positiveFinite(width) &&
    positiveFinite(height) &&
    width >= 240 &&
    height >= 240 &&
    width <= 1920 &&
    height <= 1600
  )
}

export function isTargetManagedAutoNodeSize(size: { width: number; height: number }): boolean {
  return (
    sameSize(size, defaultPreviewNodeSizeForDesignTarget('web')) ||
    sameSize(size, defaultPreviewNodeSizeForDesignTarget('app')) ||
    sameSize(size, defaultFrameSizeForDesignTarget('web')) ||
    sameSize(size, defaultFrameSizeForDesignTarget('app'))
  )
}

export function resolvePrototypeViewportFrame(
  artifact: DesignArtifact | null | undefined,
  fallbackTarget?: unknown
): PrototypePlayerViewportFrame {
  const fallback = defaultFrameSizeForDesignTarget(fallbackTarget)
  const node = artifact?.kind === 'html' ? artifact.node : undefined
  if (!node || !positiveFinite(node.width) || !positiveFinite(node.height)) {
    return viewportFrameFromSize(fallback)
  }
  const nodeSize = { width: node.width, height: node.height }
  if (node.sizeMode !== 'manual') {
    return viewportFrameFromSize(fallback)
  }
  if (isTargetManagedAutoNodeSize(nodeSize) || !isReasonablePrototypeViewportSize(nodeSize)) {
    return viewportFrameFromSize(fallback)
  }
  return viewportFrameFromSize(nodeSize)
}

export function shouldCapturePrototypeNavigationHref(value: string, baseUrl: string): boolean {
  const raw = value.trim()
  if (!raw || raw.startsWith('?')) return false
  if (raw.startsWith('#')) return extractPrototypeHashRouteHref(raw) !== null
  if (/^(?:javascript|mailto|tel|data):/i.test(raw)) return false
  if (!/^[a-z][a-z\d+.-]*:/i.test(raw)) return isPageLikePrototypePath(raw)
  try {
    const url = new URL(raw, baseUrl)
    const base = new URL(baseUrl)
    if (url.protocol === 'file:') return isPageLikePrototypePath(url.pathname)
    return url.origin === base.origin && isPageLikePrototypePath(url.pathname)
  } catch {
    return false
  }
}

export function extractPrototypeNavigationHref(navigationUrl: string): string | null {
  const raw = navigationUrl.trim()
  if (!raw) return null
  const hash = raw.startsWith('#')
    ? raw.slice(1)
    : (() => {
        try {
          return new URL(raw).hash.slice(1)
        } catch {
          return ''
        }
      })()
  if (!hash.startsWith(PROTOTYPE_NAV_HASH_PREFIX)) return null
  return decodeURIComponent(hash.slice(PROTOTYPE_NAV_HASH_PREFIX.length))
}

export function isPrototypeBackNavigation(navigationUrl: string): boolean {
  return prototypeBackNavigationSteps(navigationUrl) !== null
}

export function prototypeBackNavigationSteps(navigationUrl: string): number | null {
  const raw = navigationUrl.trim()
  if (!raw) return null
  let hash = ''
  if (raw.startsWith('#')) {
    hash = raw.slice(1)
  } else {
    try {
      hash = new URL(raw).hash.slice(1)
    } catch {
      return null
    }
  }
  try {
    hash = decodeURIComponent(hash)
  } catch {
    // Keep the raw hash when it is not URI-encoded cleanly.
  }
  if (!hash.startsWith(PROTOTYPE_BACK_HASH_PREFIX)) return null
  const payload = hash.slice(PROTOTYPE_BACK_HASH_PREFIX.length)
  try {
    const params = new URLSearchParams(payload)
    const steps = Number(params.get('steps'))
    if (Number.isFinite(steps) && steps > 0) return Math.max(1, Math.floor(steps))
  } catch {
    // Legacy back signals had an opaque timestamp after the prefix.
  }
  return 1
}

export function resolvePrototypeNavigationTarget(
  navigationUrl: string,
  currentFileUrl: string,
  links: readonly PrototypePlayerLink[]
): PrototypePlayerLink | null {
  const capturedHref = extractPrototypeNavigationHref(navigationUrl)
  const hashRouteHref = capturedHref
    ? extractPrototypeHashRouteHref(capturedHref)
    : extractPrototypeHashRouteHref(navigationUrl)
  const hashTarget = capturedHref
    ? extractPrototypePlainHashTarget(capturedHref)
    : extractPrototypePlainHashTarget(navigationUrl)
  const href = hashRouteHref ?? hashTarget ?? capturedHref ?? navigationUrl
  const normalizedHref = normalizeUrlForCompare(href, currentFileUrl)
  const normalizedTargetTitle = normalizeTitle(href)
  if (!normalizedTargetTitle) return null
  for (const link of links) {
    if (link.href) {
      if (href === link.href) return link
      const normalizedLink = normalizeUrlForCompare(link.href, currentFileUrl)
      if (normalizedHref && normalizedLink && normalizedHref === normalizedLink) return link
    }
  }
  return (
    uniqueRelativePathLinkMatch(href, links) ??
    uniqueExactLinkTitleMatch(href, links) ??
    uniqueRouteSlugLinkMatch(href, currentFileUrl, links) ??
    uniqueFuzzyLinkTitleMatch(href, links)
  )
}
