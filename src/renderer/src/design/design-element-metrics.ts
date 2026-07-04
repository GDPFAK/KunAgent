/**
 * Pure helpers for the element-inspector panel.
 *
 * The webview captures raw computed-style strings; these utilities turn them
 * into something a panel can render and into hex for color routing
 * (the brand-color swatch requires `^#[0-9a-fA-F]{6}$`).
 */

export type BoxSides = { top: number; right: number; bottom: number; left: number }

export type DesignElementMetrics = {
  width: number
  height: number
  margin: BoxSides
  padding: BoxSides
  border: BoxSides
  boxSizing: string
  color: string
  backgroundColor: string
  borderColor: string
  id: string
  className: string
}

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const RGB_RE = /^rgba?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(-?\d+(?:\.\d+)?))?\s*\)$/

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 255) return 255
  return Math.round(value)
}

function toHexComponent(value: number): string {
  return clampChannel(value).toString(16).padStart(2, '0')
}

/**
 * Convert any CSS color string a browser would yield from getComputedStyle into
 * a `#rrggbb` lowercase hex. Returns `''` for fully transparent / unparsable
 * inputs so callers can decide whether to fall back.
 */
export function rgbToHex(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed === 'transparent') return ''

  const hexMatch = trimmed.match(HEX_RE)
  if (hexMatch) {
    const body = hexMatch[1]
    if (body.length === 3) {
      return ('#' + body.split('').map((c) => c + c).join('')).toLowerCase()
    }
    if (body.length === 8) {
      return ('#' + body.slice(0, 6)).toLowerCase()
    }
    return ('#' + body).toLowerCase()
  }

  const rgbMatch = trimmed.match(RGB_RE)
  if (rgbMatch) {
    const alpha = rgbMatch[4] != null ? Number(rgbMatch[4]) : 1
    if (alpha === 0) return ''
    return ('#' + toHexComponent(Number(rgbMatch[1])) + toHexComponent(Number(rgbMatch[2])) + toHexComponent(Number(rgbMatch[3]))).toLowerCase()
  }

  return ''
}

/** Format a number of pixels for the inspector. `42.6` → `'42.6px'`, `42` → `'42px'`. */
export function formatPx(value: number): string {
  if (!Number.isFinite(value)) return '0px'
  if (Math.abs(value - Math.round(value)) < 0.05) {
    return `${Math.round(value)}px`
  }
  return `${value.toFixed(1)}px`
}

/**
 * Collapse a 4-side box into a CSS-shorthand-style label: `'0'` when all zero,
 * one value when uniform, two when vertical/horizontal pair, otherwise all four.
 */
export function formatBoxSides(box: BoxSides): string {
  const { top, right, bottom, left } = box
  if (top === 0 && right === 0 && bottom === 0 && left === 0) return '0'
  if (top === right && right === bottom && bottom === left) return formatPx(top)
  if (top === bottom && right === left) return `${formatPx(top)} ${formatPx(right)}`
  return `${formatPx(top)} ${formatPx(right)} ${formatPx(bottom)} ${formatPx(left)}`
}

/** Useful for the inspector and the eyedropper popover. */
export function hasVisibleFill(color: string | null | undefined): boolean {
  return Boolean(rgbToHex(color))
}
