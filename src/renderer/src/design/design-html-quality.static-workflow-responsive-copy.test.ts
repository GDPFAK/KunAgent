import { describe, expect, it } from 'vitest'
import {
  auditDesignHtmlQuality,
  buildDesignHtmlQualityRepairPrompt,
  buildDesignRuntimeQualityAuditScript,
  clearDesignRuntimeQualityFindings,
  formatDesignHtmlQualityFindings,
  getDesignRuntimeQualityFindings,
  mergeDesignHtmlQualityFindings,
  normalizeRuntimeQualityFindings,
  setDesignRuntimeQualityFindings,
  shouldAutoRepairDesignHtmlFinding,
  summarizeDesignHtmlQualityDetails,
  summarizeDesignHtmlQualityStatus
} from './design-html-quality'

describe("auditDesignHtmlQuality workflow, responsive, and copy rules", () => {
    it('flags tabs and segmented controls with generic view labels', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.tabs { display: inline-flex; gap: 4px; }',
          '.is-active { border-bottom: 2px solid #0f766e; font-weight: 700; }',
          'button:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '[aria-selected="true"] { color: #0f766e; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<div class="tabs" role="tablist" aria-label="Dashboard views">',
          '<button role="tab" aria-selected="true" class="is-active">Overview</button>',
          '<button role="tab" aria-selected="false">Details</button><button role="tab" aria-selected="false">Settings</button></div>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
          '<section><h2>Renewal accounts</h2><p>Loading state, empty state, error state.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-tab-current-state')
      expect(findings.map((finding) => finding.code)).toContain('generic-tab-labels')
    })
    it('accepts tabs with domain-specific view labels', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.tabs { display: inline-flex; gap: 4px; }',
          '.is-active { border-bottom: 2px solid #0f766e; font-weight: 700; }',
          'button:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '[aria-selected="true"] { color: #0f766e; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<div class="tabs" role="tablist" aria-label="Renewal views">',
          '<button role="tab" aria-selected="true" class="is-active">Renewal accounts</button>',
          '<button role="tab" aria-selected="false">Approval tasks</button><button role="tab" aria-selected="false">Owner notes</button></div>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
          '<section><h2>Renewal accounts</h2><p>Loading state, empty state, error state.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('generic-tab-labels')
    })
    it('flags multi-step workflows without current or completed state', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.checkout-stepper { display: flex; gap: 12px; }',
          'button:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Checkout</a></nav></header><main id="main">',
          '<section><h1>Review launch checkout</h1>',
          '<p>Mina Chen is preparing order RN-2048 for Acme Finance, $84,200 due Jun 18, currently pending finance review.</p>',
          '<ol class="checkout-stepper"><li class="step">Account</li><li class="step">Billing</li><li class="step">Review</li><li class="step">Submit</li></ol>',
          '<button onclick="document.body.classList.toggle(\'submitted\')">Submit launch order</button></section>',
          '<section><h2>Review summary</h2><p>Loading state, empty state, error state.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-workflow-step-state')
    })
    it('accepts multi-step workflows with current, completed, and upcoming state', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.checkout-stepper { display: flex; gap: 12px; }',
          '.is-completed { font-weight: 700; }',
          '.is-current { border-bottom: 2px solid #0f766e; }',
          '[data-state="upcoming"] { opacity: .64; }',
          'button:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Checkout</a></nav></header><main id="main">',
          '<section><h1>Review launch checkout</h1>',
          '<p>Mina Chen is preparing order RN-2048 for Acme Finance, $84,200 due Jun 18, currently pending finance review.</p>',
          '<ol class="checkout-stepper">',
          '<li class="step is-completed" data-state="completed">Account</li>',
          '<li class="step is-completed" data-state="completed">Billing</li>',
          '<li class="step is-current" aria-current="step" data-state="current">Review</li>',
          '<li class="step" data-state="upcoming">Submit</li>',
          '</ol>',
          '<button onclick="document.body.classList.toggle(\'submitted\')">Submit launch order</button></section>',
          '<section><h2>Review summary</h2><p>Loading state, empty state, error state.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-workflow-step-state')
    })
    it('flags multi-step workflows with generic step labels', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.checkout-stepper { display: flex; gap: 12px; }',
          '.is-completed { font-weight: 700; }',
          '.is-current { border-bottom: 2px solid #0f766e; }',
          '[data-state="upcoming"] { opacity: .64; }',
          'button:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Checkout</a></nav></header><main id="main">',
          '<section><h1>Review launch checkout</h1>',
          '<p>Mina Chen is preparing order RN-2048 for Acme Finance, $84,200 due Jun 18, currently pending finance review.</p>',
          '<ol class="checkout-stepper">',
          '<li class="step is-completed" data-state="completed">Step 1</li>',
          '<li class="step is-completed" data-state="completed">Step 2</li>',
          '<li class="step is-current" aria-current="step" data-state="current">Step 3</li>',
          '<li class="step" data-state="upcoming">Step 4</li>',
          '</ol>',
          '<button onclick="document.body.classList.toggle(\'submitted\')">Submit launch order</button></section>',
          '<section><h2>Review summary</h2><p>Loading state, empty state, error state.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-workflow-step-state')
      expect(findings.map((finding) => finding.code)).toContain('generic-workflow-step-labels')
    })
    it('accepts multi-step workflows with domain-specific step labels', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.checkout-stepper { display: flex; gap: 12px; }',
          '.is-completed { font-weight: 700; }',
          '.is-current { border-bottom: 2px solid #0f766e; }',
          '[data-state="upcoming"] { opacity: .64; }',
          'button:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Checkout</a></nav></header><main id="main">',
          '<section><h1>Review launch checkout</h1>',
          '<p>Mina Chen is preparing order RN-2048 for Acme Finance, $84,200 due Jun 18, currently pending finance review.</p>',
          '<ol class="checkout-stepper">',
          '<li class="step is-completed" data-state="completed">Connect billing account</li>',
          '<li class="step is-completed" data-state="completed">Verify invoice owner</li>',
          '<li class="step is-current" aria-current="step" data-state="current">Review renewal risk</li>',
          '<li class="step" data-state="upcoming">Submit approval</li>',
          '</ol>',
          '<button onclick="document.body.classList.toggle(\'submitted\')">Submit launch order</button></section>',
          '<section><h2>Review summary</h2><p>Loading state, empty state, error state.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('generic-workflow-step-labels')
    })
    it('flags fixed desktop frames that will not adapt to smaller canvases', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'body { width: 1440px; height: 100vh; overflow: hidden; }',
          'main { min-width: 1280px; font-size: clamp(16px, 2vw, 20px); }',
          'button:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { .summary { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><main><h1>Approve regional launch plans</h1>',
          '<button onclick="document.body.classList.toggle(\'sent\')">Approve plan</button>',
          '<p>Loading state, empty state, error state, disabled state.</p>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('fixed-desktop-frame')
    })
    it('accepts fluid max-width containers without treating them as fixed desktop frames', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'body { min-height: 100dvh; overflow-x: hidden; }',
          '.shell { width: min(100%, 960px); max-width: 1200px; margin: 0 auto; }',
          '.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }',
          'button:focus-visible, a:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { .shell { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Review queue</a></nav></header>',
          '<main id="main" class="shell"><h1>Approve regional launch plans</h1>',
          '<section class="grid"><button>Approve plan</button><p>Loading state, empty state, error state, disabled state.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('fixed-desktop-frame')
    })
    it('flags pages without a specific top-level heading', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><button>Review invoices</button><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('missing-page-heading')
    })
    it('accepts aria-level 1 headings as page headings', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><div role="heading" aria-level="1">Vendor invoice review</div>',
          '<button>Review invoices</button><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('missing-page-heading')
    })
    it('flags generic top-level headings that do not state the screen goal', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Dashboard</h1><button>Review invoices</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('generic-page-heading')
    })
    it('accepts specific top-level headings', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Approve overdue vendor invoices</h1><button>Review invoices</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('generic-page-heading')
    })
    it('flags prompt-like marketing page headings', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Marketing site for field operations software</h1>',
          '<p>OpsPilot helps regional service teams route urgent jobs, sync dispatch notes, and keep supervisors aligned.</p>',
          '<button>Book dispatch demo</button><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('meta-page-heading')
    })
    it('accepts offer-category headings that do not name the page type', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Field dispatch software for regional service teams</h1>',
          '<p>OpsPilot helps regional service teams route urgent jobs, sync dispatch notes, and keep supervisors aligned.</p>',
          '<button>Book dispatch demo</button><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('meta-page-heading')
    })
    it('flags marketing pages with multiple generic section headings', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}@media(max-width:640px){.grid{grid-template-columns:1fr}}</style>',
          '</head><body><header><nav><a href="#features">Features</a><a href="#pricing">Pricing</a></nav></header><main>',
          '<section><h1>Field dispatch software for regional service teams</h1>',
          '<p>OpsPilot helps supervisors route urgent jobs, sync dispatch notes, and review crew capacity before each morning standup.</p>',
          '<button>Book a demo</button></section>',
          '<section id="features"><h2>Features</h2><p>Route emergency work orders by SLA, location, and part availability.</p></section>',
          '<section><h2>Benefits</h2><p>Reduce missed handoffs for regional service crews during peak weeks.</p></section>',
          '<section><h2>Testimonials</h2><p>Harbor HVAC reduced missed handoffs by 31% in one quarter.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('generic-section-heading')
    })
    it('accepts product-specific marketing section headings', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}@media(max-width:640px){.grid{grid-template-columns:1fr}}</style>',
          '</head><body><header><nav><a href="#features">Capabilities</a><a href="#pricing">Pricing</a></nav></header><main>',
          '<section><h1>Field dispatch software for regional service teams</h1>',
          '<p>OpsPilot helps supervisors route urgent jobs, sync dispatch notes, and review crew capacity before each morning standup.</p>',
          '<button>Book a demo</button></section>',
          '<section id="features"><h2>Dispatch workflows that prevent missed handoffs</h2><p>Route emergency work orders by SLA, location, and part availability.</p></section>',
          '<section><h2>Proof from regional service crews</h2><p>Harbor HVAC reduced missed handoffs by 31% in one quarter.</p></section>',
          '<section><h2>Plans by crew size and launch support</h2><p>Starter, Studio, and Agency plans map to active crews, dispatch volume, and onboarding needs.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('generic-section-heading')
    })
    it('flags generic aria-level 1 headings', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><div role="heading" aria-level="1">Overview</div>',
          '<button>Review invoices</button><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('generic-page-heading')
    })
    it('flags vague template copy that should be replaced with product-specific content', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Transform your workflow</h1>',
          '<p>All-in-one platform built for modern teams with a seamless experience and powerful tools.</p>',
          '<button>Start review</button><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('vague-template-copy')
    })
    it('flags repeated design cards that reuse the same copy', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>.feature-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.feature-card{border:1px solid #cbd5e1;padding:16px}button:focus-visible{outline:2px solid #000}@media(max-width:640px){.feature-grid{grid-template-columns:1fr}}</style>',
          '</head><body><header><nav><a href="#main">OpsPilot</a><a href="#features">Features</a></nav></header><main id="main">',
          '<section><h1>Field dispatch software for regional service teams</h1><p>OpsPilot helps regional crews route urgent jobs and sync shift notes.</p><button>Book dispatch demo</button></section>',
          '<section id="features" class="feature-section"><h2>Dispatch capabilities</h2><div class="feature-grid">',
          '<article class="feature-card"><h3>Live crew routing</h3><p>Route emergency work by crew capacity, SLA window, and part availability before calls pile up.</p></article>',
          '<article class="feature-card"><h3>Live crew routing</h3><p>Route emergency work by crew capacity, SLA window, and part availability before calls pile up.</p></article>',
          '<article class="feature-card"><h3>Live crew routing</h3><p>Route emergency work by crew capacity, SLA window, and part availability before calls pile up.</p></article>',
          '</div></section><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('duplicated-card-copy')
    })
    it('accepts repeated card groups with distinct content and outcomes', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>.feature-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.feature-card{border:1px solid #cbd5e1;padding:16px}button:focus-visible{outline:2px solid #000}@media(max-width:640px){.feature-grid{grid-template-columns:1fr}}</style>',
          '</head><body><header><nav><a href="#main">OpsPilot</a><a href="#features">Features</a></nav></header><main id="main">',
          '<section><h1>Field dispatch software for regional service teams</h1><p>OpsPilot helps regional crews route urgent jobs and sync shift notes.</p><button>Book dispatch demo</button></section>',
          '<section id="features" class="feature-section"><h2>Dispatch capabilities</h2><div class="feature-grid">',
          '<article class="feature-card"><h3>Live crew routing</h3><p>Route emergency work by crew capacity, SLA window, and part availability before calls pile up.</p></article>',
          '<article class="feature-card"><h3>Supervisor dashboard</h3><p>Track blocked jobs, late arrivals, and utilization with shift-level alerts for every region.</p></article>',
          '<article class="feature-card"><h3>Handoff sync</h3><p>Sync technician notes, customer photos, and approval history into one workflow for next-day follow-up.</p></article>',
          '</div></section><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('duplicated-card-copy')
    })
    it('checks DESIGN.md handoff notes for states and responsive behavior', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><button>Join waitlist</button><p>Error and empty states.</p></main></body></html>'
        ].join(''),
        designNotes: '# Page\n\nUses brand tokens and cards.'
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).toContain('notes-missing-states')
      expect(codes).toContain('notes-missing-page-role')
      expect(codes).toContain('notes-missing-responsive')
    })
    it('checks DESIGN.md handoff notes for interactions and token/component usage', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><button>Approve invoice</button><p>Error and empty states.</p></main></body></html>'
        ].join(''),
        designNotes: '# Vendor review\n\nStates: loading, empty, error.\nResponsive: mobile stacks the queue above detail.'
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).toContain('notes-missing-interactions')
      expect(codes).toContain('notes-missing-tokens')
      expect(codes).toContain('notes-missing-implementation-notes')
    })
    it('accepts complete DESIGN.md handoff notes', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><button>Approve invoice</button><p>Error and empty states.</p></main></body></html>'
        ].join(''),
        designNotes: [
          '# Vendor review',
          'Page role: invoice approval workspace for finance leads with a primary action to approve the selected invoice.',
          'States: loading, empty, error, disabled approve.',
          'Responsive: mobile stacks the queue above detail; desktop uses a split pane.',
          'Interactions: Approve submits the invoice, secondary link opens audit history, hover and focus states are visible.',
          'Tokens/components: uses ink palette, 16px spacing token, 8px radius, table row component, and primary button component.',
          'Implementation notes: preserve the split-pane component contract, invoice data assumptions, and submit behavior.'
        ].join('\n')
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('notes-missing-states')
      expect(codes).not.toContain('notes-missing-responsive')
      expect(codes).not.toContain('notes-missing-interactions')
      expect(codes).not.toContain('notes-missing-tokens')
      expect(codes).not.toContain('notes-missing-page-role')
      expect(codes).not.toContain('notes-missing-implementation-notes')
    })
    it('flags common AI-slop visual patterns', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'body{background:#fff7ed}',
          'main{font-size:clamp(16px,2vw,20px)}',
          '.hero{background:linear-gradient(135deg,#7c3aed,#2563eb)}',
          'a:focus-visible{outline:2px solid #111}@media(max-width:640px){main{padding:16px}}',
          '</style></head><body><main id="main">',
          '<a href="#main">Open dashboard</a><p>Loading state, empty state, error state. Metrics \u{1F4C8} Tasks \u{1F4CB} Launch \u{1F680}</p>',
          '</main></body></html>'
        ].join('')
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).toContain('generic-ai-gradient')
      expect(codes).toContain('default-cream-background')
      expect(codes).toContain('emoji-iconography')
    })
    it('does not flag a specific non-purple palette or inline SVG icon system as AI slop', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'body{background:#f8fafc}',
          'main{font-size:clamp(16px,2vw,20px)}',
          '.hero{background:linear-gradient(135deg,#0f766e,#f97316)}',
          'a:focus-visible,button:focus-visible{outline:2px solid #111}@media(max-width:640px){main{padding:16px}}',
          '</style></head><body><main id="main">',
          '<a href="#main">Open dashboard</a><button onclick="document.body.classList.toggle(\'ready\')">',
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12"/></svg>Start</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('generic-ai-gradient')
      expect(codes).not.toContain('default-cream-background')
      expect(codes).not.toContain('emoji-iconography')
    })
    it('flags hard-coded color piles without reusable palette tokens', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'body{background:#f8fafc;color:#0f172a}',
          '.hero{background:#ffffff;border-color:#cbd5e1;color:#111827}',
          '.primary{background:#0f766e;color:#ffffff}',
          '.danger{background:#dc2626;color:#fff1f2}',
          '.muted{color:#64748b;background:#eef2ff}',
          'button:focus-visible{outline:2px solid #111}',
          '@media(max-width:640px){main{padding:16px}}',
          '</style></head><body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button class="primary" onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
          '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-color-system')
    })
    it('accepts tokenized palette colors', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root{--surface:#ffffff;--canvas:#f8fafc;--text:#0f172a;--muted:#64748b;--border:#cbd5e1;--accent:#0f766e;--danger:#dc2626;--info:#eef2ff}',
          'body{background:var(--canvas);color:var(--text)}',
          '.hero{background:var(--surface);border-color:var(--border)}',
          '.primary{background:var(--accent);color:var(--surface)}',
          'button:focus-visible{outline:2px solid var(--text)}',
          '@media(max-width:640px){main{padding:16px}}',
          '</style></head><body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button class="primary" onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
          '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-color-system')
    })
})
