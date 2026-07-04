/**
 * Token extraction from the rendered HTML artifact (runs inside the webview
 * via `executeJavaScript`). Strategy: read CSS custom properties off `:root`
 * / `html` cssRules first; fall back to sampling computed colors only when
 * the source defines fewer than two named tokens.
 */

import {
  buildPalette,
  typeScaleToRows,
  roleFromTokenName,
  type ExtractedDesignTokens,
  type NamedPalette,
  type TypeRow
} from './design-tokens'

export type WebviewLike = {
  executeJavaScript: (code: string) => Promise<unknown>
}

/**
 * The guest-side IIFE as a string. Kept as a top-level export so it can be
 * unit-tested in a jsdom environment if needed; called via
 * `webview.executeJavaScript` in production.
 */
export const TOKEN_EXTRACT_GUEST_SRC = `(() => {
  try {
  const customPropNames = new Set();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; }
    for (const rule of Array.from(rules || [])) {
      if (rule && rule.selectorText && (rule.selectorText === ':root' || rule.selectorText === 'html')) {
        for (const name of Array.from(rule.style)) {
          if (name.startsWith('--')) customPropNames.add(name);
        }
      }
    }
  }
  const rootStyle = getComputedStyle(document.documentElement);
  const read = (n) => rootStyle.getPropertyValue(n).trim();
  const colors = [], fonts = [], radii = [], spacing = [];
  for (const name of customPropNames) {
    const value = read(name);
    if (!value) continue;
    if (/color|bg|background|accent|primary|secondary|tertiary|neutral|surface|ink|text|border|fill|muted/i.test(name)
        && /^#|rgb|hsl|oklch/i.test(value)) {
      colors.push({ name: name, value: value });
    } else if (/font.*family|^--font(-|$)/i.test(name)) {
      fonts.push({ name: name, value: value });
    } else if (/radius|rounded/i.test(name)) {
      radii.push({ name: name, value: value });
    } else if (/space|gap|spacing/i.test(name)) {
      spacing.push({ name: name, value: value });
    }
  }
  // Typography scale.
  const typeSet = new Map();
  for (const sel of ['h1','h2','h3','h4','h5','h6','p','body','button','small']) {
    const el = document.querySelector(sel);
    if (!el) continue;
    const cs = getComputedStyle(el);
    const key = cs.fontSize + '/' + cs.fontWeight;
    if (!typeSet.has(key)) {
      typeSet.set(key, {
        sample: sel,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        fontFamily: cs.fontFamily
      });
    }
  }
  // Sampled color fallback.
  let sampled = [];
  if (colors.length < 2) {
    const seen = new Set();
    const els = Array.from(document.querySelectorAll('body *')).slice(0, 400);
    for (const el of els) {
      const cs = getComputedStyle(el);
      for (const v of [cs.color, cs.backgroundColor]) {
        if (v && v !== 'rgba(0, 0, 0, 0)' && !seen.has(v)) {
          seen.add(v);
          sampled.push(v);
        }
      }
    }
  }
  return {
    colors: colors,
    fonts: fonts,
    radii: radii,
    spacing: spacing,
    typeScale: Array.from(typeSet.values()),
    sampledColors: sampled.slice(0, 24),
    title: document.title || ''
  };
  } catch {
    return null;
  }
})()`

type GuestColor = { name: string; value: string }
type GuestExtraction = {
  colors: GuestColor[]
  fonts: { name: string; value: string }[]
  radii: { name: string; value: string }[]
  spacing: { name: string; value: string }[]
  typeScale: {
    sample: string
    fontSize: string
    fontWeight: string
    lineHeight: string
    fontFamily: string
  }[]
  sampledColors: string[]
  title: string
}

/**
 * Normalize any browser-rendered color string (`rgb()/rgba()/named/hsl()`)
 * into a `#rrggbb` lowercase hex by letting the browser parse it. Returns
 * `''` for transparent / unparsable values so callers can drop them.
 */
export function normalizeCssColorToHex(value: string): string {
  if (typeof document === 'undefined') return ''
  if (!value) return ''
  const probe = document.createElement('span')
  probe.style.color = ''
  probe.style.color = value.trim()
  if (!probe.style.color) return ''
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  document.body.removeChild(probe)
  const m = computed.match(/rgba?\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(-?\d+(?:\.\d+)?))?\s*\)/)
  if (!m) return ''
  const alpha = m[4] != null ? Number(m[4]) : 1
  if (alpha === 0) return ''
  const hex = (n: string): string =>
    Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0')
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3]).toLowerCase()}`.toLowerCase()
}

/**
 * Shape the guest extraction into the canonical `ExtractedDesignTokens`,
 * tagging each color with its inferred role and normalizing non-hex colors
 * to hex (so the palette/ramp helpers receive uniform input).
 */
export function shapeGuestExtraction(raw: GuestExtraction): ExtractedDesignTokens {
  const colors = raw.colors.map((c) => {
    const hex = c.value.startsWith('#') ? c.value.toLowerCase() : normalizeCssColorToHex(c.value)
    return { name: c.name, value: hex || c.value, role: roleFromTokenName(c.name) }
  }).filter((c) => c.value)

  return {
    colors,
    fonts: raw.fonts,
    radii: raw.radii,
    spacing: raw.spacing,
    typeScale: raw.typeScale,
    sampledColors: raw.sampledColors,
    title: raw.title
  }
}

export type DerivedTokens = {
  extracted: ExtractedDesignTokens
  palette: NamedPalette
  typeRows: TypeRow[]
}

/**
 * Host-side wrapper: run the guest IIFE, validate the shape, derive the
 * palette + type-row projections. Returns `null` if the webview isn't ready
 * or the IIFE returned something unexpected (caller decides how to surface).
 */
export async function extractTokensFromWebview(webview: WebviewLike): Promise<DerivedTokens | null> {
  let raw: unknown
  try {
    raw = await webview.executeJavaScript(TOKEN_EXTRACT_GUEST_SRC)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const guest = raw as GuestExtraction
  if (!Array.isArray(guest.colors) || !Array.isArray(guest.typeScale)) return null
  const extracted = shapeGuestExtraction(guest)
  return {
    extracted,
    palette: buildPalette(extracted),
    typeRows: typeScaleToRows(extracted.typeScale)
  }
}
