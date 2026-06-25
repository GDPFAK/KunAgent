export function middleEllipsize(value: string, maxLength: number): string {
  if (maxLength <= 0) return ''
  if (value.length <= maxLength) return value
  if (maxLength <= 3) return '.'.repeat(maxLength)

  const marker = '...'
  const visibleLength = maxLength - marker.length
  const startLength = Math.ceil(visibleLength / 2)
  const endLength = Math.floor(visibleLength / 2)

  return `${value.slice(0, startLength)}${marker}${value.slice(value.length - endLength)}`
}
