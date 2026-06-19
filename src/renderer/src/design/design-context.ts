import type { DesignSystemPreset } from '@shared/app-settings'

/** Whether the surface is brand-led or product-led. */
export type DesignSurfaceType = 'brand' | 'product'

/**
 * Design intent injected into every design-agent turn. Generalizes the SDD
 * `SddDesignContext` (designType / brandColor / tone) by ADDING a named
 * design-system preset.
 */
export type DesignContext = {
  designType?: DesignSurfaceType
  /** Anchor brand color (any CSS color string). */
  brandColor?: string
  /** Free-form tone chips, e.g. 编辑风 / 专业 / 科技感. */
  tone?: string[]
  /** Named design-system preset that seeds tokens/voice; undefined / 'none' = no preset. */
  designSystemPreset?: DesignSystemPreset
  /** Free-form additional design rules (from settings.design.designGuidelines). */
  designGuidelines?: string
}

/** Suggested tone chips offered in the design-context form. */
export const DESIGN_TONE_OPTIONS = [
  '编辑风',
  '专业',
  '活泼',
  '极简',
  '大胆',
  '温暖',
  '科技感',
  '严肃'
] as const

const DESIGN_TYPE_LABEL: Record<DesignSurfaceType, string> = {
  brand: 'Brand-led (marketing / landing / portfolio — design IS the product)',
  product: 'Product-led (app UI / dashboard / tool — design SERVES the product)'
}

const DESIGN_SYSTEM_LABEL: Record<Exclude<DesignSystemPreset, 'none'>, string> = {
  shadcn: 'shadcn/ui — neutral, modern, restrained; Radix primitives, subtle borders, small radii',
  material: 'Material Design — elevation, bold color roles, 4dp grid, ripple feedback',
  ios: 'iOS / Apple HIG — large titles, translucency, generous spacing, SF-style type',
  fluent: 'Fluent (Microsoft) — acrylic depth, clear hierarchy, reveal highlights'
}

/**
 * Render the design context as prompt lines. Returns `[]` when nothing is set,
 * so callers can spread it unconditionally. Mirrors `formatSddDesignContextLines`
 * and keeps the same anti-"AI tell" guardrails.
 */
export function formatDesignContextLines(ctx: DesignContext | undefined): string[] {
  if (!ctx) return []
  const parts: string[] = []
  if (ctx.designType) parts.push(`- Surface: ${DESIGN_TYPE_LABEL[ctx.designType]}`)
  if (ctx.brandColor) {
    parts.push(
      `- Brand color anchor: ${ctx.brandColor} — compose the palette around this; do not fall back to the purple→blue AI-default gradient.`
    )
  }
  if (ctx.tone?.length) parts.push(`- Tone: ${ctx.tone.join('、')}`)
  if (ctx.designSystemPreset && ctx.designSystemPreset !== 'none') {
    parts.push(`- Design system: ${DESIGN_SYSTEM_LABEL[ctx.designSystemPreset]}`)
  }
  if (ctx.designGuidelines?.trim()) parts.push(`- Additional rules: ${ctx.designGuidelines.trim()}`)
  if (parts.length === 0) return []
  return [
    'Design context (honor it in every visual decision):',
    ...parts,
    '- Avoid generic AI tells: cream/sand default backgrounds, purple→blue gradients, bounce/elastic easing, nested cards, gray text on colored backgrounds. Verify text contrast and provide a prefers-reduced-motion fallback.',
    ''
  ]
}

/**
 * Render the design context as a standalone `DESIGN_SYSTEM.md` body — the
 * shared, persistent source of truth both the design agent and the code agent
 * read from the workspace.
 */
export function formatDesignSystemMarkdown(ctx: DesignContext | undefined): string {
  const body = [
    '# Design system',
    '',
    "Single source of truth for this product's visual language. Honor it in all UI work — the design canvas and the real code alike.",
    ''
  ]
  const lines = formatDesignContextLines(ctx)
  if (lines.length === 0) {
    body.push('_No brand color, tone or design-system preset set yet._')
  } else {
    body.push(...lines)
  }
  return `${body.join('\n')}\n`
}
