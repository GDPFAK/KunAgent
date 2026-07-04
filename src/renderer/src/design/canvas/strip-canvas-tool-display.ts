const UNFENCED_CANVAS_MARKER = 'design_canvas'
const FENCED_CANVAS_BLOCK_RE = /```(?:design_canvas|shapeops)\s*[\s\S]*?```/g

/**
 * Find the closing `}` for a JSON object that starts at `openIndex`.
 * Respects double-quoted strings and backslash escapes so HTML in
 * `"content": "<!DOCTYPE …>"` does not throw off depth counting.
 */
export function findMatchingJsonObjectEnd(text: string, openIndex: number): number {
  if (text[openIndex] !== '{') return -1
  let depth = 0
  let inString = false
  let escape = false
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Remove unfenced `design_canvas { … }` tool-call blobs from assistant text
 * before it is shown in the chat UI. The renderer still parses the raw SSE
 * stream for live canvas application — this helper is display-only.
 *
 * Models sometimes emit `design_canvas {"action":"write","content":"<!DOCTYPE…"}`
 * without markdown fences, which would dump entire HTML documents into the rail.
 * Incomplete blocks (still streaming) are stripped from the marker onward.
 */
export function stripUnfencedCanvasToolCalls(text: string): string {
  const preserved: string[] = []
  const protectedText = text.replace(FENCED_CANVAS_BLOCK_RE, (match) => {
    const token = `\u0000CANVAS_FENCE_${preserved.length}\u0000`
    preserved.push(match)
    return token
  })

  let result = ''
  let cursor = 0
  while (cursor < protectedText.length) {
    const markerIndex = protectedText.indexOf(UNFENCED_CANVAS_MARKER, cursor)
    if (markerIndex === -1) {
      result += protectedText.slice(cursor)
      break
    }
    result += protectedText.slice(cursor, markerIndex)
    let pos = markerIndex + UNFENCED_CANVAS_MARKER.length
    while (pos < protectedText.length && /\s/.test(protectedText[pos]!)) pos += 1
    if (protectedText[pos] === '{') {
      const end = findMatchingJsonObjectEnd(protectedText, pos)
      if (end === -1) break
      cursor = end + 1
      continue
    }
    result += UNFENCED_CANVAS_MARKER
    cursor = markerIndex + UNFENCED_CANVAS_MARKER.length
  }

  const restored = preserved.reduce(
    (acc, block, index) => acc.replace(`\u0000CANVAS_FENCE_${index}\u0000`, block),
    result
  )
  return restored.replace(/\n{3,}/g, '\n\n').trimEnd()
}

export function sanitizeAssistantCanvasToolDisplay(text: string): string {
  return stripUnfencedCanvasToolCalls(text)
}
