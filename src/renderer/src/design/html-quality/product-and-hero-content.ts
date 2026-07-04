import { DESIGN_RESIZE_RESPONSIVE_LINES, formatDesignContextLines, type DesignContext } from '../design-context'
import { BRAND_LANDING_SCREEN_RE, BREADCRUMB_CONTAINER_RE, CONCRETE_DATA_PATTERNS, CONCRETE_METRIC_SPECIFICITY_RE, DECORATIVE_VISUAL_ANCHOR_RE, GENERIC_BREADCRUMB_LABEL_RE, GENERIC_PRODUCT_NAV_LABEL_RE, GENERIC_TRUST_PROOF_LABEL_RE, GENERIC_VANITY_METRIC_RE, HERO_VIEWPORT_LOCK_RE, PRODUCT_APP_CHROME_CLASS_RE, PRODUCT_APP_SCREEN_RE, PRODUCT_NAV_DOMAIN_LABEL_RE, SPECIFIC_BREADCRUMB_LABEL_RE, STATE_LAUNDRY_LIST_RE, STRONG_BRAND_LANDING_SCREEN_RE, TESTIMONIAL_ATTRIBUTION_RE, TESTIMONIAL_CLASS_RE, TRUST_PROOF_CLASS_RE, TRUST_PROOF_TEXT_RE, VANITY_METRIC_CONTAINER_RE, VISUAL_ANCHOR_CLASS_RE, VISUAL_ANCHOR_STYLE_RE, textContent } from './patterns'
import { attributeValue, attributeValues, hasStaticPrimaryAction, isDeadHrefTarget, pairedTagMatches, staticHeadingTexts, tagMatches } from './interaction-and-accessibility'
import { actionableRecordCount, hasMetricContainerClass } from './records-and-charts'
import { controlLabel, formFieldTags, normalizedActionLabel } from './controls-forms-and-dialogs'
import { navigationBlocks } from './navigation-workflow-and-color'

export function hasTopLevelHeading(html: string): boolean {
  if (/<h1\b/i.test(html)) return true
  const roleHeadings = html.match(/<[^>]+\brole\s*=\s*["']heading["'][^>]*>/gi) ?? []
  return roleHeadings.some((tag) => attributeValue(tag, 'aria-level') === '1')
}

export function firstTopLevelHeadingIndex(html: string): number {
  const indices = [
    /<h1\b/i.exec(html)?.index ?? -1,
    /<[^>]+\brole\s*=\s*["']heading["'][^>]*\baria-level\s*=\s*["']1["'][^>]*>/i.exec(html)?.index ?? -1,
    /<[^>]+\baria-level\s*=\s*["']1["'][^>]*\brole\s*=\s*["']heading["'][^>]*>/i.exec(html)?.index ?? -1
  ].filter((index) => index >= 0)
  return indices.length > 0 ? Math.min(...indices) : -1
}

export function hasFirstScreenSupportContent(html: string): boolean {
  const headingIndex = firstTopLevelHeadingIndex(html)
  if (headingIndex < 0) return true
  const lead = html
    .slice(headingIndex, headingIndex + 2800)
    .replace(/<h[1-6]\b[\s\S]*?<\/h[1-6]>/gi, ' ')
    .replace(/<button\b[\s\S]*?<\/button>/gi, ' ')
    .replace(/<a\b[\s\S]*?<\/a>/gi, ' ')
    .replace(/<(label|option)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(input|select|textarea)\b[\s\S]*?(?:<\/\1>|>)/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
  const supportText = textContent(lead)
    .replace(/\b(loading|empty|error|disabled|success|hover|focus) state\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return /[.!?。！？]/.test(supportText) ? supportText.length >= 36 : supportText.length >= 48
}

export function firstScreenActionDescriptors(html: string): string[] {
  const headingIndex = firstTopLevelHeadingIndex(html)
  const lead = headingIndex >= 0 ? html.slice(headingIndex, headingIndex + 3000) : html.slice(0, 3000)
  const descriptors: string[] = []
  for (const { tag, inner } of pairedTagMatches(lead, 'button')) {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    if (type === 'reset' || /\bdisabled\b/i.test(tag)) continue
    descriptors.push(controlLabel(tag, inner))
  }
  for (const tag of tagMatches(lead, 'input')) {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    if (!['button', 'submit'].includes(type) || /\bdisabled\b/i.test(tag)) continue
    descriptors.push(controlLabel(tag))
  }
  for (const { tag, inner } of pairedTagMatches(lead, 'a')) {
    const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
    const target = attributeValue(tag, 'href')
    if (role !== 'button' && isDeadHrefTarget(target, html)) continue
    descriptors.push(controlLabel(tag, inner) || target || '')
  }
  return Array.from(new Set(descriptors.map(normalizedActionLabel).filter(Boolean)))
}

export function hasWeakSecondaryActionPath(html: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 220 &&
    firstScreenActionDescriptors(html).length < 2
  )
}

export function contentForDataRealism(text: string): string {
  return text
    .replace(/\b(loading|empty|error|disabled|success|hover|focus) states?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function concreteDataSignalCount(text: string): number {
  const content = contentForDataRealism(text)
  return CONCRETE_DATA_PATTERNS.reduce((count, pattern) => count + (pattern.test(content) ? 1 : 0), 0)
}

export function hasWeakDataRealism(text: string): boolean {
  const content = contentForDataRealism(text)
  return content.length >= 120 && concreteDataSignalCount(content) < 2
}

export function stateLaundryListCount(text: string): number {
  return text.match(STATE_LAUNDRY_LIST_RE)?.length ?? 0
}

export function hasStateLaundryList(text: string): boolean {
  return stateLaundryListCount(text) >= 3
}

export function meaningfulContentModuleCount(html: string): number {
  const moduleTags = ['section', 'article', 'aside', 'form', 'table', 'ul', 'ol']
  let count = 0
  for (const tagName of moduleTags) {
    for (const { inner } of pairedTagMatches(html, tagName)) {
      const moduleText = contentForDataRealism(textContent(inner))
      const hasStructuredChildren = /<(table|form|li|tr|article|aside)\b/i.test(inner)
      if (moduleText.length >= 36 || hasStructuredChildren) count += 1
    }
  }

  const taggedSectionRe = /<([a-z0-9-]+)\b[^>]*\bdata-ds-section\s*=\s*["'][^"']+["'][^>]*>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = taggedSectionRe.exec(html))) {
    const moduleText = contentForDataRealism(textContent(match[2] ?? ''))
    if (moduleText.length >= 36) count += 1
  }
  return count
}

export function hasWeakContentDepth(html: string, visibleText: string): boolean {
  return contentForDataRealism(visibleText).length >= 140 && meaningfulContentModuleCount(html) < 2
}

export function hasProductAppScreenSignal(html: string, visibleText: string): boolean {
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'aria-label'),
    ...attributeValues(html, 'role')
  ].join(' ')
  return PRODUCT_APP_SCREEN_RE.test(`${visibleText} ${metadata}`)
}

export function productAppMetricCount(html: string): number {
  return ['section', 'article', 'div', 'li']
    .flatMap((tagName) => tagMatches(html, tagName))
    .filter(hasMetricContainerClass).length
}

export function productAppModuleSignalCount(html: string): number {
  let count = 0
  if (meaningfulContentModuleCount(html) >= 2) count += 1
  if (/<(?:table|form)\b/i.test(html)) count += 1
  if (formFieldTags(html).length >= 2) count += 1
  if (actionableRecordCount(html) >= 2) count += 1
  if (productAppMetricCount(html) >= 2) count += 1
  if (tagMatches(html, 'button').length + pairedTagMatches(html, 'a').length >= 4) count += 1
  return count
}

export function hasProductAppChrome(html: string): boolean {
  if (/<(?:nav|aside)\b/i.test(html)) return true
  if (/\brole\s*=\s*["'](?:navigation|complementary)["']/i.test(html)) return true
  return PRODUCT_APP_CHROME_CLASS_RE.test(attributeValues(html, 'class').join(' ').replace(/[-_]/g, ' '))
}

export function hasWeakProductAppShell(html: string, visibleText: string): boolean {
  return hasProductAppScreenSignal(html, visibleText) && productAppModuleSignalCount(html) >= 2 && !hasProductAppChrome(html)
}

export function normalizedProductNavLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function genericProductNavLabel(text: string): boolean {
  const normalized = normalizedProductNavLabel(text)
  return normalized.length > 0 && normalized.length <= 32 && GENERIC_PRODUCT_NAV_LABEL_RE.test(normalized)
}

export function specificProductNavLabel(text: string): boolean {
  const normalized = normalizedProductNavLabel(text)
  return normalized.length > 0 && normalized.length <= 48 && PRODUCT_NAV_DOMAIN_LABEL_RE.test(normalized)
}

export function productNavigationLabels(block: string): string[] {
  const labels = [
    ...pairedTagMatches(block, 'a').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(block, 'button').map(({ tag, inner }) => controlLabel(tag, inner))
  ]
  return Array.from(new Set(labels.map(normalizedProductNavLabel).filter(Boolean)))
}

export function hasBreadcrumbContainerMetadata(markup: string): boolean {
  const metadata = [
    ...attributeValues(markup, 'class'),
    ...attributeValues(markup, 'id'),
    ...attributeValues(markup, 'aria-label'),
    ...attributeValues(markup, 'title')
  ].join(' ').replace(/[-_]/g, ' ')
  return BREADCRUMB_CONTAINER_RE.test(metadata)
}

export function genericProductNavigationBlocks(html: string, visibleText: string): string[] {
  if (!hasProductAppScreenSignal(html, visibleText) || productAppModuleSignalCount(html) < 2 || !hasProductAppChrome(html)) return []
  return navigationBlocks(html).filter((block) => {
    if (hasBreadcrumbContainerMetadata(block)) return false
    const labels = productNavigationLabels(block)
    if (labels.length < 3) return false
    const genericCount = labels.filter(genericProductNavLabel).length
    const specificCount = labels.filter(specificProductNavLabel).length
    return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
  })
}

export function breadcrumbBlocks(html: string): string[] {
  const blocks: string[] = []
  for (const { tag, inner } of pairedTagMatches(html, 'nav')) {
    const metadata = [
      attributeValue(tag, 'class') ?? '',
      attributeValue(tag, 'id') ?? '',
      attributeValue(tag, 'aria-label') ?? '',
      attributeValue(tag, 'title') ?? ''
    ].join(' ').replace(/[-_]/g, ' ')
    if (BREADCRUMB_CONTAINER_RE.test(metadata)) blocks.push(`${tag}${inner}`)
  }
  const roleNavigationRe =
    /(<([a-z0-9-]+)\b[^>]*\brole\s*=\s*["']navigation["'][^>]*>)([\s\S]*?)<\/\2>/gi
  let match: RegExpExecArray | null
  while ((match = roleNavigationRe.exec(html))) {
    const tag = match[1] ?? ''
    const inner = match[3] ?? ''
    const metadata = [
      attributeValue(tag, 'class') ?? '',
      attributeValue(tag, 'id') ?? '',
      attributeValue(tag, 'aria-label') ?? '',
      attributeValue(tag, 'title') ?? ''
    ].join(' ').replace(/[-_]/g, ' ')
    if (BREADCRUMB_CONTAINER_RE.test(metadata)) blocks.push(`${tag}${inner}`)
  }
  for (const tagName of ['ol', 'ul', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        attributeValue(tag, 'class') ?? '',
        attributeValue(tag, 'id') ?? '',
        attributeValue(tag, 'aria-label') ?? '',
        attributeValue(tag, 'title') ?? ''
      ].join(' ').replace(/[-_]/g, ' ')
      if (BREADCRUMB_CONTAINER_RE.test(metadata)) blocks.push(`${tag}${inner}`)
    }
  }
  return blocks
}

export function normalizedBreadcrumbLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/#-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function breadcrumbLabels(block: string): string[] {
  const labels = [
    ...pairedTagMatches(block, 'a').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(block, 'button').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(block, 'span').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(block, 'li').map(({ inner }) => textContent(inner))
  ]
  if (labels.length < 3) labels.push(...textContent(block).split(/\s*(?:\/|>|›|»|→)\s*/))
  return Array.from(new Set(labels.map(normalizedBreadcrumbLabel).filter(Boolean)))
}

export function genericBreadcrumbLabel(text: string): boolean {
  const normalized = normalizedBreadcrumbLabel(text)
  return normalized.length > 0 && normalized.length <= 36 && GENERIC_BREADCRUMB_LABEL_RE.test(normalized)
}

export function specificBreadcrumbLabel(text: string): boolean {
  const normalized = normalizedBreadcrumbLabel(text)
  return (
    normalized.length > 0 &&
    normalized.length <= 72 &&
    (SPECIFIC_BREADCRUMB_LABEL_RE.test(normalized) || concreteDataSignalCount(normalized) > 0)
  )
}

export function genericBreadcrumbLabelBlocks(html: string, visibleText: string, prototypeLike = false): string[] {
  if (!prototypeLike && !hasProductAppScreenSignal(html, visibleText) && !hasProductAppChrome(html)) return []
  return breadcrumbBlocks(html).filter((block) => {
    const labels = breadcrumbLabels(block)
    if (labels.length < 3) return false
    const genericCount = labels.filter(genericBreadcrumbLabel).length
    const specificCount = labels.filter(specificBreadcrumbLabel).length
    return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
  })
}

export function hasBrandLandingScreenSignal(html: string, visibleText: string): boolean {
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'aria-label'),
    ...attributeValues(html, 'title')
  ].join(' ')
  const content = `${visibleText} ${metadata}`
  if (STRONG_BRAND_LANDING_SCREEN_RE.test(content)) return true
  return BRAND_LANDING_SCREEN_RE.test(content) && !hasProductAppScreenSignal(html, visibleText)
}

export function hasVisualAnchorClass(html: string): boolean {
  return VISUAL_ANCHOR_CLASS_RE.test(attributeValues(html, 'class').join(' ').replace(/[-_]/g, ' '))
}

export function hasPrimaryVisualAnchor(html: string, styles: string): boolean {
  if (/<(?:img|picture|video|iframe|canvas)\b/i.test(html)) return true
  if (VISUAL_ANCHOR_STYLE_RE.test(styles)) return true
  return hasVisualAnchorClass(html)
}

export function hasWeakVisualAnchor(html: string, styles: string, visibleText: string): boolean {
  return hasTopLevelHeading(html) && hasStaticPrimaryAction(html) && hasBrandLandingScreenSignal(html, visibleText) && !hasPrimaryVisualAnchor(html, styles)
}

export function visualAnchorBlocks(html: string): Array<{ tag: string; inner: string }> {
  return ['figure', 'section', 'article', 'div', 'aside']
    .flatMap((tagName) => pairedTagMatches(html, tagName))
    .filter(({ tag }) => {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      return VISUAL_ANCHOR_CLASS_RE.test(metadata)
    })
}

export function hasConcretePreviewDetail(markup: string): boolean {
  if (/<(?:img|picture|video|iframe|canvas|svg)\b/i.test(markup)) return true
  const text = contentForDataRealism(textContent(markup))
  const hasUiStructure = /<(?:table|ul|ol|li|button|input|select|textarea)\b|\brole\s*=\s*["'](?:row|grid|list|listitem|progressbar|status)["']/i.test(markup)
  const hasConcreteData = concreteDataSignalCount(text) > 0
  return text.length >= 70 && hasUiStructure && hasConcreteData
}

export function hasConcreteVisualAnchorDetail(markup: string): boolean {
  if (/<(?:img|picture|video|iframe|canvas)\b/i.test(markup)) return true
  if (VISUAL_ANCHOR_STYLE_RE.test(markup)) return true
  const text = contentForDataRealism(textContent(markup))
  const hasUiStructure = /<(?:table|ul|ol|li|button|input|select|textarea)\b|\brole\s*=\s*["'](?:row|grid|list|listitem|progressbar|status)["']/i.test(markup)
  const hasProductLabel = /\b(?:account|analytics|approval|browser|calendar|chart|customer|dashboard|dispatch|gallery|invoice|kanban|map|metric|order|pipeline|preview|project|record|report|row|screen|status|task|ticket|timeline|workflow)\b/i.test(text)
  const hasConcreteData = concreteDataSignalCount(text) > 0
  return (text.length >= 40 && hasConcreteData) || (text.length >= 64 && hasUiStructure && hasProductLabel)
}

export function decorativeVisualAnchorTags(html: string): string[] {
  const weak: string[] = []
  for (const { tag, inner } of visualAnchorBlocks(html)) {
    const markup = `${tag}${inner}`
    const metadata = [
      ...attributeValues(markup, 'class'),
      ...attributeValues(markup, 'id'),
      ...attributeValues(markup, 'aria-label'),
      ...attributeValues(markup, 'title')
    ].join(' ').replace(/[-_]/g, ' ')
    if (!DECORATIVE_VISUAL_ANCHOR_RE.test(`${metadata} ${textContent(inner).slice(0, 160)}`)) continue
    if (!hasConcreteVisualAnchorDetail(markup)) weak.push(tag)
  }
  return weak
}

export function hasWeakProductPreviewDetail(html: string, visibleText: string): boolean {
  const blocks = visualAnchorBlocks(html)
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    blocks.length > 0 &&
    blocks.some(({ tag, inner }) => !hasConcretePreviewDetail(`${tag}${inner}`))
  )
}

export function hasWeakHeroViewportComposition(html: string, styles: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 220 &&
    meaningfulContentModuleCount(html) >= 2 &&
    HERO_VIEWPORT_LOCK_RE.test(styles)
  )
}

export function hasTrustProof(html: string, visibleText: string): boolean {
  if (/<blockquote\b/i.test(html)) return true
  if (TRUST_PROOF_TEXT_RE.test(visibleText)) return true
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'aria-label'),
    ...attributeValues(html, 'title'),
    ...attributeValues(html, 'alt')
  ].join(' ').replace(/[-_]/g, ' ')
  return TRUST_PROOF_CLASS_RE.test(metadata)
}

export function hasWeakTrustProof(html: string, visibleText: string): boolean {
  return hasTopLevelHeading(html) && hasStaticPrimaryAction(html) && hasBrandLandingScreenSignal(html, visibleText) && !hasTrustProof(html, visibleText)
}

export function normalizedTrustProofLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function genericTrustProofLabel(text: string): boolean {
  const normalized = normalizedTrustProofLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_TRUST_PROOF_LABEL_RE.test(normalized)
}

export function genericTrustProofTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'div', 'ul', 'ol', 'aside']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      const headings = staticHeadingTexts(inner).join(' ')
      if (!TRUST_PROOF_CLASS_RE.test(`${metadata} ${headings}`) && !TRUST_PROOF_TEXT_RE.test(`${headings} ${textContent(inner)}`)) continue
      const labels = [
        ...['span', 'li', 'a', 'strong', 'b'].flatMap((labelTagName) =>
          pairedTagMatches(inner, labelTagName).map(({ inner: labelInner }) => textContent(labelInner))
        ),
        ...tagMatches(inner, 'img').map((imgTag) =>
          [attributeValue(imgTag, 'alt'), attributeValue(imgTag, 'aria-label'), attributeValue(imgTag, 'title')]
            .filter(Boolean)
            .join(' ')
        )
      ].map(normalizedTrustProofLabel).filter(Boolean)
      if (labels.filter(genericTrustProofLabel).length >= 2) weak.push(tag)
    }
  }
  return weak
}

export function normalizedVanityMetricText(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}%+./-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function genericVanityMetricText(text: string): boolean {
  const normalized = normalizedVanityMetricText(text)
  return (
    normalized.length >= 5 &&
    normalized.length <= 96 &&
    GENERIC_VANITY_METRIC_RE.test(normalized) &&
    !CONCRETE_METRIC_SPECIFICITY_RE.test(normalized)
  )
}

export function genericVanityMetricTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'div', 'ul', 'ol', 'aside']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      const marker = `${metadata} ${staticHeadingTexts(inner).join(' ')} ${textContent(inner).slice(0, 220)}`
      if (!VANITY_METRIC_CONTAINER_RE.test(marker) && !TRUST_PROOF_CLASS_RE.test(marker) && !TRUST_PROOF_TEXT_RE.test(marker)) continue
      const labels = ['article', 'li', 'div', 'p', 'span', 'strong', 'b', 'h2', 'h3', 'small']
        .flatMap((labelTagName) => pairedTagMatches(inner, labelTagName).map(({ inner: labelInner }) => textContent(labelInner)))
        .map(normalizedVanityMetricText)
        .filter(Boolean)
      if (labels.filter(genericVanityMetricText).length >= 2) weak.push(tag)
    }
  }
  return weak
}

export function testimonialBlocks(html: string): string[] {
  const blocks = pairedTagMatches(html, 'blockquote').map(({ tag, inner }) => `${tag}${inner}`)
  for (const tagName of ['section', 'article', 'div', 'li']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      if (TESTIMONIAL_CLASS_RE.test(metadata) && textContent(inner).length >= 32) blocks.push(`${tag}${inner}`)
    }
  }
  return blocks
}

export function hasTestimonialAttribution(block: string): boolean {
  const text = textContent(block)
  const metadata = [
    ...attributeValues(block, 'class'),
    ...attributeValues(block, 'id'),
    ...attributeValues(block, 'aria-label'),
    ...attributeValues(block, 'title'),
    ...attributeValues(block, 'cite')
  ].join(' ').replace(/[-_]/g, ' ')
  return TESTIMONIAL_ATTRIBUTION_RE.test(`${text} ${metadata}`)
}

export function hasWeakTestimonialAttribution(html: string, visibleText: string): boolean {
  const blocks = testimonialBlocks(html)
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    blocks.length > 0 &&
    blocks.some((block) => !hasTestimonialAttribution(block))
  )
}
