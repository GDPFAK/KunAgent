import { DESIGN_RESIZE_RESPONSIVE_LINES, formatDesignContextLines, type DesignContext } from '../design-context'
import type { DesignHtmlQualityAuditSibling, DesignHtmlQualityFinding } from './types'
import { ACTIONABLE_RECORD_TEXT_RE, FEEDBACK_MESSAGE_CLASS_RE, FEEDBACK_MESSAGE_CONTEXT_RE, GENERIC_FEEDBACK_MESSAGE_RE, GENERIC_RECOVERABLE_STATE_COPY_RE, PROTOTYPE_NAV_HASH_PREFIX, RECOVERABLE_STATE_CONTEXT_RE, RECOVERABLE_STATE_HEADING_RE, RECOVERABLE_STATE_TEXT_RE, STATE_MODULE_CLASS_RE, STATUS_AFFORDANCE_ATTRIBUTE_RE, STATUS_AFFORDANCE_CLASS_RE, STATUS_AFFORDANCE_STYLE_RE, STATUS_VALUE_ONLY_RE, textContent } from './patterns'
import { concreteDataSignalCount, contentForDataRealism } from './product-and-hero-content'

export function countPatternHits(text: string, patterns: readonly RegExp[]): number {
  return patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0)
}

export function pushFinding(
  findings: DesignHtmlQualityFinding[],
  finding: DesignHtmlQualityFinding
): void {
  if (!findings.some((item) => item.code === finding.code)) findings.push(finding)
}

export function normalizePath(path: string): string {
  return path.trim().replaceAll('\\', '/')
}

export function isPageLikePrototypeTargetPath(value: string): boolean {
  const path = normalizePath(value).replace(/[?#].*$/, '').replace(/^\/+/, '')
  if (!path || path === '.' || path === '..') return false
  return /\.(?:html|htm)$/i.test(path) || !/\.[a-z0-9]{2,8}$/i.test(path)
}

export function extractPrototypeHashRouteTarget(target: string): string | null {
  const raw = target.trim()
  if (!raw.startsWith('#')) return null
  let hash = raw.slice(1)
  if (!hash) return null
  try {
    hash = decodeURIComponent(hash)
  } catch {
    // Keep the raw hash when it is not URI-encoded cleanly.
  }
  if (!hash || hash.startsWith(PROTOTYPE_NAV_HASH_PREFIX)) return null
  if (hash.startsWith('!')) hash = hash.slice(1)
  const routeLike =
    /^(?:\/|\.\/|\.\.\/)/.test(hash) ||
    /\.(?:html|htm)(?:[?#].*)?$/i.test(hash)
  return routeLike && isPageLikePrototypeTargetPath(hash) ? hash : null
}

export function normalizePrototypeTarget(target: string): string {
  return normalizePath(extractPrototypeHashRouteTarget(target) ?? target)
    .replace(/[?#].*$/, '')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function decodePrototypePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function normalizePrototypeRouteSlug(value: string): string {
  return normalizePrototypeTarget(value.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '))
}

export function prototypeTitleTokens(value: string): string[] {
  return normalizePrototypeRouteSlug(value).split(' ').filter(Boolean)
}

export function fuzzyPrototypeSlugMatch(query: string, candidate: string): boolean {
  const queryTokens = prototypeTitleTokens(query)
  const candidateTokens = prototypeTitleTokens(candidate)
  if (queryTokens.length === 0 || candidateTokens.length === 0) return false
  return (
    queryTokens.every((token) => candidateTokens.includes(token)) ||
    candidateTokens.every((token) => queryTokens.includes(token))
  )
}

export function prototypeRouteSlugCandidates(value: string): string[] {
  const segments = normalizePath(extractPrototypeHashRouteTarget(value) ?? value)
    .replace(/[?#].*$/, '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map(decodePrototypePathSegment)
  if (segments.length === 0) return []
  const last = segments[segments.length - 1]
  const lastSlug = normalizePrototypeRouteSlug(last)
  const sourceSegments =
    /^(?:index|v\d+)$/i.test(lastSlug) && segments.length > 1
      ? [segments[segments.length - 2]]
      : [last]
  const slugs = sourceSegments
    .map(normalizePrototypeRouteSlug)
    .filter((slug) => slug && !/^(?:index|v\d+)$/.test(slug))
  return Array.from(new Set(slugs))
}

export function prototypeExactTargetsForScreen(screen: DesignHtmlQualityAuditSibling): string[] {
  return [screen.htmlPath, screen.prototypeHref ?? '', screen.name ?? '']
    .map(normalizePrototypeTarget)
    .filter(Boolean)
}

export function prototypeRouteSlugsForScreen(screen: DesignHtmlQualityAuditSibling): string[] {
  return Array.from(new Set([
    ...prototypeRouteSlugCandidates(screen.htmlPath),
    ...prototypeRouteSlugCandidates(screen.prototypeHref ?? ''),
    normalizePrototypeRouteSlug(screen.name ?? '')
  ].filter(Boolean)))
}

export function matchingSiblingScreensForPrototypeTarget(
  target: string,
  siblingScreens: DesignHtmlQualityAuditSibling[] | undefined
): DesignHtmlQualityAuditSibling[] {
  const siblings = siblingScreens ?? []
  if (siblings.length === 0) return []
  const normalized = normalizePrototypeTarget(target)
  const exactMatches = siblings.filter((screen) => prototypeExactTargetsForScreen(screen).includes(normalized))
  if (exactMatches.length > 0) return exactMatches.length === 1 ? exactMatches : []
  const targetSlugs = prototypeRouteSlugCandidates(target)
  if (targetSlugs.length === 0) return []
  const slugMatches = siblings.filter((screen) => {
    const screenSlugs = prototypeRouteSlugsForScreen(screen)
    return targetSlugs.some((slug) =>
      screenSlugs.some((screenSlug) => slug === screenSlug || fuzzyPrototypeSlugMatch(slug, screenSlug))
    )
  })
  return slugMatches.length === 1 ? slugMatches : []
}

export function attributeValues(html: string, name: string): string[] {
  const values: string[] = []
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const value = match[1]?.trim()
    if (value) values.push(value)
  }
  return values
}

export function onclickAttributeValues(html: string): string[] {
  const values: string[] = []
  const re = /\bonclick\s*=\s*(["'])([\s\S]*?)\1/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const value = match[2]?.trim()
    if (value) values.push(value)
  }
  return values
}

export function onsubmitAttributeValues(html: string): string[] {
  const values: string[] = []
  const re = /\bonsubmit\s*=\s*(["'])([\s\S]*?)\1/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const value = match[2]?.trim()
    if (value) values.push(value)
  }
  return values
}

export function prototypeTargetFromInlineHandler(handler: string | undefined): string | undefined {
  const text = handler?.trim()
  if (!text) return undefined
  const historyMatch = text.match(/(?:window\.)?history\.(?:pushState|replaceState)\s*\(\s*[\s\S]*?,\s*(['"])[^'"]*\1\s*,\s*(['"])([^'"]+)\2\s*\)/i)
  if (historyMatch?.[3]) return historyMatch[3].trim()
  const assignMatch = text.match(/(?:window\.)?location\.(?:assign|replace)\s*\(\s*(['"])([^'"]+)\1\s*\)/i)
  if (assignMatch?.[2]) return assignMatch[2].trim()
  const hrefMatch = text.match(/(?:window\.)?location(?:\.href)?\s*=\s*(['"])([^'"]+)\1/i)
  if (hrefMatch?.[2]) return hrefMatch[2].trim()
  const hashMatch = text.match(/(?:window\.)?location\.hash\s*=\s*(['"])([^'"]+)\1/i)
  return hashMatch?.[2]?.trim() || undefined
}

export function isPrototypeBackInlineHandler(handler: string | undefined): boolean {
  const text = handler?.trim()
  if (!text) return false
  return (
    /(?:window\.)?history\.back\s*\(\s*\)/i.test(text) ||
    /(?:window\.)?history\.go\s*\(\s*-\d+\s*\)/i.test(text)
  )
}

export function inlinePrototypeNavigationTargets(html: string): string[] {
  return [
    ...onclickAttributeValues(html),
    ...onsubmitAttributeValues(html)
  ]
    .map(prototypeTargetFromInlineHandler)
    .filter((value): value is string => Boolean(value))
}

export function prototypeTargetAttributeValues(html: string): string[] {
  return [
    ...attributeValues(html, 'href'),
    ...attributeValues(html, 'data-href'),
    ...attributeValues(html, 'data-prototype-href'),
    ...attributeValues(html, 'data-prototype-target'),
    ...attributeValues(html, 'data-target'),
    ...inlinePrototypeNavigationTargets(html)
  ]
}

export function tagMatches(html: string, tagName: string): string[] {
  const tags: string[] = []
  const re = new RegExp(`<${tagName}\\b[^>]*>`, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) tags.push(match[0])
  return tags
}

export function pairedTagMatches(html: string, tagName: string): Array<{ tag: string; inner: string }> {
  const tags: Array<{ tag: string; inner: string }> = []
  const re = new RegExp(`(<${tagName}\\b[^>]*>)([\\s\\S]*?)<\\/${tagName}>`, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) tags.push({ tag: match[1] ?? '', inner: match[2] ?? '' })
  return tags
}

export function attributeValue(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i')
  return re.exec(tag)?.[1]?.trim()
}

export function hasHashTarget(html: string, hash: string): boolean {
  const id = hash.replace(/^#/, '').trim()
  if (!id) return false
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b(id|name)\\s*=\\s*["']${escaped}["']`, 'i').test(html)
}

export function isDeadHrefTarget(target: string | undefined, html?: string): boolean {
  const raw = (target ?? '').trim()
  const lower = raw.toLowerCase()
  if (!raw || raw === '#') return true
  if (/^javascript\s*:/i.test(raw)) return true
  if (lower === 'void(0)' || lower === 'javascript:void(0)' || lower === 'javascript:;') return true
  if (extractPrototypeHashRouteTarget(raw)) return false
  if (raw.startsWith('#')) return html ? !hasHashTarget(html, raw) : false
  return false
}

export function deadAnchorTags(html: string): string[] {
  return tagMatches(html, 'a').filter((tag) =>
    isDeadHrefTarget(attributeValue(tag, 'href'), html) &&
    !prototypeTargetFromInlineHandler(onclickAttributeValues(tag)[0]) &&
    !isPrototypeBackInlineHandler(onclickAttributeValues(tag)[0])
  )
}

export function hasUsefulAnchorTarget(html: string): boolean {
  return tagMatches(html, 'a').some((tag) =>
    !isDeadHrefTarget(attributeValue(tag, 'href'), html) ||
    Boolean(prototypeTargetFromInlineHandler(onclickAttributeValues(tag)[0])) ||
    isPrototypeBackInlineHandler(onclickAttributeValues(tag)[0])
  )
}

export function hasScriptedInteraction(html: string): boolean {
  return (
    /\son(click|change|input|submit|keydown|keyup|pointerdown|mousedown)\s*=/i.test(html) ||
    /<script\b[\s\S]*?\b(addEventListener|onclick|onchange|onsubmit|classList|aria-expanded|aria-pressed|preventDefault)\b[\s\S]*?<\/script>/i.test(html)
  )
}

export function hasFormFeedbackScript(html: string): boolean {
  return (
    /\sonsubmit\s*=/i.test(html) ||
    /<script\b[\s\S]*?\b(submit|onsubmit|preventDefault|FormData|classList|toast|alert|aria-busy)\b[\s\S]*?<\/script>/i.test(html)
  )
}

export function hasInteractiveControls(html: string): boolean {
  return /<(button|input|select|textarea)\b/i.test(html) || /\brole=["'](button|switch|tab|checkbox|radio|link)["']/i.test(html)
}

export function hasStaticPrimaryAction(html: string): boolean {
  return /<(button|a|input|select|textarea)\b/i.test(html) || /\brole=["']button["']/i.test(html)
}

export function hasInteractionStateAffordance(html: string): boolean {
  return (
    /:(hover|active)\b/i.test(html) ||
    /\[(aria-pressed|aria-expanded|aria-selected|aria-disabled|data-state|disabled)\]/i.test(html) ||
    /\b(aria-pressed|aria-expanded|aria-selected|aria-disabled|data-state|disabled)\s*=/i.test(html)
  )
}

export function isSkippableInput(tag: string): boolean {
  const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
  return ['hidden', 'button', 'submit', 'reset', 'image'].includes(type)
}

export function isWrappedByLabel(html: string, tag: string): boolean {
  const index = html.indexOf(tag)
  if (index < 0) return false
  const before = html.slice(0, index)
  const open = before.lastIndexOf('<label')
  const close = before.lastIndexOf('</label')
  return open > close && html.indexOf('</label>', index) > index
}

export function hasAssociatedLabel(html: string, tag: string): boolean {
  if (attributeValue(tag, 'aria-label') || attributeValue(tag, 'aria-labelledby') || attributeValue(tag, 'title')) {
    return true
  }
  const id = attributeValue(tag, 'id')
  if (id) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*["']${escaped}["']`, 'i').test(html)) return true
  }
  return isWrappedByLabel(html, tag)
}

export function unlabeledFieldTags(html: string): string[] {
  const fields = [
    ...tagMatches(html, 'input').filter((tag) => !isSkippableInput(tag)),
    ...tagMatches(html, 'select'),
    ...tagMatches(html, 'textarea')
  ]
  return fields.filter((tag) => !hasAssociatedLabel(html, tag))
}

export function hasControlAccessibleName(tag: string, inner: string): boolean {
  if (attributeValue(tag, 'aria-label') || attributeValue(tag, 'aria-labelledby') || attributeValue(tag, 'title')) {
    return true
  }
  if (textContent(inner)) return true
  return ['alt', 'title', 'aria-label', 'aria-labelledby'].some((name) => attributeValues(inner, name).length > 0)
}

export function unnamedIconOnlyControlTags(html: string): string[] {
  const controls = [...pairedTagMatches(html, 'button'), ...pairedTagMatches(html, 'a')]
  return controls
    .filter(({ tag, inner }) => !hasControlAccessibleName(tag, inner))
    .map(({ tag }) => tag)
}

export function hasCardLikeClass(tag: string): boolean {
  const className = attributeValue(tag, 'class') ?? ''
  return className
    .split(/\s+/)
    .filter(Boolean)
    .some((token) => /^(card|panel|surface|tile)$/.test(token) || /-(card|panel|surface|tile)$/.test(token))
}

export function normalizedClassText(tag: string): string {
  return (attributeValue(tag, 'class') ?? '').replace(/[-_]/g, ' ').toLowerCase()
}

export function statusValueLabel(text: string): boolean {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？:]+$/g, '')
    .trim()
  return normalized.length <= 32 && STATUS_VALUE_ONLY_RE.test(normalized)
}

export function hasStatusAffordanceMarkup(markup: string): boolean {
  if (!markup) return false
  if (STATUS_AFFORDANCE_ATTRIBUTE_RE.test(markup)) return true
  if (STATUS_AFFORDANCE_STYLE_RE.test(markup)) return true
  const classValues = attributeValues(markup, 'class')
    .join(' ')
    .replace(/[-_]/g, ' ')
    .toLowerCase()
  return STATUS_AFFORDANCE_CLASS_RE.test(classValues)
}

export function hasStatusAffordanceTag(tag: string, inner: string): boolean {
  return hasStatusAffordanceMarkup(tag) || hasStatusAffordanceMarkup(inner)
}

export function weakStatusAffordanceTags(html: string): string[] {
  const weak = ['td', 'li', 'span', 'div']
    .flatMap((tagName) => pairedTagMatches(html, tagName).map((match) => ({ ...match, tagName })))
    .filter(({ tag, inner, tagName }) => {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') {
        return false
      }
      if ((tagName === 'td' || tagName === 'li') && /<(?:span|div|strong|em|b|i)\b/i.test(inner)) return false
      return statusValueLabel(textContent(inner)) && !hasStatusAffordanceTag(tag, inner)
    })
    .map(({ tag }) => tag)
  return weak.length >= 2 ? weak : []
}

export function hasRecoverableStateClass(tag: string): boolean {
  return STATE_MODULE_CLASS_RE.test(normalizedClassText(tag))
}

export function staticHeadingTexts(inner: string): string[] {
  const headings: string[] = []
  for (const tagName of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    headings.push(...pairedTagMatches(inner, tagName).map(({ inner: heading }) => textContent(heading)))
  }
  return headings.map((heading) => heading.trim()).filter(Boolean)
}

export function hasRecoverableStateSignal(tag: string, inner: string): boolean {
  const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
  if (['alert', 'status'].includes(role) || attributeValue(tag, 'aria-live')) return RECOVERABLE_STATE_TEXT_RE.test(textContent(inner))
  if (hasRecoverableStateClass(tag) && RECOVERABLE_STATE_TEXT_RE.test(textContent(inner))) return true
  return staticHeadingTexts(inner).some((heading) => RECOVERABLE_STATE_HEADING_RE.test(heading))
}

export function hasStateRecoveryAction(inner: string): boolean {
  if (tagMatches(inner, 'button').some((tag) => !/\bdisabled\b/i.test(tag))) return true
  if (tagMatches(inner, 'input').some((tag) => {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    return ['button', 'submit'].includes(type) && !/\bdisabled\b/i.test(tag)
  })) return true
  if (tagMatches(inner, 'a').some((tag) => !isDeadHrefTarget(attributeValue(tag, 'href'), inner))) return true
  return /\brole\s*=\s*["'](?:button|link)["']/i.test(inner)
}

export function genericRecoverableStateCopy(block: string): boolean {
  const text = contentForDataRealism(textContent(block))
    .replace(/\s+/g, ' ')
    .trim()
  return (
    GENERIC_RECOVERABLE_STATE_COPY_RE.test(text) &&
    !RECOVERABLE_STATE_CONTEXT_RE.test(text) &&
    concreteDataSignalCount(text) < 2
  )
}

export function genericRecoverableStateCopyTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if ((attributeValue(tag, 'aria-busy') ?? '').toLowerCase() === 'true') continue
      const block = `${tag}${inner}`
      if (!hasRecoverableStateSignal(tag, inner) || !hasStateRecoveryAction(inner)) continue
      if (genericRecoverableStateCopy(block)) weak.push(tag)
    }
  }
  return weak
}

export function hasFeedbackMessageSignal(tag: string): boolean {
  const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
  if (['alert', 'status'].includes(role) || attributeValue(tag, 'aria-live')) return true
  const metadata = [
    attributeValue(tag, 'class') ?? '',
    attributeValue(tag, 'id') ?? '',
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'title') ?? ''
  ].join(' ').replace(/[-_]/g, ' ')
  return FEEDBACK_MESSAGE_CLASS_RE.test(metadata)
}

export function normalizedFeedbackMessageText(text: string): string {
  return text
    .replace(/\b(?:loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？:]+$/g, '')
    .trim()
}

export function genericFeedbackMessageCopy(text: string): boolean {
  const normalized = normalizedFeedbackMessageText(text)
  return normalized.length > 0 && normalized.length <= 64 && GENERIC_FEEDBACK_MESSAGE_RE.test(normalized)
}

export function specificFeedbackMessageCopy(text: string): boolean {
  const normalized = normalizedFeedbackMessageText(text)
  return FEEDBACK_MESSAGE_CONTEXT_RE.test(normalized) || concreteDataSignalCount(normalized) > 0
}

export function genericFeedbackMessageCopyTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'div', 'p', 'span', 'output']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (!hasFeedbackMessageSignal(tag)) continue
      const text = textContent(inner)
      if (genericFeedbackMessageCopy(text) && !specificFeedbackMessageCopy(text)) weak.push(tag)
    }
  }
  return weak
}

export function weakStateRecoveryActionTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if ((attributeValue(tag, 'aria-busy') ?? '').toLowerCase() === 'true') continue
      if (!hasRecoverableStateSignal(tag, inner)) continue
      if (!hasStateRecoveryAction(inner)) weak.push(tag)
    }
  }
  return weak
}

export function hasRecordAction(inner: string): boolean {
  if (tagMatches(inner, 'button').some((tag) => !/\bdisabled\b/i.test(tag))) return true
  if (tagMatches(inner, 'input').some((tag) => {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    return ['button', 'checkbox', 'radio', 'submit'].includes(type) && !/\bdisabled\b/i.test(tag)
  })) return true
  if (tagMatches(inner, 'select').length > 0) return true
  if (tagMatches(inner, 'a').some((tag) => !isDeadHrefTarget(attributeValue(tag, 'href'), inner))) return true
  return /\brole\s*=\s*["'](?:button|checkbox|link|menuitem|radio)["']/i.test(inner)
}

export function hasActionableRecordText(text: string): boolean {
  const normalized = contentForDataRealism(text)
  return ACTIONABLE_RECORD_TEXT_RE.test(normalized) && concreteDataSignalCount(normalized) >= 2
}
