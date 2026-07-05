export type BackgroundSubagentCompletionNotice = {
  childId: string
  label: string
  status: 'completed' | 'failed'
  summary?: string
  error?: string
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function unescapeXml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

function readXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  if (!match) return null
  return unescapeXml(match[1].trim())
}

export function formatBackgroundSubagentCompletionNotice(input: BackgroundSubagentCompletionNotice): string {
  const lines = [
    '<background_subagent_completed>',
    `<child_id>${escapeXml(input.childId)}</child_id>`,
    `<label>${escapeXml(input.label)}</label>`,
    `<status>${input.status}</status>`
  ]
  if (input.summary?.trim()) {
    lines.push(`<summary>${escapeXml(input.summary.trim())}</summary>`)
  }
  if (input.error?.trim()) {
    lines.push(`<error>${escapeXml(input.error.trim())}</error>`)
  }
  lines.push('</background_subagent_completed>')
  return lines.join('\n')
}

export function parseBackgroundSubagentCompletionNotice(text: string): BackgroundSubagentCompletionNotice | null {
  const trimmed = text.trim()
  if (!trimmed.includes('<background_subagent_completed>')) return null
  const childId = readXmlTag(trimmed, 'child_id')
  const label = readXmlTag(trimmed, 'label')
  const status = readXmlTag(trimmed, 'status')
  if (!childId || !label || (status !== 'completed' && status !== 'failed')) return null
  const summary = readXmlTag(trimmed, 'summary') ?? undefined
  const error = readXmlTag(trimmed, 'error') ?? undefined
  return {
    childId,
    label,
    status,
    ...(summary ? { summary } : {}),
    ...(error ? { error } : {})
  }
}

export function isBackgroundSubagentNoticeSource(
  messageSource: unknown
): messageSource is 'background_subagent' {
  return messageSource === 'background_subagent'
}

export type BackgroundSubagentUserMessageSource = 'background_subagent'

export function inferBackgroundSubagentUserMessageSource(
  text: string
): BackgroundSubagentUserMessageSource | undefined {
  return parseBackgroundSubagentCompletionNotice(text) ? 'background_subagent' : undefined
}

export function isBackgroundSubagentNoticeUserMessage(input: {
  text: string
  meta?: Record<string, unknown> | null
}): boolean {
  if (isBackgroundSubagentNoticeSource(input.meta?.messageSource)) return true
  return inferBackgroundSubagentUserMessageSource(input.text) === 'background_subagent'
}
