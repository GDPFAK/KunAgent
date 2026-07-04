import { DESIGN_RESIZE_RESPONSIVE_LINES, formatDesignContextLines, type DesignContext } from '../design-context'
import type { DesignHtmlQualityAuditSibling, DesignHtmlQualityDetails, DesignHtmlQualityFinding, DesignHtmlQualityStatus } from './types'
import { BODY_TEXT_SELECTOR_RE, CSS_RULE_BLOCK_RE, EMOJI_RE, FIXED_DESKTOP_FRAME_RE, FLUID_MEDIA_RULE_RE, GLOBAL_BOX_SIZING_RE, HEADING_SELECTOR_RE, NEGATIVE_LETTER_SPACING_RE, SPACING_DECLARATION_RE, SPACING_TOKEN_RE, UNBOUNDED_VIEWPORT_FONT_RE, VIEWPORT_LOCK_RE, VISUAL_MEDIA_TAG_RE, normalizeQualityCode } from './patterns'
import { matchingSiblingScreensForPrototypeTarget, normalizePath, prototypeTargetAttributeValues } from './interaction-and-accessibility'
import { hasTopLevelHeading } from './product-and-hero-content'
import { severityRank } from './repair-prompt'

export function hasMissingLayoutReset(html: string, styles: string): boolean {
  return VISUAL_MEDIA_TAG_RE.test(html) && (!GLOBAL_BOX_SIZING_RE.test(styles) || !FLUID_MEDIA_RULE_RE.test(styles))
}

export function spacingValueTokens(styles: string): string[] {
  const values: string[] = []
  let match: RegExpExecArray | null
  SPACING_DECLARATION_RE.lastIndex = 0
  while ((match = SPACING_DECLARATION_RE.exec(styles))) {
    const declaration = match[1] ?? ''
    if (/\b(var|calc|clamp|min|max|auto)\s*\(/i.test(declaration) || /\bauto\b/i.test(declaration)) continue
    const tokens = declaration.match(/\b\d*\.?\d+(?:px|rem)\b/gi) ?? []
    for (const token of tokens) {
      const normalized = token.toLowerCase()
      if (normalized !== '0px' && normalized !== '0rem') values.push(normalized)
    }
  }
  return values
}

export function hasWeakSpacingSystem(styles: string): boolean {
  if (SPACING_TOKEN_RE.test(styles)) return false
  const values = spacingValueTokens(styles)
  if (values.length < 8) return false
  const defaultCount = values.filter((value) => value === '16px' || value === '1rem').length
  const uniqueCount = new Set(values).size
  return defaultCount >= 6 && defaultCount / values.length >= 0.65 && uniqueCount <= 3
}

export function hasFixedDesktopFrame(styles: string): boolean {
  return FIXED_DESKTOP_FRAME_RE.test(styles) || VIEWPORT_LOCK_RE.test(styles)
}

export function hasWeakTypographyConstraints(styles: string): boolean {
  return UNBOUNDED_VIEWPORT_FONT_RE.test(styles) || NEGATIVE_LETTER_SPACING_RE.test(styles)
}

export function radiusPx(value: string | undefined): number | undefined {
  if (!value || /\b(var|calc|min|max|clamp)\s*\(/i.test(value)) return undefined
  const values = [...value.matchAll(/(\d*\.?\d+)\s*(px|rem|em)\b/gi)]
    .map((match) => {
      const amount = Number.parseFloat(match[1] ?? '')
      if (!Number.isFinite(amount)) return undefined
      const unit = (match[2] ?? '').toLowerCase()
      return unit === 'px' ? amount : amount * 16
    })
    .filter((amount): amount is number => amount !== undefined)
  return values.length > 0 ? Math.max(...values) : undefined
}

export function hasCardLikeSelector(selector: string): boolean {
  return /(?:^|[.#\s>+~_-])(?:card|panel|surface|tile)(?:$|[.#\s>+~_-])/i.test(selector)
}

export function hasOverRoundedCardStyling(styles: string): boolean {
  CSS_RULE_BLOCK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CSS_RULE_BLOCK_RE.exec(styles))) {
    const selector = match[1] ?? ''
    const block = match[2] ?? ''
    if (!hasCardLikeSelector(selector)) continue
    const radius = radiusPx(declarationValue(block, 'border-radius'))
    if (radius !== undefined && radius >= 18) return true
  }
  return false
}

export function declarationValue(block: string, property: string): string | undefined {
  return new RegExp(`\\b${property}\\s*:\\s*([^;{}]+)`, 'i').exec(block)?.[1]?.trim()
}

export function fontSizePx(value: string | undefined): number | undefined {
  if (!value || /\b(var|calc|min|max)\s*\(/i.test(value)) return undefined
  const matches = [...value.matchAll(/(-?\d*\.?\d+)\s*(px|rem|em)\b/gi)]
  if (matches.length === 0) return undefined
  const values = matches
    .map((match) => {
      const amount = Number.parseFloat(match[1] ?? '')
      if (!Number.isFinite(amount) || amount <= 0) return undefined
      const unit = (match[2] ?? '').toLowerCase()
      return unit === 'px' ? amount : amount * 16
    })
    .filter((amount): amount is number => amount !== undefined)
  return values.length > 0 ? Math.max(...values) : undefined
}

export function fontWeightValue(value: string | undefined): number | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'bold') return 700
  if (normalized === 'normal') return 400
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function hasWeakTypeHierarchy(html: string, styles: string): boolean {
  if (!hasTopLevelHeading(html)) return false
  const headingSizes: number[] = []
  const bodySizes: number[] = []
  const headingWeights: number[] = []
  const bodyWeights: number[] = []
  CSS_RULE_BLOCK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CSS_RULE_BLOCK_RE.exec(styles))) {
    const selector = match[1] ?? ''
    const block = match[2] ?? ''
    const size = fontSizePx(declarationValue(block, 'font-size'))
    const weight = fontWeightValue(declarationValue(block, 'font-weight'))
    if (HEADING_SELECTOR_RE.test(selector)) {
      if (size !== undefined) headingSizes.push(size)
      if (weight !== undefined) headingWeights.push(weight)
    }
    if (BODY_TEXT_SELECTOR_RE.test(selector)) {
      if (size !== undefined) bodySizes.push(size)
      if (weight !== undefined) bodyWeights.push(weight)
    }
  }
  if (headingSizes.length === 0) return false
  const headingSize = Math.max(...headingSizes)
  const bodySize = bodySizes.length > 0 ? Math.max(...bodySizes) : 16
  const headingWeight = headingWeights.length > 0 ? Math.max(...headingWeights) : 700
  const bodyWeight = bodyWeights.length > 0 ? Math.max(...bodyWeights) : 400
  const ratio = headingSize / Math.max(bodySize, 1)
  const weakSize = headingSize < 22 && ratio < 1.35
  const weakWeight = headingWeight <= bodyWeight + 150
  return (ratio < 1.18 && weakWeight) || (weakSize && headingWeight < 750)
}

export function hasCenterEverythingLayout(styles: string): boolean {
  const centeredTextBlocks =
    styles.match(/(?:body|main|\.hero|\.page|\.app|\.container|section)\s*{[^}]*text-align\s*:\s*center[^}]*}/gi) ?? []
  const centeredFlexBlocks =
    styles.match(
      /(?:body|main|\.hero|\.page|\.app|\.container|section)\s*{(?=[^}]*display\s*:\s*flex)(?=[^}]*justify-content\s*:\s*center)(?=[^}]*align-items\s*:\s*center)[^}]*}/gi
    ) ?? []
  return centeredTextBlocks.length >= 2 || (centeredTextBlocks.length >= 1 && centeredFlexBlocks.length >= 1)
}

export function countEmoji(text: string): number {
  return [...text.matchAll(EMOJI_RE)].length
}

export function hasSiblingPrototypeNavigation(
  html: string,
  siblingScreens: DesignHtmlQualityAuditSibling[] | undefined
): boolean {
  if ((siblingScreens?.length ?? 0) === 0) return true
  return prototypeTargetAttributeValues(html)
    .some((target) => matchingSiblingScreensForPrototypeTarget(target, siblingScreens).length > 0)
}

export function linkedSiblingPrototypeTargetCount(
  html: string,
  siblingScreens: DesignHtmlQualityAuditSibling[] | undefined
): number {
  if ((siblingScreens?.length ?? 0) === 0) return 0
  const matched = new Set<DesignHtmlQualityAuditSibling>()
  for (const target of prototypeTargetAttributeValues(html)) {
    for (const screen of matchingSiblingScreensForPrototypeTarget(target, siblingScreens)) {
      matched.add(screen)
    }
  }
  return matched.size
}

export const runtimeQualityFindings = new Map<string, DesignHtmlQualityFinding[]>()

export function setDesignRuntimeQualityFindings(
  artifactRelativePath: string,
  findings: DesignHtmlQualityFinding[]
): void {
  const key = normalizePath(artifactRelativePath)
  if (!key) return
  runtimeQualityFindings.set(key, normalizeRuntimeQualityFindings(findings))
}

export function getDesignRuntimeQualityFindings(artifactRelativePath: string | undefined): DesignHtmlQualityFinding[] {
  const key = normalizePath(artifactRelativePath ?? '')
  if (!key) return []
  return runtimeQualityFindings.get(key)?.slice() ?? []
}

export function clearDesignRuntimeQualityFindings(artifactRelativePath: string): void {
  const key = normalizePath(artifactRelativePath)
  if (key) runtimeQualityFindings.delete(key)
}

export function shouldAutoRepairDesignHtmlFinding(finding: DesignHtmlQualityFinding | undefined): boolean {
  if (!finding) return false
  return finding.severity === 'critical'
}

export function mergeDesignHtmlQualityFindings(
  ...groups: Array<DesignHtmlQualityFinding[] | undefined>
): DesignHtmlQualityFinding[] {
  const merged = new Map<string, DesignHtmlQualityFinding>()
  for (const group of groups) {
    for (const finding of normalizeRuntimeQualityFindings(group ?? [])) {
      const existing = merged.get(finding.code)
      if (!existing || severityRank(finding.severity) < severityRank(existing.severity)) {
        merged.set(finding.code, finding)
      }
    }
  }
  return [...merged.values()].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

export function normalizeRuntimeQualityFindings(value: unknown): DesignHtmlQualityFinding[] {
  if (!Array.isArray(value)) return []
  const findings: DesignHtmlQualityFinding[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const code = typeof record.code === 'string' ? record.code.trim() : ''
    const message = typeof record.message === 'string' ? record.message.trim() : ''
    const suggestion = typeof record.suggestion === 'string' ? record.suggestion.trim() : ''
    const severity =
      record.severity === 'critical' || record.severity === 'warning' || record.severity === 'info'
        ? record.severity
        : 'warning'
    if (!code || !message || !suggestion) continue
    findings.push({ code, severity, message, suggestion })
    if (findings.length >= 12) break
  }
  return findings
}

export function summarizeDesignHtmlQualityStatus(
  findings: DesignHtmlQualityFinding[] | undefined,
  checked: boolean
): DesignHtmlQualityStatus {
  if (!checked) {
    return {
      kind: 'checking',
      label: 'Quality check',
      title: 'Kun is checking the rendered design for layout and accessibility issues.',
      count: 0
    }
  }
  const items = normalizeRuntimeQualityFindings(findings ?? [])
  const autoRepairable = items.filter(shouldAutoRepairDesignHtmlFinding)
  if (autoRepairable.length > 0) {
    return {
      kind: 'critical',
      label: `Auto repair ${autoRepairable.length}`,
      title: autoRepairable.map((finding) => `${finding.code}: ${finding.message}`).join('\n'),
      count: autoRepairable.length
    }
  }
  const warnings = items.filter((finding) => finding.severity === 'warning')
  if (warnings.length > 0) {
    return {
      kind: 'warning',
      label: `Quality ${warnings.length}`,
      title: warnings.map((finding) => `${finding.code}: ${finding.message}`).join('\n'),
      count: warnings.length
    }
  }
  return {
    kind: 'passed',
    label: 'Quality OK',
    title: 'Rendered quality check passed.',
    count: 0
  }
}

export function summarizeDesignHtmlQualityDetails(
  findings: DesignHtmlQualityFinding[] | undefined,
  checked: boolean,
  limit = 5
): DesignHtmlQualityDetails {
  const maxRows = Math.max(0, Math.floor(limit))
  if (!checked) {
    return {
      heading: 'Quality check running',
      body: 'Checking the rendered preview for layout, contrast, and tap target issues.',
      rows: [],
      overflowCount: 0
    }
  }

  const items = mergeDesignHtmlQualityFindings(findings)
  if (items.length === 0) {
    return {
      heading: 'Quality OK',
      body: 'Rendered layout, contrast, tap targets, and overflow checks passed.',
      rows: [],
      overflowCount: 0
    }
  }

  const criticalCount = items.filter((finding) => finding.severity === 'critical').length
  const warningCount = items.filter((finding) => finding.severity === 'warning').length
  const infoCount = items.filter((finding) => finding.severity === 'info').length
  const countLabel = (count: number, singular: string): string =>
    singular === 'critical' ? `${count} critical` : `${count} ${singular}${count === 1 ? '' : 's'}`
  const counts = [
    criticalCount > 0 ? countLabel(criticalCount, 'critical') : '',
    warningCount > 0 ? countLabel(warningCount, 'warning') : '',
    infoCount > 0 ? countLabel(infoCount, 'note') : ''
  ].filter(Boolean)

  return {
    heading: criticalCount > 0 ? 'Needs auto repair' : warningCount > 0 ? 'Quality issues' : 'Quality notes',
    body: `${counts.join(', ')} found in the rendered preview.`,
    rows: items.slice(0, maxRows),
    overflowCount: Math.max(0, items.length - maxRows)
  }
}

export function formatDesignHtmlQualityFindings(
  findings: DesignHtmlQualityFinding[] | undefined,
  limit = 8
): string[] {
  if (!findings || findings.length === 0) return []
  const ordered = findings
    .slice()
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, limit)
  return [
    'Previous version quality audit (repair these while making the requested change):',
    ...ordered.map((finding) => `- [${finding.severity}] ${finding.code}: ${finding.message} ${finding.suggestion}`)
  ]
}

export function designQualityRepairDirective(code: string): string | undefined {
  switch (normalizeQualityCode(code)) {
    case 'fixed-desktop-frame':
    case 'horizontal-overflow':
    case 'clipped-text':
    case 'overlapping-text':
      return 'Resize-adaptive layout: remove fixed desktop shells, let text wrap, use fluid max-widths/minmax grids, make html/body/root fill the frame, and verify mobile/tablet/desktop plus arbitrary resized canvas frames without clipped or overlapping text.'
    case 'missing-layout-reset':
      return 'Layout resilience: add *, *::before, *::after { box-sizing: border-box; }, fluid img/video/iframe rules, and min-width:0 on grid/flex children so media cannot break responsive previews.'
    case 'center-everything-layout':
      return 'Information architecture: replace center-everything composition with aligned sections, split content, grids, tables, or lists that create a clear scanning path.'
    case 'nested-card-layout':
      return 'Layout structure: flatten card-in-card shells into sections, grids, rows, tables, or sibling repeated cards; avoid putting framed cards inside other framed cards.'
    case 'over-rounded-card-styling':
      return 'Surface radius: keep product cards and panels on a restrained radius scale, usually around 6-8px, reserving large pill radii for intentional controls or media masks.'
    case 'missing-document-title':
    case 'generic-document-title':
      return 'Document title: add a meaningful <title> that names the product, brand, screen, or offer; avoid Untitled, Draft, and prompt/page-type titles.'
    case 'weak-first-screen-hierarchy':
    case 'generic-action-copy':
    case 'missing-page-heading':
    case 'generic-page-heading':
    case 'weak-page-heading':
    case 'missing-primary-action':
    case 'weak-primary-action':
      return 'First screen: make the page goal obvious with a specific H1, concrete support copy, and one visually dominant primary action near the top.'
    case 'meta-page-heading':
      return 'Hero/title copy: replace prompt-style headings like "Marketing site for..." or "Pricing page for..." with the brand/product/person name or a literal offer/category, then put explanatory value props in supporting copy.'
    case 'generic-section-heading':
      return 'Section headings: replace bare section labels like Features, Benefits, Testimonials, and How it works with product-specific headings that name the workflow, audience, proof point, or outcome.'
    case 'weak-secondary-action-path':
      return 'Secondary action path: pair the primary first-screen CTA with a clearly different secondary action such as View demo, See features, Read case study, Compare plans, or Contact sales.'
    case 'weak-hero-viewport-composition':
      return 'Hero viewport composition: avoid full-height marketing heroes that hide the next section; reduce min-height, tune vertical spacing, or expose a next-section peek in the first viewport.'
    case 'weak-content-depth':
      return 'Content depth: add at least two product-relevant modules beyond the hero, such as a table, record list, form, status panel, proof section, timeline, or settings group.'
    case 'weak-app-shell':
      return 'Product shell: for app UI and dashboard surfaces, add visible product chrome such as a top bar, sidebar, nav rail, breadcrumbs, search, user/status area, and workspace switcher around the work surface.'
    case 'generic-product-navigation':
      return 'Product navigation: replace Dashboard, Analytics, Reports, or Settings-only nav with domain-specific product areas, objects, queues, workflows, or saved views tied to the screen.'
    case 'generic-breadcrumb-labels':
      return 'Breadcrumb specificity: replace Home, Dashboard, Details, and Page 1-only trails with product areas, object names, record IDs, workflow stages, or the current task context.'
    case 'weak-brand-navigation':
      return 'Brand navigation: add a branded header/nav with a logo or wordmark, links to the key page sections, and a visible primary action so the page feels like a complete site.'
    case 'weak-brand-identity':
      return 'Brand identity: make the product, brand, person, or place name visible in the header or first viewport with a real wordmark, logo, or product name instead of generic navigation labels alone.'
    case 'weak-portfolio-structure':
      return 'Portfolio structure: add real project or case-study cards with client, role/category, timeline or year, visual, outcome metric, and detail CTAs such as View project or Read case study.'
    case 'generic-portfolio-project-detail':
      return 'Portfolio project detail: replace placeholder entries like Project One, Client A, and Case Study 1 with realistic project names, client names, roles, timelines, visuals, outcome metrics, and detail CTAs.'
    case 'weak-visual-anchor':
      return 'Visual anchor: for landing, brand, portfolio, pricing, and marketing pages, add a real product preview, screenshot, image, gallery, media-led hero, or designed mockup that shows the offer instead of relying on text-only cards.'
    case 'weak-product-preview-detail':
      return 'Product preview detail: fill product previews, screenshots, mockups, or media panels with real media or concrete UI/data details such as dashboard rows, metrics, statuses, screenshots, and labeled controls.'
    case 'decorative-visual-anchor':
      return 'Visual anchor specificity: replace abstract blobs, orbs, gradients, and decorative-only SVG shapes with a product screenshot, media asset, gallery image, or concrete UI mockup that includes real labels, rows, metrics, and statuses.'
    case 'weak-trust-proof':
      return 'Trust proof: add concrete customer logos, testimonials, ratings, case-study metrics, press mentions, or security/compliance badges with realistic names and numbers so the page feels credible.'
    case 'generic-trust-proof':
      return 'Trust proof detail: replace placeholder proof labels like Logo 1, Company A, and Client B with realistic customer names, publication names, certification badges, ratings, or outcome metrics.'
    case 'generic-vanity-metrics':
      return 'Proof metrics: replace generic vanity stats like 99% satisfaction, 10x faster, 1M+ users, and 24/7 support with sourced customer metrics, timeframes, benchmarks, or case-study outcomes.'
    case 'weak-testimonial-attribution':
      return 'Testimonial attribution: give each testimonial or customer quote a named person/company, role or source, and concrete outcome context such as a metric, timeframe, or use case.'
    case 'generic-testimonial-copy':
      return 'Testimonial copy: replace vague praise like Amazing product, Highly recommend, and Game-changer with a concrete workflow, metric, timeframe, or case-study outcome from the named customer.'
    case 'weak-feature-anatomy':
      return 'Feature anatomy: add concrete feature, benefit, capability, or use-case sections with named product capabilities, user outcomes, and product-specific details instead of relying on hero copy alone.'
    case 'generic-feature-card-detail':
      return 'Feature card detail: replace broad cards like Automation, Analytics, Security, and Collaboration with named product capabilities tied to concrete objects, workflows, user outcomes, metrics, or domain-specific labels.'
    case 'duplicated-card-copy':
      return 'Card/module specificity: rewrite repeated feature, pricing, proof, project, and testimonial cards so each one has a distinct title, concrete detail, data point, outcome, or target audience.'
    case 'weak-pricing-structure':
      return 'Pricing structure: build distinct plan cards or a comparison table with prices, billing cadence, recommended/best-for labeling, feature differences, and plan-specific CTAs.'
    case 'generic-pricing-plan-detail':
      return 'Pricing plan detail: replace filler like All core features, Everything you need, and Priority support with concrete plan limits, feature differences, intended audiences, service levels, and upgrade reasons.'
    case 'generic-pricing-plan-action-labels':
      return 'Pricing plan CTAs: replace repeated Choose plan, Get started, or Start trial buttons with plan-specific actions such as Start studio trial, Upgrade to agency launch, or Talk to enterprise sales.'
    case 'weak-conversion-close':
      return 'Conversion close: add a final CTA/footer, FAQ, contact/demo/signup form, calendar/contact route, or next-step section near the end so landing pages have a complete conversion path.'
    case 'generic-conversion-close':
      return 'Conversion close detail: replace generic closes like Ready to get started, Start today, and Take the next step with a specific outcome, timeframe, next deliverable, or domain-specific CTA.'
    case 'weak-faq-anatomy':
      return 'FAQ anatomy: when an FAQ section is present, include multiple concrete question/answer items covering real objections such as pricing, migration, support, security, setup, or timeline.'
    case 'generic-faq-questions':
      return 'FAQ question specificity: replace generic questions like What is this, How does it work, and Who is this for with real objections about pricing, migration, setup time, security, support, integrations, or plan limits.'
    case 'generic-faq-answers':
      return 'FAQ answer detail: replace generic answers like Contact us, Learn more, or Our team can help with concrete objection-handling details about pricing, migration, support, security, setup, timelines, integrations, or plan limits.'
    case 'weak-site-footer':
      return 'Site footer: finish brand and marketing pages with a real footer containing brand/contact details, secondary links, social/legal links, copyright/support information, newsletter links, or status/help routes.'
    case 'generic-site-footer-detail':
      return 'Site footer detail: replace generic Product, Company, and Resources footer columns with brand/contact details, legal/status/social/help links, copyright, and product-specific routes.'
    case 'weak-metric-context':
      return 'Metric context: give KPI cards timeframe labels, previous-period deltas, target/goal comparisons, trend direction, or benchmark notes so numbers are interpretable.'
    case 'generic-metric-card-labels':
      return 'Metric specificity: replace generic Revenue, Users, Growth, and Tasks scorecards with KPI labels that name the business object, workflow, period, owner, SLA, risk, or target.'
    case 'weak-chart-structure':
      return 'Data visualization: add chart titles or captions, axis/legend labels, visible values, and accessible SVG title/desc or aria labels tied to concrete data.'
    case 'generic-chart-labels':
      return 'Chart specificity: replace Chart, Data, Growth, Performance, and Series 1-only labels with the business metric, object, period, comparison, segment, or decision the visualization supports.'
    case 'weak-table-structure':
      return 'Data tables: add clear column headers, scope attributes, captions or aria labels, and realistic row values so table modules are readable and implementation-ready.'
    case 'generic-record-table-columns':
      return 'Record table columns: replace Name, Status, Date, or Action-only table headers with domain-specific fields such as account, invoice, renewal, amount, due date, risk, owner, SLA, and workflow stage.'
    case 'weak-list-structure':
      return 'Structured records: convert repeated record cards, queues, feeds, and timelines from generic div stacks into ul/li, ol/li, table rows, role=list/listitem, or role=row patterns with clear item labels.'
    case 'weak-record-actions':
      return 'Record actions: add visible row actions, detail links, selection with bulk actions, approve/retry/assign buttons, or contextual menus so actionable records are not just static data.'
    case 'generic-record-item-labels':
      return 'Record item titles: replace Item 1, Task 2, Record A, and Customer B-only list or card titles with concrete customer, invoice, ticket, renewal, owner, date, amount, or workflow context.'
    case 'generic-record-action-labels':
      return 'Record action specificity: replace View, Details, More, or Open-only repeated row/card actions with task-specific actions such as Review renewal, Assign owner, Retry sync, Approve invoice, or Resolve ticket.'
    case 'weak-record-discovery-controls':
      return 'Record discovery: add search, status/date filters, sortable columns, pagination, saved views, or segmented tabs so dense tables and lists can be scanned and narrowed quickly.'
    case 'generic-record-discovery-controls':
      return 'Record discovery specificity: replace generic Search, Filter, or All statuses controls with object-specific search labels, domain filters, saved views, sort labels, or pagination copy.'
    case 'weak-status-affordance':
      return 'Status affordance: render statuses as labeled badges, chips, or state tags with semantic color, sufficient contrast, and accessible labels instead of plain table or list text for critical states.'
    case 'unnamed-content-section':
      return 'Module naming: give every meaningful section, panel, list, form, aside, and status module a concise visible heading, legend, aria-label, or aria-labelledby so the page is scannable and accessible.'
    case 'weak-data-realism':
    case 'placeholder-content':
    case 'vague-template-copy':
      return 'Real content: replace abstract copy with realistic names, metrics, dates, prices, IDs, statuses, records, and domain-specific labels.'
    case 'weak-color-system':
      return 'Color system: define reusable palette tokens for surface, text, border, muted, and accent roles; replace scattered hard-coded colors with those tokens.'
    case 'one-note-palette':
      return 'Palette range: keep one clear brand color, then add neutral surface/text/border roles plus a distinct secondary accent or semantic color so the design is not all one hue family.'
    case 'weak-spacing-system':
      return 'Spacing system: define a small spacing scale and vary section, group, and control spacing; avoid using the same 16px gap/padding everywhere.'
    case 'state-laundry-list':
    case 'missing-ui-states':
      return 'State coverage: replace state-name lists with visible UI states such as skeleton rows, empty panels, retry banners, disabled controls, offline/permission notices, or toast feedback.'
    case 'weak-state-recovery-action':
      return 'State recovery: give empty, error, offline, and permission states a clear next action such as Retry, Clear filters, Import records, Connect source, Request access, or Contact support.'
    case 'generic-recoverable-state-copy':
      return 'State recovery copy: replace generic No data, Nothing here, and Something went wrong panels with the missing object, likely cause, domain-specific next step, and recovery action.'
    case 'generic-feedback-message-copy':
      return 'Feedback message specificity: replace Success, Saved, Error, or Failed-only toasts, alerts, banners, and inline confirmations with the object, action result, and next step or recovery path.'
    case 'dead-link-targets':
    case 'dead-links':
    case 'missing-prototype-navigation':
    case 'missing-navigation-landmark':
    case 'missing-navigation-current-state':
    case 'missing-interaction-behavior':
      return 'Prototype behavior: convert dead anchors and visual-only controls into real routes (`<a href>`, `data-href`, `data-prototype-href`, or `data-prototype-target` on button-like controls), Back/Previous controls that call `history.back()` / `history.go(-1)`, section anchors, form feedback, filters, expanded panels, toasts, or sibling-screen navigation with a visible/accessible current-page state.'
    case 'weak-prototype-navigation-coverage':
      return 'Prototype navigation coverage: when several sibling screens exist, link to multiple relevant pages from nav items, tabs, breadcrumbs, cards, or CTAs using the provided prototype hrefs or exact screen titles (`<a href>` for links, `data-href` / `data-prototype-href` / `data-prototype-target` for button-like controls), and keep a visible current-page state.'
    case 'weak-tab-current-state':
      return 'Tab state: give tabs, segmented controls, and view switchers a visible and accessible selected state with aria-selected, aria-current, data-state="active", or active/current styling.'
    case 'generic-tab-labels':
      return 'Tab labels: replace generic Overview, Details, Settings, and Tab 1 labels with domain-specific views, queues, objects, or workflow stages tied to the screen.'
    case 'weak-workflow-step-state':
      return 'Workflow progress: mark multi-step flows with current, completed, and upcoming states using aria-current, data-state/status, progressbar values, and visible active/completed/pending styling.'
    case 'generic-workflow-step-labels':
      return 'Workflow step labels: replace Step 1, Step 2, and Phase 3 labels with domain-specific actions or milestones such as Connect source, Map fields, Review exceptions, and Submit approval.'
    case 'weak-destructive-action-safety':
      return 'Destructive action safety: style destructive actions with a clear danger tone and pair them with confirmation, undo toast/recovery, or explicit irreversible-warning feedback.'
    case 'weak-dialog-affordance':
      return 'Dialog affordance: use native <dialog> or role="dialog" with aria-modal/labeling, a visible title, and Close/Cancel/Dismiss controls for modals, drawers, sheets, and popovers.'
    case 'generic-dialog-title':
      return 'Dialog title specificity: replace Details, Confirmation, Warning, or Settings-only titles with titles that name the specific object, action, consequence, or workflow.'
    case 'missing-form-labels':
    case 'unlabeled-fields':
    case 'inert-form-submission':
    case 'weak-form-affordance':
      return 'Forms: give every field a visible/accessibility label, required/optional or helper guidance, aria-describedby/error text where useful, and submit paths that show validation, loading, success, error, or toast feedback.'
    case 'weak-lead-form-response':
      return 'Lead form response: for contact, demo, signup, waitlist, and newsletter forms, add visible submitting/loading, success/confirmation, and error/validation states so the conversion path feels complete.'
    case 'generic-form-field-labels':
      return 'Form field specificity: replace Name, Email, Message, and Details-only forms with fields tied to the intent, such as work email, company domain, team size, launch timeline, budget, request type, dispatch volume, or use case.'
    case 'generic-settings-control-labels':
      return 'Settings control specificity: replace Option 1, Enable, Notifications, and Setting-only toggles, checkboxes, or radio choices with labels that name the controlled object, audience, effect, or workflow.'
    case 'missing-image-source':
    case 'missing-image-alt':
    case 'generic-image-alt':
    case 'broken-images':
      return 'Media: use valid workspace-relative images or intentional designed placeholders, and write specific alt text naming the product, person, place, screen, or content shown unless the image is decorative.'
    case 'missing-focus-states':
    case 'missing-interaction-states':
    case 'small-tap-targets':
    case 'unnamed-icon-controls':
    case 'low-contrast-text':
      return 'Accessibility polish: keep focus states visible, add hover/active/disabled/pressed states, keep tap targets at least 40px, icon controls named, and important text at accessible contrast.'
    case 'weak-type-hierarchy':
      return 'Type hierarchy: build a bounded type scale where H1/H2 are visibly larger or heavier than body text, with smaller metadata/caption text and stable wrapping across breakpoints.'
    case 'wide-text-measure':
      return 'Text measure: constrain prose, lead copy, and explanatory text to readable columns around 60-72ch while letting tables, grids, and controls use wider layouts where appropriate.'
    case 'weak-typography-constraints':
      return 'Typography: replace unbounded viewport-sized text with a bounded type scale, keep letter spacing at 0 or positive values, and verify headings wrap cleanly on mobile and desktop.'
    default:
      return undefined
  }
}
