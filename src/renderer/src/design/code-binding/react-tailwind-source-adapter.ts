import type { DesignCodeChangeRequest } from './code-change-request'

export type ReactTailwindSourceSkip = {
  requestId: string
  reason: string
}

export type ReactTailwindSourceApplyResult = {
  content: string
  changed: boolean
  applied: DesignCodeChangeRequest[]
  skipped: ReactTailwindSourceSkip[]
}

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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function escapeJsxText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function cleanClassToken(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function safeArbitraryValue(value: string | null): string | null {
  const cleaned = value?.trim()
  if (!cleaned || /[\s"'`<>\\\]]/.test(cleaned)) return null
  return cleaned
}

function tagNameAt(source: string, start: number): string {
  const match = source.slice(start).match(/^<([A-Za-z][\w.$:-]*)/)
  return match?.[1] ?? ''
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

function findOpeningTagEnd(source: string, start: number): number {
  let quote = ''
  let braceDepth = 0
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i]
    const prev = source[i - 1]
    if (quote) {
      if (ch === quote && prev !== '\\') quote = ''
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') {
      braceDepth += 1
      continue
    }
    if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1)
      continue
    }
    if (ch === '>' && braceDepth === 0) return i + 1
  }
  return -1
}

function readOpeningTag(source: string, start: number): TagRange | null {
  if (source[start] !== '<') return null
  const end = findOpeningTagEnd(source, start)
  const tagName = tagNameAt(source, start)
  if (end < 0 || !tagName) return null
  return {
    start,
    end,
    tagName,
    selfClosing: /\/\s*>$/.test(source.slice(start, end))
  }
}

function findAttributeTag(source: string, attrName: string, attrValue: string): TagRange | null {
  const value = escapeRegex(attrValue)
  const pattern = new RegExp(`\\b${escapeRegex(attrName)}\\s*=\\s*(?:"${value}"|'${value}'|\\{\\s*["']${value}["']\\s*\\})`)
  const match = pattern.exec(source)
  if (!match) return null
  const tagStart = findTagStartBefore(source, match.index)
  if (tagStart < 0) return null
  return readOpeningTag(source, tagStart)
}

function findComponentTag(source: string, componentName: string): TagRange | null {
  const pattern = new RegExp(`<${escapeRegex(componentName)}\\b`, 'g')
  const starts: number[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source))) starts.push(match.index)
  if (starts.length !== 1) return null
  return readOpeningTag(source, starts[0])
}

function findRequestTag(source: string, request: DesignCodeChangeRequest): TagRange | null {
  if (request.onlookId) {
    const tag = findAttributeTag(source, 'data-onlook-id', request.onlookId)
    if (tag) return tag
  }
  if (request.domId) {
    return (
      findAttributeTag(source, 'data-kun-source-id', request.domId) ??
      findAttributeTag(source, 'data-dom-id', request.domId) ??
      findAttributeTag(source, 'id', request.domId)
    )
  }
  if (request.componentName) return findComponentTag(source, request.componentName)
  return null
}

function findNextSameTag(source: string, tagName: string, from: number): { index: number; closing: boolean } | null {
  const pattern = new RegExp(`<\\/?${escapeRegex(tagName)}\\b`, 'g')
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
    if (next.closing) {
      depth -= 1
      const closeEnd = source.indexOf('>', next.index)
      if (closeEnd < 0) return null
      if (depth === 0) return { start: open.start, end: closeEnd + 1, open, closeStart: next.index }
      cursor = closeEnd + 1
      continue
    }
    const nestedOpen = readOpeningTag(source, next.index)
    if (!nestedOpen) return null
    if (!nestedOpen.selfClosing) depth += 1
    cursor = nestedOpen.end
  }
  return null
}

function firstSolidColor(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  const first = value[0]
  if (!first || typeof first !== 'object') return null
  const fill = first as Record<string, unknown>
  return fill.type === 'solid' && typeof fill.color === 'string' ? fill.color : null
}

function firstStroke(value: unknown): { color?: string; width?: number } | null {
  if (!Array.isArray(value)) return null
  const first = value[0]
  if (!first || typeof first !== 'object') return null
  const stroke = first as Record<string, unknown>
  return {
    ...(typeof stroke.color === 'string' ? { color: stroke.color } : {}),
    ...(typeof stroke.width === 'number' ? { width: stroke.width } : {})
  }
}

function numericPx(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 100) / 100}px` : null
}

function tailwindClassesForRequest(request: DesignCodeChangeRequest): string[] {
  const payload = request.payload
  const classes: string[] = []
  const fillColor = safeArbitraryValue(firstSolidColor(payload.fills))
  if (fillColor) classes.push(`bg-[${fillColor}]`)
  const stroke = firstStroke(payload.strokes)
  const strokeColor = safeArbitraryValue(stroke?.color ?? null)
  if (strokeColor) classes.push(`border-[${strokeColor}]`)
  const strokeWidth = numericPx(stroke?.width)
  if (strokeWidth) classes.push('border', `border-[${strokeWidth}]`)
  const fontColor = safeArbitraryValue(typeof payload.fontColor === 'string' ? payload.fontColor : null)
  if (fontColor) classes.push(`text-[${fontColor}]`)
  const fontSize = numericPx(payload.fontSize)
  if (fontSize) classes.push(`text-[${fontSize}]`)
  const radius = Array.isArray(payload.cornerRadius) ? payload.cornerRadius[0] : payload.cornerRadius
  const radiusPx = numericPx(radius)
  if (radiusPx) classes.push(`rounded-[${radiusPx}]`)
  if (typeof payload.opacity === 'number' && Number.isFinite(payload.opacity)) {
    classes.push(`opacity-[${Math.max(0, Math.min(1, payload.opacity))}]`)
  }
  const width = numericPx(payload.width ?? (payload.bounds as Record<string, unknown> | undefined)?.width)
  const height = numericPx(payload.height ?? (payload.bounds as Record<string, unknown> | undefined)?.height)
  if (width) classes.push(`w-[${width}]`)
  if (height) classes.push(`h-[${height}]`)
  return classes
}

function mergeClassNames(existing: string, additions: readonly string[]): string {
  const tokens = existing.split(/\s+/).filter(Boolean)
  for (const addition of additions.map(cleanClassToken).filter(Boolean)) {
    if (!tokens.includes(addition)) tokens.push(addition)
  }
  return tokens.join(' ')
}

function updateClassName(source: string, tag: TagRange, additions: readonly string[]): string | null {
  if (additions.length === 0) return null
  const tagSource = source.slice(tag.start, tag.end)
  const classMatch = /\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(tagSource)
  if (classMatch) {
    const quote = classMatch[1] !== undefined ? '"' : "'"
    const existing = classMatch[1] ?? classMatch[2] ?? ''
    const merged = mergeClassNames(existing, additions)
    const attrStart = tag.start + classMatch.index
    const attrEnd = attrStart + classMatch[0].length
    return `${source.slice(0, attrStart)}className=${quote}${merged}${quote}${source.slice(attrEnd)}`
  }
  if (/\bclassName\s*=/.test(tagSource)) return null
  const insertAt = tag.selfClosing ? tag.end - 2 : tag.end - 1
  return `${source.slice(0, insertAt)} className="${additions.join(' ')}"${source.slice(insertAt)}`
}

function applyEditText(source: string, request: DesignCodeChangeRequest, open: TagRange): string | null {
  const textContent = request.payload.textContent
  if (typeof textContent !== 'string') return null
  const range = findElementRange(source, open)
  if (!range?.closeStart || range.open.selfClosing) return null
  const inner = source.slice(open.end, range.closeStart)
  if (/[<{]/.test(inner)) return null
  return `${source.slice(0, open.end)}${escapeJsxText(textContent)}${source.slice(range.closeStart)}`
}

function applyRemoveNode(source: string, open: TagRange): string | null {
  const range = findElementRange(source, open)
  if (!range) return null
  return `${source.slice(0, range.start)}${source.slice(range.end)}`
}

function applyRequest(source: string, request: DesignCodeChangeRequest): { content?: string; reason?: string } {
  const tag = findRequestTag(source, request)
  if (!tag) return { reason: 'No unique JSX tag found for this binding anchor.' }
  switch (request.kind) {
    case 'edit-text':
      {
        const content = applyEditText(source, request, tag)
        return content
          ? { content }
          : { reason: 'Text edit requires a non-nested plain JSX text node.' }
      }
    case 'update-style':
    case 'update-layout': {
      const classes = tailwindClassesForRequest(request)
      const content = updateClassName(source, tag, classes)
      return content
        ? { content }
        : { reason: classes.length === 0 ? 'No supported Tailwind class update in payload.' : 'className is an expression.' }
    }
    case 'remove-node':
      {
        const content = applyRemoveNode(source, tag)
        return content ? { content } : { reason: 'Unable to find a complete JSX element range.' }
      }
    default:
      return { reason: `Unsupported code change request kind: ${request.kind}` }
  }
}

export function applyReactTailwindRequestsToSource(
  source: string,
  requests: readonly DesignCodeChangeRequest[]
): ReactTailwindSourceApplyResult {
  let content = source
  const applied: DesignCodeChangeRequest[] = []
  const skipped: ReactTailwindSourceSkip[] = []
  for (const request of requests) {
    const result = applyRequest(content, request)
    if (!result.content || result.content === content) {
      skipped.push({ requestId: request.id, reason: result.reason ?? 'No source change produced.' })
      continue
    }
    content = result.content
    applied.push(request)
  }
  return {
    content,
    changed: content !== source,
    applied,
    skipped
  }
}
