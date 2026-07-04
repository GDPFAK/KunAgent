import { describe, expect, it } from 'vitest'
import type { DesignArtifact } from '../design-types'
import {
  buildOpenUiNormalizationReport,
  normalizeOpenUiHtmlArtifact,
  OPENUI_NORMALIZATION_REPORT_PATH,
  serializeOpenUiNormalizationReport
} from './openui-html-normalizer'

const now = '2026-06-29T00:00:00.000Z'

function artifact(id = 'home'): DesignArtifact {
  const relativePath = `.kun-design/doc/${id}/v1.html`
  return {
    id,
    kind: 'html',
    title: 'Home artifact',
    relativePath,
    designMdPath: `.kun-design/doc/${id}/DESIGN.md`,
    createdAt: now,
    updatedAt: now,
    versions: [{ id: `${id}-v1`, relativePath, createdAt: now, summary: '' }]
  }
}

const html = `
<!doctype html>
<html>
  <head>
    <title>OpsPilot dashboard</title>
    <style>
      :root {
        --brand-primary: #2563eb;
        --surface-muted: #f8fafc;
        --space-md: 16px;
        --radius-card: 8px;
        --font-sans: Inter, system-ui, sans-serif;
      }
      .card { border-radius: var(--radius-card); }
    </style>
  </head>
  <body>
    <nav><a href="./settings.html">Settings</a></nav>
    <main>
      <section aria-label="Hero">
        <h1>Dispatch handoff dashboard</h1>
        <a href="../details/v1.html">Open details</a>
      </section>
      <section><h2>At-risk routes</h2><article class="card">Route A</article><article class="card">Route B</article></section>
      <form><label>Email</label><input /></form>
      <table><tr><td>INV-100</td></tr></table>
    </main>
  </body>
</html>
`

describe('openui html normalizer', () => {
  it('uses the stable report path', () => {
    expect(OPENUI_NORMALIZATION_REPORT_PATH).toBe('.kun-design/openui-normalization.json')
  })

  it('normalizes generated HTML into screen, token, component, and link hints', () => {
    const normalized = normalizeOpenUiHtmlArtifact(artifact(), html)

    expect(normalized.screen).toMatchObject({
      artifactId: 'home',
      title: 'Dispatch handoff dashboard',
      htmlPath: '.kun-design/doc/home/v1.html',
      designMdPath: '.kun-design/doc/home/DESIGN.md',
      documentTitle: 'OpsPilot dashboard',
      h1: 'Dispatch handoff dashboard',
      moduleCount: 4,
      prototypeLinks: [
        { label: 'Settings', href: './settings.html' },
        { label: 'Open details', href: '../details/v1.html' }
      ]
    })
    expect(normalized.tokens.map((token) => [token.name, token.kind, token.value])).toEqual([
      ['brand-primary', 'color', '#2563eb'],
      ['surface-muted', 'color', '#f8fafc'],
      ['space-md', 'space', '16px'],
      ['radius-card', 'radius', '8px'],
      ['font-sans', 'type', 'Inter, system-ui, sans-serif']
    ])
    expect(normalized.components.map((component) => [component.name, component.kind])).toEqual([
      ['Hero', 'hero'],
      ['Navigation', 'nav'],
      ['Form', 'form'],
      ['Data table', 'table'],
      ['Card list', 'card-list'],
      ['At-risk routes', 'section']
    ])
    expect(normalized.warnings).toEqual([])
  })

  it('builds a report and warns when generated HTML is too thin to normalize', () => {
    const report = buildOpenUiNormalizationReport({
      items: [{ artifact: artifact('empty'), html: '<main><h1>Empty</h1></main>' }],
      updatedAt: now
    })

    expect(report).toMatchObject({
      version: 1,
      kind: 'kun.openui.normalization',
      screens: [{ artifactId: 'empty', title: 'Empty' }]
    })
    expect(report.tokens).toEqual([])
    expect(report.components.map((component) => component.kind)).toEqual(['hero'])
    expect(report.warnings).toEqual([
      '.kun-design/doc/empty/v1.html: no reusable CSS tokens found',
      '.kun-design/doc/empty/v1.html: no local prototype links found'
    ])
  })

  it('serializes with a trailing newline', () => {
    const content = serializeOpenUiNormalizationReport(
      buildOpenUiNormalizationReport({
        items: [{ artifact: artifact(), html }],
        updatedAt: now
      })
    )

    expect(content.endsWith('\n')).toBe(true)
    expect(JSON.parse(content)).toMatchObject({ kind: 'kun.openui.normalization' })
  })
})
