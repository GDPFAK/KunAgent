export function wrapUntrustedContent(input: {
  content: string
  source?: { kind?: string; label?: string }
}): string {
  const source = [input.source?.kind, input.source?.label].filter(Boolean).join(':') || 'external'
  return [
    `<untrusted-content source="${escapeAttribute(source)}">`,
    input.content,
    '</untrusted-content>'
  ].join('\n')
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
