import type { DesignTokenKind } from '../canvas/design-system-types'
import type { DesignArtifact } from '../design-types'

export const OPENUI_NORMALIZATION_REPORT_PATH = '.kun-design/openui-normalization.json'

export type OpenUiNormalizedToken = {
  name: string
  kind: DesignTokenKind
  value: string
  sourcePath: string
}

export type OpenUiNormalizedComponent = {
  name: string
  kind: 'hero' | 'nav' | 'form' | 'table' | 'card-list' | 'section'
  sourcePath: string
  evidence: string[]
}

export type OpenUiNormalizedScreen = {
  artifactId: string
  title: string
  htmlPath: string
  designMdPath?: string
  documentTitle?: string
  h1?: string
  moduleCount: number
  prototypeLinks: Array<{ label: string; href: string }>
  tokenNames: string[]
  componentNames: string[]
}

export type OpenUiNormalizationReport = {
  version: 1
  kind: 'kun.openui.normalization'
  source: 'kun-design-mode'
  updatedAt: string
  screens: OpenUiNormalizedScreen[]
  tokens: OpenUiNormalizedToken[]
  components: OpenUiNormalizedComponent[]
  warnings: string[]
}

export type BuildOpenUiNormalizationReportOptions = {
  items: Array<{ artifact: DesignArtifact; html: string }>
  updatedAt?: string
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
}

function firstTagText(html: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(html)
  const text = match ? stripTags(match[1] ?? '') : ''
  return text || undefined
}

function attrValue(tag: string, attr: string): string {
  const match = new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  return decodeEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim()
}

function cssVarDeclarations(html: string): Array<{ name: string; value: string }> {
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1] ?? '')
  const declarations: Array<{ name: string; value: string }> = []
  for (const style of styles) {
    for (const match of style.matchAll(/(--[a-z0-9-_]+)\s*:\s*([^;{}]+)\s*;/gi)) {
      const name = (match[1] ?? '').trim()
      const value = (match[2] ?? '').trim()
      if (name && value) declarations.push({ name, value })
    }
  }
  return declarations
}

function normalizeTokenName(name: string): string {
  return name.replace(/^--/, '').replace(/_/g, '-').replace(/-{2,}/g, '-')
}

function tokenKind(name: string, value: string): DesignTokenKind | null {
  const probe = `${name} ${value}`.toLowerCase()
  if (/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i.test(value)) return 'color'
  if (/\b(font|type|line-height)\b|font-size/.test(probe)) return 'type'
  if (/radius|rounded/.test(probe)) return 'radius'
  if (/shadow/.test(probe)) return 'shadow'
  if (/space|spacing|gap|padding|margin/.test(probe) && /\b-?\d*\.?\d+(?:px|rem|em)\b/i.test(value)) return 'space'
  return null
}

function extractTokens(html: string, sourcePath: string): OpenUiNormalizedToken[] {
  return cssVarDeclarations(html)
    .map((item) => {
      const kind = tokenKind(item.name, item.value)
      return kind
        ? {
            name: normalizeTokenName(item.name),
            kind,
            value: item.value,
            sourcePath
          }
        : null
    })
    .filter((item): item is OpenUiNormalizedToken => Boolean(item))
}

function localPrototypeLinks(html: string): Array<{ label: string; href: string }> {
  return [...html.matchAll(/<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const href = decodeEntities(match[1] ?? match[2] ?? match[3] ?? '').trim()
      const label = stripTags(match[4] ?? '') || href
      return { label, href }
    })
    .filter((link) =>
      Boolean(link.href) &&
      !/^https?:\/\//i.test(link.href) &&
      !/^(mailto|tel):/i.test(link.href) &&
      link.href !== '#'
    )
    .slice(0, 12)
}

function tagCount(html: string, tag: string): number {
  return [...html.matchAll(new RegExp(`<${tag}\\b`, 'gi'))].length
}

function classCount(html: string, pattern: RegExp): number {
  return [...html.matchAll(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
    .map((match) => `${match[1] ?? ''} ${match[2] ?? ''}`)
    .filter((value) => pattern.test(value))
    .length
}

function component(
  name: string,
  kind: OpenUiNormalizedComponent['kind'],
  sourcePath: string,
  evidence: string[]
): OpenUiNormalizedComponent {
  return { name, kind, sourcePath, evidence }
}

function extractComponents(html: string, sourcePath: string): OpenUiNormalizedComponent[] {
  const out: OpenUiNormalizedComponent[] = []
  const h1 = firstTagText(html, 'h1')
  if (h1) out.push(component('Hero', 'hero', sourcePath, [h1]))
  if (tagCount(html, 'nav') > 0) out.push(component('Navigation', 'nav', sourcePath, ['<nav>']))
  if (tagCount(html, 'form') > 0) out.push(component('Form', 'form', sourcePath, [`${tagCount(html, 'form')} form(s)`]))
  if (tagCount(html, 'table') > 0) out.push(component('Data table', 'table', sourcePath, [`${tagCount(html, 'table')} table(s)`]))
  const cardCount = classCount(html, /\b(card|tile|panel|surface|item)\b/i)
  if (cardCount >= 2) out.push(component('Card list', 'card-list', sourcePath, [`${cardCount} card-like nodes`]))
  for (const match of html.matchAll(/<section\b([^>]*)>([\s\S]*?)<\/section>/gi)) {
    const label =
      attrValue(match[1] ?? '', 'aria-label') ||
      firstTagText(match[2] ?? '', 'h2') ||
      firstTagText(match[2] ?? '', 'h3')
    if (label) out.push(component(label, 'section', sourcePath, [label]))
  }
  return out.slice(0, 16)
}

function moduleCount(html: string): number {
  return tagCount(html, 'section') + tagCount(html, 'aside') + tagCount(html, 'form') + tagCount(html, 'table')
}

function uniqueByName<T extends { name: string; sourcePath?: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.sourcePath ?? ''}:${item.name}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function warningsForScreen(screen: OpenUiNormalizedScreen, tokenCount: number, componentCount: number): string[] {
  const warnings: string[] = []
  if (tokenCount === 0) warnings.push(`${screen.htmlPath}: no reusable CSS tokens found`)
  if (componentCount === 0) warnings.push(`${screen.htmlPath}: no reusable component structure detected`)
  if (screen.prototypeLinks.length === 0) warnings.push(`${screen.htmlPath}: no local prototype links found`)
  return warnings
}

export function normalizeOpenUiHtmlArtifact(
  artifact: DesignArtifact,
  html: string
): {
  screen: OpenUiNormalizedScreen
  tokens: OpenUiNormalizedToken[]
  components: OpenUiNormalizedComponent[]
  warnings: string[]
} {
  const sourcePath = artifact.relativePath
  const tokens = uniqueByName(extractTokens(html, sourcePath))
  const components = uniqueByName(extractComponents(html, sourcePath))
  const documentTitle = firstTagText(html, 'title')
  const h1 = firstTagText(html, 'h1')
  const screen: OpenUiNormalizedScreen = {
    artifactId: artifact.id,
    title: h1 ?? documentTitle ?? artifact.title,
    htmlPath: artifact.relativePath,
    ...(artifact.designMdPath ? { designMdPath: artifact.designMdPath } : {}),
    ...(documentTitle ? { documentTitle } : {}),
    ...(h1 ? { h1 } : {}),
    moduleCount: moduleCount(html),
    prototypeLinks: localPrototypeLinks(html),
    tokenNames: tokens.map((token) => token.name),
    componentNames: components.map((item) => item.name)
  }
  return {
    screen,
    tokens,
    components,
    warnings: warningsForScreen(screen, tokens.length, components.length)
  }
}

export function buildOpenUiNormalizationReport(
  options: BuildOpenUiNormalizationReportOptions
): OpenUiNormalizationReport {
  const normalized = options.items.map((item) => normalizeOpenUiHtmlArtifact(item.artifact, item.html))
  return {
    version: 1,
    kind: 'kun.openui.normalization',
    source: 'kun-design-mode',
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    screens: normalized.map((item) => item.screen),
    tokens: normalized.flatMap((item) => item.tokens),
    components: normalized.flatMap((item) => item.components),
    warnings: normalized.flatMap((item) => item.warnings)
  }
}

export function serializeOpenUiNormalizationReport(report: OpenUiNormalizationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}
