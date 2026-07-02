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
  radius?: 'sharp' | 'soft' | 'rounded' | 'pill'
  density?: 'compact' | 'cozy' | 'spacious'
  fontStyle?: 'system' | 'geometric' | 'humanist' | 'serif' | 'mono'
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
  radix: 'Radix Themes — accessible primitives, balanced neutrals, clear focus states',
  material: 'Material Design — elevation, bold color roles, 4dp grid, ripple feedback',
  ios: 'iOS / Apple HIG — large titles, translucency, generous spacing, SF-style type',
  fluent: 'Fluent (Microsoft) — acrylic depth, clear hierarchy, reveal highlights',
  ant: 'Ant Design — dense enterprise UI, blue accent, compact controls, rich data tables',
  chakra: 'Chakra UI — friendly, rounded, accessible, soft neutrals',
  carbon: 'Carbon (IBM) — data-dense, structured grid, restrained palette, monospaced accents',
  polaris: 'Polaris (Shopify) — commerce admin, calm greens/inks, clear cards and tables',
  bootstrap: 'Bootstrap — familiar utility components, 12-column grid, classic blue',
  geist: 'Geist (Vercel) — minimal, high-contrast black/white, mono accents, tight spacing',
  brutalism: 'Neo-brutalism — raw, thick black borders, hard offset shadows, bold flat color, no gradients',
  editorial: 'Editorial — magazine typography, strong type hierarchy, generous margins, restrained color'
}

/** Short display names for the preset selectors (proper nouns, not translated). */
export const DESIGN_SYSTEM_DISPLAY: Record<DesignSystemPreset, string> = {
  none: 'None',
  shadcn: 'shadcn/ui',
  radix: 'Radix',
  material: 'Material',
  ios: 'iOS / Apple',
  fluent: 'Fluent',
  ant: 'Ant Design',
  chakra: 'Chakra UI',
  carbon: 'Carbon (IBM)',
  polaris: 'Polaris (Shopify)',
  bootstrap: 'Bootstrap',
  geist: 'Geist (Vercel)',
  brutalism: 'Neo-brutalism',
  editorial: 'Editorial'
}

/**
 * Built-in design craft discipline — condensed from the open-design craft guides
 * (anti-AI-slop, color, type, layout, motion, a11y, states). Injected into every
 * design turn and DESIGN_SYSTEM.md so output has a quality floor regardless of the
 * preset or brief.
 */
export const DESIGN_CRAFT_LINES: string[] = [
  'Design craft (apply unless the brief explicitly overrides):',
  '- Anti-AI-slop: no cream/sand default backgrounds, no purple→blue gradients, no glassmorphism-on-a-gradient, no center-everything layouts, no emoji as icons.',
  '- Color: one accent + a real neutral ramp; ≥4.5:1 text contrast; avoid pure #000 and gray text on colored fills.',
  '- Typography: a clear hierarchy (2–3 sizes), body line-height ~1.6, tighter headings; one or two families max.',
  '- Layout: a real grid, intentional whitespace, aligned to a baseline; avoid nested cards and uniform 16px-everywhere.',
  '- Motion: subtle and fast (≤200ms), ease-out; honor prefers-reduced-motion.',
  '- Accessibility: visible focus states, labels, hit targets ≥40px, semantic structure.',
  '- States: design empty / loading / error / hover / disabled, not just the happy path.'
]

/**
 * HTML artifacts live inside resizable canvas frames/webviews. This is stricter
 * than normal responsive design: the frame may be dragged to arbitrary sizes
 * after generation, so the document must react to container/viewport resize.
 */
export const DESIGN_RESIZE_RESPONSIVE_LINES: string[] = [
  'Resize-adaptive HTML contract (mandatory for every final HTML artifact):',
  '- Treat the canvas frame/webview as a live, resizable viewport. The design must adapt when the frame is resized after generation, not only at first load.',
  '- Include `<meta name="viewport" content="width=device-width, initial-scale=1">` and CSS that lets `html`, `body`, and the top-level app/root fill the frame (`width:100%`, `min-height:100%`, no default body margin).',
  '- Do not lock the page to a fixed desktop canvas: avoid `width`/`min-width` above the frame width, avoid `height:100vh` + `overflow:hidden`, and avoid absolute layouts that cannot reflow.',
  '- Use fluid primitives: `%`, `min()`, `max()`, `clamp()`, `minmax()`, wrapping flex/grid, `max-width:100%`, `min-width:0`, and responsive media rules/container-aware sections.',
  '- Verify mentally at mobile (~390px), tablet (~768px), desktop (~1280px), and arbitrary resized frame sizes: no horizontal scroll, clipped text, overlap, or tiny tap targets.'
]

/**
 * Delivery bar for generated design artifacts. The craft lines say what "good"
 * looks like visually; these lines say what a complete product-design handoff
 * must contain so Stitch-style multi-page generation lands as usable work.
 */
export const DESIGN_DELIVERY_LINES: string[] = [
  'Design delivery checklist (complete before you finish):',
  '- Document title: exported HTML must include a meaningful `<title>` with the product, brand, screen, or offer name; no Untitled/Draft/page-type titles.',
  '- Product intent: make the page goal, primary user action, and secondary escape path obvious without explanatory copy.',
  '- Secondary action path: in the first screen, pair the primary CTA with a clearly different secondary action such as view demo, see work, compare plans, read case study, or contact/schedule.',
  '- Brand identity: for landing, brand, portfolio, pricing, and marketing pages, make the product/brand/person name visible in the first viewport or header, not only generic nav links.',
  '- Brand navigation: for landing, brand, portfolio, pricing, and marketing pages, include a branded header/nav with section links and a primary action.',
  '- Product shell: for app UI, dashboards, admin tools, and workspaces, include real product chrome such as a top bar, sidebar, nav rail, breadcrumbs, search, user/status area, or workspace switcher.',
  '- Product navigation: for app UI, dashboards, admin tools, and workspaces, make navigation labels specific to the domain objects and workflows; no Dashboard / Analytics / Reports-only nav.',
  '- Breadcrumbs and page paths: for app UI and multi-screen prototypes, breadcrumb labels should name product areas, objects, records, or workflow stages; no Home / Dashboard / Details-only trails.',
  '- Data tables: for app UI, dashboards, admin tools, and workspaces, name columns after real domain fields; no Name / Status / Date / Action-only tables.',
  '- Record item titles: repeated queue, list, and card items should name concrete records, customers, tickets, invoices, or workflow tasks; no Item 1 / Task 2 / Record A-only lists.',
  '- Record actions: row, card, and list actions should name the next business task; no View / Details / More-only repeated actions.',
  '- Record discovery: for dense tables and lists, search, filters, sorts, saved views, and pagination should name searched objects or views; no Search / Filter / All statuses-only toolbars.',
  '- KPI cards: for app UI, dashboards, admin tools, and workspaces, metric labels should name business objects and periods; no Revenue / Users / Growth-only scorecards.',
  '- Chart specificity: chart titles, captions, axes, and legends should name the business metric, object, period, and comparison; no Chart / Data / Growth / Series 1-only visuals.',
  '- Visual anchor: for landing, brand, portfolio, pricing, and marketing pages, include a real product preview, image, gallery, or media-led hero visual instead of text-only cards or abstract blob/orb decoration.',
  '- Product preview detail: when using product previews, screenshots, mockups, or media panels, show real media or concrete UI/data details inside the preview; no empty framed placeholder shells or decorative-only SVGs.',
  '- Image semantics: non-decorative images need specific alt text that names the product, person, place, screen, or content shown; no generic "image", "screenshot", "hero image", or "product preview" labels.',
  '- Trust proof: for landing and marketing pages, include concrete customer logos, testimonials, ratings, case-study metrics, press, or security/compliance badges; no Logo 1 / Company A placeholders.',
  '- Proof metrics: avoid generic vanity stats like 99% satisfaction, 10x faster, 1M+ users, or 24/7 support unless they have a customer/source, timeframe, benchmark, or case-study context.',
  '- Testimonial attribution and proof: when using testimonials or customer quotes, include a named person or company, role/source, and concrete outcome context; no vague "amazing product" / "highly recommend" praise without a real workflow, metric, or timeframe.',
  '- Feature anatomy: for landing, brand, product, feature, and marketing pages, include concrete feature/benefit/use-case sections with named capabilities, user outcomes, and product-specific details; no generic Automation / Analytics / Security cards without product objects or workflow detail.',
  '- Portfolio/case-study anatomy: for portfolio and case-study pages, include real project entries with client, role/category, timeline/year, visual, outcome metric, and detail CTA; no Project One / Client A / Case Study placeholders.',
  '- Pricing anatomy: for pricing/plans pages, show distinct plan cards or a comparison table with prices, billing cadence, recommended plan, concrete limits/features/audience differences, and plan-specific actions; no "all core features" filler.',
  '- Pricing CTAs: plan-card actions should reflect the plan or funnel step; no identical Choose plan / Get started buttons repeated across every tier.',
  '- Conversion close: for landing and marketing pages, include a final CTA/footer, FAQ, contact/demo/signup form, calendar/contact route, or next-step section near the end; no generic "Ready to get started?" close without a specific outcome, timeframe, or next deliverable.',
  '- FAQ anatomy: when using FAQ/frequently-asked-questions sections, include multiple concrete question/answer items that address real objections, pricing, migration, support, security, or setup details; no generic "what is this?" questions or "contact us" answers.',
  '- Lead form response: for contact, demo, signup, waitlist, and newsletter forms, include visible loading/submitting, success/confirmation, and error/validation feedback states.',
  '- Form field specificity: for lead, signup, demo, contact, and product forms, use field labels tied to the requested business information; no Name / Email / Message-only forms.',
  '- Feedback messages: toasts, alerts, banners, and inline confirmations should name the object, action result, or recovery step; no Success / Saved / Error-only copy.',
  '- Settings controls: toggles, checkboxes, and radio choices should name the controlled object and effect; no Option 1 / Enable / Notifications-only settings.',
  '- Card/module specificity: repeated feature, pricing, proof, project, and testimonial cards must have distinct titles, data, and outcomes; no copied card bodies.',
  '- Site footer: for landing, brand, portfolio, pricing, and marketing pages, finish with a real footer containing brand/contact details, secondary links, social/legal links, or copyright/support information; no Product / Company / Resources-only footer columns.',
  '- Section specificity: section headings should name the actual product area, workflow, audience, or outcome; avoid stacked generic headings like Features, Benefits, Testimonials, and How it works.',
  '- Workflow steps: steppers, timelines, and process flows should use domain actions or milestones; no Step 1 / Step 2 / Step 3-only labels.',
  '- Tabs and view switchers: use domain-specific view labels for app UI and dashboards; no Overview / Details / Settings-only tab sets.',
  '- Dialog titles: modals, drawers, and confirmation surfaces should name the object, action, or consequence; no Details / Confirmation-only titles.',
  '- First-screen hierarchy: include a specific top-level H1/page title, supporting copy, and a visually dominant primary action before dense secondary content.',
  '- Hero viewport composition: for landing, brand, portfolio, pricing, and marketing pages, avoid full-height heroes that hide the next section; keep a hint of the following content visible in the first viewport.',
  '- Hero/title copy: do not use prompt/meta headings like "marketing site for..." or "pricing page for..."; use the brand/product/person name or a literal offer/category as the H1.',
  '- Prototype coherence: for multi-screen work, include consistent navigation, tabs, breadcrumbs, or page-switching entry points that connect related screens; when several sibling pages exist, expose more than one sibling route instead of linking only a single page.',
  '- Content realism: use plausible domain-specific labels, data, names, prices, dates, and empty-state copy; no lorem ipsum or generic placeholder cards.',
  '- Interaction depth: include hover/focus/disabled states and small UI feedback; no dead `href="#"` links or visual-only buttons — CTAs must navigate, submit, expand, filter, toast, or otherwise visibly respond.',
  '- State coverage: represent happy path plus relevant empty/loading/error/permission/offline states for app surfaces with domain-specific state copy and recovery actions; no generic "No data" or "Something went wrong" panels.',
  '- Responsive polish: explicitly handle mobile, tablet, and desktop breakpoints with no overlap, clipped text, or tiny tap targets.',
  '- Handoff notes: when a DESIGN.md path is provided, record page role, tokens/components used, key states, responsive behavior, and implementation notes.'
]

/** Token option lists for the selectors ('' = unset / let the agent decide). */
export const DESIGN_RADIUS_OPTIONS = ['', 'sharp', 'soft', 'rounded', 'pill'] as const
export const DESIGN_DENSITY_OPTIONS = ['', 'compact', 'cozy', 'spacious'] as const
export const DESIGN_FONT_OPTIONS = ['', 'system', 'geometric', 'humanist', 'serif', 'mono'] as const

const RADIUS_LABEL: Record<'sharp' | 'soft' | 'rounded' | 'pill', string> = {
  sharp: 'sharp corners (0–2px)',
  soft: 'soft corners (6–10px)',
  rounded: 'rounded corners (14–20px)',
  pill: 'pill / fully rounded'
}
const DENSITY_LABEL: Record<'compact' | 'cozy' | 'spacious', string> = {
  compact: 'compact, tight spacing',
  cozy: 'cozy, balanced spacing',
  spacious: 'spacious, airy whitespace'
}
const FONT_LABEL: Record<'system' | 'geometric' | 'humanist' | 'serif' | 'mono', string> = {
  system: 'native system UI fonts',
  geometric: 'geometric sans (Inter / Geist style)',
  humanist: 'humanist sans (warmer, readable)',
  serif: 'serif (editorial, high-contrast)',
  mono: 'monospace accents (technical)'
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
  if (ctx.radius) parts.push(`- Corner radius: ${RADIUS_LABEL[ctx.radius]}`)
  if (ctx.density) parts.push(`- Spacing density: ${DENSITY_LABEL[ctx.density]}`)
  if (ctx.fontStyle) parts.push(`- Type style: ${FONT_LABEL[ctx.fontStyle]}`)
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
  body.push(
    '',
    '## Delivery Quality',
    '',
    ...DESIGN_DELIVERY_LINES,
    '',
    '## Resize-Adaptive HTML',
    '',
    ...DESIGN_RESIZE_RESPONSIVE_LINES,
    '',
    '## Craft',
    '',
    ...DESIGN_CRAFT_LINES
  )
  return `${body.join('\n')}\n`
}

/**
 * Map a CSS font-family (or stack) to a DesignContext font style bucket. Matches
 * the FIRST family name and checks specific faces before the generic `serif`
 * fallback (which is stripped of `sans-serif` first, so `Inter, sans-serif` reads
 * as geometric, not serif).
 */
function fontStyleFromFamily(family: string | undefined): DesignContext['fontStyle'] | undefined {
  const first = (family ?? '').toLowerCase().split(',')[0].trim()
  if (!first) return undefined
  if (/mono|consolas|menlo|courier|jetbrains|fira code|source code/.test(first)) return 'mono'
  if (/inter|geist|poppins|futura|montserrat|circular|sf pro|manrope|space grotesk/.test(first)) return 'geometric'
  if (/segoe|roboto|open sans|lato|source sans|helvetica|noto sans|pt sans/.test(first)) return 'humanist'
  if (/system-ui|-apple-system|ui-sans|ui-serif/.test(first)) return 'system'
  const serifProbe = first.replace(/sans[-\s]?serif/g, '')
  if (/serif|georgia|times|charter|garamond|playfair|merriweather|lora/.test(serifProbe)) return 'serif'
  return undefined
}

/**
 * Enrich an unset DesignContext with values inferred from the design's actually
 * extracted tokens: an empty brand color falls back to the realized accent, an
 * empty font style to the realized font family. NEVER overrides an explicit user
 * choice — only fills blanks — so first-turn / unconfigured sessions still match
 * the look already on screen instead of running on defaults.
 */
export function mergeDesignContextWithTokens(
  ctx: DesignContext | undefined,
  tokens: { palette: { primary?: { base: string } }; typeRows: { fontFamily: string }[] } | undefined
): DesignContext | undefined {
  if (!tokens) return ctx
  const merged: DesignContext = { ...(ctx ?? {}) }
  if (!merged.brandColor && tokens.palette.primary?.base) {
    merged.brandColor = tokens.palette.primary.base
  }
  if (!merged.fontStyle) {
    const inferred = fontStyleFromFamily(tokens.typeRows.find((row) => row.fontFamily)?.fontFamily)
    if (inferred) merged.fontStyle = inferred
  }
  return Object.keys(merged).length > 0 ? merged : ctx
}

/**
 * Stable content hash of a published DESIGN_SYSTEM.md body. Lets design mode
 * detect when the shared design system has drifted from what an artifact was
 * implemented against (the code side of bidirectional design↔code drift).
 */
export function hashDesignSystem(content: string): string {
  let hash = 5381
  for (let i = 0; i < content.length; i += 1) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}
