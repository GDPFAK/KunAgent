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

describe("auditDesignHtmlQuality product shell and hero proof", () => {
    it('accepts pages with multiple meaningful product modules', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          'button:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button></section>',
          '<section><h2>Renewal accounts</h2><table><tbody>',
          '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr>',
          '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td>Pending</td></tr>',
          '</tbody></table></section>',
          '<section><h2>Follow-up states</h2><ul><li>Loading account health</li><li>Empty renewal queue</li><li>Error retry banner</li></ul></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-content-depth')
    })
    it('flags app-like work surfaces without product shell chrome', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          '.metric { border: 1px solid var(--border); padding: 20px; }',
          'button:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { main { padding: 16px; } .metrics { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><main id="revenue-dashboard">',
          '<section><h1>Review revenue dashboard</h1>',
          '<p>Mina Chen is tracking Acme Finance renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'approved\')">Approve renewal plan</button></section>',
          '<section class="metrics"><article class="metric"><h2>Pipeline</h2><p>$428,000 this quarter, +12% vs Q1 target.</p></article>',
          '<article class="metric"><h2>At risk</h2><p>17 accounts, $184,200 ARR, down 4 this week.</p></article>',
          '<article class="metric"><h2>Cycle time</h2><p>6.2 days average, 1.1 days faster than May.</p></article></section>',
          '<section><h2>Renewal orders</h2><table><caption>Accounts due this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200</td><td><span class="status warning">At risk</span></td></tr>',
          '<tr><td>Northstar Labs</td><td>$42,900</td><td><span class="status">Pending</span></td></tr></tbody></table></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-app-shell')
    })
    it('accepts app-like work surfaces with sidebar or topbar chrome', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '.app-shell { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 100dvh; }',
          '.sidebar { border-right: 1px solid var(--border); padding: 20px; }',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          '.metric { border: 1px solid var(--border); padding: 20px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { .app-shell { grid-template-columns: 1fr; } .metrics { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><div class="app-shell"><aside class="sidebar"><nav aria-label="Workspace">',
          '<a href="#dashboard" aria-current="page">Dashboard</a><a href="#orders">Orders</a><a href="#reports">Reports</a>',
          '</nav></aside><main id="dashboard">',
          '<section><h1>Review revenue dashboard</h1>',
          '<p>Mina Chen is tracking Acme Finance renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'approved\')">Approve renewal plan</button></section>',
          '<section class="metrics"><article class="metric"><h2>Pipeline</h2><p>$428,000 this quarter, +12% vs Q1 target.</p></article>',
          '<article class="metric"><h2>At risk</h2><p>17 accounts, $184,200 ARR, down 4 this week.</p></article>',
          '<article class="metric"><h2>Cycle time</h2><p>6.2 days average, 1.1 days faster than May.</p></article></section>',
          '<section><h2>Renewal orders</h2><table><caption>Accounts due this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200</td><td><span class="status warning">At risk</span></td></tr>',
          '<tr><td>Northstar Labs</td><td>$42,900</td><td><span class="status">Pending</span></td></tr></tbody></table></section>',
          '</main></div></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-app-shell')
    })
    it('flags app-like work surfaces with generic dashboard navigation labels', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '.app-shell { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 100dvh; }',
          '.sidebar { border-right: 1px solid var(--border); padding: 20px; }',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          '.metric { border: 1px solid var(--border); padding: 20px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { .app-shell { grid-template-columns: 1fr; } .metrics { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><div class="app-shell"><aside class="sidebar"><nav aria-label="Workspace">',
          '<a href="#dashboard" aria-current="page">Dashboard</a><a href="#analytics">Analytics</a><a href="#reports">Reports</a><a href="#settings">Settings</a>',
          '</nav></aside><main id="dashboard">',
          '<section><h1>Review revenue dashboard</h1>',
          '<p>Mina Chen is tracking Acme Finance renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'approved\')">Approve renewal plan</button></section>',
          '<section class="metrics"><article class="metric"><h2>Pipeline</h2><p>$428,000 this quarter, +12% vs Q1 target.</p></article>',
          '<article class="metric"><h2>At risk</h2><p>17 accounts, $184,200 ARR, down 4 this week.</p></article>',
          '<article class="metric"><h2>Cycle time</h2><p>6.2 days average, 1.1 days faster than May.</p></article></section>',
          '<section><h2>Renewal orders</h2><table><caption>Accounts due this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200</td><td><span class="status warning">At risk</span></td></tr>',
          '<tr><td>Northstar Labs</td><td>$42,900</td><td><span class="status">Pending</span></td></tr></tbody></table></section>',
          '</main></div></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-app-shell')
      expect(findings.map((finding) => finding.code)).toContain('generic-product-navigation')
    })
    it('accepts app-like work surfaces with domain-specific navigation labels', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '.app-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100dvh; }',
          '.sidebar { border-right: 1px solid var(--border); padding: 20px; }',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          '.metric { border: 1px solid var(--border); padding: 20px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { .app-shell { grid-template-columns: 1fr; } .metrics { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><div class="app-shell"><aside class="sidebar"><nav aria-label="Renewal workspace">',
          '<a href="#renewal-queue" aria-current="page">Renewal queue</a><a href="#at-risk-accounts">At-risk accounts</a><a href="#approval-handoffs">Approval handoffs</a><a href="#billing-exceptions">Billing exceptions</a>',
          '</nav></aside><main id="renewal-queue">',
          '<section><h1>Review revenue dashboard</h1>',
          '<p>Mina Chen is tracking Acme Finance renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'approved\')">Approve renewal plan</button></section>',
          '<section class="metrics"><article class="metric"><h2>Pipeline</h2><p>$428,000 this quarter, +12% vs Q1 target.</p></article>',
          '<article class="metric"><h2>At risk</h2><p>17 accounts, $184,200 ARR, down 4 this week.</p></article>',
          '<article class="metric"><h2>Cycle time</h2><p>6.2 days average, 1.1 days faster than May.</p></article></section>',
          '<section><h2>Renewal orders</h2><table><caption>Accounts due this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200</td><td><span class="status warning">At risk</span></td></tr>',
          '<tr><td>Northstar Labs</td><td>$42,900</td><td><span class="status">Pending</span></td></tr></tbody></table></section>',
          '</main></div></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('generic-product-navigation')
    })
    it('flags generic breadcrumb trails in app-like work surfaces', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '.app-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100dvh; }',
          '.sidebar { border-right: 1px solid var(--border); padding: 20px; }',
          '.topbar { border-bottom: 1px solid var(--border); padding: 12px 20px; }',
          '.metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          '.metric { border: 1px solid var(--border); padding: 20px; }',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { .app-shell { grid-template-columns: 1fr; } .metrics { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><div class="app-shell"><aside class="sidebar"><nav aria-label="Renewal workspace">',
          '<a href="#renewal-queue" aria-current="page">Renewal queue</a><a href="#at-risk-accounts">At-risk accounts</a><a href="#approval-handoffs">Approval handoffs</a><a href="#billing-exceptions">Billing exceptions</a>',
          '</nav></aside><div><nav class="breadcrumbs" aria-label="Breadcrumb"><ol>',
          '<li><a href="#home">Home</a></li><li><a href="#dashboard">Dashboard</a></li><li aria-current="page">Details</li>',
          '</ol></nav><main id="renewal-queue">',
          '<section><h1>Review revenue dashboard</h1>',
          '<p>Mina Chen is tracking Acme Finance renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'approved\')">Approve renewal plan</button></section>',
          '<section class="metrics"><article class="metric"><h2>Pipeline</h2><p>$428,000 this quarter, +12% vs Q1 target.</p></article>',
          '<article class="metric"><h2>At risk</h2><p>17 accounts, $184,200 ARR, down 4 this week.</p></article>',
          '<article class="metric"><h2>Cycle time</h2><p>6.2 days average, 1.1 days faster than May.</p></article></section>',
          '<section><h2>Renewal orders</h2><table><caption>Accounts due this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200</td><td><span class="status warning">At risk</span></td></tr>',
          '<tr><td>Northstar Labs</td><td>$42,900</td><td><span class="status">Pending</span></td></tr></tbody></table></section>',
          '</main></div></div></body></html>'
        ].join('')
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).toContain('generic-breadcrumb-labels')
      expect(codes).not.toContain('generic-product-navigation')
    })
    it('accepts breadcrumb trails with product areas and record context', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '.app-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100dvh; }',
          '.sidebar { border-right: 1px solid var(--border); padding: 20px; }',
          '.topbar { border-bottom: 1px solid var(--border); padding: 12px 20px; }',
          '.metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          '.metric { border: 1px solid var(--border); padding: 20px; }',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { .app-shell { grid-template-columns: 1fr; } .metrics { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><div class="app-shell"><aside class="sidebar"><nav aria-label="Renewal workspace">',
          '<a href="#renewal-queue" aria-current="page">Renewal queue</a><a href="#at-risk-accounts">At-risk accounts</a><a href="#approval-handoffs">Approval handoffs</a><a href="#billing-exceptions">Billing exceptions</a>',
          '</nav></aside><div><nav class="breadcrumbs" aria-label="Breadcrumb"><ol>',
          '<li><a href="#workspace">Renewal workspace</a></li><li><a href="#accounts">At-risk accounts</a></li><li aria-current="page">Acme Finance RN-2048</li>',
          '</ol></nav><main id="renewal-queue">',
          '<section><h1>Review revenue dashboard</h1>',
          '<p>Mina Chen is tracking Acme Finance renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'approved\')">Approve renewal plan</button></section>',
          '<section class="metrics"><article class="metric"><h2>Pipeline</h2><p>$428,000 this quarter, +12% vs Q1 target.</p></article>',
          '<article class="metric"><h2>At risk</h2><p>17 accounts, $184,200 ARR, down 4 this week.</p></article>',
          '<article class="metric"><h2>Cycle time</h2><p>6.2 days average, 1.1 days faster than May.</p></article></section>',
          '<section><h2>Renewal orders</h2><table><caption>Accounts due this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200</td><td><span class="status warning">At risk</span></td></tr>',
          '<tr><td>Northstar Labs</td><td>$42,900</td><td><span class="status">Pending</span></td></tr></tbody></table></section>',
          '</main></div></div></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('generic-breadcrumb-labels')
    })
    it('flags landing and marketing pages without a strong visual anchor', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
          '.proof { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { .hero, .proof { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#features">Features</a><a href="#pricing">Pricing</a></nav></header><main>',
          '<section class="hero"><div><h1>Portfolio website builder for boutique studios</h1>',
          '<p>Launch a marketing site with case studies, pricing plans, and testimonials for the Aria Studio team by Jun 18.</p>',
          '<a href="#pricing" role="button">Book a demo</a></div>',
          '<div><h2>Launch checklist</h2><p>Case studies, pricing, testimonials, and inquiry routing are ready for review.</p></div></section>',
          '<section id="features" class="proof"><article><h2>Features</h2><p>Three reusable project sections with real client names.</p></article>',
          '<article><h2>Testimonials</h2><p>Quotes from Mina Chen and Northstar Labs.</p></article>',
          '<article><h2>Pricing</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></article></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-visual-anchor')
    })
    it('accepts landing and marketing pages with a product preview visual', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '*,*::before,*::after{box-sizing:border-box}',
          'img { max-width: 100%; height: auto; display: block; }',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
          '.product-preview { border: 1px solid var(--border); padding: 12px; }',
          '.proof { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { .hero, .proof { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#features">Features</a><a href="#pricing">Pricing</a></nav></header><main>',
          '<section class="hero"><div><h1>Portfolio website builder for boutique studios</h1>',
          '<p>Launch a marketing site with case studies, pricing plans, and testimonials for the Aria Studio team by Jun 18.</p>',
          '<a href="#pricing" role="button">Book a demo</a></div>',
          '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
          '<figcaption>Live portfolio preview with case studies and pricing.</figcaption></figure></section>',
          '<section id="features" class="proof"><article><h2>Features</h2><p>Three reusable project sections with real client names.</p></article>',
          '<article><h2>Testimonials</h2><p>Quotes from Mina Chen and Northstar Labs.</p></article>',
          '<article><h2>Pricing</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></article></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-visual-anchor')
    })
    it('flags product preview shells without real media or concrete UI detail', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '*,*::before,*::after{box-sizing:border-box}',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
          '.product-preview { border: 1px solid var(--border); min-height: 280px; padding: 12px; }',
          '.proof { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { .hero, .proof { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#features">Features</a><a href="#pricing">Pricing</a></nav></header><main>',
          '<section class="hero"><div><h1>Portfolio website builder for boutique studios</h1>',
          '<p>Launch a marketing site with case studies, pricing plans, and testimonials for the Aria Studio team by Jun 18.</p>',
          '<a href="#pricing" role="button">Book a demo</a></div>',
          '<figure class="product-preview"><figcaption>Product preview area for the launch dashboard.</figcaption></figure></section>',
          '<section id="features" class="proof"><article><h2>Features</h2><p>Three reusable project sections with real client names.</p></article>',
          '<article><h2>Testimonials</h2><p>Quotes from Mina Chen and Northstar Labs.</p></article>',
          '<article><h2>Pricing</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></article></section>',
          '</main></body></html>'
        ].join('')
      })
  
      const codes = findings.map((finding) => finding.code)
      expect(codes).not.toContain('weak-visual-anchor')
      expect(codes).toContain('weak-product-preview-detail')
    })
    it('accepts product preview mockups with concrete UI rows and data', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '*,*::before,*::after{box-sizing:border-box}',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
          '.product-preview { border: 1px solid var(--border); padding: 16px; }',
          '.preview-row { display: flex; justify-content: space-between; gap: 16px; }',
          '.proof { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { .hero, .proof { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#features">Features</a><a href="#pricing">Pricing</a></nav></header><main>',
          '<section class="hero"><div><h1>Portfolio website builder for boutique studios</h1>',
          '<p>Launch a marketing site with case studies, pricing plans, and testimonials for the Aria Studio team by Jun 18.</p>',
          '<a href="#pricing" role="button">Book a demo</a></div>',
          '<aside class="product-preview" aria-label="Launch dashboard preview"><h2>Launch dashboard</h2><ul>',
          '<li class="preview-row"><span>Northstar Labs</span><strong>82% ready</strong></li>',
          '<li class="preview-row"><span>Juniper Studio</span><strong>14 pages migrated</strong></li>',
          '<li class="preview-row"><span>Inquiry routing</span><strong>Live</strong></li>',
          '</ul><button>Open preview</button></aside></section>',
          '<section id="features" class="proof"><article><h2>Features</h2><p>Three reusable project sections with real client names.</p></article>',
          '<article><h2>Testimonials</h2><p>Quotes from Mina Chen and Northstar Labs.</p></article>',
          '<article><h2>Pricing</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></article></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-product-preview-detail')
    })
    it('flags abstract decorative visuals used as the primary visual anchor', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '*,*::before,*::after{box-sizing:border-box}',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
          '.hero-visual.abstract-orbs { border: 1px solid var(--border); padding: 16px; }',
          '.proof { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { .hero, .proof { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#features">Features</a><a href="#pricing">Pricing</a></nav></header><main>',
          '<section class="hero"><div><h1>Portfolio website builder for boutique studios</h1>',
          '<p>Launch a marketing site with case studies, pricing plans, and testimonials for the Aria Studio team by Jun 18.</p>',
          '<a href="#pricing" role="button">Book a demo</a></div>',
          '<figure class="hero-visual abstract-orbs" aria-label="Abstract gradient orb decoration">',
          '<svg viewBox="0 0 360 260" role="img" aria-label="Decorative gradient shapes">',
          '<defs><radialGradient id="g"><stop stop-color="#0f766e"/><stop offset="1" stop-color="#60a5fa"/></radialGradient></defs>',
          '<circle cx="120" cy="110" r="88" fill="url(#g)"/><circle cx="238" cy="142" r="72" fill="#cbd5e1"/></svg></figure></section>',
          '<section id="features" class="proof"><article><h2>Features</h2><p>Three reusable project sections with real client names.</p></article>',
          '<article><h2>Testimonials</h2><p>Quotes from Mina Chen and Northstar Labs.</p></article>',
          '<article><h2>Pricing</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></article></section>',
          '</main></body></html>'
        ].join('')
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('weak-visual-anchor')
      expect(codes).not.toContain('weak-product-preview-detail')
      expect(codes).toContain('decorative-visual-anchor')
    })
    it('accepts SVG product previews with concrete labels and data', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '*,*::before,*::after{box-sizing:border-box}',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
          '.hero-visual.product-preview { border: 1px solid var(--border); padding: 16px; }',
          '.proof { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { .hero, .proof { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#features">Features</a><a href="#pricing">Pricing</a></nav></header><main>',
          '<section class="hero"><div><h1>Portfolio website builder for boutique studios</h1>',
          '<p>Launch a marketing site with case studies, pricing plans, and testimonials for the Aria Studio team by Jun 18.</p>',
          '<a href="#pricing" role="button">Book a demo</a></div>',
          '<figure class="hero-visual product-preview" aria-label="Launch dashboard preview">',
          '<svg viewBox="0 0 420 280" role="img" aria-labelledby="preview-title"><title id="preview-title">Aria launch dashboard with customer rows</title>',
          '<text x="32" y="48">Launch dashboard</text><text x="32" y="92">Northstar Labs - 82% ready</text>',
          '<text x="32" y="128">Juniper Studio - 14 pages migrated</text><text x="32" y="164">Inquiry routing - Live</text></svg></figure></section>',
          '<section id="features" class="proof"><article><h2>Features</h2><p>Three reusable project sections with real client names.</p></article>',
          '<article><h2>Testimonials</h2><p>Quotes from Mina Chen and Northstar Labs.</p></article>',
          '<article><h2>Pricing</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></article></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('decorative-visual-anchor')
    })
    it('flags landing and marketing pages without concrete trust proof', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '*,*::before,*::after{box-sizing:border-box}',
          'img { max-width: 100%; height: auto; display: block; }',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
          '.product-preview { border: 1px solid var(--border); padding: 12px; }',
          '.feature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { .hero, .feature-grid { grid-template-columns: 1fr; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#features">Features</a><a href="#pricing">Pricing</a></nav></header><main>',
          '<section class="hero"><div><h1>Portfolio website builder for boutique studios</h1>',
          '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
          '<a href="#pricing" role="button">Book a demo</a></div>',
          '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
          '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
          '<section id="features" class="feature-grid"><article><h2>Project pages</h2><p>Reusable sections for editorial launches and gallery pages.</p></article>',
          '<article><h2>Inquiry routing</h2><p>Studio requests are sorted by budget, date, and package.</p></article>',
          '<article id="pricing"><h2>Pricing plans</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></article></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-trust-proof')
    })
    it('accepts landing and marketing pages with testimonials or logo proof', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root { --surface: #f8fafc; --text: #172033; --border: #cbd5e1; --accent: #0f766e; }',
          '*,*::before,*::after{box-sizing:border-box}',
          'img { max-width: 100%; height: auto; display: block; }',
          'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
          '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
          '.product-preview { border: 1px solid var(--border); padding: 12px; }',
          '.logo-cloud { display: flex; gap: 18px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          'button:hover { filter: brightness(.96); }',
          '@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#proof">Proof</a><a href="#pricing">Pricing</a></nav></header><main>',
          '<section class="hero"><div><h1>Portfolio website builder for boutique studios</h1>',
          '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
          '<a href="#pricing" role="button">Book a demo</a></div>',
          '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
          '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
          '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
          '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
          '<section><h2>Customer story</h2><blockquote>"We launched 14 case-study pages in one week."</blockquote>',
          '<p>Mina Chen, Creative Director at Juniper Studio, reported 32% more qualified inquiries.</p></section>',
          '<section id="pricing"><h2>Pricing plans</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('weak-trust-proof')
      expect(codes).not.toContain('generic-trust-proof')
      expect(codes).not.toContain('generic-vanity-metrics')
    })
})
