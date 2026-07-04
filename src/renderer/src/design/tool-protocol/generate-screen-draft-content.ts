import type { CanvasShape } from '../canvas/canvas-types'
import type { DesignContext } from '../design-context'
import type { DesignArtifact } from '../design-types'
import type { GeneratedScreenSpec } from './screen-generation-support'

type DraftContentOptions = {
  artifact: DesignArtifact
  spec: GeneratedScreenSpec
  frame?: CanvasShape
  designContext?: DesignContext
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function sentence(value: string | undefined, fallback: string): string {
  const trimmed = value?.replace(/\s+/g, ' ').trim()
  if (!trimmed) return fallback
  return trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?') ? trimmed : `${trimmed}.`
}

function screenKind(ctx: DesignContext | undefined, frame: CanvasShape | undefined): 'app' | 'web' {
  return ctx?.designTarget === 'app' || frame?.devicePreset === 'mobile' ? 'app' : 'web'
}

function cssForKind(kind: 'app' | 'web'): string {
  const maxWidth = kind === 'app' ? '440px' : '1180px'
  const shellRadius = kind === 'app' ? '28px' : '18px'
  return `
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f7f4;
      color: #18211f;
      --ink: #18211f;
      --muted: #5f6b66;
      --line: #d8dfd8;
      --panel: #ffffff;
      --accent: #0f766e;
      --accent-2: #b45309;
      --soft: #e6f3ef;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; min-height: 100%; }
    body {
      min-height: 100%;
      background:
        linear-gradient(180deg, #fbfcf9 0%, #eef3ef 100%);
    }
    button, input { font: inherit; }
    .page {
      width: min(100%, ${maxWidth});
      margin: 0 auto;
      padding: clamp(18px, 4vw, 40px);
    }
    .shell {
      min-height: calc(100vh - clamp(36px, 8vw, 80px));
      border: 1px solid var(--line);
      border-radius: ${shellRadius};
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 18px 60px rgba(24, 33, 31, 0.10);
      overflow: hidden;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px clamp(18px, 4vw, 32px);
      border-bottom: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.92);
    }
    .brand { display: grid; gap: 2px; min-width: 0; }
    .brand strong { font-size: 15px; letter-spacing: 0; }
    .brand span { color: var(--muted); font-size: 12px; }
    nav { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    nav a {
      color: var(--muted);
      text-decoration: none;
      border: 1px solid transparent;
      border-radius: 999px;
      padding: 8px 11px;
      font-size: 13px;
    }
    nav a:first-child { color: var(--accent); border-color: #b9d9d3; background: var(--soft); }
    main {
      display: grid;
      grid-template-columns: ${kind === 'app' ? '1fr' : 'minmax(0, 1.15fr) minmax(280px, 0.85fr)'};
      gap: clamp(18px, 4vw, 34px);
      padding: clamp(22px, 5vw, 42px);
    }
    .hero { display: grid; gap: 18px; align-content: start; min-width: 0; }
    h1 {
      margin: 0;
      max-width: 760px;
      font-size: clamp(32px, ${kind === 'app' ? '11vw' : '6vw'}, ${kind === 'app' ? '48px' : '72px'});
      line-height: 1.02;
      letter-spacing: 0;
    }
    .lead { margin: 0; max-width: 68ch; color: var(--muted); font-size: clamp(15px, 2vw, 18px); line-height: 1.65; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .primary, .secondary {
      min-height: 44px;
      border-radius: 999px;
      border: 1px solid var(--line);
      padding: 10px 15px;
      cursor: pointer;
    }
    .primary { background: var(--accent); color: white; border-color: var(--accent); }
    .secondary { background: white; color: var(--ink); }
    .panel-grid { display: grid; gap: 12px; }
    .panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      padding: 16px;
      display: grid;
      gap: 10px;
    }
    .metric { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .metric strong { font-size: 28px; color: var(--accent); }
    .metric span, .panel p { color: var(--muted); margin: 0; line-height: 1.55; }
    .list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .list li { display: flex; justify-content: space-between; gap: 10px; border-top: 1px solid #edf1ed; padding-top: 8px; }
    .status { color: var(--accent-2); font-weight: 700; }
    @media (max-width: 760px) {
      .page { padding: 0; }
      .shell { min-height: 100vh; border-radius: 0; border-left: 0; border-right: 0; }
      .topbar { align-items: flex-start; }
      nav { max-width: 180px; }
      main { grid-template-columns: 1fr; padding: 22px 18px; }
      .actions { flex-direction: column; }
      .primary, .secondary { width: 100%; }
    }
  `
}

export function buildGeneratedScreenDraftHtml(options: DraftContentOptions): string {
  const kind = screenKind(options.designContext, options.frame)
  const title = escapeHtml(options.artifact.title || options.spec.name || 'Generated screen')
  const brief = escapeHtml(sentence(options.spec.brief, 'Draft the first usable design pass for this screen.'))
  const targetLabel = kind === 'app' ? 'Mobile app screen' : 'Responsive web screen'
  const cta = kind === 'app' ? 'Approve next task' : 'Start guided review'
  const secondary = kind === 'app' ? 'Open activity log' : 'Compare design direction'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>${cssForKind(kind)}
  </style>
</head>
<body>
  <div class="page">
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <strong>${title}</strong>
          <span>${targetLabel}</span>
        </div>
        <nav aria-label="Screen sections">
          <a href="#overview">Overview</a>
          <a href="#signals">Signals</a>
          <a href="#handoff">Handoff</a>
        </nav>
      </header>
      <main>
        <section class="hero" id="overview">
          <h1>${title}</h1>
          <p class="lead">${brief}</p>
          <div class="actions">
            <button class="primary" type="button">${cta}</button>
            <button class="secondary" type="button">${secondary}</button>
          </div>
        </section>
        <section class="panel-grid" aria-label="Draft screen details">
          <article class="panel" id="signals">
            <div class="metric"><span>Primary flow confidence</span><strong>82%</strong></div>
            <p>Use this draft as the first screen artifact for critique, repair, system extraction, and code binding.</p>
          </article>
          <article class="panel">
            <h2>Content model</h2>
            <ul class="list">
              <li><span>Primary user intent</span><span class="status">captured</span></li>
              <li><span>Responsive frame contract</span><span class="status">ready</span></li>
              <li><span>Design notes handoff</span><span class="status">linked</span></li>
            </ul>
          </article>
          <article class="panel" id="handoff">
            <h2>Next design agent move</h2>
            <p>Run critique, repair, or system extraction to turn this draft into a polished Stitch-style screen.</p>
          </article>
        </section>
      </main>
    </div>
  </div>
</body>
</html>
`
}
