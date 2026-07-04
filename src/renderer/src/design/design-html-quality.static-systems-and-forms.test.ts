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

describe("auditDesignHtmlQuality systems and forms", () => {
    it('flags palettes dominated by a single hue family even when colors are tokenized', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root{--canvas:#0f172a;--surface:#111c33;--panel:#1e293b;--border:#334155;--muted:#64748b;--text:#e0f2fe;--accent:#0ea5e9;--accent-2:#38bdf8;--chip:#bae6fd;--glow:#075985}',
          'body{background:var(--canvas);color:var(--text)}',
          '.hero{background:var(--surface);border:1px solid var(--border)}',
          '.primary{background:var(--accent);color:var(--canvas)}',
          '.chip{background:var(--chip);color:var(--glow)}',
          'button:focus-visible{outline:2px solid var(--accent-2)}',
          'button:hover{filter:brightness(1.08)}',
          'button[disabled]{opacity:.55}',
          '@media(max-width:640px){main{padding:16px}}',
          '</style></head><body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section class="hero"><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button class="primary" onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button><button disabled>Syncing accounts</button></section>',
          '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td><span class="chip">At risk</span></td></tr></tbody></table></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('one-note-palette')
    })
    it('accepts palettes with neutral roles and distinct semantic accents', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root{--canvas:#f8fafc;--surface:#ffffff;--text:#0f172a;--muted:#64748b;--border:#cbd5e1;--accent:#0f766e;--warning:#f59e0b;--danger:#dc2626;--info:#2563eb;--success:#16a34a}',
          'body{background:var(--canvas);color:var(--text)}',
          '.hero{background:var(--surface);border:1px solid var(--border)}',
          '.primary{background:var(--accent);color:var(--surface)}',
          '.warning{color:var(--warning)}.danger{color:var(--danger)}.info{color:var(--info)}',
          'button:focus-visible{outline:2px solid var(--info)}',
          'button:hover{filter:brightness(.96)}',
          'button[disabled]{opacity:.55}',
          '@media(max-width:640px){main{padding:16px}}',
          '</style></head><body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section class="hero"><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button class="primary" onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button><button disabled>Syncing accounts</button></section>',
          '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td class="warning">At risk</td></tr></tbody></table></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('one-note-palette')
    })
    it('flags uniform 16px-everywhere spacing without a spacing scale', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main{font-size:clamp(16px,2vw,20px);padding:16px}',
          '.hero{padding:16px;margin:16px;gap:16px}',
          '.toolbar{padding:16px;gap:16px}',
          '.row{margin-bottom:16px;gap:16px}',
          '.panel{padding:16px}',
          'button:focus-visible{outline:2px solid #111}',
          'button:hover{filter:brightness(.96)}',
          'button[disabled]{opacity:.55}',
          '@media(max-width:640px){main{padding:16px}}',
          '</style></head><body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section class="hero"><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button><button disabled>Syncing accounts</button></section>',
          '<section class="panel"><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-spacing-system')
    })
    it('accepts tokenized spacing scales with varied rhythm', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          ':root{--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-6:24px;--space-8:32px}',
          'main{font-size:clamp(16px,2vw,20px);padding:var(--space-8)}',
          '.hero{padding:var(--space-8);margin-bottom:var(--space-6);gap:var(--space-4)}',
          '.toolbar{padding:var(--space-3);gap:var(--space-2)}',
          '.row{margin-bottom:var(--space-3);gap:var(--space-4)}',
          '.panel{padding:var(--space-6)}',
          'button:focus-visible{outline:2px solid #111}',
          'button:hover{filter:brightness(.96)}',
          'button[disabled]{opacity:.55}',
          '@media(max-width:640px){main{padding:var(--space-4)}}',
          '</style></head><body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section class="hero"><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button><button disabled>Syncing accounts</button></section>',
          '<section class="panel"><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-spacing-system')
    })
    it('flags visual media pages without a layout reset and fluid media constraints', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main{font-size:clamp(16px,2vw,20px);padding:32px}',
          '.profile{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:24px}',
          '.portrait{width:520px;border-radius:20px}',
          'button:focus-visible{outline:2px solid #111}',
          'button:hover{filter:brightness(.96)}',
          'button[disabled]{opacity:.55}',
          '@media(max-width:640px){.profile{grid-template-columns:1fr}main{padding:16px}}',
          '</style></head><body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section class="profile"><div><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button><button disabled>Syncing accounts</button></div>',
          '<img class="portrait" src=".kun-design/assets/customer.png" alt="Portrait of Mina Chen"></section>',
          '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('missing-layout-reset')
    })
    it('accepts visual media pages with a global reset and fluid media rules', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          '*,*::before,*::after{box-sizing:border-box}',
          'img,video,iframe,canvas,svg{max-width:100%;height:auto;display:block}',
          'main{font-size:clamp(16px,2vw,20px);padding:32px}',
          '.profile{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,360px);gap:24px}',
          '.profile>*{min-width:0}',
          '.portrait{width:100%;border-radius:20px}',
          'button:focus-visible{outline:2px solid #111}',
          'button:hover{filter:brightness(.96)}',
          'button[disabled]{opacity:.55}',
          '@media(max-width:640px){.profile{grid-template-columns:1fr}main{padding:16px}}',
          '</style></head><body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section class="profile"><div><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button><button disabled>Syncing accounts</button></div>',
          '<img class="portrait" src=".kun-design/assets/customer.png" alt="Portrait of Mina Chen"></section>',
          '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
          '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
          '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('missing-layout-reset')
    })
    it('flags dead anchors and visual-only controls without behavior', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><a href="#">Pricing</a><button>Start project</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).toContain('dead-link-targets')
      expect(codes).toContain('missing-interaction-behavior')
    })
    it('accepts scripted controls and valid section anchors as real interactions', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><a href="#main">Skip</a></header><main id="main">',
          '<button id="save">Save changes</button><p>Loading state, empty state, error state.</p></main>',
          '<script>document.getElementById("save").addEventListener("click", function(){ document.body.classList.toggle("saved") })</script>',
          '</body></html>'
        ].join('')
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('dead-link-targets')
      expect(codes).not.toContain('missing-interaction-behavior')
    })
    it('accepts Back controls that use prototype-player history handlers', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Project details</h1><a href="#" onclick="history.back()">Back</a>',
          '<button onclick="window.history.go(-1)">Previous step</button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('dead-link-targets')
      expect(codes).not.toContain('missing-interaction-behavior')
    })
    it('flags form fields that rely only on placeholders', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,input:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Join waitlist</h1><form><input placeholder="Email address"><button>Join</button></form>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('missing-form-labels')
    })
    it('flags forms without submit destinations or local feedback', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,input:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Join vendor review</h1><form><label for="email">Email</label>',
          '<input id="email"><button>Join</button></form>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('inert-form-submission')
    })
    it('accepts forms with action targets or scripted submit feedback', () => {
      const withAction = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,input:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Join vendor review</h1><form action="/signup"><label for="email">Email</label>',
          '<input id="email"><button>Join</button></form>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
      const withScript = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,input:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Join vendor review</h1><form id="signup"><label for="email">Email</label>',
          '<input id="email"><button>Join</button></form>',
          '<p>Loading state, empty state, error state.</p></main>',
          '<script>document.getElementById("signup").addEventListener("submit", function(event){ event.preventDefault(); document.body.classList.add("sent") })</script>',
          '</body></html>'
        ].join('')
      })
  
      expect(withAction.map((finding) => finding.code)).not.toContain('inert-form-submission')
      expect(withScript.map((finding) => finding.code)).not.toContain('inert-form-submission')
    })
    it('accepts form prototype targets intercepted by the player', () => {
      const formTarget = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,input:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Create workspace</h1><form data-prototype-target="Dashboard"><label for="email">Email</label>',
          '<input id="email"><button>Create workspace</button></form>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
      const submitterTarget = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,input:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Create workspace</h1><form><label for="team">Team</label>',
          '<input id="team"><button type="submit" data-href="../dashboard/v1.html">Create workspace</button></form>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(formTarget.map((finding) => finding.code)).not.toContain('inert-form-submission')
      expect(submitterTarget.map((finding) => finding.code)).not.toContain('inert-form-submission')
    })
    it('accepts visible and accessible form labels', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Account setup</h1><form>',
          '<label for="email">Email</label><input id="email" placeholder="you@example.com">',
          '<select aria-label="Plan"><option>Pro</option></select><button>Create account</button>',
          '</form><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('missing-form-labels')
    })
    it('flags multi-field forms without helper, required, or validation affordances', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Account setup</h1><form action="/account">',
          '<label for="email">Email</label><input id="email">',
          '<label for="company">Company</label><input id="company">',
          '<label for="plan">Plan</label><select id="plan"><option>Pro</option></select>',
          '<button>Create account</button></form><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-form-affordance')
    })
    it('accepts multi-field forms with helper text and validation affordances', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Account setup</h1><form action="/account">',
          '<label for="email">Email <span>Required</span></label><input id="email" required aria-describedby="email-help">',
          '<p id="email-help">Use your work email so renewal alerts reach the right owner.</p>',
          '<label for="company">Company</label><input id="company" aria-describedby="company-help">',
          '<p id="company-help">Optional if your workspace already has company data.</p>',
          '<label for="plan">Plan</label><select id="plan"><option>Pro</option></select>',
          '<p role="alert">Error state: show a clear validation message before retrying.</p>',
          '<button>Create account</button></form><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-form-affordance')
    })
    it('flags marketing lead forms without loading, success, and error feedback states', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          '*,*::before,*::after{box-sizing:border-box}img{max-width:100%;height:auto}button:focus-visible,input:focus-visible{outline:2px solid #000}',
          '.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,420px);gap:32px}.site-nav,.logo-cloud{display:flex;gap:16px}.demo-form{display:grid;gap:12px}',
          '@media(max-width:640px){.hero{grid-template-columns:1fr}.site-nav,.logo-cloud{flex-wrap:wrap}}',
          '</style></head><body><header><nav class="site-nav"><a href="#top">FieldOps</a><a href="#demo">Book a demo</a></nav></header>',
          '<main id="top"><section class="hero"><div><h1>Marketing site for field dispatch software</h1>',
          '<p>FieldOps helps service teams route urgent jobs, sync crew notes, and reduce missed handoffs before the morning standup.</p>',
          '<a href="#demo" role="button">Book a dispatch demo</a></div>',
          '<figure class="product-preview"><img src=".kun-design/assets/dispatch.png" alt="FieldOps dispatch dashboard preview">',
          '<figcaption>Dispatch dashboard preview with crew load, route risk, and service alerts.</figcaption></figure></section>',
          '<section class="feature-section"><h2>Core capabilities</h2><article class="feature-card"><h3>Live routing</h3><p>Route emergency jobs by crew capacity and SLA window.</p></article><article class="feature-card"><h3>Handoff sync</h3><p>Sync technician notes and approval history into one workflow.</p></article></section>',
          '<section class="logo-cloud" aria-label="Trusted by service teams"><span>Harbor HVAC</span><span>Northline Utilities</span><span>Civic Repair Co.</span></section>',
          '<section id="demo"><h2>Book a demo</h2><form class="demo-form" action="/demo">',
          '<label for="email">Work email <span>Required</span></label><input id="email" name="email" type="email" required aria-describedby="email-help">',
          '<p id="email-help">Use your work email so the dispatch audit reaches the right owner.</p>',
          '<label for="company">Company</label><input id="company" name="company">',
          '<button>Schedule demo</button></form></section>',
          '</main><footer class="site-footer"><p>Contact support@fieldops.example for implementation help.</p><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-lead-form-response')
    })
    it('accepts marketing lead forms with loading, success, and error feedback states', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          '*,*::before,*::after{box-sizing:border-box}img{max-width:100%;height:auto}button:focus-visible,input:focus-visible{outline:2px solid #000}',
          '.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,420px);gap:32px}.site-nav,.logo-cloud{display:flex;gap:16px}.demo-form{display:grid;gap:12px}',
          '.form-loading,.form-success,.form-error{border:1px solid currentColor;padding:8px}',
          '@media(max-width:640px){.hero{grid-template-columns:1fr}.site-nav,.logo-cloud{flex-wrap:wrap}}',
          '</style></head><body><header><nav class="site-nav"><a href="#top">FieldOps</a><a href="#demo">Book a demo</a></nav></header>',
          '<main id="top"><section class="hero"><div><h1>Marketing site for field dispatch software</h1>',
          '<p>FieldOps helps service teams route urgent jobs, sync crew notes, and reduce missed handoffs before the morning standup.</p>',
          '<a href="#demo" role="button">Book a dispatch demo</a></div>',
          '<figure class="product-preview"><img src=".kun-design/assets/dispatch.png" alt="FieldOps dispatch dashboard preview">',
          '<figcaption>Dispatch dashboard preview with crew load, route risk, and service alerts.</figcaption></figure></section>',
          '<section class="feature-section"><h2>Core capabilities</h2><article class="feature-card"><h3>Live routing</h3><p>Route emergency jobs by crew capacity and SLA window.</p></article><article class="feature-card"><h3>Handoff sync</h3><p>Sync technician notes and approval history into one workflow.</p></article></section>',
          '<section class="logo-cloud" aria-label="Trusted by service teams"><span>Harbor HVAC</span><span>Northline Utilities</span><span>Civic Repair Co.</span></section>',
          '<section id="demo"><h2>Book a demo</h2><form class="demo-form" action="/demo">',
          '<label for="email">Work email <span>Required</span></label><input id="email" name="email" type="email" required aria-describedby="email-help">',
          '<p id="email-help">Use your work email so the dispatch audit reaches the right owner.</p>',
          '<label for="company">Company</label><input id="company" name="company">',
          '<button>Schedule demo</button></form>',
          '<p class="form-loading" aria-live="polite">Submitting demo request...</p>',
          '<p class="form-success" role="status">Request received. We will be in touch within 24 hours.</p>',
          '<p class="form-error" role="alert">Please enter a work email before submitting.</p></section>',
          '</main><footer class="site-footer"><p>Contact support@fieldops.example for implementation help.</p><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-lead-form-response')
    })
    it('flags lead forms with generic field labels', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          '*,*::before,*::after{box-sizing:border-box}img{max-width:100%;height:auto}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #000}',
          '.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,420px);gap:32px}.demo-form{display:grid;gap:12px}.form-loading,.form-success,.form-error{border:1px solid currentColor;padding:8px}',
          '@media(max-width:640px){.hero{grid-template-columns:1fr}}',
          '</style></head><body><header><nav><a href="#top">FieldOps</a><a href="#demo">Book a demo</a></nav></header>',
          '<main id="top"><section class="hero"><div><h1>FieldOps dispatch demo</h1>',
          '<p>Book a demo to review crew handoff gaps, route risk, and SLA windows across urgent service jobs.</p>',
          '<a href="#demo" role="button">Request dispatch audit</a></div>',
          '<figure><img src=".kun-design/assets/dispatch.png" alt="FieldOps dispatch dashboard with crew load and SLA risk"><figcaption>Dispatch dashboard preview.</figcaption></figure></section>',
          '<section><h2>Dispatch teams trust FieldOps</h2><p>Harbor HVAC reduced missed emergency handoffs by 18% during the first two weeks.</p></section>',
          '<section id="demo"><h2>Book a dispatch demo</h2><form class="demo-form" action="/demo">',
          '<label for="name">Name <span>Required</span></label><input id="name" name="name" required aria-describedby="name-help"><p id="name-help">Required contact field.</p>',
          '<label for="email">Email <span>Required</span></label><input id="email" name="email" type="email" required aria-describedby="email-help"><p id="email-help">Required contact field.</p>',
          '<label for="message">Message</label><textarea id="message" name="message" aria-describedby="message-help"></textarea><p id="message-help">Optional context for the team.</p>',
          '<button>Request demo</button></form>',
          '<p class="form-loading" aria-live="polite">Submitting demo request...</p>',
          '<p class="form-success" role="status">Request received. We will be in touch within 24 hours.</p>',
          '<p class="form-error" role="alert">Please enter a valid work email before submitting.</p></section>',
          '</main><footer><p>Contact support@fieldops.example for implementation help.</p><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('generic-form-field-labels')
    })
    it('accepts lead forms with domain-specific field labels', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          '*,*::before,*::after{box-sizing:border-box}img{max-width:100%;height:auto}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #000}',
          '.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,420px);gap:32px}.demo-form{display:grid;gap:12px}.form-loading,.form-success,.form-error{border:1px solid currentColor;padding:8px}',
          '@media(max-width:640px){.hero{grid-template-columns:1fr}}',
          '</style></head><body><header><nav><a href="#top">FieldOps</a><a href="#demo">Book a demo</a></nav></header>',
          '<main id="top"><section class="hero"><div><h1>FieldOps dispatch demo</h1>',
          '<p>Book a demo to review crew handoff gaps, route risk, and SLA windows across urgent service jobs.</p>',
          '<a href="#demo" role="button">Request dispatch audit</a></div>',
          '<figure><img src=".kun-design/assets/dispatch.png" alt="FieldOps dispatch dashboard with crew load and SLA risk"><figcaption>Dispatch dashboard preview.</figcaption></figure></section>',
          '<section><h2>Dispatch teams trust FieldOps</h2><p>Harbor HVAC reduced missed emergency handoffs by 18% during the first two weeks.</p></section>',
          '<section id="demo"><h2>Book a dispatch demo</h2><form class="demo-form" action="/demo">',
          '<label for="work-email">Work email <span>Required</span></label><input id="work-email" name="work_email" type="email" required aria-describedby="email-help"><p id="email-help">Use the address that receives dispatch escalation alerts.</p>',
          '<label for="domain">Company domain</label><input id="domain" name="company_domain" aria-describedby="domain-help"><p id="domain-help">Helps us prefill your dispatch workspace.</p>',
          '<label for="team-size">Team size</label><select id="team-size" name="team_size" aria-describedby="team-help"><option>12-30 field technicians</option></select><p id="team-help">Used to size the route-risk walkthrough.</p>',
          '<label for="timeline">Launch timeline</label><input id="timeline" name="launch_timeline" aria-describedby="timeline-help"><p id="timeline-help">For example, before the July maintenance window.</p>',
          '<label for="volume">Dispatch volume</label><input id="volume" name="dispatch_volume" aria-describedby="volume-help"><p id="volume-help">Weekly urgent jobs or SLA-bound requests.</p>',
          '<label for="use-case">Use case</label><textarea id="use-case" name="use_case" aria-describedby="use-case-help"></textarea><p id="use-case-help">Tell us which handoff or routing workflow to audit.</p>',
          '<button>Request dispatch audit</button></form>',
          '<p class="form-loading" aria-live="polite">Submitting dispatch audit request...</p>',
          '<p class="form-success" role="status">Request received. A dispatch specialist will send a route-risk agenda within 24 hours.</p>',
          '<p class="form-error" role="alert">Please enter a work email and team size before submitting.</p></section>',
          '</main><footer><p>Contact support@fieldops.example for implementation help.</p><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('generic-form-field-labels')
    })
    it('flags settings controls with generic toggle and checkbox labels', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.settings-panel { border: 1px solid #d8dee8; padding: 20px; display: grid; gap: 12px; }',
          'button:focus-visible,input:focus-visible { outline: 2px solid #111; }',
          '@media(max-width:640px){main{padding:16px}}',
          '</style></head><body><header><nav><a href="#settings">Workspace settings</a></nav></header><main id="settings">',
          '<section><h1>Workspace notification settings</h1>',
          '<p>Mina Chen manages Acme Finance renewal RN-2048 alerts, $84,200 ARR risk, and vendor SLA routing from this workspace.</p>',
          '<button onclick="document.body.classList.toggle(\'saved\')">Save notification routing</button></section>',
          '<section class="settings-panel"><h2>Notification settings</h2>',
          '<label><input type="checkbox" checked> Notifications</label>',
          '<label><input type="checkbox"> Email alerts</label>',
          '<label><input type="checkbox"> Updates</label>',
          '</section>',
          '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('generic-settings-control-labels')
    })
    it('accepts settings controls that name the object and effect', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.settings-panel { border: 1px solid #d8dee8; padding: 20px; display: grid; gap: 12px; }',
          'button:focus-visible,input:focus-visible { outline: 2px solid #111; }',
          '@media(max-width:640px){main{padding:16px}}',
          '</style></head><body><header><nav><a href="#settings">Workspace settings</a></nav></header><main id="settings">',
          '<section><h1>Workspace notification settings</h1>',
          '<p>Mina Chen manages Acme Finance renewal RN-2048 alerts, $84,200 ARR risk, and vendor SLA routing from this workspace.</p>',
          '<button onclick="document.body.classList.toggle(\'saved\')">Save notification routing</button></section>',
          '<section class="settings-panel"><h2>Renewal alert routing</h2>',
          '<label><input type="checkbox" checked> Alert renewal owners when ARR risk increases</label>',
          '<label><input type="checkbox"> Send invoice approval digest to finance leads</label>',
          '<label><input type="checkbox"> Escalate vendor SLA breaches to workspace admins</label>',
          '</section>',
          '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('generic-settings-control-labels')
    })
    it('flags icon-only controls without accessible names', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible,a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><header><a href="#main"><span class="icon"></span></a></header><main id="main">',
          '<button onclick="document.body.classList.toggle(\'menu-open\')"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12"/></svg></button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('unnamed-icon-controls')
    })
    it('accepts named icon-only controls', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'button:focus-visible,a:focus-visible{outline:2px solid #000}',
          '.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}',
          '@media(max-width:640px){main{padding:16px}}',
          '</style></head><body><header><a href="#main"><span class="sr-only">Skip to content</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12"/></svg></a></header>',
          '<main id="main"><button aria-label="Open navigation"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12"/></svg></button>',
          '<p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('unnamed-icon-controls')
    })
    it('flags images with missing sources or missing accessible descriptions', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Customer profile</h1>',
          '<img src="" alt="Account hero"><img src=".kun-design/assets/customer.png">',
          '<button>Review account</button><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).toContain('missing-image-source')
      expect(codes).toContain('missing-image-alt')
    })
    it('flags generic image alt text on non-decorative images', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head><body><main><h1>Customer profile</h1>',
          '<img src=".kun-design/assets/customer.png" alt="Image">',
          '<img src=".kun-design/assets/dashboard.png" alt="Product screenshot">',
          '<button>Review account</button><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).not.toContain('missing-image-alt')
      expect(codes).toContain('generic-image-alt')
    })
})
