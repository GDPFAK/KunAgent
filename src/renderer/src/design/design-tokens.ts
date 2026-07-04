/**
 * Pure color math and palette/typescale shaping for the design tokens panel.
 *
 * Zero dependencies. Inputs are hex (`#rrggbb`) so the helpers are unit-testable
 * in the `node` vitest env. The renderer normalizes non-hex CSS color strings
 * (`rgb()`, `hsl()`, `oklch()`, named) into hex via a detached DOM element
 * before reaching here.
 */

export type RGB = { r: number; g: number; b: number }
export type HSL = { h: number; s: number; l: number }

export const RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const

/**
 * Per-stop target lightness used to project a base color into a 50–900 ramp.
 * The 500 step lives near the visually balanced midpoint; adjacent stops are
 * spaced for even perceptual gaps on saturated brand colors.
 */
const STOP_LIGHTNESS: Record<number, number> = {
  50: 0.96,
  100: 0.9,
  200: 0.82,
  300: 0.7,
  400: 0.58,
  500: 0.5,
  600: 0.42,
  700: 0.34,
  800: 0.24,
  900: 0.14
}

export type Ramp = { stop: number; hex: string; isBase: boolean }[]
export type NamedPalette = {
  primary?: { base: string; ramp: Ramp }
  secondary?: { base: string; ramp: Ramp }
  tertiary?: { base: string; ramp: Ramp }
  neutral?: { base: string; ramp: Ramp }
}

export type TokenRole = 'primary' | 'secondary' | 'tertiary' | 'neutral' | 'other'
export type ExtractedToken = { name: string; value: string; role: TokenRole }
export type TypeScaleEntry = {
  sample: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  fontFamily: string
}
export type ExtractedDesignTokens = {
  colors: ExtractedToken[]
  fonts: { name: string; value: string }[]
  radii: { name: string; value: string }[]
  spacing: { name: string; value: string }[]
  typeScale: TypeScaleEntry[]
  sampledColors: string[]
  title: string
}

// --- color conversions ------------------------------------------------------

export function hexToRgb(hex: string): RGB | null {
  if (!hex) return null
  const m = hex.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!m) return null
  const body = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16)
  }
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const R = r / 255
  const G = g / 255
  const B = b / 255
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === R) h = ((G - B) / d + (G < B ? 6 : 0))
    else if (max === G) h = (B - R) / d + 2
    else h = (R - G) / d + 4
    h *= 60
  }
  return { h, s, l }
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = ((h % 360) + 360) % 360 / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (hp >= 0 && hp < 1) { r1 = c; g1 = x; b1 = 0 }
  else if (hp < 2) { r1 = x; g1 = c; b1 = 0 }
  else if (hp < 3) { r1 = 0; g1 = c; b1 = x }
  else if (hp < 4) { r1 = 0; g1 = x; b1 = c }
  else if (hp < 5) { r1 = x; g1 = 0; b1 = c }
  else { r1 = c; g1 = 0; b1 = x }
  const m = l - c / 2
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 }
}

// --- ramp generation --------------------------------------------------------

/**
 * Build a 10-stop ramp from a base hex. Stop nearest the base lightness is
 * snapped to the exact base color so the source value is always present.
 */
export function generateRamp(baseHex: string): Ramp {
  const rgb = hexToRgb(baseHex)
  if (!rgb) return []
  const { h, s } = rgbToHsl(rgb)
  const { l: baseL } = rgbToHsl(rgb)
  // Find the stop whose target lightness is closest to the base color's L.
  let anchorStop = 500
  let anchorDelta = Number.POSITIVE_INFINITY
  for (const stop of RAMP_STOPS) {
    const d = Math.abs(STOP_LIGHTNESS[stop] - baseL)
    if (d < anchorDelta) {
      anchorDelta = d
      anchorStop = stop
    }
  }
  const baseLower = baseHex.toLowerCase()
  return RAMP_STOPS.map((stop) => {
    if (stop === anchorStop) {
      return { stop, hex: baseLower, isBase: true }
    }
    const hex = rgbToHex(hslToRgb({ h, s, l: STOP_LIGHTNESS[stop] }))
    return { stop, hex, isBase: false }
  })
}

// --- role inference + palette shaping --------------------------------------

// Neutral check first: a token like `--text-primary` is the primary *text*
// color (a neutral), not the brand primary. Without the precedence, the
// `primary` substring would wrongly steal that slot.
const NEUTRAL_RE = /(^|[-_])(text|bg|background|surface|ink|border|muted|fg|fill|neutral|gray|grey|divider)([-_]|$|\d)/i
const PRIMARY_RE = /(^|[-_])(primary|accent|brand)([-_]|$|\d)/i
const SECONDARY_RE = /(^|[-_])secondary([-_]|$|\d)/i
const TERTIARY_RE = /(^|[-_])tertiary([-_]|$|\d)/i

export function roleFromTokenName(name: string): TokenRole {
  if (NEUTRAL_RE.test(name)) return 'neutral'
  if (PRIMARY_RE.test(name)) return 'primary'
  if (SECONDARY_RE.test(name)) return 'secondary'
  if (TERTIARY_RE.test(name)) return 'tertiary'
  return 'other'
}

export function buildPalette(extracted: ExtractedDesignTokens): NamedPalette {
  const palette: NamedPalette = {}
  const claim = (role: Exclude<TokenRole, 'other'>, hex: string): void => {
    if (palette[role]) return
    palette[role] = { base: hex.toLowerCase(), ramp: generateRamp(hex) }
  }
  for (const token of extracted.colors) {
    if (token.role !== 'other') claim(token.role, token.value)
  }
  // Ordering fallback for `other`s when slots are still open.
  const ordered = (['primary', 'secondary', 'tertiary', 'neutral'] as const).filter((r) => !palette[r])
  let i = 0
  for (const token of extracted.colors) {
    if (token.role === 'other' && i < ordered.length) {
      claim(ordered[i], token.value)
      i += 1
    }
  }
  return palette
}

// --- typography scale -------------------------------------------------------

export type TypeRow = {
  label: string
  sample: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  fontFamily: string
  px: number
}

function labelForFontSize(px: number): string {
  if (px >= 40) return 'Display'
  if (px >= 28) return 'H1'
  if (px >= 22) return 'H2'
  if (px >= 18) return 'H3'
  if (px >= 14) return 'Body'
  return 'Caption'
}

export function typeScaleToRows(scale: TypeScaleEntry[]): TypeRow[] {
  const rows: TypeRow[] = scale.map((entry) => {
    const px = parseFloat(entry.fontSize) || 0
    return {
      label: labelForFontSize(px),
      sample: entry.sample,
      fontSize: entry.fontSize,
      fontWeight: entry.fontWeight,
      lineHeight: entry.lineHeight,
      fontFamily: entry.fontFamily,
      px
    }
  })
  rows.sort((a, b) => b.px - a.px)
  // Dedupe by px+weight so an h1 and an h2 with same size+weight collapse.
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${Math.round(row.px)}:${row.fontWeight}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
