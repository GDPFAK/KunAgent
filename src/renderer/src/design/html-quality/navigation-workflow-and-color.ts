import { DESIGN_RESIZE_RESPONSIVE_LINES, formatDesignContextLines, type DesignContext } from '../design-context'
import type { ParsedCssColor } from './types'
import { AI_GRADIENT_COLOR_RE, BRAND_IDENTITY_CLASS_RE, BRAND_LANDING_SCREEN_RE, BRAND_NAME_LIKE_RE, COLOR_LITERAL_RE, CSS_CUSTOM_PROPERTY_RE, GENERIC_BRAND_IDENTITY_LABEL_RE, GENERIC_PAGE_HEADING_RE, GENERIC_PORTFOLIO_PROJECT_RE, GENERIC_SECTION_HEADING_RE, GENERIC_TAB_LABEL_RE, GENERIC_WORKFLOW_STEP_LABEL_RE, META_PAGE_HEADING_RE, PORTFOLIO_BUILDER_RE, PORTFOLIO_DETAIL_ACTION_RE, PORTFOLIO_ENTRY_CLASS_RE, PORTFOLIO_OUTCOME_RE, PORTFOLIO_SURFACE_RE, SPECIFIC_TAB_LABEL_RE, SPECIFIC_WORKFLOW_STEP_LABEL_RE, TAB_CONTAINER_CLASS_RE, WORKFLOW_STEP_CONTAINER_CLASS_RE, WORKFLOW_STEP_ITEM_CLASS_RE, WORKFLOW_STEP_STATE_RE, styleContent, textContent } from './patterns'
import { attributeValue, attributeValues, hasStaticPrimaryAction, inlinePrototypeNavigationTargets, isDeadHrefTarget, normalizedClassText, pairedTagMatches, staticHeadingTexts, tagMatches } from './interaction-and-accessibility'
import { controlLabel } from './controls-forms-and-dialogs'
import { contentForDataRealism, hasBrandLandingScreenSignal, hasProductAppScreenSignal, hasTopLevelHeading } from './product-and-hero-content'
import { hasBrandNavigation } from './marketing-commerce-content'

export function isBrandIdentityText(text: string, allowSimpleName: boolean): boolean {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[.!?。！？]+$/g, '')
    .trim()
  if (normalized.length < 2 || normalized.length > 48) return false
  if (GENERIC_BRAND_IDENTITY_LABEL_RE.test(normalized)) return false
  if (BRAND_LANDING_SCREEN_RE.test(normalized)) return false
  if (BRAND_NAME_LIKE_RE.test(normalized)) return true
  return allowSimpleName && /^[A-Z][A-Za-z0-9&'.-]{2,24}(?:\s+[A-Z][A-Za-z0-9&'.-]{2,24}){0,2}$/.test(normalized)
}

export function hasBrandIdentity(html: string): boolean {
  const blocks = [
    ...pairedTagMatches(html, 'header').map(({ tag, inner }) => `${tag}${inner}`),
    ...navigationBlocks(html)
  ]
  for (const block of blocks) {
    for (const tagName of ['a', 'span', 'strong', 'b', 'div']) {
      const items = pairedTagMatches(block, tagName)
      for (const { tag, inner } of items) {
        const metadata = [
          ...attributeValues(tag, 'class'),
          ...attributeValues(tag, 'id'),
          ...attributeValues(tag, 'aria-label'),
          ...attributeValues(tag, 'title')
        ].join(' ').replace(/[-_]/g, ' ')
        if (BRAND_IDENTITY_CLASS_RE.test(metadata) && isBrandIdentityText(textContent(inner), true)) return true
      }
    }
    for (const imgTag of tagMatches(block, 'img')) {
      const metadata = [
        ...attributeValues(imgTag, 'class'),
        ...attributeValues(imgTag, 'id'),
        ...attributeValues(imgTag, 'alt'),
        ...attributeValues(imgTag, 'aria-label'),
        ...attributeValues(imgTag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      if (BRAND_IDENTITY_CLASS_RE.test(metadata) && isBrandIdentityText(metadata, true)) return true
    }
    const firstNavLabel = ['a', 'button', 'span', 'strong', 'b']
      .flatMap((tagName) => pairedTagMatches(block, tagName).map(({ inner }) => textContent(inner)))
      .find(Boolean)
    if (firstNavLabel && isBrandIdentityText(firstNavLabel, true)) return true
  }
  return topLevelHeadingTexts(html).some((heading) => isBrandIdentityText(heading, false))
}

export function hasWeakBrandIdentity(html: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 180 &&
    hasBrandNavigation(html) &&
    !hasBrandIdentity(html)
  )
}

export function hasWeakBrandNavigation(html: string, visibleText: string): boolean {
  return (
    hasTopLevelHeading(html) &&
    hasStaticPrimaryAction(html) &&
    hasBrandLandingScreenSignal(html, visibleText) &&
    contentForDataRealism(visibleText).length >= 180 &&
    !hasBrandNavigation(html)
  )
}

export function portfolioSurfaceSignal(html: string, visibleText: string): boolean {
  const headings = [...topLevelHeadingTexts(html), ...staticHeadingTexts(html)].join(' ')
  const metadata = [
    ...attributeValues(html, 'class'),
    ...attributeValues(html, 'id'),
    ...attributeValues(html, 'aria-label'),
    ...attributeValues(html, 'title')
  ].join(' ').replace(/[-_]/g, ' ')
  const signal = `${headings} ${metadata}`
  if (!hasBrandLandingScreenSignal(html, visibleText) || !PORTFOLIO_SURFACE_RE.test(signal)) return false
  return !(/\bportfolio\b/i.test(signal) && PORTFOLIO_BUILDER_RE.test(signal))
}

export function portfolioEntryCount(html: string): number {
  return ['section', 'article', 'div', 'li']
    .flatMap((tagName) => tagMatches(html, tagName))
    .filter((tag) => PORTFOLIO_ENTRY_CLASS_RE.test(normalizedClassText(tag))).length
}

export function hasPortfolioProjectStructure(html: string, visibleText: string): boolean {
  return portfolioEntryCount(html) >= 2 && PORTFOLIO_OUTCOME_RE.test(visibleText) && PORTFOLIO_DETAIL_ACTION_RE.test(visibleText)
}

export function hasWeakPortfolioStructure(html: string, visibleText: string): boolean {
  return hasTopLevelHeading(html) && hasStaticPrimaryAction(html) && portfolioSurfaceSignal(html, visibleText) && !hasPortfolioProjectStructure(html, visibleText)
}

export function portfolioProjectBlocks(html: string): string[] {
  const blocks: string[] = []
  for (const tagName of ['article', 'li', 'div', 'section']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const metadata = [
        ...attributeValues(tag, 'class'),
        ...attributeValues(tag, 'id'),
        ...attributeValues(tag, 'aria-label'),
        ...attributeValues(tag, 'title')
      ].join(' ').replace(/[-_]/g, ' ')
      const text = contentForDataRealism(textContent(inner))
      if (PORTFOLIO_ENTRY_CLASS_RE.test(metadata) && text.length >= 36) blocks.push(`${tag}${inner}`)
    }
  }
  return blocks
}

export function genericPortfolioProjectDetail(block: string): boolean {
  const text = contentForDataRealism(textContent(block))
    .replace(/\s+/g, ' ')
    .trim()
  return GENERIC_PORTFOLIO_PROJECT_RE.test(text)
}

export function genericPortfolioProjectDetailTags(html: string, visibleText: string): string[] {
  if (!portfolioSurfaceSignal(html, visibleText) || !hasPortfolioProjectStructure(html, visibleText)) return []
  const blocks = portfolioProjectBlocks(html)
  if (blocks.length < 2) return []
  return blocks.filter(genericPortfolioProjectDetail).slice(0, 4)
}

export function topLevelHeadingTexts(html: string): string[] {
  const headings = pairedTagMatches(html, 'h1').map(({ inner }) => textContent(inner))
  const roleHeadingRe = /(<([a-z0-9-]+)\b[^>]*\brole\s*=\s*["']heading["'][^>]*>)([\s\S]*?)<\/\2>/gi
  let match: RegExpExecArray | null
  while ((match = roleHeadingRe.exec(html))) {
    const tag = match[1] ?? ''
    if (attributeValue(tag, 'aria-level') === '1') headings.push(textContent(match[3] ?? ''))
  }
  return headings.map((text) => text.trim()).filter(Boolean)
}

export function isGenericPageHeading(text: string): boolean {
  const normalized = text
    .replace(/&amp;/gi, '&')
    .replace(/[\s:|/\\-]+/g, ' ')
    .replace(/[^\p{L}\p{N}& ]/gu, '')
    .trim()
  return GENERIC_PAGE_HEADING_RE.test(normalized)
}

export function isMetaPageHeading(text: string): boolean {
  const normalized = text
    .replace(/&amp;/gi, '&')
    .replace(/[\s:|/\\-]+/g, ' ')
    .replace(/[^\p{L}\p{N}& ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return META_PAGE_HEADING_RE.test(normalized)
}

export function normalizedHeadingText(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[\s:|/\\-]+/g, ' ')
    .replace(/[^\p{L}\p{N}& ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isGenericSectionHeading(text: string): boolean {
  return GENERIC_SECTION_HEADING_RE.test(normalizedHeadingText(text))
}

export function sectionHeadingTexts(html: string): string[] {
  const headings = ['h2', 'h3'].flatMap((tagName) =>
    pairedTagMatches(html, tagName).map(({ inner }) => textContent(inner))
  )
  const roleHeadingRe = /(<([a-z0-9-]+)\b[^>]*\brole\s*=\s*["']heading["'][^>]*>)([\s\S]*?)<\/\2>/gi
  let match: RegExpExecArray | null
  while ((match = roleHeadingRe.exec(html))) {
    const tag = match[1] ?? ''
    const level = Number.parseInt(attributeValue(tag, 'aria-level') ?? '', 10)
    if (level === 2 || level === 3) headings.push(textContent(match[3] ?? ''))
  }
  return headings.map((text) => text.trim()).filter(Boolean)
}

export function genericSectionHeadingTags(html: string, visibleText: string): string[] {
  if (!hasTopLevelHeading(html) || !hasStaticPrimaryAction(html) || !hasBrandLandingScreenSignal(html, visibleText)) return []
  const genericHeadings = sectionHeadingTexts(html).filter(isGenericSectionHeading)
  return genericHeadings.length >= 2 ? genericHeadings.slice(0, 4) : []
}

export function hasNavigationLandmark(html: string): boolean {
  return /<nav\b/i.test(html) || /\brole\s*=\s*["']navigation["']/i.test(html)
}

export function navigationBlocks(html: string): string[] {
  const blocks = pairedTagMatches(html, 'nav').map(({ tag, inner }) => `${tag}${inner}`)
  const roleNavigationRe =
    /(<([a-z0-9-]+)\b[^>]*\brole\s*=\s*["']navigation["'][^>]*>)([\s\S]*?)<\/\2>/gi
  let match: RegExpExecArray | null
  while ((match = roleNavigationRe.exec(html))) blocks.push(`${match[1] ?? ''}${match[3] ?? ''}`)
  return blocks
}

export function hasNavigationCurrentState(html: string): boolean {
  return (
    /\baria-current\s*=\s*["']?(?!false\b)[^"'\s>]+/i.test(html) ||
    /\baria-selected\s*=\s*["']true["']/i.test(html) ||
    /\bdata-state\s*=\s*["'](?:active|current|selected)["']/i.test(html) ||
    /\bclass\s*=\s*["'][^"']*\b(?:active|current|selected|is-active|is-current|is-selected)\b/i.test(html)
  )
}

export function hasMultiItemPrototypeNavigationWithoutCurrentState(html: string): boolean {
  return navigationBlocks(html).some((block) => {
    const linkTargets = attributeValues(block, 'href').filter((target) => !isDeadHrefTarget(target, html))
    const prototypeTargets = [
      ...linkTargets.filter((target) => /\.html(?:[?#].*)?$/i.test(target) || target.includes('.html?')),
      ...attributeValues(block, 'data-href'),
      ...attributeValues(block, 'data-prototype-href'),
      ...attributeValues(block, 'data-prototype-target'),
      ...attributeValues(block, 'data-target'),
      ...inlinePrototypeNavigationTargets(block)
    ]
    const roleTabs = tagMatches(block, 'button').filter((tag) => (attributeValue(tag, 'role') ?? '').toLowerCase() === 'tab')
    return prototypeTargets.length + roleTabs.length >= 2 && !hasNavigationCurrentState(block)
  })
}

export function hasTabContainerClass(tag: string): boolean {
  return TAB_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

export function tabControlCount(inner: string): number {
  const buttonsAndLinks = [...pairedTagMatches(inner, 'button'), ...pairedTagMatches(inner, 'a')]
    .filter(({ tag }) => (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() !== 'true')
    .length
  const radios = tagMatches(inner, 'input')
    .filter((tag) => (attributeValue(tag, 'type') ?? '').toLowerCase() === 'radio')
    .length
  const roleTabs = /role\s*=\s*["']tab["']/gi.exec(inner) ? (inner.match(/role\s*=\s*["']tab["']/gi)?.length ?? 0) : 0
  return Math.max(buttonsAndLinks + radios, roleTabs)
}

export function tabControlLabels(inner: string): string[] {
  const labels = [
    ...pairedTagMatches(inner, 'button').map(({ tag, inner: buttonInner }) => controlLabel(tag, buttonInner)),
    ...pairedTagMatches(inner, 'a').map(({ tag, inner: anchorInner }) => controlLabel(tag, anchorInner)),
    ...['div', 'span', 'li'].flatMap((tagName) =>
      pairedTagMatches(inner, tagName)
        .filter(({ tag }) => (attributeValue(tag, 'role') ?? '').toLowerCase() === 'tab')
        .map(({ tag, inner: tabInner }) => controlLabel(tag, tabInner))
    )
  ]
  for (const tag of tagMatches(inner, 'input')) {
    const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
    if (type === 'radio') labels.push(controlLabel(tag))
  }
  return Array.from(new Set(labels.map(normalizedHeadingText).filter(Boolean)))
}

export function genericTabLabel(text: string): boolean {
  const normalized = normalizedHeadingText(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_TAB_LABEL_RE.test(normalized)
}

export function specificTabLabel(text: string): boolean {
  const normalized = normalizedHeadingText(text)
  return normalized.length > 0 && normalized.length <= 48 && SPECIFIC_TAB_LABEL_RE.test(normalized)
}

export function genericTabLabelTags(html: string, visibleText: string): string[] {
  if (!hasProductAppScreenSignal(html, visibleText)) return []
  const weak: string[] = []
  for (const tagName of ['div', 'section', 'nav', 'ul']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const tabLike = role === 'tablist' || hasTabContainerClass(tag)
      if (!tabLike || tabControlCount(inner) < 2 || !hasNavigationCurrentState(`${tag}${inner}`)) continue
      const labels = tabControlLabels(inner)
      if (labels.length < 2) continue
      const genericCount = labels.filter(genericTabLabel).length
      const specificCount = labels.filter(specificTabLabel).length
      if (specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)) weak.push(tag)
    }
  }
  return weak
}

export function weakTabCurrentStateTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['div', 'section', 'nav', 'ul']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const tabLike = role === 'tablist' || hasTabContainerClass(tag)
      if (!tabLike || tabControlCount(inner) < 2) continue
      if (!hasNavigationCurrentState(`${tag}${inner}`)) weak.push(tag)
    }
  }
  return weak
}

export function hasWorkflowStepContainerClass(tag: string): boolean {
  return WORKFLOW_STEP_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

export function workflowStepItemCount(inner: string): number {
  const classItems = ['li', 'div', 'article', 'section']
    .flatMap((tagName) => tagMatches(inner, tagName))
    .filter((tag) => WORKFLOW_STEP_ITEM_CLASS_RE.test(normalizedClassText(tag))).length
  const listItems = tagMatches(inner, 'li').length
  const orderedText = textContent(inner)
  const numberedSteps = orderedText.match(/\b(?:step\s*)?\d+[.)]\s+[A-Z]/g)?.length ?? 0
  return Math.max(classItems, listItems, numberedSteps)
}

export function normalizedWorkflowStepLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&.)/-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function workflowStepLabels(inner: string): string[] {
  const labels = ['li', 'div', 'article', 'section']
    .flatMap((tagName) =>
      pairedTagMatches(inner, tagName)
        .filter(({ tag }) => tagName === 'li' || WORKFLOW_STEP_ITEM_CLASS_RE.test(normalizedClassText(tag)))
        .map(({ inner: itemInner }) => textContent(itemInner))
    )
    .map(normalizedWorkflowStepLabel)
    .filter((label) => label.length > 0 && label.length <= 64)
  return Array.from(new Set(labels))
}

export function genericWorkflowStepLabel(text: string): boolean {
  const normalized = normalizedWorkflowStepLabel(text)
  return GENERIC_WORKFLOW_STEP_LABEL_RE.test(normalized)
}

export function specificWorkflowStepLabel(text: string): boolean {
  const normalized = normalizedWorkflowStepLabel(text)
  return SPECIFIC_WORKFLOW_STEP_LABEL_RE.test(normalized)
}

export function hasWorkflowStepState(markup: string): boolean {
  return WORKFLOW_STEP_STATE_RE.test(markup)
}

export function genericWorkflowStepLabelTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['ol', 'ul', 'div', 'section', 'article', 'nav']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const workflowLike = hasWorkflowStepContainerClass(tag) || role === 'progressbar'
      if (!workflowLike || workflowStepItemCount(inner) < 3 || !hasWorkflowStepState(`${tag}${inner}`)) continue
      const labels = workflowStepLabels(inner)
      if (labels.length < 3) continue
      const genericCount = labels.filter(genericWorkflowStepLabel).length
      const specificCount = labels.filter(specificWorkflowStepLabel).length
      if (specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)) weak.push(tag)
    }
  }
  return weak
}

export function weakWorkflowStepStateTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['ol', 'ul', 'div', 'section', 'article', 'nav']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const workflowLike = hasWorkflowStepContainerClass(tag) || role === 'progressbar'
      if (!workflowLike || workflowStepItemCount(inner) < 3) continue
      if (!hasWorkflowStepState(`${tag}${inner}`)) weak.push(tag)
    }
  }
  return weak
}

export function hasGenericPurpleBlueGradient(html: string): boolean {
  const styles = styleContent(html)
  const gradients = styles.match(/(?:linear|radial|conic)-gradient\([^)]*\)/gi) ?? []
  return gradients.some((gradient) => {
    const hits = gradient.match(AI_GRADIENT_COLOR_RE) ?? []
    return hits.length >= 2
  })
}

export function colorLiteralCount(styles: string): number {
  return new Set((styles.match(COLOR_LITERAL_RE) ?? []).map((color) => color.toLowerCase())).size
}

export function hasWeakColorSystem(styles: string): boolean {
  return colorLiteralCount(styles) >= 8 && !CSS_CUSTOM_PROPERTY_RE.test(styles)
}

export function normalizeHue(value: number): number {
  return ((value % 360) + 360) % 360
}

export function hueDistance(a: number, b: number): number {
  const distance = Math.abs(normalizeHue(a) - normalizeHue(b))
  return Math.min(distance, 360 - distance)
}

export function rgbToHsl(r: number, g: number, b: number): ParsedCssColor {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const delta = max - min
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let h = 0
  if (max === red) h = (green - blue) / delta + (green < blue ? 6 : 0)
  else if (max === green) h = (blue - red) / delta + 2
  else h = (red - green) / delta + 4
  return { h: normalizeHue(h * 60), s, l }
}

export function parseHexColor(raw: string): ParsedCssColor | undefined {
  const hex = raw.trim().replace(/^#/, '')
  if (![3, 4, 6, 8].includes(hex.length)) return undefined
  const expanded = hex.length <= 4 ? hex.slice(0, 3).replace(/./g, (char) => char + char) : hex.slice(0, 6)
  const value = Number.parseInt(expanded, 16)
  if (!Number.isFinite(value)) return undefined
  return rgbToHsl((value >> 16) & 255, (value >> 8) & 255, value & 255)
}

export function parseRgbChannel(raw: string): number | undefined {
  const value = raw.trim()
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(0, Math.min(255, value.endsWith('%') ? (parsed / 100) * 255 : parsed))
}

export function parseRgbColor(raw: string): ParsedCssColor | undefined {
  const match = /^rgba?\(([^)]+)\)$/i.exec(raw.trim())
  if (!match) return undefined
  const channels = match[1]
    ?.replace(/\/.*$/, ' ')
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map(parseRgbChannel)
  if (!channels || channels.length < 3 || channels.some((channel) => channel === undefined)) return undefined
  return rgbToHsl(channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0)
}

export function parseHueToken(raw: string): number | undefined {
  const match = /^([-+]?\d*\.?\d+)(deg|turn|rad|grad)?$/i.exec(raw.trim())
  if (!match) return undefined
  const value = Number.parseFloat(match[1] ?? '')
  if (!Number.isFinite(value)) return undefined
  const unit = (match[2] ?? 'deg').toLowerCase()
  if (unit === 'turn') return normalizeHue(value * 360)
  if (unit === 'rad') return normalizeHue((value * 180) / Math.PI)
  if (unit === 'grad') return normalizeHue(value * 0.9)
  return normalizeHue(value)
}

export function parseHslPercent(raw: string): number | undefined {
  const value = raw.trim()
  if (!value.endsWith('%')) return undefined
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.max(0, Math.min(1, parsed / 100))
}

export function parseHslColor(raw: string): ParsedCssColor | undefined {
  const match = /^hsla?\(([^)]+)\)$/i.exec(raw.trim())
  if (!match) return undefined
  const parts = (match[1] ?? '')
    .replace(/\/.*$/, ' ')
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  const h = parseHueToken(parts[0] ?? '')
  const s = parseHslPercent(parts[1] ?? '')
  const l = parseHslPercent(parts[2] ?? '')
  if (h === undefined || s === undefined || l === undefined) return undefined
  return { h, s, l }
}

export function parseCssColor(raw: string): ParsedCssColor | undefined {
  if (raw.startsWith('#')) return parseHexColor(raw)
  if (/^rgba?\(/i.test(raw)) return parseRgbColor(raw)
  if (/^hsla?\(/i.test(raw)) return parseHslColor(raw)
  return undefined
}

export function cssPaletteColors(styles: string): ParsedCssColor[] {
  const unique = new Set((styles.match(COLOR_LITERAL_RE) ?? []).map((color) => color.toLowerCase()))
  return [...unique].map(parseCssColor).filter((color): color is ParsedCssColor => Boolean(color))
}

export function largestHueClusterCount(colors: ParsedCssColor[], radius: number): number {
  return colors.reduce(
    (largest, color) => Math.max(largest, colors.filter((item) => hueDistance(item.h, color.h) <= radius).length),
    0
  )
}

export function hasOneNotePalette(styles: string): boolean {
  const chromaticColors = cssPaletteColors(styles).filter((color) => color.s >= 0.18 && color.l >= 0.08 && color.l <= 0.95)
  if (chromaticColors.length < 5) return false
  const largestCluster = largestHueClusterCount(chromaticColors, 22)
  return largestCluster >= 5 && largestCluster / chromaticColors.length >= 0.78
}
