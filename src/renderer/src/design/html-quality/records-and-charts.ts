import { DESIGN_RESIZE_RESPONSIVE_LINES, formatDesignContextLines, type DesignContext } from '../design-context'
import { CHART_CONTAINER_CLASS_RE, CHART_MARK_CLASS_RE, GENERIC_CHART_LABEL_RE, GENERIC_METRIC_LABEL_RE, GENERIC_RECORD_ACTION_LABEL_RE, GENERIC_RECORD_DISCOVERY_LABEL_RE, GENERIC_RECORD_ITEM_LABEL_RE, GENERIC_RECORD_TABLE_COLUMN_LABEL_RE, METRIC_CONTAINER_CLASS_RE, METRIC_CONTEXT_RE, PSEUDO_LIST_CONTAINER_CLASS_RE, PSEUDO_LIST_ITEM_CLASS_RE, RECORD_DISCOVERY_CONTROL_RE, RECORD_DISCOVERY_MARKUP_RE, SPECIFIC_METRIC_LABEL_RE, SPECIFIC_RECORD_ACTION_LABEL_RE, SPECIFIC_RECORD_DISCOVERY_LABEL_RE, SPECIFIC_RECORD_ITEM_LABEL_RE, SPECIFIC_RECORD_TABLE_COLUMN_LABEL_RE, textContent } from './patterns'
import { attributeValue, attributeValues, hasActionableRecordText, hasCardLikeClass, hasRecordAction, isDeadHrefTarget, normalizedClassText, pairedTagMatches, staticHeadingTexts, tagMatches } from './interaction-and-accessibility'
import { controlLabel, normalizedActionLabel } from './controls-forms-and-dialogs'
import { concreteDataSignalCount, hasProductAppScreenSignal, productAppModuleSignalCount } from './product-and-hero-content'

export function tableDataRowTexts(inner: string): string[] {
  return pairedTagMatches(inner, 'tr')
    .filter(({ inner: rowInner }) => /<td\b/i.test(rowInner))
    .map(({ inner: rowInner }) => textContent(rowInner))
    .filter((text) => text.length >= 16)
}

export function normalizedRecordTableColumnLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tableHeaderLabels(inner: string): string[] {
  const labels = pairedTagMatches(inner, 'th')
    .map(({ tag, inner: headerInner }) => controlLabel(tag, headerInner))
    .map(normalizedRecordTableColumnLabel)
    .filter(Boolean)
  return Array.from(new Set(labels))
}

export function genericRecordTableColumnLabel(text: string): boolean {
  const normalized = normalizedRecordTableColumnLabel(text)
  return normalized.length > 0 && normalized.length <= 32 && GENERIC_RECORD_TABLE_COLUMN_LABEL_RE.test(normalized)
}

export function specificRecordTableColumnLabel(text: string): boolean {
  const normalized = normalizedRecordTableColumnLabel(text)
  return normalized.length > 0 && normalized.length <= 48 && SPECIFIC_RECORD_TABLE_COLUMN_LABEL_RE.test(normalized)
}

export function listItemRecordTexts(inner: string): string[] {
  return pairedTagMatches(inner, 'li')
    .map(({ inner: itemInner }) => textContent(itemInner))
    .filter((text) => text.length >= 24)
}

export function normalizedRecordItemLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/#.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function recordItemTitleLabels(tag: string, inner: string): string[] {
  const labels = [
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'title') ?? '',
    ...['h2', 'h3', 'h4', 'h5', 'h6'].flatMap((tagName) =>
      pairedTagMatches(inner, tagName).map(({ tag: headingTag, inner: headingInner }) => controlLabel(headingTag, headingInner))
    )
  ]
  return Array.from(new Set(labels.map(normalizedRecordItemLabel).filter(Boolean)))
}

export function genericRecordItemLabel(text: string): boolean {
  const normalized = normalizedRecordItemLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_RECORD_ITEM_LABEL_RE.test(normalized)
}

export function specificRecordItemLabel(text: string): boolean {
  const normalized = normalizedRecordItemLabel(text)
  return (
    normalized.length > 0 &&
    normalized.length <= 96 &&
    (SPECIFIC_RECORD_ITEM_LABEL_RE.test(normalized) || concreteDataSignalCount(normalized) > 0)
  )
}

export function recordItemBlocks(inner: string): Array<{ tag: string; inner: string }> {
  return ['li', 'article', 'section', 'div']
    .flatMap((tagName) => pairedTagMatches(inner, tagName))
    .filter(({ tag }) => {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') return false
      return tag.toLowerCase().startsWith('<li') || tag.toLowerCase().startsWith('<article') || hasPseudoListItemClass(tag) || hasCardLikeClass(tag)
    })
}

export function genericRecordItemLabelScope(inner: string): boolean {
  const recordItems = recordItemBlocks(inner).filter(({ inner: itemInner }) => hasActionableRecordText(textContent(itemInner)))
  if (recordItems.length < 3) return false
  const labels = recordItems.flatMap(({ tag, inner: itemInner }) => recordItemTitleLabels(tag, itemInner))
  if (labels.length < 3) return false
  const genericCount = labels.filter(genericRecordItemLabel).length
  const specificCount = labels.filter(specificRecordItemLabel).length
  return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
}

export function genericRecordItemLabelTags(html: string, visibleText: string): string[] {
  if (!hasProductAppScreenSignal(html, visibleText) || productAppModuleSignalCount(html) < 2) return []
  const weak: string[] = []
  for (const tagName of ['ul', 'ol', 'section', 'article', 'aside', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (genericRecordItemLabelScope(inner)) weak.push(tag)
    }
  }
  return weak
}

export function weakRecordActionTags(html: string): string[] {
  const weak: string[] = []
  for (const { tag, inner } of pairedTagMatches(html, 'table')) {
    const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
    if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
    const rows = tableDataRowTexts(inner).filter(hasActionableRecordText)
    if (rows.length >= 2 && !hasRecordAction(inner)) weak.push(tag)
  }
  for (const tagName of ['ul', 'ol']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const items = listItemRecordTexts(inner).filter(hasActionableRecordText)
      if (items.length >= 2 && !hasRecordAction(inner)) weak.push(tag)
    }
  }
  return weak
}

export function recordActionLabels(inner: string): string[] {
  const labels = [
    ...pairedTagMatches(inner, 'button').map(({ tag, inner: labelInner }) => controlLabel(tag, labelInner)),
    ...pairedTagMatches(inner, 'a').map(({ tag, inner: labelInner }) => {
      if (isDeadHrefTarget(attributeValue(tag, 'href'), inner)) return ''
      return controlLabel(tag, labelInner)
    }),
    ...tagMatches(inner, 'input').map((tag) => {
      const type = (attributeValue(tag, 'type') ?? '').toLowerCase()
      if (!['button', 'submit'].includes(type)) return ''
      return controlLabel(tag)
    }),
    ...tagMatches(inner, 'select').map((tag) => (
      attributeValue(tag, 'aria-label') ??
      attributeValue(tag, 'title') ??
      attributeValue(tag, 'name') ??
      ''
    ))
  ]
  const roleControlRe = /(<([a-z0-9-]+)\b[^>]*\brole\s*=\s*["'](?:button|link|menuitem)["'][^>]*>)([\s\S]*?)<\/\2>/gi
  let match: RegExpExecArray | null
  while ((match = roleControlRe.exec(inner))) {
    labels.push(controlLabel(match[1] ?? '', match[3] ?? ''))
  }
  return labels.map(normalizedActionLabel).filter(Boolean)
}

export function genericRecordActionLabel(text: string): boolean {
  const normalized = normalizedActionLabel(text)
  return normalized.length > 0 && normalized.length <= 36 && GENERIC_RECORD_ACTION_LABEL_RE.test(normalized)
}

export function specificRecordActionLabel(text: string): boolean {
  const normalized = normalizedActionLabel(text)
  return normalized.length > 0 && normalized.length <= 64 && SPECIFIC_RECORD_ACTION_LABEL_RE.test(normalized)
}

export function genericRecordActionLabelTags(html: string): string[] {
  const weak: string[] = []
  for (const { tag, inner } of pairedTagMatches(html, 'table')) {
    const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
    if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
    const actionableRows = pairedTagMatches(inner, 'tr').filter(({ inner: rowInner }) => /<td\b/i.test(rowInner) && hasActionableRecordText(textContent(rowInner)))
    if (actionableRows.length < 2 || !hasRecordAction(inner)) continue
    const labels = actionableRows.flatMap(({ inner: rowInner }) => recordActionLabels(rowInner))
    if (labels.length < 2) continue
    const genericCount = labels.filter(genericRecordActionLabel).length
    const specificCount = labels.filter(specificRecordActionLabel).length
    if (specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)) weak.push(tag)
  }
  for (const tagName of ['ul', 'ol']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const actionableItems = pairedTagMatches(inner, 'li').filter(({ inner: itemInner }) => hasActionableRecordText(textContent(itemInner)))
      if (actionableItems.length < 2 || !hasRecordAction(inner)) continue
      const labels = actionableItems.flatMap(({ inner: itemInner }) => recordActionLabels(itemInner))
      if (labels.length < 2) continue
      const genericCount = labels.filter(genericRecordActionLabel).length
      const specificCount = labels.filter(specificRecordActionLabel).length
      if (specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)) weak.push(tag)
    }
  }
  return weak
}

export function genericRecordTableColumnTags(html: string, visibleText: string): string[] {
  if (!hasProductAppScreenSignal(html, visibleText) || productAppModuleSignalCount(html) < 2) return []
  return pairedTagMatches(html, 'table')
    .filter(({ tag, inner }) => {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') return false
      const rows = tableDataRowTexts(inner).filter(hasActionableRecordText)
      if (rows.length < 2) return false
      const labels = tableHeaderLabels(inner)
      if (labels.length < 3) return false
      const genericCount = labels.filter(genericRecordTableColumnLabel).length
      const specificCount = labels.filter(specificRecordTableColumnLabel).length
      return specificCount === 0 && genericCount >= Math.ceil(labels.length * 0.67)
    })
    .map(({ tag }) => tag)
}

export function recordDiscoveryControlMarkup(html: string): boolean {
  return RECORD_DISCOVERY_MARKUP_RE.test(html) || RECORD_DISCOVERY_CONTROL_RE.test(textContent(html))
}

export function recordDiscoveryControlArea(markup: string): string {
  return markup
    .replace(/<table\b[\s\S]*?<\/table>/gi, ' ')
    .replace(/<(?:ul|ol)\b[\s\S]*?<\/(?:ul|ol)>/gi, ' ')
}

export function normalizedRecordDiscoveryLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function genericRecordDiscoveryLabel(text: string): boolean {
  const normalized = normalizedRecordDiscoveryLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_RECORD_DISCOVERY_LABEL_RE.test(normalized)
}

export function specificRecordDiscoveryLabel(text: string): boolean {
  const normalized = normalizedRecordDiscoveryLabel(text)
  return normalized.length > 0 && normalized.length <= 60 && SPECIFIC_RECORD_DISCOVERY_LABEL_RE.test(normalized)
}

export function recordDiscoveryControlLabels(markup: string): string[] {
  const area = recordDiscoveryControlArea(markup)
  const labels = [
    ...pairedTagMatches(area, 'label').map(({ inner }) => textContent(inner)),
    ...pairedTagMatches(area, 'button').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(area, 'a').map(({ tag, inner }) => controlLabel(tag, inner)),
    ...pairedTagMatches(area, 'option').map(({ inner }) => textContent(inner))
  ]
  for (const tagName of ['input', 'select']) {
    for (const tag of tagMatches(area, tagName)) {
      labels.push(
        attributeValue(tag, 'aria-label') ?? '',
        attributeValue(tag, 'title') ?? '',
        attributeValue(tag, 'placeholder') ?? ''
      )
    }
  }
  return Array.from(new Set(labels.map(normalizedRecordDiscoveryLabel).filter(Boolean)))
}

export function genericRecordDiscoveryControlTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['main', 'section', 'article', 'aside']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (actionableRecordCount(inner) < 4 || !recordDiscoveryControlMarkup(inner)) continue
      const labels = recordDiscoveryControlLabels(inner)
      const candidates = labels.filter((label) =>
        RECORD_DISCOVERY_CONTROL_RE.test(label) ||
        genericRecordDiscoveryLabel(label) ||
        specificRecordDiscoveryLabel(label)
      )
      if (candidates.length < 2) continue
      const genericCount = candidates.filter(genericRecordDiscoveryLabel).length
      const specificCount = candidates.filter(specificRecordDiscoveryLabel).length
      if (specificCount === 0 && genericCount >= Math.ceil(candidates.length * 0.67)) weak.push(tag)
    }
  }
  return weak
}

export function actionableRecordCount(inner: string): number {
  const tableRows = pairedTagMatches(inner, 'table')
    .flatMap(({ inner: tableInner }) => tableDataRowTexts(tableInner))
    .filter(hasActionableRecordText)
  const listItems = ['ul', 'ol']
    .flatMap((tagName) => pairedTagMatches(inner, tagName))
    .flatMap(({ inner: listInner }) => listItemRecordTexts(listInner))
    .filter(hasActionableRecordText)
  return tableRows.length + listItems.length
}

export function weakRecordDiscoveryControlTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['main', 'section', 'article', 'aside']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (actionableRecordCount(inner) >= 4 && !recordDiscoveryControlMarkup(inner)) weak.push(tag)
    }
  }
  return weak
}

export function hasMetricContainerClass(tag: string): boolean {
  return METRIC_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

export function hasMetricValue(text: string): boolean {
  return /[$€£¥]\s*\d|\b\d[\d,.]*\s?(?:%|k|m|b|arr|mrr|usd|eur|gbp|cny|rmb|users?|members?|tasks?|orders?|tickets?|invoices?|files?|days?|hrs?|hours?)\b|\b\d{2,}(?:\.\d+)?\b/i.test(
    text
  )
}

export function hasMetricContext(text: string): boolean {
  return METRIC_CONTEXT_RE.test(text)
}

export function metricCardBlocks(html: string): string[] {
  const blocks: string[] = []
  for (const tagName of ['section', 'article', 'div', 'li']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (!hasMetricContainerClass(tag)) continue
      const text = textContent(inner)
      if (text.length <= 180 && hasMetricValue(text)) blocks.push(`${tag}${inner}`)
    }
  }
  return blocks
}

export function metricCardLabel(block: string): string {
  const localHeading = staticHeadingTexts(block)[0]
  if (localHeading) return localHeading
  const label = ['span', 'small', 'p']
    .flatMap((tagName) => pairedTagMatches(block, tagName).map(({ inner }) => textContent(inner)))
    .find((text) => text.length > 0 && text.length <= 64)
  return label ?? ''
}

export function normalizedMetricLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/%+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function genericMetricCardLabel(block: string): boolean {
  const label = normalizedMetricLabel(metricCardLabel(block))
    .replace(/\b(?:today|this|last|previous|prior|current|q[1-4]|month|week|quarter|year|daily|weekly|monthly|annual|yearly)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const text = normalizedMetricLabel(textContent(block))
  return label.length > 0 && label.length <= 40 && GENERIC_METRIC_LABEL_RE.test(label) && !SPECIFIC_METRIC_LABEL_RE.test(text)
}

export function genericMetricCardLabelTags(html: string, visibleText: string): string[] {
  if (!hasProductAppScreenSignal(html, visibleText) || productAppModuleSignalCount(html) < 2) return []
  const blocks = metricCardBlocks(html)
  if (blocks.length < 3) return []
  const weak = blocks.filter(genericMetricCardLabel)
  return weak.length >= 3 ? weak.slice(0, 4) : []
}

export function weakMetricContextTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'div', 'li']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      if (!hasMetricContainerClass(tag)) continue
      const text = textContent(inner)
      if (text.length > 180 || !hasMetricValue(text)) continue
      if (!hasMetricContext(`${text} ${tag}`)) weak.push(tag)
    }
  }
  return weak.length >= 3 ? weak : []
}

export function hasPseudoListContainerClass(tag: string): boolean {
  return PSEUDO_LIST_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

export function hasPseudoListItemClass(tag: string): boolean {
  return PSEUDO_LIST_ITEM_CLASS_RE.test(normalizedClassText(tag))
}

export function hasChartContainerClass(tag: string): boolean {
  return CHART_CONTAINER_CLASS_RE.test(normalizedClassText(tag))
}

export function hasChartMarkClass(tag: string): boolean {
  return CHART_MARK_CLASS_RE.test(normalizedClassText(tag))
}

export function nestedCardLikeTags(html: string): string[] {
  const nested: string[] = []
  for (const tagName of ['div', 'section', 'article', 'li', 'aside']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      if (!hasCardLikeClass(tag)) continue
      const hasNestedCard = ['div', 'section', 'article', 'li', 'aside'].some((innerTagName) =>
        tagMatches(inner, innerTagName).some(hasCardLikeClass)
      )
      if (hasNestedCard) nested.push(tag)
    }
  }
  return nested
}

export function hasSemanticRecordStructure(html: string): boolean {
  return (
    /<(ul|ol|table)\b/i.test(html) ||
    /<(li|tr)\b/i.test(html) ||
    /\brole\s*=\s*["'](?:feed|grid|list|listbox|listitem|row|table)["']/i.test(html)
  )
}

export function pseudoListContainerTags(html: string): string[] {
  const containers: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'div']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      if (hasSemanticRecordStructure(inner)) continue
      const repeatedItems = ['div', 'article', 'section']
        .flatMap((innerTagName) => tagMatches(inner, innerTagName))
        .filter((innerTag) => hasPseudoListItemClass(innerTag) || hasCardLikeClass(innerTag))
      if (repeatedItems.length < 3) continue
      if (hasPseudoListContainerClass(tag) || repeatedItems.filter(hasPseudoListItemClass).length >= 3) containers.push(tag)
    }
  }
  return containers
}

export function chartMarkCount(inner: string): number {
  return ['div', 'span', 'i', 'b', 'rect', 'circle', 'path'].reduce(
    (count, tagName) => count + tagMatches(inner, tagName).filter(hasChartMarkClass).length,
    0
  )
}

export function hasChartDataContext(tag: string, inner: string): boolean {
  if (/<(figcaption|title|desc|text)\b/i.test(inner)) return true
  if (/\b(data-value|aria-valuenow|aria-valuetext)\s*=/i.test(inner)) return true
  const labels = [
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'aria-labelledby') ?? '',
    attributeValue(tag, 'title') ?? '',
    ...attributeValues(inner, 'aria-label'),
    ...attributeValues(inner, 'title')
  ].join(' ')
  return concreteDataSignalCount(`${textContent(inner)} ${labels}`) >= 2
}

export function weakChartStructureTags(html: string): string[] {
  const weak: string[] = []
  for (const tagName of ['section', 'article', 'aside', 'figure', 'div', 'svg']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const markCount = chartMarkCount(inner)
      const chartLike =
        hasChartContainerClass(tag) ||
        (tagName === 'svg' && hasChartContainerClass(tag)) ||
        markCount >= 3 ||
        /\brole\s*=\s*["']img["']/i.test(tag) && hasChartContainerClass(tag)
      if (!chartLike || markCount < 3) continue
      if (!hasChartDataContext(tag, inner)) weak.push(tag)
    }
  }
  return weak
}

export function chartLikeBlocks(html: string): Array<{ tag: string; inner: string }> {
  const blocks: Array<{ tag: string; inner: string }> = []
  for (const tagName of ['section', 'article', 'aside', 'figure', 'div', 'svg']) {
    for (const { tag, inner } of pairedTagMatches(html, tagName)) {
      const role = (attributeValue(tag, 'role') ?? '').toLowerCase()
      if (role === 'presentation' || role === 'none' || (attributeValue(tag, 'aria-hidden') ?? '').toLowerCase() === 'true') continue
      const markCount = chartMarkCount(inner)
      const chartLike =
        hasChartContainerClass(tag) ||
        (tagName === 'svg' && hasChartContainerClass(tag)) ||
        markCount >= 3 ||
        /\brole\s*=\s*["']img["']/i.test(tag) && hasChartContainerClass(tag)
      if (chartLike && markCount >= 3) blocks.push({ tag, inner })
    }
  }
  return blocks
}

export function normalizedChartLabel(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/[^\p{L}\p{N}&/%$€£¥#.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function chartLabelTexts(tag: string, inner: string): string[] {
  const labels = [
    attributeValue(tag, 'aria-label') ?? '',
    attributeValue(tag, 'title') ?? '',
    ...attributeValues(inner, 'aria-label'),
    ...attributeValues(inner, 'title')
  ]
  for (const tagName of ['h2', 'h3', 'h4', 'figcaption', 'title', 'desc', 'legend', 'text']) {
    labels.push(...pairedTagMatches(inner, tagName).map(({ inner: labelInner }) => textContent(labelInner)))
  }
  return Array.from(new Set(labels.map(normalizedChartLabel).filter(Boolean)))
}

export function genericChartLabel(text: string): boolean {
  const normalized = normalizedChartLabel(text)
  return normalized.length > 0 && normalized.length <= 40 && GENERIC_CHART_LABEL_RE.test(normalized)
}
