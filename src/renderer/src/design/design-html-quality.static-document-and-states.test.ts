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

describe("auditDesignHtmlQuality document readiness and states", () => {
    it('flags incomplete documents, placeholder copy, and missing product-design affordances', () => {
      const findings = auditDesignHtmlQuality({
        html: '<html><head><title>Draft</title></head><body><div>Feature 1 placeholder</div></body>'
      })
      const codes = findings.map((finding) => finding.code)
  
      expect(codes).toContain('incomplete-document')
      expect(codes).toContain('missing-viewport')
      expect(codes).toContain('generic-document-title')
      expect(codes).toContain('placeholder-content')
      expect(codes).toContain('weak-responsive-rules')
      expect(codes).toContain('missing-focus-states')
      expect(codes).toContain('missing-primary-action')
    })
    it('flags complete documents that do not include a browser document title', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
          '</head>',
          '<body><main><h1>Approve vendor invoices</h1>',
          '<p>Review INV-2048 for Acme Finance before sending approvals.</p>',
          '<button>Start invoice review</button><p>Loading state, empty state, error state.</p></main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('missing-document-title')
    })
    it('accepts a complete responsive artifact with motion fallback, focus states, actions, states, and semantic regions', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<title>Vendor invoice approval workspace</title>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          'button:focus-visible { outline: 2px solid #2563eb; }',
          'button:hover { filter: brightness(.96); }',
          'button[disabled] { opacity: .55; cursor: not-allowed; }',
          '.card { transition: transform 140ms ease-out; }',
          '.status-badge { border: 1px solid #d97706; background: #fffbeb; font-weight: 700; }',
          '@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }',
          '@media (max-width: 640px) { nav { display: none; } }',
          '</style>',
          '</head>',
          '<body>',
          '<header><nav><a href="#main">Home</a></nav></header>',
          '<main id="main">',
          '<section><h1>Approve vendor invoices</h1>',
          '<p>Review INV-2048 for Acme Finance, $12,480 due Jun 18, and three overdue suppliers before sending approvals.</p>',
          '<button>Start invoice review</button><button disabled>Syncing approvals</button></section>',
          '<section><h2>Approval queue</h2><table><caption>Invoices waiting for approval</caption><thead>',
          '<tr><th scope="col">Supplier</th><th scope="col">Invoice</th><th scope="col">Amount</th><th scope="col">Status</th><th scope="col">Action</th></tr>',
          '</thead><tbody>',
          '<tr><td>Acme Finance</td><td>INV-2048</td><td>$12,480</td><td><span class="status-badge status-overdue">Overdue</span></td><td><button>Approve invoice</button></td></tr>',
          '<tr><td>Northstar Labs</td><td>INV-2051</td><td>$8,940</td><td><span class="status-badge status-pending">Pending</span></td><td><button>Open supplier detail</button></td></tr>',
          '</tbody></table></section>',
          '<section><h2>Operational states</h2><ul>',
          '<li>Skeleton rows appear while supplier invoices load from NetSuite.</li>',
          '<li>An empty queue panel invites the reviewer to import the next invoice batch.</li>',
          '<li>A retry banner explains sync failures and keeps the approve button disabled.</li>',
          '</ul></section>',
          '</main>',
          '</body>',
          '</html>'
        ].join('')
      })
  
      expect(findings).toEqual([])
    })
    it('flags first screens with a title and action but no supporting content', () => {
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
          '<h1>Approve regional launch plans</h1>',
          '<button onclick="document.body.classList.toggle(\'approved\')">Approve plan</button>',
          '<aside>Loading state, empty state, error state, disabled state.</aside>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-first-screen-hierarchy')
    })
    it('accepts first screens with supporting content near the page goal', () => {
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
          '<h1>Approve regional launch plans</h1>',
          '<p>Compare each market owner, readiness score, launch date, and budget variance before approving the next rollout.</p>',
          '<button onclick="document.body.classList.toggle(\'approved\')">Approve plan</button>',
          '<aside>Loading state, empty state, error state, disabled state.</aside>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-first-screen-hierarchy')
    })
    it('flags product screens that lack realistic domain data', () => {
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
          '<h1>Review customer renewals</h1>',
          '<p>Review account health, upcoming renewal conversations, team ownership, and next best actions before confirming the weekly plan.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button>',
          '<section><h2>Renewal focus</h2><p>Loading state, empty state, error state, disabled state.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-data-realism')
    })
    it('accepts product screens with concrete names, metrics, dates, IDs, and statuses', () => {
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
          '<h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button>',
          '<section><h2>Renewal focus</h2><p>Loading state, empty state, error state, disabled state.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-data-realism')
    })
    it('flags KPI cards that show values without timeframe, delta, target, or trend context', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.metric-card { border: 1px solid #d8dee8; padding: 16px; }',
          'button:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
          '<section><h2>Renewal scorecard</h2>',
          '<div class="metric-card"><span>At-risk ARR</span><strong>$84,200</strong></div>',
          '<div class="metric-card"><span>Open tasks</span><strong>18</strong></div>',
          '<div class="metric-card"><span>Approval rate</span><strong>64%</strong></div>',
          '</section>',
          '<section><h2>Account health sync</h2><p>Loading state, empty state, error state.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-metric-context')
    })
    it('accepts KPI cards with comparison and timeframe context', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.metric-card { border: 1px solid #d8dee8; padding: 16px; }',
          'button:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
          '<section><h2>Renewal scorecard</h2>',
          '<div class="metric-card"><span>At-risk ARR this month</span><strong>$84,200</strong><small>+8% vs last month, target $72,000</small></div>',
          '<div class="metric-card"><span>Open tasks this week</span><strong>18</strong><small>Down 4 from previous week</small></div>',
          '<div class="metric-card"><span>Approval rate Q2</span><strong>64%</strong><small>Trend ↑ toward 70% goal</small></div>',
          '</section>',
          '<section><h2>Account health sync</h2><p>Loading state, empty state, error state.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-metric-context')
    })
    it('flags KPI cards that use generic dashboard metric labels', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.metric-card { border: 1px solid #d8dee8; padding: 16px; }',
          'button:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review growth dashboard</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
          '<section><h2>Executive scorecard</h2>',
          '<div class="metric-card"><span>Revenue this month</span><strong>$84,200</strong><small>+8% vs last month, target $72,000</small></div>',
          '<div class="metric-card"><span>Users this week</span><strong>18</strong><small>Down 4 from previous week</small></div>',
          '<div class="metric-card"><span>Growth Q2</span><strong>64%</strong><small>Trend ↑ toward 70% goal</small></div>',
          '</section>',
          '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-metric-context')
      expect(findings.map((finding) => finding.code)).toContain('generic-metric-card-labels')
    })
    it('accepts KPI cards that name business objects and periods', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.metric-card { border: 1px solid #d8dee8; padding: 16px; }',
          'button:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review renewal dashboard</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
          '<section><h2>Renewal scorecard</h2>',
          '<div class="metric-card"><span>At-risk renewal ARR this month</span><strong>$84,200</strong><small>+8% vs last month, target $72,000</small></div>',
          '<div class="metric-card"><span>Open approval tasks this week</span><strong>18</strong><small>Down 4 from previous week</small></div>',
          '<div class="metric-card"><span>Account renewal approval rate Q2</span><strong>64%</strong><small>Trend ↑ toward 70% goal</small></div>',
          '</section>',
          '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('generic-metric-card-labels')
    })
    it('flags state-name laundry lists instead of real state designs', () => {
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
          '<section><h2>Renewal states</h2><p>Loading state, empty state, error state, disabled state.</p></section>',
          '<section><h2>Renewal accounts</h2><table><tbody>',
          '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr>',
          '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td>Pending</td></tr>',
          '</tbody></table></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('state-laundry-list')
    })
    it('accepts concrete UI state modules instead of state-name lists', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          'button:focus-visible { outline: 2px solid #111; }',
          'button[disabled] { opacity: .55; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button></section>',
          '<section aria-busy="true"><h2>Account health sync</h2><p>Skeleton renewal rows appear while NetSuite refreshes.</p><button disabled>Syncing accounts</button></section>',
          '<section role="alert"><h2>Retry failed sync</h2><p>Acme Finance failed to update at 09:24; retry keeps approval locked until records match.</p><button onclick="document.body.classList.toggle(\'retrying\')">Retry NetSuite sync</button></section>',
          '<section><h2>Renewal accounts</h2><table><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('state-laundry-list')
    })
    it('flags recoverable empty or error states without a clear next action', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.empty-state { border: 1px solid #d8dee8; padding: 24px; }',
          'button:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button></section>',
          '<section class="empty-state"><h2>No renewal records yet</h2>',
          '<p>Connect Salesforce or import a CSV before the team can review customer renewal risk.</p></section>',
          '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-state-recovery-action')
    })
    it('accepts recoverable states with visible recovery actions', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.empty-state { border: 1px solid #d8dee8; padding: 24px; }',
          'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button></section>',
          '<section class="empty-state"><h2>No renewal records yet</h2>',
          '<p>Connect Salesforce or import a CSV before the team can review customer renewal risk.</p>',
          '<button onclick="document.body.classList.toggle(\'connecting\')">Connect Salesforce</button>',
          '<a href="#main">Return to approval queue</a></section>',
          '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-state-recovery-action')
    })
    it('flags recoverable states with generic empty or error copy', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.empty-state { border: 1px solid #d8dee8; padding: 24px; }',
          'button:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button></section>',
          '<section class="empty-state"><h2>No data yet</h2>',
          '<p>Nothing to show here. Try again later.</p>',
          '<button onclick="document.body.classList.toggle(\'creating\')">Create new</button></section>',
          '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('weak-state-recovery-action')
      expect(findings.map((finding) => finding.code)).toContain('generic-recoverable-state-copy')
    })
    it('accepts recoverable states with object-specific copy and next steps', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.empty-state { border: 1px solid #d8dee8; padding: 24px; }',
          'button:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button></section>',
          '<section class="empty-state"><h2>No renewal records yet</h2>',
          '<p>Connect Salesforce or import a CSV before the team can review customer renewal risk.</p>',
          '<button onclick="document.body.classList.toggle(\'connecting\')">Connect Salesforce</button></section>',
          '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('generic-recoverable-state-copy')
    })
    it('flags generic toast, alert, banner, and inline feedback copy', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.toast { border: 1px solid #0f766e; padding: 12px; }',
          'button:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
          '<div class="toast toast-success" role="status" aria-live="polite">Saved</div>',
          '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('generic-feedback-message-copy')
    })
    it('accepts feedback copy with the object, result, and next step', () => {
      const findings = auditDesignHtmlQuality({
        html: [
          '<!doctype html>',
          '<html lang="en">',
          '<head>',
          '<meta name="viewport" content="width=device-width, initial-scale=1">',
          '<style>',
          'main { font-size: clamp(16px, 2vw, 20px); }',
          '.toast { border: 1px solid #0f766e; padding: 12px; }',
          'button:focus-visible { outline: 2px solid #111; }',
          '@media (max-width: 640px) { main { padding: 16px; } }',
          '</style>',
          '</head>',
          '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
          '<section><h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
          '<div class="toast toast-success" role="status" aria-live="polite">Acme Finance renewal plan saved. Assign an owner before the Jun 18 review.</div>',
          '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).not.toContain('generic-feedback-message-copy')
    })
    it('flags shallow pages without enough meaningful content modules', () => {
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
          '<h1>Review customer renewals</h1>',
          '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
          '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button>',
          '<p>Loading state, empty state, error state, disabled state.</p>',
          '</main></body></html>'
        ].join('')
      })
  
      expect(findings.map((finding) => finding.code)).toContain('weak-content-depth')
    })
})
