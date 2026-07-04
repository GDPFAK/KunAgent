import { useCanvasShapeStore } from "../canvas-shape-store"
import { useCanvasViewportStore } from "../canvas-viewport-store"
import {
  createDefaultShape,
  shapeGeometry,
  type CanvasShape,
  type Rect,
  type ShapeType
} from "../canvas-types"
import { placeRectInViewportAvoiding } from "../canvas-placement"
import { useDesignSystemStore } from "../design-system-store"
import { resolveTokenPatch, type ComponentDef, type DesignToken, type TokenProp } from "../design-system-types"
import type { OpError } from "../shape-ops"
import { normalizeDesignTarget, type DesignTarget } from "../../design-context"
import { useDesignWorkspaceStore } from "../../design-workspace-store"
import { DEFAULT_SEED } from './foundation'

export function normalizeHex(value: string | undefined): string | null {
  if (!value) return null
  const raw = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase()
  const short = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase()
  return null
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex) ?? DEFAULT_SEED
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const part = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase()
}

export function mix(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const t = Math.max(0, Math.min(1, amount))
  return rgbToHex(ca.r + (cb.r - ca.r) * t, ca.g + (cb.g - ca.g) * t, ca.b + (cb.b - ca.b) * t)
}

export function rotateHue(hex: string, degrees: number): string {
  const { r, g, b } = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  return hslToHex((h + degrees) % 360, Math.min(0.92, s + 0.08), Math.max(0.28, Math.min(0.68, l)))
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h * 60, s, l]
}

export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rp = 0
  let gp = 0
  let bp = 0
  if (h < 60) [rp, gp, bp] = [c, x, 0]
  else if (h < 120) [rp, gp, bp] = [x, c, 0]
  else if (h < 180) [rp, gp, bp] = [0, c, x]
  else if (h < 240) [rp, gp, bp] = [0, x, c]
  else if (h < 300) [rp, gp, bp] = [x, 0, c]
  else [rp, gp, bp] = [c, 0, x]
  return rgbToHex((rp + m) * 255, (gp + m) * 255, (bp + m) * 255)
}
