import type { DesignHtmlElementContext } from './design-composer-context'

type TagRange = {
  start: number
  end: number
  tagName: string
  selfClosing: boolean
}

type ElementRange = {
  start: number
  end: number
  open: TagRange
  closeStart?: number
}

export type HtmlElementTextReplaceResult =
  | { ok: true; content: string }
  | { ok: false; message: string }

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function tagNameAt(source: string, start: number): string {
  const match = source.slice(start).match(/^<([A-Za-z][\w:-]*)/)
  return match?.[1]?.toLowerCase() ?? ''
}

function findOpeningTagEnd(source: string, start: number): number {
  let quote = ''
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i]
    const prev = source[i - 1]
    if (quote) {
      if (ch === quote && prev !== '\\') quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '>') return i + 1
  }
  return -1
}

function readOpeningTag(source: string, start: number): TagRange | null {
  if (source[start] !== '<') return null
  const tagName = tagNameAt(source, start)
  const end = findOpeningTagEnd(source, start)
  if (!tagName || end < 0) return null
  return {
    start,
    end,
    tagName,
    selfClosing: VOID_TAGS.has(tagName) || /\/\s*>$/.test(source.slice(start, end))
  }
}

function findNextSameTag(source: string, tagName: string, from: number): { index: number; closing: boolean } | null {
  const pattern = new RegExp(`<\\/?${escapeRegex(tagName)}\\b`, 'gi')
  pattern.lastIndex = from
  const match = pattern.exec(source)
  if (!match) return null
  return { index: match.index, closing: source[match.index + 1] === '/' }
}

function findElementRange(source: string, open: TagRange): ElementRange | null {
  if (open.selfClosing) return { start: open.start, end: open.end, open }
  let depth = 1
  let cursor = open.end
  while (cursor < source.length) {
    const next = findNextSameTag(source, open.tagName, cursor)
    if (!next) return null
    const tagEnd = source.indexOf('>', next.index)
    if (tagEnd < 0) return null
    if (next.closing) {
      depth -= 1
      if (depth === 0) {
        return { start: open.start, end: tagEnd + 1, open, closeStart: next.index }
      }
      cursor = tagEnd + 1
      continue
    }
    const nestedOpen = readOpeningTag(source, next.index)
    if (!nestedOpen) return null
    if (!nestedOpen.selfClosing) depth += 1
    cursor = nestedOpen.end
  }
  return null
}

function findTagStartBefore(source: string, index: number): number {
  let cursor = index
  while (cursor >= 0) {
    const start = source.lastIndexOf('<', cursor)
    if (start < 0) return -1
    const next = source[start + 1]
    if (next && !['/', '!', '?'].includes(next) && /[A-Za-z]/.test(next)) return start
    cursor = start - 1
  }
  return -1
}

function findAttributeElementRange(
  source: string,
  tagName: string,
  attrName: string,
  attrValue: string
): ElementRange | null {
  const value = escapeRegex(attrValue)
  const pattern = new RegExp(
    `\\b${escapeRegex(attrName)}\\s*=\\s*(?:"${value}"|'${value}'|${value})(?=[\\s>/])`,
    'gi'
  )
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source))) {
    const tagStart = findTagStartBefore(source, match.index)
    if (tagStart < 0) continue
    const open = readOpeningTag(source, tagStart)
    if (!open || open.tagName !== tagName.toLowerCase()) continue
    return findElementRange(source, open)
  }
  return null
}

function skipIgnorableMarkup(source: string, index: number): number {
  if (source.startsWith('<!--', index)) {
    const end = source.indexOf('-->', index + 4)
    return end < 0 ? source.length : end + 3
  }
  if (source[index + 1] === '!' || source[index + 1] === '?') {
    const end = source.indexOf('>', index + 2)
    return end < 0 ? source.length : end + 1
  }
  return index
}

function directChildElementRanges(source: string, parent: ElementRange): ElementRange[] {
  if (parent.closeStart === undefined) return []
  const children: ElementRange[] = []
  let cursor = parent.open.end
  while (cursor < parent.closeStart) {
    const next = source.indexOf('<', cursor)
    if (next < 0 || next >= parent.closeStart) break
    const skipped = skipIgnorableMarkup(source, next)
    if (skipped !== next) {
      cursor = skipped
      continue
    }
    if (source[next + 1] === '/') break
    const open = readOpeningTag(source, next)
    if (!open) {
      cursor = next + 1
      continue
    }
    const range = findElementRange(source, open)
    if (!range) {
      cursor = open.end
      continue
    }
    children.push(range)
    cursor = range.end
  }
  return children
}

function findBodyRange(source: string): ElementRange | null {
  const match = /<body\b/i.exec(source)
  if (!match) return null
  const open = readOpeningTag(source, match.index)
  return open ? findElementRange(source, open) : null
}

type SelectorStep = {
  tagName: string
  nth: number
}

function parseGeneratedSelector(selector: string): SelectorStep[] | null {
  const parts = selector.split('>').map((part) => part.trim()).filter(Boolean)
  if (parts[0]?.toLowerCase() !== 'body') return null
  const steps: SelectorStep[] = []
  for (const part of parts.slice(1)) {
    const match = /^([a-z][\w:-]*)(?::nth-of-type\((\d+)\))?$/i.exec(part)
    if (!match) return null
    steps.push({
      tagName: match[1].toLowerCase(),
      nth: Math.max(1, Number.parseInt(match[2] ?? '1', 10))
    })
  }
  return steps
}

function findGeneratedSelectorRange(source: string, selector: string): ElementRange | null {
  const steps = parseGeneratedSelector(selector)
  if (!steps) return null
  let current = findBodyRange(source)
  if (!current) return null
  for (const step of steps) {
    const matches: ElementRange[] = directChildElementRanges(source, current)
      .filter((child) => child.open.tagName === step.tagName)
    current = matches[step.nth - 1] ?? null
    if (!current) return null
  }
  return current
}

function replacePlainElementText(source: string, range: ElementRange, nextText: string): string | null {
  if (range.closeStart === undefined || range.open.selfClosing) return null
  const inner = source.slice(range.open.end, range.closeStart)
  if (/<\s*\/?[a-zA-Z][^>]*>/.test(inner)) return null
  const leading = inner.trim() ? (inner.match(/^\s*/)?.[0] ?? '') : ''
  const trailing = inner.trim() ? (inner.match(/\s*$/)?.[0] ?? '') : ''
  return `${source.slice(0, range.open.end)}${leading}${escapeHtmlText(nextText)}${trailing}${source.slice(range.closeStart)}`
}

function idFromElementHtml(html: string): string | null {
  return /\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(html)?.slice(1).find(Boolean) ?? null
}

function rangeForContext(source: string, element: DesignHtmlElementContext): ElementRange | null {
  const tagName = element.tagName.toLowerCase()
  const id = idFromElementHtml(element.html)
  if (id) {
    const byId = findAttributeElementRange(source, tagName, 'id', id)
    if (byId) return byId
  }
  if (element.selector.startsWith('body')) {
    const byGeneratedSelector = findGeneratedSelectorRange(source, element.selector)
    if (byGeneratedSelector?.open.tagName === tagName) return byGeneratedSelector
  }
  return null
}

function replaceExactElementHtml(
  source: string,
  elementHtml: string,
  nextText: string
): HtmlElementTextReplaceResult {
  const html = elementHtml.trim()
  if (!html) return { ok: false, message: 'Selected element has no HTML source.' }
  const first = source.indexOf(html)
  if (first < 0) return { ok: false, message: 'Selected element could not be located in the HTML file.' }
  if (source.indexOf(html, first + html.length) >= 0) {
    return { ok: false, message: 'Selected element markup appears more than once; please select a more specific text element.' }
  }
  const open = readOpeningTag(html, 0)
  const range = open ? findElementRange(html, open) : null
  if (!range) return { ok: false, message: 'Selected element HTML is incomplete.' }
  const updatedHtml = replacePlainElementText(html, range, nextText)
  if (!updatedHtml) {
    return { ok: false, message: 'Only plain text elements can be edited directly. Select the innermost text node.' }
  }
  return {
    ok: true,
    content: `${source.slice(0, first)}${updatedHtml}${source.slice(first + html.length)}`
  }
}

export function replaceHtmlElementTextInSource(
  source: string,
  element: DesignHtmlElementContext,
  nextText: string
): HtmlElementTextReplaceResult {
  const range = rangeForContext(source, element)
  if (range) {
    const content = replacePlainElementText(source, range, nextText)
    if (content) return { ok: true, content }
    return { ok: false, message: 'Only plain text elements can be edited directly. Select the innermost text node.' }
  }
  return replaceExactElementHtml(source, element.html, nextText)
}
