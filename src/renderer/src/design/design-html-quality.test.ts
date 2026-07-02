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

describe('auditDesignHtmlQuality', () => {
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

  it('flags trust proof sections that use generic logo placeholders', () => {
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
        '.logo-cloud { display: flex; gap: 18px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#demo">Demo</a></nav></header><main>',
        '<section class="hero"><div><h1>Field dispatch software for regional service teams</h1>',
        '<p>OpsPilot routes urgent jobs, syncs dispatch notes, and helps supervisors track SLA risk before morning standup.</p>',
        '<a href="#demo" role="button">Book a dispatch demo</a></div></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by field service customers">',
        '<span>Logo 1</span><span>Company A</span><span>Client B</span></section>',
        '<section id="demo"><h2>Book an operations review</h2><p>See routing performance for 24 crews and 312 open work orders.</p></section>',
        '<p>Loading state, empty state, error state.</p></main></body></html>'
      ].join('')
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('weak-trust-proof')
    expect(codes).toContain('generic-trust-proof')
  })

  it('flags proof metrics that rely on generic vanity claims', () => {
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
        '.impact-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero, .impact-stats { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#demo">Demo</a></nav></header><main>',
        '<section class="hero"><div><h1>Field dispatch software for regional service teams</h1>',
        '<p>OpsPilot routes urgent jobs, syncs dispatch notes, and helps supervisors track SLA risk before morning standup.</p>',
        '<a href="#demo" role="button">Book a dispatch demo</a></div></section>',
        '<section id="proof" class="impact-stats proof" aria-label="Customer proof metrics">',
        '<article><strong>99% satisfaction</strong><p>Happy customers across every team.</p></article>',
        '<article><strong>10x faster</strong><p>Productivity boost for modern crews.</p></article>',
        '<article><strong>1M+ users</strong><p>Trusted worldwide.</p></article></section>',
        '<section id="demo"><h2>Book an operations review</h2><p>See routing performance for 24 crews and 312 open work orders.</p></section>',
        '</main></body></html>'
      ].join('')
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('weak-trust-proof')
    expect(codes).toContain('generic-vanity-metrics')
  })

  it('accepts proof metrics with customer, timeframe, or benchmark context', () => {
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
        '.impact-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero, .impact-stats { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#demo">Demo</a></nav></header><main>',
        '<section class="hero"><div><h1>Field dispatch software for regional service teams</h1>',
        '<p>OpsPilot routes urgent jobs, syncs dispatch notes, and helps supervisors track SLA risk before morning standup.</p>',
        '<a href="#demo" role="button">Book a dispatch demo</a></div></section>',
        '<section id="proof" class="impact-stats proof" aria-label="Customer proof metrics">',
        '<article><strong>99% dispatch approval after Harbor HVAC pilot</strong><p>Measured across 42 emergency jobs in Q2.</p></article>',
        '<article><strong>10x faster triage versus spreadsheet baseline</strong><p>Northstar Field cut morning sorting from 50 minutes to five.</p></article>',
        '<article><strong>24/7 support coverage for Q2 migration weekend</strong><p>Two rollout specialists handled 18 branch teams.</p></article></section>',
        '<section id="demo"><h2>Book an operations review</h2><p>See routing performance for 24 crews and 312 open work orders.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('generic-vanity-metrics')
  })

  it('flags testimonials without named attribution or outcome context', () => {
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
        '.testimonial { border: 1px solid var(--border); padding: 20px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#pricing">Pricing</a></nav></header><main>',
        '<section class="hero"><div><h1>Portfolio website builder for boutique studios</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Book a demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="testimonial"><h2>Customer proof</h2><blockquote>"We launched our studio portfolio in one week and finally had a clear inquiry path."</blockquote></section>',
        '<section id="pricing"><h2>Pricing plans</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-testimonial-attribution')
  })

  it('accepts testimonials with named source, role, company, and outcome context', () => {
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
        '.testimonial { border: 1px solid var(--border); padding: 20px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#pricing">Pricing</a></nav></header><main>',
        '<section class="hero"><div><h1>Portfolio website builder for boutique studios</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Book a demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="testimonial"><h2>Customer proof</h2><blockquote>"We launched 14 case-study pages in one week and increased qualified inquiries by 32%."</blockquote>',
        '<p>Mina Chen, Creative Director at Juniper Studio</p></section>',
        '<section id="pricing"><h2>Pricing plans</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-testimonial-attribution')
    expect(findings.map((finding) => finding.code)).not.toContain('generic-testimonial-copy')
  })

  it('flags testimonials with named sources but generic praise copy', () => {
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
        '.testimonial { border: 1px solid var(--border); padding: 20px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#pricing">Pricing</a></nav></header><main>',
        '<section class="hero"><div><h1>Portfolio website builder for boutique studios</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Book a demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof"><h2>Customer proof</h2><article class="testimonial">',
        '<p>"Amazing product. It changed everything for our team and we highly recommend it."</p>',
        '<p>Mina Chen, Creative Director at Juniper Studio</p></article></section>',
        '<section id="pricing"><h2>Pricing plans</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-testimonial-attribution')
    expect(findings.map((finding) => finding.code)).toContain('generic-testimonial-copy')
  })

  it('flags pricing pages without complete plan comparison structure', () => {
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
        '<section class="hero"><div><h1>Pricing page for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Book a demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><p>Starter plan $49, Studio plan $129, Agency plan $249.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-pricing-structure')
  })

  it('accepts pricing pages with plan cards, cadence, recommendation, and plan CTAs', () => {
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
        '.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.pricing-card { border: 1px solid var(--border); padding: 20px; }',
        '.recommended { border-color: var(--accent); }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .hero, .pricing-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#pricing">Pricing</a></nav></header><main>',
        '<section class="hero"><div><h1>Pricing page for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Compare plans</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><div class="pricing-grid">',
        '<article class="pricing-card plan"><h3>Starter</h3><p>$49 / month</p><p>Includes 3 project pages, email support, and 1 workspace.</p><a href="#signup" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan recommended"><p>Recommended for studio teams</p><h3>Studio</h3><p>$129 / month</p><p>Includes unlimited projects, gallery analytics, and priority support.</p><a href="#trial" role="button">Start trial</a></article>',
        '<article class="pricing-card plan"><h3>Agency</h3><p>$249 / month</p><p>Includes client workspaces, SSO, audit log, and launch support.</p><a href="#sales" role="button">Contact sales</a></article>',
        '</div></section>',
        '</main></body></html>'
      ].join('')
    })

    const codes = findings.map((finding) => finding.code)
    expect(codes).not.toContain('weak-pricing-structure')
    expect(codes).not.toContain('generic-pricing-plan-detail')
    expect(codes).not.toContain('generic-pricing-plan-action-labels')
  })

  it('flags pricing plan cards that use generic filler instead of concrete differences', () => {
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
        '.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.pricing-card { border: 1px solid var(--border); padding: 20px; }',
        '.recommended { border-color: var(--accent); }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero, .pricing-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#pricing">Pricing</a></nav></header><main>',
        '<section class="hero"><div><h1>Pricing page for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Compare plans</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><div class="pricing-grid">',
        '<article class="pricing-card plan"><h3>Starter</h3><p>$49 / month</p><p>All core features for growing teams.</p><a href="#signup" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan recommended"><p>Recommended for teams</p><h3>Studio</h3><p>$129 / month</p><p>Everything you need to scale with confidence.</p><a href="#trial" role="button">Start trial</a></article>',
        '<article class="pricing-card plan"><h3>Agency</h3><p>Contact sales</p><p>Priority support and custom support for business growth.</p><a href="#sales" role="button">Contact sales</a></article>',
        '</div></section>',
        '</main></body></html>'
      ].join('')
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('weak-pricing-structure')
    expect(codes).toContain('generic-pricing-plan-detail')
  })

  it('flags pricing plan cards that repeat the same generic action label', () => {
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
        '.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.pricing-card { border: 1px solid var(--border); padding: 20px; }',
        '.recommended { border-color: var(--accent); }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero, .pricing-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#pricing">Pricing</a></nav></header><main>',
        '<section class="hero"><div><h1>Pricing page for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Compare plans</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><div class="pricing-grid">',
        '<article class="pricing-card plan"><h3>Starter</h3><p>$49 / month</p><p>Includes 3 project pages, email support, and 1 workspace.</p><a href="#signup" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan recommended"><p>Recommended for studio teams</p><h3>Studio</h3><p>$129 / month</p><p>Includes unlimited projects, gallery analytics, and priority support.</p><a href="#trial" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan"><h3>Agency</h3><p>$249 / month</p><p>Includes client workspaces, SSO, audit log, and launch support.</p><a href="#sales" role="button">Choose plan</a></article>',
        '</div></section>',
        '</main></body></html>'
      ].join('')
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('weak-pricing-structure')
    expect(codes).not.toContain('generic-pricing-plan-detail')
    expect(codes).toContain('generic-pricing-plan-action-labels')
  })

  it('flags marketing pages without concrete feature or benefit anatomy', () => {
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
        '.site-nav, .site-footer { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav, .site-footer, .logo-cloud { flex-wrap: wrap; } .hero { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="OpsPilot">',
        '<a class="wordmark" href="#top">OpsPilot</a><a href="#proof">Customers</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Marketing site for field operations software</h1>',
        '<p>OpsPilot helps regional service teams route urgent jobs, sync dispatch notes, and keep supervisors aligned before the morning standup.</p>',
        '<a href="#demo" role="button">Book a dispatch demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/opspilot-dispatch.png" alt="OpsPilot dispatch board preview">',
        '<figcaption>Dispatch board preview with job routes, crew capacity, and service alerts.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by field service teams">',
        '<span>Harbor HVAC</span><span>Northline Utilities</span><span>Civic Repair Co.</span></section>',
        '<section class="testimonial"><blockquote>OpsPilot reduced missed handoffs by 31% in one quarter for Harbor HVAC.</blockquote></section>',
        '<section id="demo" class="final-cta"><h2>Ready to tighten dispatch handoffs?</h2><p>Book a demo and get a crew routing audit within 48 hours.</p><a href="/demo" role="button">Schedule demo</a></section>',
        '</main><footer class="site-footer" aria-label="OpsPilot footer">',
        '<p>OpsPilot field operations software. Contact support@opspilot.example for implementation help.</p>',
        '<nav class="footer-links" aria-label="Footer links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/status">Status</a></nav>',
        '<p>Copyright 2026 OpsPilot. All rights reserved.</p>',
        '</footer></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-feature-anatomy')
  })

  it('accepts marketing pages with concrete feature and benefit anatomy', () => {
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
        '.site-nav, .site-footer { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview, .feature-card { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.feature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav, .site-footer, .logo-cloud { flex-wrap: wrap; } .hero, .feature-grid { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="OpsPilot">',
        '<a class="wordmark" href="#top">OpsPilot</a><a href="#capabilities">Capabilities</a><a href="#proof">Customers</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Marketing site for field operations software</h1>',
        '<p>OpsPilot helps regional service teams route urgent jobs, sync dispatch notes, and keep supervisors aligned before the morning standup.</p>',
        '<a href="#demo" role="button">Book a dispatch demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/opspilot-dispatch.png" alt="OpsPilot dispatch board preview">',
        '<figcaption>Dispatch board preview with job routes, crew capacity, and service alerts.</figcaption></figure></section>',
        '<section id="capabilities" class="feature-section"><h2>Core capabilities for dispatch teams</h2><div class="feature-grid">',
        '<article class="feature-card"><h3>Live job routing</h3><p>Route emergency work orders by crew capacity, location, SLA window, and parts availability before calls pile up.</p></article>',
        '<article class="feature-card"><h3>Supervisor dashboard</h3><p>Track late arrivals, blocked jobs, and crew utilization with shift-level insights that update during dispatch.</p></article>',
        '<article class="feature-card"><h3>Handoff sync</h3><p>Sync technician notes, customer photos, and approval history into one workflow for next-day follow-up.</p></article>',
        '</div></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by field service teams">',
        '<span>Harbor HVAC</span><span>Northline Utilities</span><span>Civic Repair Co.</span></section>',
        '<section class="testimonial"><blockquote>OpsPilot reduced missed handoffs by 31% in one quarter for Harbor HVAC.</blockquote></section>',
        '<section id="demo" class="final-cta"><h2>Ready to tighten dispatch handoffs?</h2><p>Book a demo and get a crew routing audit within 48 hours.</p><a href="/demo" role="button">Schedule demo</a></section>',
        '</main><footer class="site-footer" aria-label="OpsPilot footer">',
        '<p>OpsPilot field operations software. Contact support@opspilot.example for implementation help.</p>',
        '<nav class="footer-links" aria-label="Footer links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/status">Status</a></nav>',
        '<p>Copyright 2026 OpsPilot. All rights reserved.</p>',
        '</footer></body></html>'
      ].join('')
    })

    const codes = findings.map((finding) => finding.code)
    expect(codes).not.toContain('weak-feature-anatomy')
    expect(codes).not.toContain('generic-feature-card-detail')
  })

  it('flags marketing feature cards with generic capability copy', () => {
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
        '.site-nav, .site-footer { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview, .feature-card { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.feature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .site-nav, .site-footer, .logo-cloud { flex-wrap: wrap; } .hero, .feature-grid { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="OpsPilot">',
        '<a class="wordmark" href="#top">OpsPilot</a><a href="#capabilities">Capabilities</a><a href="#proof">Customers</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Marketing site for field operations software</h1>',
        '<p>OpsPilot helps regional service teams route urgent jobs, sync dispatch notes, and keep supervisors aligned before the morning standup.</p>',
        '<a href="#demo" role="button">Book a dispatch demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/opspilot-dispatch.png" alt="OpsPilot dispatch board preview">',
        '<figcaption>Dispatch board preview with job routes, crew capacity, and service alerts.</figcaption></figure></section>',
        '<section id="capabilities" class="feature-section"><h2>Core capabilities for modern teams</h2><div class="feature-grid">',
        '<article class="feature-card"><h3>Automation</h3><p>Powerful automation streamlines your workflow and saves time for every team.</p></article>',
        '<article class="feature-card"><h3>Analytics</h3><p>Advanced analytics gives smart insights so teams move faster with confidence.</p></article>',
        '<article class="feature-card"><h3>Collaboration</h3><p>Seamless collaboration keeps everyone aligned in one modern workspace.</p></article>',
        '</div></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by field service teams">',
        '<span>Harbor HVAC</span><span>Northline Utilities</span><span>Civic Repair Co.</span></section>',
        '<section class="testimonial"><blockquote>OpsPilot reduced missed handoffs by 31% in one quarter for Harbor HVAC.</blockquote></section>',
        '<section id="demo" class="final-cta"><h2>Ready to tighten dispatch handoffs?</h2><p>Book a demo and get a crew routing audit within 48 hours.</p><a href="/demo" role="button">Schedule demo</a></section>',
        '</main><footer class="site-footer" aria-label="OpsPilot footer">',
        '<p>OpsPilot field operations software. Contact support@opspilot.example for implementation help.</p>',
        '<nav class="footer-links" aria-label="Footer links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/status">Status</a></nav>',
        '<p>Copyright 2026 OpsPilot. All rights reserved.</p>',
        '</footer></body></html>'
      ].join('')
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('weak-feature-anatomy')
    expect(codes).toContain('generic-feature-card-detail')
  })

  it('flags marketing heroes that fill the viewport and hide the next section', () => {
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
        '.site-nav, .site-footer { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: center; }',
        '.product-preview, .feature-card { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.feature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav, .site-footer, .logo-cloud { flex-wrap: wrap; } .hero, .feature-grid { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="OpsPilot">',
        '<a class="wordmark" href="#top">OpsPilot</a><a href="#capabilities">Capabilities</a><a href="#proof">Customers</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Marketing site for field operations software</h1>',
        '<p>OpsPilot helps regional service teams route urgent jobs, sync dispatch notes, and keep supervisors aligned before the morning standup.</p>',
        '<a href="#demo" role="button">Book a dispatch demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/opspilot-dispatch.png" alt="OpsPilot dispatch board preview">',
        '<figcaption>Dispatch board preview with job routes, crew capacity, and service alerts.</figcaption></figure></section>',
        '<section id="capabilities" class="feature-section"><h2>Core capabilities for dispatch teams</h2><div class="feature-grid">',
        '<article class="feature-card"><h3>Live job routing</h3><p>Route emergency work orders by crew capacity, location, SLA window, and parts availability before calls pile up.</p></article>',
        '<article class="feature-card"><h3>Supervisor dashboard</h3><p>Track late arrivals, blocked jobs, and crew utilization with shift-level insights that update during dispatch.</p></article>',
        '<article class="feature-card"><h3>Handoff sync</h3><p>Sync technician notes, customer photos, and approval history into one workflow for next-day follow-up.</p></article>',
        '</div></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by field service teams">',
        '<span>Harbor HVAC</span><span>Northline Utilities</span><span>Civic Repair Co.</span></section>',
        '<section class="testimonial"><blockquote>OpsPilot reduced missed handoffs by 31% in one quarter for Harbor HVAC.</blockquote></section>',
        '<section id="demo" class="final-cta"><h2>Ready to tighten dispatch handoffs?</h2><p>Book a demo and get a crew routing audit within 48 hours.</p><a href="/demo" role="button">Schedule demo</a></section>',
        '</main><footer class="site-footer" aria-label="OpsPilot footer">',
        '<p>OpsPilot field operations software. Contact support@opspilot.example for implementation help.</p>',
        '<nav class="footer-links" aria-label="Footer links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/status">Status</a></nav>',
        '<p>Copyright 2026 OpsPilot. All rights reserved.</p>',
        '</footer></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-hero-viewport-composition')
  })

  it('accepts marketing heroes that leave a next-section peek in the first viewport', () => {
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
        '.site-nav, .site-footer { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { min-height: min(82vh, 680px); display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: center; padding-block: 48px; }',
        '.product-preview, .feature-card { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.feature-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav, .site-footer, .logo-cloud { flex-wrap: wrap; } .hero, .feature-grid { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="OpsPilot">',
        '<a class="wordmark" href="#top">OpsPilot</a><a href="#capabilities">Capabilities</a><a href="#proof">Customers</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Marketing site for field operations software</h1>',
        '<p>OpsPilot helps regional service teams route urgent jobs, sync dispatch notes, and keep supervisors aligned before the morning standup.</p>',
        '<a href="#demo" role="button">Book a dispatch demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/opspilot-dispatch.png" alt="OpsPilot dispatch board preview">',
        '<figcaption>Dispatch board preview with job routes, crew capacity, and service alerts.</figcaption></figure></section>',
        '<section id="capabilities" class="feature-section"><h2>Core capabilities for dispatch teams</h2><div class="feature-grid">',
        '<article class="feature-card"><h3>Live job routing</h3><p>Route emergency work orders by crew capacity, location, SLA window, and parts availability before calls pile up.</p></article>',
        '<article class="feature-card"><h3>Supervisor dashboard</h3><p>Track late arrivals, blocked jobs, and crew utilization with shift-level insights that update during dispatch.</p></article>',
        '<article class="feature-card"><h3>Handoff sync</h3><p>Sync technician notes, customer photos, and approval history into one workflow for next-day follow-up.</p></article>',
        '</div></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by field service teams">',
        '<span>Harbor HVAC</span><span>Northline Utilities</span><span>Civic Repair Co.</span></section>',
        '<section class="testimonial"><blockquote>OpsPilot reduced missed handoffs by 31% in one quarter for Harbor HVAC.</blockquote></section>',
        '<section id="demo" class="final-cta"><h2>Ready to tighten dispatch handoffs?</h2><p>Book a demo and get a crew routing audit within 48 hours.</p><a href="/demo" role="button">Schedule demo</a></section>',
        '</main><footer class="site-footer" aria-label="OpsPilot footer">',
        '<p>OpsPilot field operations software. Contact support@opspilot.example for implementation help.</p>',
        '<nav class="footer-links" aria-label="Footer links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/status">Status</a></nav>',
        '<p>Copyright 2026 OpsPilot. All rights reserved.</p>',
        '</footer></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-hero-viewport-composition')
  })

  it('flags marketing first screens without a secondary action path', () => {
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
        '.site-nav { display: flex; gap: 24px; }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview, .feature-card { border: 1px solid var(--border); padding: 12px; }',
        '.feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero, .feature-grid { grid-template-columns: 1fr; } .site-nav { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav class="site-nav"><a href="#features">Features</a><a href="#demo">Book demo</a></nav></header><main>',
        '<section class="hero"><div><h1>Marketing site for field operations software</h1>',
        '<p>OpsPilot helps regional service teams route urgent jobs, sync dispatch notes, and reduce missed handoffs before the morning standup.</p>',
        '<a href="#demo" role="button">Book a dispatch demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/opspilot-dispatch.png" alt="OpsPilot dispatch board preview">',
        '<figcaption>Dispatch board preview with crew load, route risk, and service alerts.</figcaption></figure></section>',
        '<section id="features" class="feature-grid"><article class="feature-card"><h2>Live routing</h2><p>Route emergency jobs by crew capacity and SLA window.</p></article>',
        '<article class="feature-card"><h2>Handoff sync</h2><p>Sync technician notes and approval history into one workflow.</p></article></section>',
        '<section id="demo"><h2>Book a demo</h2><p>Schedule a routing audit with the implementation team.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-secondary-action-path')
  })

  it('accepts marketing first screens with distinct primary and secondary actions', () => {
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
        '.site-nav, .hero-actions { display: flex; gap: 24px; }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview, .feature-card { border: 1px solid var(--border); padding: 12px; }',
        '.feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero, .feature-grid { grid-template-columns: 1fr; } .site-nav, .hero-actions { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav class="site-nav"><a href="#features">Features</a><a href="#demo">Book demo</a></nav></header><main>',
        '<section class="hero"><div><h1>Marketing site for field operations software</h1>',
        '<p>OpsPilot helps regional service teams route urgent jobs, sync dispatch notes, and reduce missed handoffs before the morning standup.</p>',
        '<div class="hero-actions"><a href="#demo" role="button">Book a dispatch demo</a><a href="#features">See routing features</a></div></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/opspilot-dispatch.png" alt="OpsPilot dispatch board preview">',
        '<figcaption>Dispatch board preview with crew load, route risk, and service alerts.</figcaption></figure></section>',
        '<section id="features" class="feature-grid"><article class="feature-card"><h2>Live routing</h2><p>Route emergency jobs by crew capacity and SLA window.</p></article>',
        '<article class="feature-card"><h2>Handoff sync</h2><p>Sync technician notes and approval history into one workflow.</p></article></section>',
        '<section id="demo"><h2>Book a demo</h2><p>Schedule a routing audit with the implementation team.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-secondary-action-path')
  })

  it('flags landing pages without a final conversion or next-step close', () => {
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
        '.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.pricing-card { border: 1px solid var(--border); padding: 20px; }',
        '.recommended { border-color: var(--accent); }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .hero, .pricing-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#pricing">Pricing</a></nav></header><main>',
        '<section class="hero"><div><h1>Pricing page for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Compare plans</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><div class="pricing-grid">',
        '<article class="pricing-card plan"><h3>Starter</h3><p>$49 / month</p><p>Includes 3 project pages, email support, and 1 workspace.</p><a href="#signup" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan recommended"><p>Recommended for studio teams</p><h3>Studio</h3><p>$129 / month</p><p>Includes unlimited projects, gallery analytics, and priority support.</p><a href="#trial" role="button">Start trial</a></article>',
        '<article class="pricing-card plan"><h3>Agency</h3><p>$249 / month</p><p>Includes client workspaces, SSO, audit log, and launch support.</p><a href="#sales" role="button">Contact sales</a></article>',
        '</div></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-conversion-close')
  })

  it('accepts landing pages with a final FAQ and closing CTA', () => {
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
        '.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.pricing-card { border: 1px solid var(--border); padding: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .hero, .pricing-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#pricing">Pricing</a></nav></header><main>',
        '<section class="hero"><div><h1>Pricing page for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Compare plans</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><div class="pricing-grid">',
        '<article class="pricing-card plan"><h3>Starter</h3><p>$49 / month</p><p>Includes 3 project pages, email support, and 1 workspace.</p><a href="#signup" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan recommended"><p>Recommended for studio teams</p><h3>Studio</h3><p>$129 / month</p><p>Includes unlimited projects, gallery analytics, and priority support.</p><a href="#trial" role="button">Start trial</a></article>',
        '<article class="pricing-card plan"><h3>Agency</h3><p>$249 / month</p><p>Includes client workspaces, SSO, audit log, and launch support.</p><a href="#sales" role="button">Contact sales</a></article>',
        '</div></section>',
        '<section class="faq"><h2>FAQ</h2><article><h3>Can we migrate old pages?</h3><p>Yes, Studio plan includes guided migration for 20 published projects.</p></article></section>',
        '<footer class="final-cta"><h2>Ready to launch Aria Studio?</h2><p>Book a demo and get a launch checklist within 24 hours.</p><a href="#demo" role="button">Book a demo</a></footer>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-conversion-close')
    expect(findings.map((finding) => finding.code)).not.toContain('generic-conversion-close')
  })

  it('flags landing pages with generic final conversion copy', () => {
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
        '.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.pricing-card { border: 1px solid var(--border); padding: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .hero, .pricing-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#pricing">Pricing</a></nav></header><main>',
        '<section class="hero"><div><h1>Pricing page for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Compare plans</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><div class="pricing-grid">',
        '<article class="pricing-card plan"><h3>Starter</h3><p>$49 / month</p><p>Includes 3 project pages, email support, and 1 workspace.</p><a href="#signup" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan recommended"><p>Recommended for studio teams</p><h3>Studio</h3><p>$129 / month</p><p>Includes unlimited projects, gallery analytics, and priority support.</p><a href="#trial" role="button">Start trial</a></article>',
        '<article class="pricing-card plan"><h3>Agency</h3><p>$249 / month</p><p>Includes client workspaces, SSO, audit log, and launch support.</p><a href="#sales" role="button">Contact sales</a></article>',
        '</div></section>',
        '<footer id="start" class="final-cta"><h2>Ready to get started?</h2><p>Start today and discover what our platform can do for your team.</p><a href="#start" role="button">Get started</a></footer>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-conversion-close')
    expect(findings.map((finding) => finding.code)).toContain('generic-conversion-close')
  })

  it('flags FAQ sections with only one thin question and answer', () => {
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
        '.faq article { border: 1px solid var(--border); padding: 16px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#faq">FAQ</a></nav></header><main>',
        '<section class="hero"><div><h1>Marketing site for studio launch software</h1>',
        '<p>Aria Launch helps studio teams migrate project pages, route inquiries, and publish portfolio updates before campaign deadlines.</p>',
        '<a href="#faq" role="button">Read launch questions</a><a href="#demo">Book demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Launch portfolio migration preview">',
        '<figcaption>Migration dashboard preview with launch status and inquiry routing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers"><span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="faq" class="faq"><h2>FAQ</h2><article><h3>Can we migrate old pages?</h3><p>Yes, Studio plan includes guided migration for 20 published projects.</p></article></section>',
        '<footer id="demo"><h2>Ready to launch?</h2><a href="/demo" role="button">Book demo</a></footer>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-faq-anatomy')
  })

  it('accepts FAQ sections with multiple concrete objection-handling answers', () => {
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
        '.faq article { border: 1px solid var(--border); padding: 16px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#faq">FAQ</a></nav></header><main>',
        '<section class="hero"><div><h1>Marketing site for studio launch software</h1>',
        '<p>Aria Launch helps studio teams migrate project pages, route inquiries, and publish portfolio updates before campaign deadlines.</p>',
        '<a href="#faq" role="button">Read launch questions</a><a href="#demo">Book demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Launch portfolio migration preview">',
        '<figcaption>Migration dashboard preview with launch status and inquiry routing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers"><span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="faq" class="faq"><h2>FAQ</h2>',
        '<article><h3>Can we migrate old pages?</h3><p>Yes. Studio plan includes guided migration for 20 published projects, preserving image alt text, redirects, and launch dates.</p></article>',
        '<article><h3>How long does setup take?</h3><p>Most studio teams publish a first portfolio system within 10 business days after assets, pricing, and routing rules are approved.</p></article>',
        '</section>',
        '<footer id="demo"><h2>Ready to launch?</h2><a href="/demo" role="button">Book demo</a></footer>',
        '</main></body></html>'
      ].join('')
    })

    const codes = findings.map((finding) => finding.code)
    expect(codes).not.toContain('weak-faq-anatomy')
    expect(codes).not.toContain('generic-faq-questions')
    expect(codes).not.toContain('generic-faq-answers')
  })

  it('flags FAQ sections with generic template questions', () => {
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
        '.faq article { border: 1px solid var(--border); padding: 16px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#faq">FAQ</a></nav></header><main>',
        '<section class="hero"><div><h1>Marketing site for studio launch software</h1>',
        '<p>Aria Launch helps studio teams migrate project pages, route inquiries, and publish portfolio updates before campaign deadlines.</p>',
        '<a href="#faq" role="button">Read launch questions</a><a href="#demo">Book demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Launch portfolio migration preview">',
        '<figcaption>Migration dashboard preview with launch status and inquiry routing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers"><span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="faq" class="faq"><h2>FAQ</h2>',
        '<article><h3>What is this?</h3><p>Aria Launch migrates portfolio pages, preserves redirects, and routes new inquiries into the studio launch queue.</p></article>',
        '<article><h3>How does it work?</h3><p>Designers upload assets, approve routing rules, and publish the first portfolio system within 10 business days.</p></article>',
        '<article><h3>Who is this for?</h3><p>Studio teams with 20 or more published project pages use it before seasonal campaign launches.</p></article>',
        '</section>',
        '<footer id="demo"><h2>Ready to launch?</h2><a href="/demo" role="button">Book demo</a></footer>',
        '</main></body></html>'
      ].join('')
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('weak-faq-anatomy')
    expect(codes).not.toContain('generic-faq-answers')
    expect(codes).toContain('generic-faq-questions')
  })

  it('flags FAQ sections with generic evasive answers', () => {
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
        '.faq article { border: 1px solid var(--border); padding: 16px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#proof">Proof</a><a href="#faq">FAQ</a></nav></header><main>',
        '<section class="hero"><div><h1>Marketing site for studio launch software</h1>',
        '<p>Aria Launch helps studio teams migrate project pages, route inquiries, and publish portfolio updates before campaign deadlines.</p>',
        '<a href="#faq" role="button">Read launch questions</a><a href="#demo">Book demo</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Launch portfolio migration preview">',
        '<figcaption>Migration dashboard preview with launch status and inquiry routing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers"><span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="faq" class="faq"><h2>FAQ</h2>',
        '<article><h3>Can we migrate old pages?</h3><p>Contact us and our team can help with details for your studio.</p></article>',
        '<article><h3>How long does setup take?</h3><p>Learn more by reviewing the full help article before starting.</p></article>',
        '</section>',
        '<footer id="demo"><h2>Ready to launch?</h2><a href="/demo" role="button">Book demo</a></footer>',
        '</main></body></html>'
      ].join('')
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('weak-faq-anatomy')
    expect(codes).toContain('generic-faq-answers')
  })

  it('flags landing pages without a complete site footer', () => {
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
        '.site-nav { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.pricing-card { border: 1px solid var(--border); padding: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav { flex-wrap: wrap; } .hero, .pricing-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="Aria Studio">',
        '<a class="wordmark" href="#top">Aria Studio</a><a href="#proof">Proof</a><a href="#pricing">Pricing</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Marketing site for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Compare plans</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><div class="pricing-grid">',
        '<article class="pricing-card plan"><h3>Starter</h3><p>$49 / month</p><p>Includes 3 project pages, email support, and 1 workspace.</p><a href="#signup" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan recommended"><p>Recommended for studio teams</p><h3>Studio</h3><p>$129 / month</p><p>Includes unlimited projects, gallery analytics, and priority support.</p><a href="#trial" role="button">Start trial</a></article>',
        '<article class="pricing-card plan"><h3>Agency</h3><p>$249 / month</p><p>Includes client workspaces, SSO, audit log, and launch support.</p><a href="#sales" role="button">Contact sales</a></article>',
        '</div></section>',
        '<section class="faq"><h2>FAQ</h2><article><h3>Can we migrate old pages?</h3><p>Yes, Studio plan includes guided migration for 20 published projects.</p></article></section>',
        '<footer id="demo" class="final-cta"><h2>Ready to launch Aria Studio?</h2><p>Book a demo and get a launch checklist within 24 hours.</p><a href="#demo" role="button">Book a demo</a></footer>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-site-footer')
  })

  it('accepts landing pages with a complete site footer', () => {
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
        '.site-nav, .site-footer { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.pricing-card { border: 1px solid var(--border); padding: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav, .site-footer { flex-wrap: wrap; } .hero, .pricing-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="Aria Studio">',
        '<a class="wordmark" href="#top">Aria Studio</a><a href="#proof">Proof</a><a href="#pricing">Pricing</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Marketing site for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Compare plans</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><div class="pricing-grid">',
        '<article class="pricing-card plan"><h3>Starter</h3><p>$49 / month</p><p>Includes 3 project pages, email support, and 1 workspace.</p><a href="#signup" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan recommended"><p>Recommended for studio teams</p><h3>Studio</h3><p>$129 / month</p><p>Includes unlimited projects, gallery analytics, and priority support.</p><a href="#trial" role="button">Start trial</a></article>',
        '<article class="pricing-card plan"><h3>Agency</h3><p>$249 / month</p><p>Includes client workspaces, SSO, audit log, and launch support.</p><a href="#sales" role="button">Contact sales</a></article>',
        '</div></section>',
        '<section class="faq"><h2>FAQ</h2><article><h3>Can we migrate old pages?</h3><p>Yes, Studio plan includes guided migration for 20 published projects.</p></article></section>',
        '<section id="demo" class="final-cta"><h2>Ready to launch Aria Studio?</h2><p>Book a demo and get a launch checklist within 24 hours.</p><a href="#demo" role="button">Book a demo</a></section>',
        '</main><footer class="site-footer" aria-label="Aria Studio footer">',
        '<div><strong>Aria Studio</strong><p>Contact support@aria.studio for launch planning and migration help.</p></div>',
        '<nav class="footer-links" aria-label="Footer links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/status">Status</a><a href="https://www.linkedin.com/company/aria-studio">LinkedIn</a></nav>',
        '<p>Copyright 2026 Aria Studio. All rights reserved.</p>',
        '</footer></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-site-footer')
    expect(findings.map((finding) => finding.code)).not.toContain('generic-site-footer-detail')
  })

  it('flags landing pages with generic footer columns only', () => {
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
        '.site-nav, .site-footer { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.pricing-card { border: 1px solid var(--border); padding: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav, .site-footer { flex-wrap: wrap; } .hero, .pricing-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="Aria Studio">',
        '<a class="wordmark" href="#top">Aria Studio</a><a href="#proof">Proof</a><a href="#pricing">Pricing</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Marketing site for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Compare plans</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><div class="pricing-grid">',
        '<article class="pricing-card plan"><h3>Starter</h3><p>$49 / month</p><p>Includes 3 project pages, email support, and 1 workspace.</p><a href="#signup" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan recommended"><p>Recommended for studio teams</p><h3>Studio</h3><p>$129 / month</p><p>Includes unlimited projects, gallery analytics, and priority support.</p><a href="#trial" role="button">Start trial</a></article>',
        '<article class="pricing-card plan"><h3>Agency</h3><p>$249 / month</p><p>Includes client workspaces, SSO, audit log, and launch support.</p><a href="#sales" role="button">Contact sales</a></article>',
        '</div></section>',
        '<section id="demo" class="final-cta"><h2>Ready to launch Aria Studio?</h2><p>Book a demo and get a launch checklist within 24 hours.</p><a href="#demo" role="button">Book a demo</a></section>',
        '</main><footer class="site-footer" aria-label="Aria Studio footer">',
        '<div><strong>Product</strong><a href="/features">Features</a><a href="/pricing">Pricing</a></div>',
        '<div><strong>Company</strong><a href="/about">About</a><a href="/customers">Customers</a></div>',
        '<div><strong>Resources</strong><a href="/blog">Blog</a><a href="/guides">Guides</a></div>',
        '</footer></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-site-footer')
    expect(findings.map((finding) => finding.code)).toContain('generic-site-footer-detail')
  })

  it('flags landing pages without branded header navigation', () => {
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
        '.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.pricing-card { border: 1px solid var(--border); padding: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .hero, .pricing-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><main>',
        '<section class="hero"><div><h1>Pricing page for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Compare plans</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><div class="pricing-grid">',
        '<article class="pricing-card plan"><h3>Starter</h3><p>$49 / month</p><p>Includes 3 project pages, email support, and 1 workspace.</p><a href="#signup" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan recommended"><p>Recommended for studio teams</p><h3>Studio</h3><p>$129 / month</p><p>Includes unlimited projects, gallery analytics, and priority support.</p><a href="#trial" role="button">Start trial</a></article>',
        '<article class="pricing-card plan"><h3>Agency</h3><p>$249 / month</p><p>Includes client workspaces, SSO, audit log, and launch support.</p><a href="#sales" role="button">Contact sales</a></article>',
        '</div></section>',
        '<section class="faq"><h2>FAQ</h2><article><h3>Can we migrate old pages?</h3><p>Yes, Studio plan includes guided migration for 20 published projects.</p></article></section>',
        '<footer class="final-cta"><h2>Ready to launch Aria Studio?</h2><p>Book a demo and get a launch checklist within 24 hours.</p><a href="#demo" role="button">Book a demo</a></footer>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-brand-navigation')
  })

  it('accepts landing pages with branded header navigation', () => {
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
        '.site-nav { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.pricing-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }',
        '.pricing-card { border: 1px solid var(--border); padding: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav { flex-wrap: wrap; } .hero, .pricing-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="Aria Studio">',
        '<a class="wordmark" href="#top">Aria Studio</a><a href="#proof">Proof</a><a href="#pricing">Pricing</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Pricing page for boutique studio websites</h1>',
        '<p>Launch a marketing site with project galleries, pricing plans, and inquiry routing for Aria Studio by Jun 18.</p>',
        '<a href="#pricing" role="button">Compare plans</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio portfolio page preview">',
        '<figcaption>Live portfolio preview with project galleries and pricing.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="pricing"><h2>Pricing plans</h2><div class="pricing-grid">',
        '<article class="pricing-card plan"><h3>Starter</h3><p>$49 / month</p><p>Includes 3 project pages, email support, and 1 workspace.</p><a href="#signup" role="button">Choose plan</a></article>',
        '<article class="pricing-card plan recommended"><p>Recommended for studio teams</p><h3>Studio</h3><p>$129 / month</p><p>Includes unlimited projects, gallery analytics, and priority support.</p><a href="#trial" role="button">Start trial</a></article>',
        '<article class="pricing-card plan"><h3>Agency</h3><p>$249 / month</p><p>Includes client workspaces, SSO, audit log, and launch support.</p><a href="#sales" role="button">Contact sales</a></article>',
        '</div></section>',
        '<section class="faq"><h2>FAQ</h2><article><h3>Can we migrate old pages?</h3><p>Yes, Studio plan includes guided migration for 20 published projects.</p></article></section>',
        '<footer id="demo" class="final-cta"><h2>Ready to launch Aria Studio?</h2><p>Book a demo and get a launch checklist within 24 hours.</p><a href="#demo" role="button">Book a demo</a></footer>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-brand-navigation')
  })

  it('flags landing pages whose navigation lacks a visible brand identity', () => {
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
        '.site-nav { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav { flex-wrap: wrap; } .hero, .feature-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav class="site-nav"><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#demo">Book demo</a></nav></header><main>',
        '<section class="hero"><div><h1>Marketing site for field operations software</h1>',
        '<p>Regional service teams route urgent jobs, sync dispatch notes, and keep supervisors aligned before the morning standup.</p>',
        '<a href="#demo" role="button">Book a dispatch demo</a><a href="#features">See routing features</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/dispatch-preview.png" alt="Dispatch board preview">',
        '<figcaption>Dispatch board preview with job routes, crew capacity, and service alerts.</figcaption></figure></section>',
        '<section id="features" class="feature-section"><h2>Core capabilities for dispatch teams</h2><div class="feature-grid">',
        '<article class="feature-card"><h3>Live job routing</h3><p>Route emergency work orders by crew capacity, location, SLA window, and parts availability.</p></article>',
        '<article class="feature-card"><h3>Handoff sync</h3><p>Sync technician notes, customer photos, and approval history into one workflow for next-day follow-up.</p></article>',
        '</div></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by field service teams"><span>Harbor HVAC</span><span>Northline Utilities</span></section>',
        '<section id="demo" class="final-cta"><h2>Ready to tighten dispatch handoffs?</h2><p>Book a demo and get a crew routing audit within 48 hours.</p><a href="/demo" role="button">Schedule demo</a></section>',
        '</main></body></html>'
      ].join('')
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('weak-brand-navigation')
    expect(codes).toContain('weak-brand-identity')
  })

  it('accepts landing pages with a visible wordmark or product identity', () => {
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
        '.site-nav { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav { flex-wrap: wrap; } .hero, .feature-grid { grid-template-columns: 1fr; } .logo-cloud { flex-wrap: wrap; } }',
        '</style>',
        '</head>',
        '<body><header><nav class="site-nav"><a class="wordmark" href="#top">OpsPilot</a><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#demo">Book demo</a></nav></header><main id="top">',
        '<section class="hero"><div><h1>Marketing site for field operations software</h1>',
        '<p>OpsPilot helps regional service teams route urgent jobs, sync dispatch notes, and keep supervisors aligned before the morning standup.</p>',
        '<a href="#demo" role="button">Book a dispatch demo</a><a href="#features">See routing features</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/opspilot-dispatch.png" alt="OpsPilot dispatch board preview">',
        '<figcaption>OpsPilot dispatch board preview with job routes, crew capacity, and service alerts.</figcaption></figure></section>',
        '<section id="features" class="feature-section"><h2>Core capabilities for dispatch teams</h2><div class="feature-grid">',
        '<article class="feature-card"><h3>Live job routing</h3><p>Route emergency work orders by crew capacity, location, SLA window, and parts availability.</p></article>',
        '<article class="feature-card"><h3>Handoff sync</h3><p>Sync technician notes, customer photos, and approval history into one workflow for next-day follow-up.</p></article>',
        '</div></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by field service teams"><span>Harbor HVAC</span><span>Northline Utilities</span></section>',
        '<section id="demo" class="final-cta"><h2>Ready to tighten dispatch handoffs?</h2><p>Book a demo and get a crew routing audit within 48 hours.</p><a href="/demo" role="button">Schedule demo</a></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-brand-identity')
  })

  it('flags portfolio and case-study pages without concrete project entries', () => {
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
        '.site-nav { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav, .logo-cloud { flex-wrap: wrap; } .hero { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="Aria Studio">',
        '<a class="wordmark" href="#top">Aria Studio</a><a href="#work">Case studies</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Case studies for boutique studio launches</h1>',
        '<p>Explore selected work from Aria Studio, including client launches, project galleries, inquiry routing, and editorial portfolio systems.</p>',
        '<a href="#work" role="button">View work</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio selected work preview">',
        '<figcaption>Selected work preview with project galleries and launch notes.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="work"><h2>Selected work</h2><p>Brand systems, editorial portfolio pages, and inquiry routing for studio teams.</p></section>',
        '<footer id="demo" class="final-cta"><h2>Ready to launch your studio portfolio?</h2><p>Book a demo and get a launch checklist within 24 hours.</p><a href="#demo" role="button">Book a demo</a></footer>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-portfolio-structure')
  })

  it('accepts portfolio and case-study pages with project cards and outcome CTAs', () => {
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
        '.site-nav { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview, .project-card { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.work-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav, .logo-cloud { flex-wrap: wrap; } .hero, .work-grid { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="Aria Studio">',
        '<a class="wordmark" href="#top">Aria Studio</a><a href="#work">Case studies</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Case studies for boutique studio launches</h1>',
        '<p>Explore selected work from Aria Studio, including client launches, project galleries, inquiry routing, and editorial portfolio systems.</p>',
        '<a href="#work" role="button">View work</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio selected work preview">',
        '<figcaption>Selected work preview with project galleries and launch notes.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="work"><h2>Selected work</h2><div class="work-grid">',
        '<article class="project-card"><img src=".kun-design/assets/northstar.png" alt="Northstar Labs project preview"><h3>Northstar Labs launch</h3>',
        '<p>Client: Northstar Labs. Role: portfolio system, 2026 launch. Outcome: +38% qualified inquiries after six weeks.</p><a href="#northstar">View project</a></article>',
        '<article class="project-card"><img src=".kun-design/assets/juniper.png" alt="Juniper Studio project preview"><h3>Juniper Studio refresh</h3>',
        '<p>Client: Juniper Studio. Role: editorial case-study system, 2025 launch. Result: saved 12 hours per project update.</p><a href="#juniper">Read case study</a></article>',
        '</div></section>',
        '<footer id="demo" class="final-cta"><h2>Ready to launch your studio portfolio?</h2><p>Book a demo and get a launch checklist within 24 hours.</p><a href="#demo" role="button">Book a demo</a></footer>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-portfolio-structure')
    expect(findings.map((finding) => finding.code)).not.toContain('generic-portfolio-project-detail')
  })

  it('flags portfolio and case-study cards with placeholder project labels', () => {
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
        '.site-nav { display: flex; justify-content: space-between; gap: 24px; }',
        'main { font-size: clamp(16px, 2vw, 20px); color: var(--text); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 420px); gap: 40px; align-items: start; }',
        '.product-preview, .project-card { border: 1px solid var(--border); padding: 12px; }',
        '.logo-cloud { display: flex; gap: 18px; }',
        '.work-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }',
        '.final-cta { border: 1px solid var(--accent); padding: 24px; }',
        'button:focus-visible,a:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { .site-nav, .logo-cloud { flex-wrap: wrap; } .hero, .work-grid { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header class="masthead"><nav class="site-nav" aria-label="Aria Studio">',
        '<a class="wordmark" href="#top">Aria Studio</a><a href="#work">Case studies</a><a href="#demo">Book a demo</a>',
        '</nav></header><main id="top">',
        '<section class="hero"><div><h1>Case studies for boutique studio launches</h1>',
        '<p>Explore selected work from Aria Studio, including client launches, project galleries, inquiry routing, and editorial portfolio systems.</p>',
        '<a href="#work" role="button">View work</a></div>',
        '<figure class="product-preview"><img src=".kun-design/assets/studio-preview.png" alt="Aria Studio selected work preview">',
        '<figcaption>Selected work preview with project galleries and launch notes.</figcaption></figure></section>',
        '<section id="proof" class="logo-cloud" aria-label="Trusted by studio customers">',
        '<span>Northstar Labs</span><span>Acme Finance</span><span>Juniper Studio</span></section>',
        '<section id="work"><h2>Selected work</h2><div class="work-grid">',
        '<article class="project-card"><img src=".kun-design/assets/project-one.png" alt="Project One preview"><h3>Project One</h3>',
        '<p>Client A, brand redesign, 2026 launch. Outcome: +32% qualified inquiries after six weeks.</p><a href="#project-one">View project</a></article>',
        '<article class="project-card"><img src=".kun-design/assets/case-study-two.png" alt="Case Study 2 preview"><h3>Case Study 2</h3>',
        '<p>Client B, editorial portfolio build, timeline 8 weeks. Result: saved 12 hours per project update.</p><a href="#case-study-two">Read case study</a></article>',
        '</div></section>',
        '<footer id="demo" class="final-cta"><h2>Ready to launch your studio portfolio?</h2><p>Book a demo and get a launch checklist within 24 hours.</p><a href="#demo" role="button">Book a demo</a></footer>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-portfolio-structure')
    expect(findings.map((finding) => finding.code)).toContain('generic-portfolio-project-detail')
  })

  it('flags unbounded viewport typography and negative letter spacing', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'h1 { font-size: 8vw; letter-spacing: -0.06em; }',
        'main { font-size: 16px; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-typography-constraints')
  })

  it('accepts bounded typography scales and normal letter spacing', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'h1 { font-size: clamp(32px, 5vw, 56px); letter-spacing: 0; }',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-typography-constraints')
  })

  it('flags pages where headings and body copy share the same weak type treatment', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'body,h1,h2,p,button { font-size: 16px; font-weight: 400; }',
        'main { font-size: 16px; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
        '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-type-hierarchy')
  })

  it('accepts pages with a clear bounded type hierarchy', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'body { font-size: 16px; font-weight: 400; }',
        'h1 { font-size: clamp(32px, 5vw, 48px); font-weight: 760; letter-spacing: 0; }',
        'h2 { font-size: 22px; font-weight: 700; letter-spacing: 0; }',
        'p,td,button { font-size: 16px; font-weight: 400; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
        '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-type-hierarchy')
  })

  it('flags generic action labels that do not communicate the user task', () => {
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
        '<button onclick="document.body.classList.toggle(\'planned\')">Get started</button>',
        '<button onclick="document.body.classList.toggle(\'more\')">Learn more</button></section>',
        '<section><h2>Renewal accounts</h2><table><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('generic-action-copy')
  })

  it('accepts specific action labels tied to the page goal', () => {
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
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button>',
        '<button onclick="document.body.classList.toggle(\'retrying\')">Retry account sync</button></section>',
        '<section><h2>Renewal accounts</h2><table><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('generic-action-copy')
  })

  it('flags destructive actions without danger treatment or confirmation feedback', () => {
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
        '<body><header><nav><a href="#main">Settings</a></nav></header><main id="main">',
        '<section><h1>Manage workspace access</h1>',
        '<p>Mina Chen owns Acme Finance workspace AC-2048 with 18 active seats and 3 pending vendor invites.</p>',
        '<button onclick="document.body.classList.toggle(\'deleted\')">Delete workspace</button></section>',
        '<section><h2>Access review</h2><p>Northstar Labs vendor access expires Jun 18 and needs owner approval.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-destructive-action-safety')
  })

  it('accepts destructive actions with danger tone and confirmation or undo feedback', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.danger-button { background: #dc2626; color: #ffffff; border: 1px solid #b91c1c; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Settings</a></nav></header><main id="main">',
        '<section><h1>Manage workspace access</h1>',
        '<p>Mina Chen owns Acme Finance workspace AC-2048 with 18 active seats and 3 pending vendor invites.</p>',
        '<button class="danger-button" data-confirm="delete workspace">Delete workspace</button>',
        '<div role="dialog" aria-modal="true"><h2>Confirm delete workspace</h2>',
        '<p>This is irreversible after the 7 day recovery window.</p><button>Cancel</button><button class="danger-button">Confirm delete</button></div>',
        '<p role="status">Undo toast appears for 30 seconds after removing vendor access.</p></section>',
        '<section><h2>Access review</h2><p>Northstar Labs vendor access expires Jun 18 and needs owner approval.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-destructive-action-safety')
  })

  it('flags dialog-like surfaces without dialog semantics, title, or close path', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.modal { border: 1px solid #d8dee8; padding: 24px; box-shadow: 0 20px 60px rgba(15,23,42,.18); }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Settings</a></nav></header><main id="main">',
        '<section><h1>Manage workspace access</h1>',
        '<p>Mina Chen owns Acme Finance workspace AC-2048 with 18 active seats and 3 pending vendor invites.</p>',
        '<button onclick="document.body.classList.toggle(\'modal-open\')">Open access details</button></section>',
        '<div class="modal"><p>Northstar Labs access expires Jun 18 and needs owner approval.</p><button>Apply access change</button></div>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-dialog-affordance')
  })

  it('flags dialogs with generic titles', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.modal { border: 1px solid #d8dee8; padding: 24px; box-shadow: 0 20px 60px rgba(15,23,42,.18); }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Settings</a></nav></header><main id="main">',
        '<section><h1>Manage workspace access</h1>',
        '<p>Mina Chen owns Acme Finance workspace AC-2048 with 18 active seats and 3 pending vendor invites.</p>',
        '<button onclick="document.body.classList.toggle(\'modal-open\')">Open vendor access details</button></section>',
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title">',
        '<h2 id="dialog-title">Details</h2>',
        '<p>Northstar Labs vendor access expires Jun 18 and needs owner approval before the billing audit.</p>',
        '<button>Cancel</button><button>Apply vendor access change</button></div>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('generic-dialog-title')
  })

  it('accepts dialogs with semantics, accessible titles, and close actions', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.modal { border: 1px solid #d8dee8; padding: 24px; box-shadow: 0 20px 60px rgba(15,23,42,.18); }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Settings</a></nav></header><main id="main">',
        '<section><h1>Manage workspace access</h1>',
        '<p>Mina Chen owns Acme Finance workspace AC-2048 with 18 active seats and 3 pending vendor invites.</p>',
        '<button onclick="document.body.classList.toggle(\'modal-open\')">Open access details</button></section>',
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="access-title">',
        '<h2 id="access-title">Review vendor access</h2>',
        '<p>Northstar Labs access expires Jun 18 and needs owner approval.</p>',
        '<button>Cancel</button><button>Apply access change</button></div>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-dialog-affordance')
    expect(findings.map((finding) => finding.code)).not.toContain('generic-dialog-title')
  })

  it('flags card-like containers nested inside other cards', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.card, .metric-card { border: 1px solid #d8dee8; border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,.08); }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section class="card"><h2>Renewal account</h2><div class="metric-card">Acme Finance $84,200 ARR at risk</div></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('nested-card-layout')
  })

  it('accepts sibling cards in a grid without treating them as nested cards', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.metric-card { border: 1px solid #d8dee8; border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,.08); }',
        '.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><div class="metrics-grid">',
        '<article class="metric-card">Acme Finance $84,200 ARR at risk</article>',
        '<article class="metric-card">Northstar Labs $42,900 ARR pending</article>',
        '</div></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('nested-card-layout')
  })

  it('flags oversized card and panel corner radii', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.metric-card, .account-panel { border: 1px solid #d8dee8; border-radius: 28px; box-shadow: 0 8px 24px rgba(15,23,42,.08); }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><div class="metrics-grid">',
        '<article class="metric-card">Acme Finance $84,200 ARR at risk</article>',
        '<article class="account-panel">Northstar Labs $42,900 ARR pending</article>',
        '</div></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('over-rounded-card-styling')
  })

  it('accepts restrained card radii for product surfaces', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.metric-card, .account-panel { border: 1px solid #d8dee8; border-radius: 8px; box-shadow: 0 8px 24px rgba(15,23,42,.08); }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><div class="metrics-grid">',
        '<article class="metric-card">Acme Finance $84,200 ARR at risk</article>',
        '<article class="account-panel">Northstar Labs $42,900 ARR pending</article>',
        '</div></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('over-rounded-card-styling')
  })

  it('flags data tables without headers or accessible context', () => {
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
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><tbody>',
        '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr>',
        '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td>Pending</td></tr>',
        '</tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-table-structure')
  })

  it('accepts data tables with headers and captions', () => {
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
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
        '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-table-structure')
  })

  it('flags record tables with generic template column labels', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.status-badge { border: 1px solid #0f766e; background: #ecfdf5; font-weight: 700; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review renewal dashboard</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Name</th><th scope="col">Status</th><th scope="col">Date</th><th scope="col">Action</th></tr>',
        '</thead><tbody>',
        '<tr><td>Acme Finance</td><td><span class="status-badge">At risk</span></td><td>Jun 18</td><td><button>Review renewal</button></td></tr>',
        '<tr><td>Northstar Labs</td><td><span class="status-badge">Pending</span></td><td>Jun 21</td><td><button>Assign owner</button></td></tr>',
        '</tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('generic-record-table-columns')
  })

  it('accepts record tables with domain-specific column labels', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.status-badge { border: 1px solid #0f766e; background: #ecfdf5; font-weight: 700; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review renewal dashboard</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Renewal due</th><th scope="col">Risk</th><th scope="col">Action</th></tr>',
        '</thead><tbody>',
        '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td>Jun 18</td><td><span class="status-badge">At risk</span></td><td><button>Review renewal</button></td></tr>',
        '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td>Jun 21</td><td><span class="status-badge">Pending</span></td><td><button>Assign owner</button></td></tr>',
        '</tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('generic-record-table-columns')
  })

  it('flags actionable record tables without row, bulk, or detail actions', () => {
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
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
        '</thead><tbody>',
        '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr>',
        '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td>Pending</td></tr>',
        '</tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-record-actions')
  })

  it('accepts actionable record tables with row actions', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.status-badge { border: 1px solid #0f766e; background: #ecfdf5; font-weight: 700; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th><th scope="col">Action</th></tr>',
        '</thead><tbody>',
        '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td><span class="status-badge">At risk</span></td><td><button>Review renewal</button></td></tr>',
        '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td><span class="status-badge">Pending</span></td><td><button>Assign owner</button></td></tr>',
        '</tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-record-actions')
    expect(findings.map((finding) => finding.code)).not.toContain('generic-record-action-labels')
  })

  it('flags actionable record tables with generic row action labels', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.status-badge { border: 1px solid #0f766e; background: #ecfdf5; font-weight: 700; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th><th scope="col">Action</th></tr>',
        '</thead><tbody>',
        '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td><span class="status-badge">At risk</span></td><td><button>View</button></td></tr>',
        '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td><span class="status-badge">Pending</span></td><td><button>Open</button></td></tr>',
        '</tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('weak-record-actions')
    expect(codes).toContain('generic-record-action-labels')
  })

  it('flags actionable record lists with generic item titles', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.queue-list { display: grid; gap: 12px; }',
        '.record-card { border: 1px solid #d8dee8; padding: 16px; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Renewal queue</a><a href="#sync">Workspace sync</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>At-risk renewal queue</h2><ul class="queue-list">',
        '<li class="record-card"><h3>Task 1</h3><p>Acme Finance renewal RN-2048 has $84,200 ARR at risk and is due Jun 18.</p><button>Review renewal</button></li>',
        '<li class="record-card"><h3>Task 2</h3><p>Northstar Labs renewal RN-2091 has $42,900 ARR pending owner approval by Jun 21.</p><button>Assign owner</button></li>',
        '<li class="record-card"><h3>Task 3</h3><p>Harbor Clinic renewal RN-2110 has $18,600 ARR delayed after vendor SLA breach.</p><button>Escalate SLA</button></li>',
        '</ul></section>',
        '<section id="sync"><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('generic-record-item-labels')
  })

  it('accepts actionable record lists with concrete item titles', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.queue-list { display: grid; gap: 12px; }',
        '.record-card { border: 1px solid #d8dee8; padding: 16px; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Renewal queue</a><a href="#sync">Workspace sync</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>At-risk renewal queue</h2><ul class="queue-list">',
        '<li class="record-card"><h3>Acme Finance renewal RN-2048</h3><p>$84,200 ARR at risk and due Jun 18.</p><button>Review renewal</button></li>',
        '<li class="record-card"><h3>Northstar Labs owner approval RN-2091</h3><p>$42,900 ARR pending owner approval by Jun 21.</p><button>Assign owner</button></li>',
        '<li class="record-card"><h3>Harbor Clinic vendor SLA breach RN-2110</h3><p>$18,600 ARR delayed after vendor SLA breach.</p><button>Escalate SLA</button></li>',
        '</ul></section>',
        '<section id="sync"><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('generic-record-item-labels')
  })

  it('flags dense record tables without search, filters, sort, pagination, or view controls', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.status-badge { border: 1px solid #0f766e; background: #ecfdf5; font-weight: 700; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th><th scope="col">Action</th></tr>',
        '</thead><tbody>',
        '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td><span class="status-badge">At risk</span></td><td><button>Review renewal</button></td></tr>',
        '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td><span class="status-badge">Pending</span></td><td><button>Assign owner</button></td></tr>',
        '<tr><td>Harbor Clinic</td><td>$18,600 ARR</td><td><span class="status-badge">Delayed</span></td><td><button>Open account</button></td></tr>',
        '<tr><td>Evergreen Systems</td><td>$51,300 ARR</td><td><span class="status-badge">Needs review</span></td><td><button>Review renewal</button></td></tr>',
        '</tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-record-discovery-controls')
  })

  it('accepts dense record tables with discovery controls', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.status-badge { border: 1px solid #0f766e; background: #ecfdf5; font-weight: 700; }',
        '.toolbar { display: flex; gap: 12px; }',
        'button:focus-visible,input:focus-visible,select:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><div class="toolbar">',
        '<label for="renewal-search">Search accounts</label><input id="renewal-search" type="search" placeholder="Search renewals">',
        '<label for="status-filter">Filter status</label><select id="status-filter"><option>All statuses</option><option>At risk</option></select>',
        '<button>Next page</button></div>',
        '<table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col" aria-sort="ascending">Account</th><th scope="col">ARR</th><th scope="col">Status</th><th scope="col">Action</th></tr>',
        '</thead><tbody>',
        '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td><span class="status-badge">At risk</span></td><td><button>Review renewal</button></td></tr>',
        '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td><span class="status-badge">Pending</span></td><td><button>Assign owner</button></td></tr>',
        '<tr><td>Harbor Clinic</td><td>$18,600 ARR</td><td><span class="status-badge">Delayed</span></td><td><button>Open account</button></td></tr>',
        '<tr><td>Evergreen Systems</td><td>$51,300 ARR</td><td><span class="status-badge">Needs review</span></td><td><button>Review renewal</button></td></tr>',
        '</tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-record-discovery-controls')
    expect(findings.map((finding) => finding.code)).not.toContain('generic-record-discovery-controls')
  })

  it('flags dense record tables with generic discovery controls', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.status-badge { border: 1px solid #0f766e; background: #ecfdf5; font-weight: 700; }',
        '.toolbar { display: flex; gap: 12px; }',
        'button:focus-visible,input:focus-visible,select:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><div class="toolbar">',
        '<label for="record-search">Search</label><input id="record-search" type="search" placeholder="Search records">',
        '<label for="record-filter">Filter</label><select id="record-filter"><option>All statuses</option></select>',
        '<button>Next page</button></div>',
        '<table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col" aria-sort="ascending">Account</th><th scope="col">ARR</th><th scope="col">Status</th><th scope="col">Action</th></tr>',
        '</thead><tbody>',
        '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td><span class="status-badge">At risk</span></td><td><button>Review renewal</button></td></tr>',
        '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td><span class="status-badge">Pending</span></td><td><button>Assign owner</button></td></tr>',
        '<tr><td>Harbor Clinic</td><td>$18,600 ARR</td><td><span class="status-badge">Delayed</span></td><td><button>Open account</button></td></tr>',
        '<tr><td>Evergreen Systems</td><td>$51,300 ARR</td><td><span class="status-badge">Needs review</span></td><td><button>Review renewal</button></td></tr>',
        '</tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-record-discovery-controls')
    expect(findings.map((finding) => finding.code)).toContain('generic-record-discovery-controls')
  })

  it('flags repeated plain-text statuses without badge or chip affordances', () => {
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
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
        '</thead><tbody>',
        '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr>',
        '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td>Pending</td></tr>',
        '<tr><td>Harbor Clinic</td><td>$18,600 ARR</td><td>Delayed</td></tr>',
        '</tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-status-affordance')
  })

  it('accepts repeated statuses rendered as semantic badges', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.status-badge { border: 1px solid #0f766e; background: #ecfdf5; font-weight: 700; }',
        '.status-risk { background: #fff7ed; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
        '</thead><tbody>',
        '<tr><td>Acme Finance</td><td>$84,200 ARR</td><td><span class="status-badge status-risk" aria-label="Status: at risk">At risk</span></td></tr>',
        '<tr><td>Northstar Labs</td><td>$42,900 ARR</td><td><span class="status-badge status-pending" aria-label="Status: pending">Pending</span></td></tr>',
        '<tr><td>Harbor Clinic</td><td>$18,600 ARR</td><td><span class="status-badge status-delayed" aria-label="Status: delayed">Delayed</span></td></tr>',
        '</tbody></table></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-status-affordance')
  })

  it('flags chart-like visuals without labels, values, captions, or accessible context', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.revenue-chart { display: flex; align-items: end; gap: 10px; height: 160px; }',
        '.bar { width: 32px; background: #0f766e; border-radius: 6px 6px 0 0; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal revenue trend</h2><div class="revenue-chart">',
        '<span class="bar" style="height:40%"></span><span class="bar" style="height:65%"></span>',
        '<span class="bar" style="height:52%"></span><span class="bar" style="height:82%"></span>',
        '</div></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-chart-structure')
  })

  it('accepts chart-like visuals with captions and concrete data values', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.revenue-chart { display: flex; align-items: end; gap: 10px; height: 160px; }',
        '.bar { width: 32px; background: #0f766e; border-radius: 6px 6px 0 0; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<figure class="revenue-chart" aria-label="Renewal revenue trend from Q1 2026 to Q4 2026">',
        '<figcaption>Renewal ARR grew from $42,900 in Q1 2026 to $84,200 in Q4 2026.</figcaption>',
        '<span class="bar" data-value="$42,900" style="height:40%"></span><span class="bar" data-value="$61,700" style="height:65%"></span>',
        '<span class="bar" data-value="$58,300" style="height:52%"></span><span class="bar" data-value="$84,200" style="height:82%"></span>',
        '</figure>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-chart-structure')
  })

  it('flags chart-like visuals with generic chart labels', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.chart { display: flex; align-items: end; gap: 10px; height: 160px; }',
        '.bar { width: 32px; background: #0f766e; border-radius: 6px 6px 0 0; }',
        '.legend { display: flex; gap: 12px; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<figure class="chart" aria-label="Chart">',
        '<figcaption>Growth</figcaption>',
        '<span class="bar" data-value="$42,900" title="Series 1" style="height:40%"></span>',
        '<span class="bar" data-value="$61,700" title="Series 2" style="height:65%"></span>',
        '<span class="bar" data-value="$58,300" title="Series 3" style="height:52%"></span>',
        '<span class="bar" data-value="$84,200" title="Series 4" style="height:82%"></span>',
        '</figure>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('weak-chart-structure')
    expect(codes).toContain('generic-chart-labels')
  })

  it('accepts chart-like visuals with metric, period, and segment labels', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.revenue-chart { display: flex; align-items: end; gap: 10px; height: 160px; }',
        '.bar { width: 32px; background: #0f766e; border-radius: 6px 6px 0 0; }',
        '.legend { display: flex; gap: 12px; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<figure class="revenue-chart" aria-label="Renewal ARR by quarter for at-risk accounts">',
        '<figcaption>Renewal ARR rose from $42,900 in Q1 2026 to $84,200 in Q4 2026 while at-risk accounts fell by 4.</figcaption>',
        '<span class="bar" data-value="$42,900" title="Q1 renewal ARR" style="height:40%"></span>',
        '<span class="bar" data-value="$61,700" title="Q2 renewal ARR" style="height:65%"></span>',
        '<span class="bar" data-value="$58,300" title="Q3 renewal ARR" style="height:52%"></span>',
        '<span class="bar" data-value="$84,200" title="Q4 renewal ARR" style="height:82%"></span>',
        '</figure>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('generic-chart-labels')
  })

  it('flags repeated record lists built from generic containers', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.renewal-list { display: grid; gap: 12px; }',
        '.account-row { display: grid; grid-template-columns: 1fr auto auto; gap: 16px; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section class="renewal-list"><h2>Renewal accounts</h2>',
        '<div class="account-row"><span>Acme Finance</span><span>$84,200 ARR</span><span>At risk</span></div>',
        '<div class="account-row"><span>Northstar Labs</span><span>$42,900 ARR</span><span>Pending</span></div>',
        '<div class="account-row"><span>Harbor Clinic</span><span>$18,600 ARR</span><span>Delayed</span></div>',
        '</section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-list-structure')
  })

  it('accepts repeated records with semantic list structure', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.renewal-list { display: grid; gap: 12px; list-style: none; padding: 0; }',
        '.account-row { display: grid; grid-template-columns: 1fr auto auto; gap: 16px; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><ul class="renewal-list" aria-label="Renewal accounts at risk">',
        '<li class="account-row"><span>Acme Finance</span><span>$84,200 ARR</span><span>At risk</span></li>',
        '<li class="account-row"><span>Northstar Labs</span><span>$42,900 ARR</span><span>Pending</span></li>',
        '<li class="account-row"><span>Harbor Clinic</span><span>$18,600 ARR</span><span>Delayed</span></li>',
        '</ul></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-list-structure')
  })

  it('flags meaningful content modules without headings or accessible names', () => {
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
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><p>Northstar Labs renewal RN-2051 is delayed by 4 days, owns $42,900 ARR, and needs legal approval before Friday.</p>',
        '<button onclick="document.body.classList.toggle(\'assigned\')">Assign follow-up owner</button></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('unnamed-content-section')
  })

  it('accepts meaningful modules with visible or accessible names', () => {
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
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section aria-label="Delayed renewal follow-up"><p>Northstar Labs renewal RN-2051 is delayed by 4 days, owns $42,900 ARR, and needs legal approval before Friday.</p>',
        '<button onclick="document.body.classList.toggle(\'assigned\')">Assign follow-up owner</button></section>',
        '<section><h2>Account health sync</h2><p>Skeleton rows appear while renewal records refresh.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('unnamed-content-section')
  })

  it('flags center-everything layouts that read like template pages', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'body { text-align: center; display: flex; align-items: center; justify-content: center; }',
        'main { text-align: center; display: flex; align-items: center; justify-content: center; flex-direction: column; }',
        'section { text-align: center; }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
        '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('center-everything-layout')
  })

  it('accepts aligned sections with grids and data modules', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.hero { display: grid; grid-template-columns: minmax(0, 1fr) 320px; align-items: start; }',
        '.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }',
        'button:focus-visible { outline: 2px solid #111; }',
        '@media (max-width: 640px) { .hero { grid-template-columns: 1fr; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section class="hero"><div><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></div><aside>3 delayed tasks</aside></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
        '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('center-everything-layout')
  })

  it('flags interactive controls that only define focus states', () => {
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
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
        '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('missing-interaction-states')
  })

  it('accepts controls with hover and disabled state affordances', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        'button:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        'button[disabled] { opacity: .55; cursor: not-allowed; }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button><button disabled>Syncing accounts</button></section>',
        '<section><h2>Renewal accounts</h2><table><caption>Renewals at risk this week</caption><thead>',
        '<tr><th scope="col">Account</th><th scope="col">ARR</th><th scope="col">Status</th></tr>',
        '</thead><tbody><tr><td>Acme Finance</td><td>$84,200 ARR</td><td>At risk</td></tr></tbody></table></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('missing-interaction-states')
  })

  it('flags tabs and segmented controls without a selected state', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>',
        'main { font-size: clamp(16px, 2vw, 20px); }',
        '.segmented-control { display: inline-flex; gap: 4px; }',
        'button:focus-visible { outline: 2px solid #111; }',
        'button:hover { filter: brightness(.96); }',
        '@media (max-width: 640px) { main { padding: 16px; } }',
        '</style>',
        '</head>',
        '<body><header><nav><a href="#main">Queue</a></nav></header><main id="main">',
        '<section><h1>Review customer renewals</h1>',
        '<p>Mina Chen owns Acme Finance, renewal RN-2048, $84,200 ARR, due Jun 18, currently at risk after 3 delayed tasks.</p>',
        '<div class="segmented-control"><button>Accounts</button><button>Tasks</button><button>Notes</button></div>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><p>Loading state, empty state, error state.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).toContain('weak-tab-current-state')
  })

  it('accepts tabs with visible and accessible selected state', () => {
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
        '<button role="tab" aria-selected="true" class="is-active">Accounts</button>',
        '<button role="tab" aria-selected="false">Tasks</button><button role="tab" aria-selected="false">Notes</button></div>',
        '<button onclick="document.body.classList.toggle(\'planned\')">Confirm renewal plan</button></section>',
        '<section><h2>Renewal accounts</h2><p>Loading state, empty state, error state.</p></section>',
        '</main></body></html>'
      ].join('')
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-tab-current-state')
  })

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

  it('accepts named and decorative images', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>button:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
        '</head><body><main><h1>Customer profile</h1>',
        '<img src=".kun-design/assets/customer.png" alt="Portrait of Mina Chen">',
        '<img src=".kun-design/assets/ring.png" alt="">',
        '<img src=".kun-design/assets/grid.png" role="presentation">',
        '<button>Review account</button><p>Loading state, empty state, error state.</p></main></body></html>'
      ].join('')
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('missing-image-source')
    expect(codes).not.toContain('missing-image-alt')
    expect(codes).not.toContain('generic-image-alt')
  })

  it('flags multi-screen pages that do not link to sibling screens', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
        '</head><body><main><button>Start project</button><p>Loading state, empty state, error state.</p></main></body></html>'
      ].join(''),
      siblingScreens: [
        { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' }
      ]
    })

    expect(findings.map((finding) => finding.code)).toContain('missing-prototype-navigation')
  })

  it('flags multi-screen pages without a navigation landmark', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
        '</head><body><main><h1>Vendor queue</h1><a href="../home/v1.html">Open overview</a>',
        '<p>Loading state, empty state, error state.</p></main></body></html>'
      ].join(''),
      siblingScreens: [
        { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' }
      ]
    })

    expect(findings.map((finding) => finding.code)).toContain('missing-navigation-landmark')
  })

  it('accepts prototype links to sibling screens', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
        '</head><body><header><nav><a href="../home/v1.html">Home</a></nav></header>',
        '<main><a href="../settings/v1.html">Start project</a><p>Loading state, empty state, error state.</p></main></body></html>'
      ].join(''),
      siblingScreens: [
        { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' }
      ]
    })

    expect(findings.map((finding) => finding.code)).not.toContain('missing-prototype-navigation')
    expect(findings.map((finding) => finding.code)).not.toContain('missing-navigation-landmark')
  })

  it('flags multi-screen projects that link to only one sibling screen', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>.current{font-weight:700}a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
        '</head><body><header><nav><a href="../home/v1.html" aria-current="page" class="current">Home</a></nav></header>',
        '<main><h1>Vendor queue</h1><a href="../home/v1.html">Back to overview</a>',
        '<p>Loading state, empty state, error state.</p></main></body></html>'
      ].join(''),
      siblingScreens: [
        { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
        { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' },
        { name: 'Reports', htmlPath: '.kun-design/doc/reports/v1.html', prototypeHref: '../reports/v1.html' }
      ]
    })
    const codes = findings.map((finding) => finding.code)

    expect(codes).not.toContain('missing-prototype-navigation')
    expect(codes).toContain('weak-prototype-navigation-coverage')
  })

  it('accepts multi-screen projects that link to multiple sibling screens', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>.current{font-weight:700}a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
        '</head><body><header><nav><a href="../home/v1.html" aria-current="page" class="current">Home</a><a href="../settings/v1.html">Settings</a><a href="../reports/v1.html">Reports</a></nav></header>',
        '<main><h1>Vendor queue</h1><a href="../settings/v1.html">Review permissions</a>',
        '<p>Loading state, empty state, error state.</p></main></body></html>'
      ].join(''),
      siblingScreens: [
        { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
        { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' },
        { name: 'Reports', htmlPath: '.kun-design/doc/reports/v1.html', prototypeHref: '../reports/v1.html' }
      ]
    })

    expect(findings.map((finding) => finding.code)).not.toContain('weak-prototype-navigation-coverage')
  })

  it('flags multi-screen navigation without a current-page state', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
        '</head><body><header><nav><a href="../home/v1.html">Home</a><a href="../settings/v1.html">Settings</a></nav></header>',
        '<main><h1>Vendor queue</h1><p>Loading state, empty state, error state.</p></main></body></html>'
      ].join(''),
      siblingScreens: [
        { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
        { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' }
      ]
    })

    expect(findings.map((finding) => finding.code)).toContain('missing-navigation-current-state')
  })

  it('accepts multi-screen navigation with a visible or accessible current-page state', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>.current{font-weight:700}a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
        '</head><body><header><nav><a href="../home/v1.html" aria-current="page" class="current">Home</a><a href="../settings/v1.html">Settings</a></nav></header>',
        '<main><h1>Vendor queue</h1><p>Loading state, empty state, error state.</p></main></body></html>'
      ].join(''),
      siblingScreens: [
        { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' },
        { name: 'Settings', htmlPath: '.kun-design/doc/settings/v1.html', prototypeHref: '../settings/v1.html' }
      ]
    })

    expect(findings.map((finding) => finding.code)).not.toContain('missing-navigation-current-state')
  })

  it('accepts role navigation landmarks in multi-screen pages', () => {
    const findings = auditDesignHtmlQuality({
      html: [
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">',
        '<style>a:focus-visible{outline:2px solid #000}@media(max-width:640px){main{padding:16px}}</style>',
        '</head><body><header role="navigation"><a href="../home/v1.html">Home</a></header>',
        '<main><h1>Vendor queue</h1><a href="../settings/v1.html">Start review</a>',
        '<p>Loading state, empty state, error state.</p></main></body></html>'
      ].join(''),
      siblingScreens: [
        { name: 'Home', htmlPath: '.kun-design/doc/home/v1.html', prototypeHref: '../home/v1.html' }
      ]
    })

    expect(findings.map((finding) => finding.code)).not.toContain('missing-navigation-landmark')
  })
})

describe('formatDesignHtmlQualityFindings', () => {
  it('sorts critical findings first and renders a repair block', () => {
    const lines = formatDesignHtmlQualityFindings([
      { code: 'missing-focus-states', severity: 'warning', message: 'No focus.', suggestion: 'Add focus.' },
      { code: 'missing-viewport', severity: 'critical', message: 'No viewport.', suggestion: 'Add viewport.' }
    ])

    expect(lines[0]).toContain('Previous version quality audit')
    expect(lines[1]).toContain('[critical] missing-viewport')
    expect(lines[2]).toContain('[warning] missing-focus-states')
  })
})

describe('buildDesignHtmlQualityRepairPrompt', () => {
  it('turns findings into concrete design repair guidance', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-center-everything-layout',
          severity: 'warning',
          message: 'The rendered page centers every block.',
          suggestion: 'Add information architecture.'
        },
        {
          code: 'runtime-state-laundry-list',
          severity: 'warning',
          message: 'The rendered page lists state names instead of designing those states.',
          suggestion: 'Replace state-name lists.'
        },
        {
          code: 'runtime-weak-content-depth',
          severity: 'warning',
          message: 'The rendered page has too few meaningful content modules.',
          suggestion: 'Add modules.'
        },
        {
          code: 'runtime-weak-data-realism',
          severity: 'warning',
          message: 'The rendered page has little concrete domain data.',
          suggestion: 'Add concrete data.'
        },
        {
          code: 'runtime-weak-typography-constraints',
          severity: 'warning',
          message: 'The rendered page uses unstable typography constraints.',
          suggestion: 'Bound the type scale.'
        },
        {
          code: 'runtime-generic-action-copy',
          severity: 'warning',
          message: 'The rendered page uses generic CTA copy.',
          suggestion: 'Write specific action labels.'
        },
        {
          code: 'runtime-nested-card-layout',
          severity: 'warning',
          message: 'The rendered page nests cards.',
          suggestion: 'Flatten layout.'
        },
        {
          code: 'runtime-weak-table-structure',
          severity: 'warning',
          message: 'The rendered page has weak table structure.',
          suggestion: 'Add headers.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('自动修复这个页面预览中的设计质量问题')
    expect(prompt).not.toContain('严重设计质量问题')
    expect(prompt).toContain('只修改当前选中的 screen/page')
    expect(prompt).toContain('修复 playbook')
    expect(prompt).toContain('Content depth')
    expect(prompt).toContain('Information architecture')
    expect(prompt).toContain('Real content')
    expect(prompt).toContain('State coverage')
    expect(prompt).toContain('Typography')
    expect(prompt).toContain('visually dominant primary action')
    expect(prompt).toContain('card-in-card')
    expect(prompt).toContain('Data tables')
    expect(prompt).toContain('skeleton rows')
    expect(prompt).toContain('Resize 自适应硬性要求')
    expect(prompt).toContain('live, resizable viewport')
    expect(prompt).toContain('同步更新 DESIGN.md')
  })

  it('includes resize-adaptive repair guidance for overflow and fixed desktop frames', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-horizontal-overflow',
          severity: 'critical',
          message: 'The rendered page is wider than the viewport.',
          suggestion: 'Remove fixed-width wrappers.'
        },
        {
          code: 'runtime-fixed-desktop-frame',
          severity: 'warning',
          message: 'The page is locked to a desktop canvas.',
          suggestion: 'Use fluid max-widths.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Resize-adaptive layout')
    expect(prompt).toContain('html/body/root fill the frame')
    expect(prompt).toContain('HTML 必须跟随画布 frame/webview resize 自动适应')
    expect(prompt).toContain('no horizontal scroll')
  })

  it('includes a color-system playbook for scattered palette colors', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-color-system',
          severity: 'warning',
          message: 'The rendered page uses many hard-coded colors.',
          suggestion: 'Add palette tokens.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Color system')
    expect(prompt).toContain('palette tokens')
  })

  it('includes metric-context guidance for KPI cards without comparisons', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-metric-context',
          severity: 'warning',
          message: 'The rendered KPI cards have no comparison context.',
          suggestion: 'Add metric context.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Metric context')
    expect(prompt).toContain('previous-period deltas')
    expect(prompt).toContain('target/goal')
  })

  it('includes metric-specificity guidance for generic KPI labels', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-metric-card-labels',
          severity: 'warning',
          message: 'The rendered dashboard uses generic KPI labels.',
          suggestion: 'Replace generic scorecard labels.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Metric specificity')
    expect(prompt).toContain('Revenue, Users, Growth')
    expect(prompt).toContain('business object')
  })

  it('includes product-shell guidance for app surfaces without chrome', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-app-shell',
          severity: 'warning',
          message: 'The rendered dashboard has no app shell.',
          suggestion: 'Add product chrome.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Product shell')
    expect(prompt).toContain('top bar')
    expect(prompt).toContain('sidebar')
  })

  it('includes product-navigation guidance for generic dashboard nav labels', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-product-navigation',
          severity: 'warning',
          message: 'The rendered dashboard nav is generic.',
          suggestion: 'Replace navigation labels.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Product navigation')
    expect(prompt).toContain('Dashboard, Analytics')
    expect(prompt).toContain('domain-specific')
  })

  it('includes breadcrumb-label guidance for generic page paths', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-breadcrumb-labels',
          severity: 'warning',
          message: 'The rendered breadcrumb is generic.',
          suggestion: 'Replace breadcrumb labels.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Breadcrumb specificity')
    expect(prompt).toContain('Home, Dashboard, Details')
    expect(prompt).toContain('record IDs')
  })

  it('includes visual-anchor guidance for marketing pages without media', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-visual-anchor',
          severity: 'warning',
          message: 'The rendered landing page has no visual anchor.',
          suggestion: 'Add product preview media.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Visual anchor')
    expect(prompt).toContain('product preview')
    expect(prompt).toContain('media-led hero')
  })

  it('includes product-preview-detail guidance for empty mockup shells', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-product-preview-detail',
          severity: 'warning',
          message: 'The rendered product preview is empty.',
          suggestion: 'Add preview data.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Product preview detail')
    expect(prompt).toContain('concrete UI/data details')
    expect(prompt).toContain('dashboard rows')
  })

  it('includes visual-anchor specificity guidance for decorative-only visuals', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-decorative-visual-anchor',
          severity: 'warning',
          message: 'The rendered hero visual is abstract decoration.',
          suggestion: 'Replace decorative shapes.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Visual anchor specificity')
    expect(prompt).toContain('abstract blobs')
    expect(prompt).toContain('concrete UI mockup')
  })

  it('includes hero-viewport guidance for full-height marketing heroes', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-hero-viewport-composition',
          severity: 'warning',
          message: 'The rendered landing hero hides the next section.',
          suggestion: 'Expose the next section.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Hero viewport composition')
    expect(prompt).toContain('full-height marketing heroes')
    expect(prompt).toContain('next-section peek')
  })

  it('includes hero-title guidance for prompt-like page headings', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-meta-page-heading',
          severity: 'warning',
          message: 'The rendered page heading reads like a prompt.',
          suggestion: 'Rewrite H1.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Hero/title copy')
    expect(prompt).toContain('Marketing site for')
    expect(prompt).toContain('literal offer/category')
  })

  it('includes section-heading guidance for generic marketing sections', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-section-heading',
          severity: 'warning',
          message: 'The rendered page has generic section headings.',
          suggestion: 'Rewrite section headings.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Section headings')
    expect(prompt).toContain('Features')
    expect(prompt).toContain('workflow')
  })

  it('includes card-specificity guidance for duplicated repeated cards', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-duplicated-card-copy',
          severity: 'warning',
          message: 'Repeated cards reuse the same copy.',
          suggestion: 'Make cards distinct.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Card/module specificity')
    expect(prompt).toContain('distinct title')
    expect(prompt).toContain('target audience')
  })

  it('includes document-title guidance for missing or generic titles', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-document-title',
          severity: 'warning',
          message: 'The rendered document title is generic.',
          suggestion: 'Rename title.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Document title')
    expect(prompt).toContain('<title>')
    expect(prompt).toContain('Untitled')
  })

  it('includes secondary-action guidance for one-path first screens', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-secondary-action-path',
          severity: 'warning',
          message: 'The rendered first screen has no secondary path.',
          suggestion: 'Add a secondary CTA.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Secondary action path')
    expect(prompt).toContain('primary first-screen CTA')
    expect(prompt).toContain('Read case study')
  })

  it('includes trust-proof guidance for marketing pages without credibility signals', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-trust-proof',
          severity: 'warning',
          message: 'The rendered landing page has no trust proof.',
          suggestion: 'Add customer proof.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Trust proof')
    expect(prompt).toContain('customer logos')
    expect(prompt).toContain('case-study metrics')
  })

  it('includes trust-proof detail guidance for generic logo placeholders', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-trust-proof',
          severity: 'warning',
          message: 'The rendered logo cloud uses placeholder labels.',
          suggestion: 'Replace fake proof.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Trust proof detail')
    expect(prompt).toContain('Logo 1')
    expect(prompt).toContain('outcome metrics')
  })

  it('includes proof-metric guidance for generic vanity stats', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-vanity-metrics',
          severity: 'warning',
          message: 'The rendered proof section uses generic vanity metrics.',
          suggestion: 'Replace broad stats.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Proof metrics')
    expect(prompt).toContain('99% satisfaction')
    expect(prompt).toContain('case-study outcomes')
  })

  it('includes testimonial-attribution guidance for anonymous customer quotes', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-testimonial-attribution',
          severity: 'warning',
          message: 'The rendered testimonial has no source.',
          suggestion: 'Add attribution.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Testimonial attribution')
    expect(prompt).toContain('named person/company')
    expect(prompt).toContain('outcome context')
  })

  it('includes testimonial-copy guidance for generic customer praise', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-testimonial-copy',
          severity: 'warning',
          message: 'The rendered testimonial uses generic praise.',
          suggestion: 'Replace vague quote copy.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Testimonial copy')
    expect(prompt).toContain('Highly recommend')
    expect(prompt).toContain('case-study outcome')
  })

  it('includes feature-anatomy guidance for marketing pages without concrete capabilities', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-feature-anatomy',
          severity: 'warning',
          message: 'The rendered landing page has no concrete feature anatomy.',
          suggestion: 'Add capability sections.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Feature anatomy')
    expect(prompt).toContain('named product capabilities')
    expect(prompt).toContain('use-case sections')
  })

  it('includes feature-card detail guidance for generic capability cards', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-feature-card-detail',
          severity: 'warning',
          message: 'The rendered feature cards use generic capability copy.',
          suggestion: 'Replace generic feature cards.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Feature card detail')
    expect(prompt).toContain('Automation')
    expect(prompt).toContain('domain-specific labels')
  })

  it('includes pricing-structure guidance for incomplete plans pages', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-pricing-structure',
          severity: 'warning',
          message: 'The rendered pricing section is incomplete.',
          suggestion: 'Add plan structure.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Pricing structure')
    expect(prompt).toContain('billing cadence')
    expect(prompt).toContain('plan-specific CTAs')
  })

  it('includes pricing-plan detail guidance for generic plan filler', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-pricing-plan-detail',
          severity: 'warning',
          message: 'The rendered pricing cards use generic filler.',
          suggestion: 'Replace filler benefits.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Pricing plan detail')
    expect(prompt).toContain('All core features')
    expect(prompt).toContain('upgrade reasons')
  })

  it('includes pricing-plan CTA guidance for repeated generic plan actions', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-pricing-plan-action-labels',
          severity: 'warning',
          message: 'The rendered pricing cards repeat generic CTA labels.',
          suggestion: 'Replace repeated pricing CTAs.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Pricing plan CTAs')
    expect(prompt).toContain('Choose plan')
    expect(prompt).toContain('Start studio trial')
  })

  it('includes conversion-close guidance for landing pages without a final next step', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-conversion-close',
          severity: 'warning',
          message: 'The rendered landing page has no final conversion.',
          suggestion: 'Add a final CTA.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Conversion close')
    expect(prompt).toContain('FAQ')
    expect(prompt).toContain('contact/demo/signup form')
  })

  it('includes conversion-close detail guidance for generic final CTAs', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-conversion-close',
          severity: 'warning',
          message: 'The rendered landing page has a generic final CTA.',
          suggestion: 'Rewrite final CTA copy.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Conversion close detail')
    expect(prompt).toContain('Ready to get started')
    expect(prompt).toContain('next deliverable')
  })

  it('includes FAQ-anatomy guidance for thin frequently asked questions sections', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-faq-anatomy',
          severity: 'warning',
          message: 'The rendered FAQ has too little detail.',
          suggestion: 'Add real question and answer items.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('FAQ anatomy')
    expect(prompt).toContain('multiple concrete question/answer items')
    expect(prompt).toContain('pricing, migration, support, security')
  })

  it('includes FAQ answer-detail guidance for generic answers', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-faq-answers',
          severity: 'warning',
          message: 'The rendered FAQ has generic answers.',
          suggestion: 'Replace vague answers.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('FAQ answer detail')
    expect(prompt).toContain('Contact us')
    expect(prompt).toContain('plan limits')
  })

  it('includes FAQ question-specificity guidance for generic questions', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-faq-questions',
          severity: 'warning',
          message: 'The rendered FAQ has generic questions.',
          suggestion: 'Replace template questions.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('FAQ question specificity')
    expect(prompt).toContain('What is this')
    expect(prompt).toContain('real objections')
  })

  it('includes site-footer guidance for marketing pages without a real footer', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-site-footer',
          severity: 'warning',
          message: 'The rendered landing page has no complete footer.',
          suggestion: 'Add site footer.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Site footer')
    expect(prompt).toContain('secondary links')
    expect(prompt).toContain('copyright')
  })

  it('includes site-footer detail guidance for generic footer columns', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-site-footer-detail',
          severity: 'warning',
          message: 'The rendered footer uses generic columns.',
          suggestion: 'Replace footer columns.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Site footer detail')
    expect(prompt).toContain('Product, Company')
    expect(prompt).toContain('legal/status/social/help')
  })

  it('includes brand-navigation guidance for marketing pages without a site header', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-brand-navigation',
          severity: 'warning',
          message: 'The rendered landing page has no branded navigation.',
          suggestion: 'Add brand nav.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Brand navigation')
    expect(prompt).toContain('logo or wordmark')
    expect(prompt).toContain('key page sections')
  })

  it('includes brand-identity guidance for marketing pages with generic nav labels only', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-brand-identity',
          severity: 'warning',
          message: 'The rendered landing page has no visible brand identity.',
          suggestion: 'Add a wordmark.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Brand identity')
    expect(prompt).toContain('product, brand, person, or place name')
    expect(prompt).toContain('generic navigation labels')
  })

  it('includes portfolio-structure guidance for incomplete case-study pages', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-portfolio-structure',
          severity: 'warning',
          message: 'The rendered case studies have no real project cards.',
          suggestion: 'Add project cards.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Portfolio structure')
    expect(prompt).toContain('outcome metric')
    expect(prompt).toContain('View project')
  })

  it('includes portfolio project-detail guidance for placeholder project cards', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-portfolio-project-detail',
          severity: 'warning',
          message: 'The rendered case studies use placeholder project names.',
          suggestion: 'Replace placeholder project cards.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Portfolio project detail')
    expect(prompt).toContain('Project One')
    expect(prompt).toContain('outcome metrics')
  })

  it('includes a structured-records playbook for generic div record lists', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-list-structure',
          severity: 'warning',
          message: 'The rendered page uses div rows for records.',
          suggestion: 'Use list semantics.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Structured records')
    expect(prompt).toContain('ul/li')
    expect(prompt).toContain('role=list/listitem')
  })

  it('includes record-action guidance for static record tables', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-record-actions',
          severity: 'warning',
          message: 'The rendered record table has no row actions.',
          suggestion: 'Add row actions.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Record actions')
    expect(prompt).toContain('row actions')
    expect(prompt).toContain('bulk actions')
  })

  it('includes record-action specificity guidance for generic row actions', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-record-action-labels',
          severity: 'warning',
          message: 'The rendered record table uses generic row actions.',
          suggestion: 'Replace generic row actions.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Record action specificity')
    expect(prompt).toContain('View, Details, More')
    expect(prompt).toContain('Review renewal')
  })

  it('includes record-item specificity guidance for generic list titles', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-record-item-labels',
          severity: 'warning',
          message: 'The rendered record list uses generic item titles.',
          suggestion: 'Replace generic record titles.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Record item titles')
    expect(prompt).toContain('Item 1, Task 2')
    expect(prompt).toContain('concrete customer')
  })

  it('includes record-table-column guidance for generic table headers', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-record-table-columns',
          severity: 'warning',
          message: 'The rendered record table uses generic columns.',
          suggestion: 'Replace generic table headers.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Record table columns')
    expect(prompt).toContain('Name, Status, Date')
    expect(prompt).toContain('domain-specific fields')
  })

  it('includes record-discovery guidance for dense tables without controls', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-record-discovery-controls',
          severity: 'warning',
          message: 'The rendered table has no search or filters.',
          suggestion: 'Add record discovery controls.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Record discovery')
    expect(prompt).toContain('search')
    expect(prompt).toContain('pagination')
  })

  it('includes record-discovery specificity guidance for generic controls', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-record-discovery-controls',
          severity: 'warning',
          message: 'The rendered table uses generic discovery controls.',
          suggestion: 'Replace generic search and filter labels.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Record discovery specificity')
    expect(prompt).toContain('Search, Filter')
    expect(prompt).toContain('object-specific search labels')
  })

  it('includes destructive-action safety guidance for risky controls', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-destructive-action-safety',
          severity: 'warning',
          message: 'A destructive action has no safety affordance.',
          suggestion: 'Add confirmation or undo feedback.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Destructive action safety')
    expect(prompt).toContain('danger tone')
    expect(prompt).toContain('undo toast')
  })

  it('includes dialog-affordance guidance for incomplete modal surfaces', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-dialog-affordance',
          severity: 'warning',
          message: 'The rendered modal has no close action.',
          suggestion: 'Add dialog semantics.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Dialog affordance')
    expect(prompt).toContain('role="dialog"')
    expect(prompt).toContain('Close/Cancel/Dismiss')
  })

  it('includes dialog-title specificity guidance for generic modal titles', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-dialog-title',
          severity: 'warning',
          message: 'The rendered modal uses a generic title.',
          suggestion: 'Replace generic modal title.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Dialog title specificity')
    expect(prompt).toContain('Details, Confirmation')
    expect(prompt).toContain('specific object')
  })

  it('includes tab-state guidance for tabs without selected state', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-tab-current-state',
          severity: 'warning',
          message: 'The rendered tabs have no selected state.',
          suggestion: 'Mark the active tab.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Tab state')
    expect(prompt).toContain('aria-selected')
    expect(prompt).toContain('data-state="active"')
  })

  it('includes tab-label guidance for generic tab sets', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-tab-labels',
          severity: 'warning',
          message: 'The rendered tabs use generic labels.',
          suggestion: 'Replace generic tab labels.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Tab labels')
    expect(prompt).toContain('Overview, Details, Settings')
    expect(prompt).toContain('domain-specific views')
  })

  it('includes workflow progress guidance for static steppers', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-workflow-step-state',
          severity: 'warning',
          message: 'The rendered stepper has no current or completed state.',
          suggestion: 'Mark workflow progress.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Workflow progress')
    expect(prompt).toContain('current')
    expect(prompt).toContain('completed')
  })

  it('includes workflow-step-label guidance for generic steppers', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-workflow-step-labels',
          severity: 'warning',
          message: 'The rendered stepper uses generic step labels.',
          suggestion: 'Replace generic steps.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Workflow step labels')
    expect(prompt).toContain('Step 1, Step 2')
    expect(prompt).toContain('Connect source')
  })

  it('includes status-affordance guidance for plain status values', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-status-affordance',
          severity: 'warning',
          message: 'The rendered table leaves status values as plain text.',
          suggestion: 'Use badges or chips.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Status affordance')
    expect(prompt).toContain('badges')
    expect(prompt).toContain('chips')
  })

  it('includes state-recovery guidance for passive recoverable states', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-state-recovery-action',
          severity: 'warning',
          message: 'The rendered empty state has no next action.',
          suggestion: 'Add a recovery action.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('State recovery')
    expect(prompt).toContain('Clear filters')
    expect(prompt).toContain('Request access')
  })

  it('includes state-recovery-copy guidance for generic empty states', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-recoverable-state-copy',
          severity: 'warning',
          message: 'The rendered empty state is generic.',
          suggestion: 'Replace generic state copy.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('State recovery copy')
    expect(prompt).toContain('No data')
    expect(prompt).toContain('domain-specific next step')
  })

  it('includes feedback-message specificity guidance for generic toasts and alerts', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-feedback-message-copy',
          severity: 'warning',
          message: 'The rendered toast is generic.',
          suggestion: 'Replace generic feedback copy.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Feedback message specificity')
    expect(prompt).toContain('Success, Saved, Error')
    expect(prompt).toContain('action result')
  })

  it('includes a surface-radius playbook for over-rounded cards', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-over-rounded-card-styling',
          severity: 'warning',
          message: 'Cards are too rounded.',
          suggestion: 'Reduce card radius.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Surface radius')
    expect(prompt).toContain('6-8px')
    expect(prompt).toContain('product cards')
  })

  it('includes a data-visualization playbook for weak chart structures', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-chart-structure',
          severity: 'warning',
          message: 'The rendered chart has marks but no labels.',
          suggestion: 'Add labels and values.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Data visualization')
    expect(prompt).toContain('axis/legend labels')
    expect(prompt).toContain('accessible SVG title/desc')
  })

  it('includes chart-label specificity guidance for generic charts', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-chart-labels',
          severity: 'warning',
          message: 'The rendered chart uses generic labels.',
          suggestion: 'Replace generic chart labels.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Chart specificity')
    expect(prompt).toContain('Chart, Data, Growth')
    expect(prompt).toContain('business metric')
  })

  it('includes a module-naming playbook for unnamed content sections', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-unnamed-content-section',
          severity: 'warning',
          message: 'The rendered page has unnamed sections.',
          suggestion: 'Name each module.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Module naming')
    expect(prompt).toContain('visible heading')
    expect(prompt).toContain('aria-labelledby')
  })

  it('includes form-affordance guidance for multi-field forms', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-form-affordance',
          severity: 'warning',
          message: 'The rendered form has no helper or validation affordance.',
          suggestion: 'Add helper text.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Forms')
    expect(prompt).toContain('required/optional')
    expect(prompt).toContain('aria-describedby')
  })

  it('includes lead-form response guidance for marketing conversion forms', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-lead-form-response',
          severity: 'warning',
          message: 'The rendered lead form has no response states.',
          suggestion: 'Add conversion form states.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Lead form response')
    expect(prompt).toContain('submitting/loading')
    expect(prompt).toContain('success/confirmation')
    expect(prompt).toContain('error/validation')
  })

  it('includes form-field specificity guidance for generic lead forms', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-form-field-labels',
          severity: 'warning',
          message: 'The rendered lead form uses generic field labels.',
          suggestion: 'Replace generic form fields.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Form field specificity')
    expect(prompt).toContain('Name, Email, Message')
    expect(prompt).toContain('team size')
  })

  it('includes settings-control specificity guidance for generic settings controls', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-settings-control-labels',
          severity: 'warning',
          message: 'The rendered settings controls use generic labels.',
          suggestion: 'Replace generic settings controls.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Settings control specificity')
    expect(prompt).toContain('Option 1, Enable')
    expect(prompt).toContain('controlled object')
  })

  it('includes current-page navigation guidance for multi-screen prototypes', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-missing-navigation-current-state',
          severity: 'warning',
          message: 'The rendered navigation has no current page state.',
          suggestion: 'Mark the active page.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Prototype behavior')
    expect(prompt).toContain('sibling-screen navigation')
    expect(prompt).toContain('current-page state')
  })

  it('includes prototype coverage guidance for multi-page projects with shallow links', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'weak-prototype-navigation-coverage',
          severity: 'warning',
          message: 'The page only links to one sibling.',
          suggestion: 'Add more prototype links.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Prototype navigation coverage')
    expect(prompt).toContain('multiple relevant pages')
    expect(prompt).toContain('provided prototype hrefs')
  })

  it('includes a palette-range playbook for one-note color systems', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-one-note-palette',
          severity: 'warning',
          message: 'The rendered palette is dominated by one hue.',
          suggestion: 'Add a supporting accent.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Palette range')
    expect(prompt).toContain('distinct secondary accent')
  })

  it('includes a spacing-system playbook for uniform spacing', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-spacing-system',
          severity: 'warning',
          message: 'The rendered page repeats 16px spacing.',
          suggestion: 'Add a spacing scale.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Spacing system')
    expect(prompt).toContain('16px')
  })

  it('includes a type-hierarchy playbook for flat heading treatment', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-weak-type-hierarchy',
          severity: 'warning',
          message: 'The rendered page has flat heading treatment.',
          suggestion: 'Add type hierarchy.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Type hierarchy')
    expect(prompt).toContain('H1/H2')
    expect(prompt).toContain('body text')
  })

  it('includes a text-measure playbook for over-wide prose', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-wide-text-measure',
          severity: 'warning',
          message: 'The rendered page has wide prose.',
          suggestion: 'Constrain text measure.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Text measure')
    expect(prompt).toContain('60-72ch')
    expect(prompt).toContain('tables')
  })

  it('includes a layout-resilience playbook for missing resets around media', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-missing-layout-reset',
          severity: 'warning',
          message: 'The rendered page uses visual media without a resilient layout reset.',
          suggestion: 'Add box sizing and fluid media rules.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Layout resilience')
    expect(prompt).toContain('box-sizing')
    expect(prompt).toContain('fluid img/video/iframe')
  })

  it('includes media guidance for generic image descriptions', () => {
    const prompt = buildDesignHtmlQualityRepairPrompt(
      [
        {
          code: 'runtime-generic-image-alt',
          severity: 'warning',
          message: 'The rendered page uses generic image alt text.',
          suggestion: 'Rewrite image descriptions.'
        }
      ],
      'auto'
    )

    expect(prompt).toContain('Media')
    expect(prompt).toContain('specific alt text')
    expect(prompt).toContain('product, person, place, screen, or content')
  })
})

describe('runtime design quality findings', () => {
  it('selects critical and high-value warning findings for automatic repair', () => {
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-overlapping-text',
        severity: 'critical',
        message: 'Overlap',
        suggestion: 'Fix layout'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-data-realism',
        severity: 'warning',
        message: 'Thin data',
        suggestion: 'Add concrete data'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-content-depth',
        severity: 'warning',
        message: 'Shallow page',
        suggestion: 'Add modules'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-app-shell',
        severity: 'warning',
        message: 'Dashboard has no app chrome',
        suggestion: 'Add top bar or sidebar'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-product-navigation',
        severity: 'warning',
        message: 'Dashboard nav is generic',
        suggestion: 'Replace navigation labels'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-breadcrumb-labels',
        severity: 'warning',
        message: 'Breadcrumb trail is generic',
        suggestion: 'Replace breadcrumb labels'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-visual-anchor',
        severity: 'warning',
        message: 'Landing page has no visual anchor',
        suggestion: 'Add product preview media'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-product-preview-detail',
        severity: 'warning',
        message: 'Product preview is empty',
        suggestion: 'Add preview data'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-decorative-visual-anchor',
        severity: 'warning',
        message: 'Hero visual is abstract decoration',
        suggestion: 'Replace decorative shapes'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-trust-proof',
        severity: 'warning',
        message: 'Landing page has no trust proof',
        suggestion: 'Add customer proof'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-trust-proof',
        severity: 'warning',
        message: 'Logo cloud uses placeholder labels',
        suggestion: 'Replace fake proof'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-vanity-metrics',
        severity: 'warning',
        message: 'Proof section uses generic vanity metrics',
        suggestion: 'Replace broad stats'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-testimonial-attribution',
        severity: 'warning',
        message: 'Customer quote has no attribution',
        suggestion: 'Add testimonial source'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-testimonial-copy',
        severity: 'warning',
        message: 'Customer quote uses generic praise',
        suggestion: 'Replace vague quote copy'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-feature-anatomy',
        severity: 'warning',
        message: 'Landing page has no concrete feature anatomy',
        suggestion: 'Add feature sections'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-feature-card-detail',
        severity: 'warning',
        message: 'Feature cards use generic copy',
        suggestion: 'Replace generic feature cards'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-hero-viewport-composition',
        severity: 'warning',
        message: 'Landing hero hides the next section',
        suggestion: 'Expose next-section peek'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-secondary-action-path',
        severity: 'warning',
        message: 'Landing first screen has no secondary path',
        suggestion: 'Add secondary CTA'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-pricing-structure',
        severity: 'warning',
        message: 'Pricing page has weak plan structure',
        suggestion: 'Add pricing plan comparison'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-pricing-plan-detail',
        severity: 'warning',
        message: 'Pricing cards use generic filler',
        suggestion: 'Replace filler benefits'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-pricing-plan-action-labels',
        severity: 'warning',
        message: 'Pricing cards repeat generic actions',
        suggestion: 'Replace repeated plan CTAs'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-conversion-close',
        severity: 'warning',
        message: 'Landing page has no final conversion',
        suggestion: 'Add final CTA'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-conversion-close',
        severity: 'warning',
        message: 'Landing page has a generic final CTA',
        suggestion: 'Rewrite final CTA'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-faq-anatomy',
        severity: 'warning',
        message: 'FAQ section is too thin',
        suggestion: 'Add concrete FAQ items'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-faq-answers',
        severity: 'warning',
        message: 'FAQ section uses generic answers',
        suggestion: 'Replace vague answers'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-faq-questions',
        severity: 'warning',
        message: 'FAQ section uses generic questions',
        suggestion: 'Replace template questions'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-site-footer',
        severity: 'warning',
        message: 'Landing page has no complete footer',
        suggestion: 'Add site footer'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-site-footer-detail',
        severity: 'warning',
        message: 'Footer uses generic columns',
        suggestion: 'Replace footer columns'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-brand-navigation',
        severity: 'warning',
        message: 'Landing page has no branded navigation',
        suggestion: 'Add brand nav'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-brand-identity',
        severity: 'warning',
        message: 'Landing page has no visible brand identity',
        suggestion: 'Add a wordmark'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-portfolio-structure',
        severity: 'warning',
        message: 'Case study page has no project cards',
        suggestion: 'Add project structure'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-portfolio-project-detail',
        severity: 'warning',
        message: 'Case study cards use placeholder project labels',
        suggestion: 'Replace placeholders'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-typography-constraints',
        severity: 'warning',
        message: 'Unstable typography',
        suggestion: 'Bound type scale'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-action-copy',
        severity: 'warning',
        message: 'Generic CTA',
        suggestion: 'Use task-specific copy'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-nested-card-layout',
        severity: 'warning',
        message: 'Nested cards',
        suggestion: 'Flatten layout'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-over-rounded-card-styling',
        severity: 'warning',
        message: 'Over-rounded cards',
        suggestion: 'Reduce radius'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-table-structure',
        severity: 'warning',
        message: 'Weak table',
        suggestion: 'Add headers'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-record-table-columns',
        severity: 'warning',
        message: 'Generic table columns',
        suggestion: 'Replace generic headers'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-record-item-labels',
        severity: 'warning',
        message: 'Generic record item labels',
        suggestion: 'Replace generic record item titles'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-chart-structure',
        severity: 'warning',
        message: 'Weak chart',
        suggestion: 'Add labels and values'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-chart-labels',
        severity: 'warning',
        message: 'Generic chart labels',
        suggestion: 'Replace chart labels'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-list-structure',
        severity: 'warning',
        message: 'Weak record list',
        suggestion: 'Use list semantics'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-metric-context',
        severity: 'warning',
        message: 'KPI values lack context',
        suggestion: 'Add comparisons'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-metric-card-labels',
        severity: 'warning',
        message: 'Generic KPI labels',
        suggestion: 'Replace KPI labels'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-record-actions',
        severity: 'warning',
        message: 'Static record table',
        suggestion: 'Add row actions'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-record-action-labels',
        severity: 'warning',
        message: 'Generic row actions',
        suggestion: 'Replace row action labels'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-record-discovery-controls',
        severity: 'warning',
        message: 'Dense record table',
        suggestion: 'Add search and filters'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-record-discovery-controls',
        severity: 'warning',
        message: 'Generic record discovery controls',
        suggestion: 'Replace search and filter labels'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-destructive-action-safety',
        severity: 'warning',
        message: 'Unsafe destructive action',
        suggestion: 'Add confirmation and undo'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-dialog-affordance',
        severity: 'warning',
        message: 'Incomplete dialog',
        suggestion: 'Add dialog semantics'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-dialog-title',
        severity: 'warning',
        message: 'Generic dialog title',
        suggestion: 'Replace generic modal title'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-tab-current-state',
        severity: 'warning',
        message: 'Tabs have no selected state',
        suggestion: 'Mark active tab'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-tab-labels',
        severity: 'warning',
        message: 'Generic tab labels',
        suggestion: 'Replace tab labels'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-workflow-step-state',
        severity: 'warning',
        message: 'Stepper has no progress state',
        suggestion: 'Mark current and completed steps'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-workflow-step-labels',
        severity: 'warning',
        message: 'Stepper uses generic labels',
        suggestion: 'Replace generic step labels'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-status-affordance',
        severity: 'warning',
        message: 'Plain status values',
        suggestion: 'Use badges or chips'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-state-recovery-action',
        severity: 'warning',
        message: 'Passive empty state',
        suggestion: 'Add a recovery action'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-recoverable-state-copy',
        severity: 'warning',
        message: 'Generic empty state',
        suggestion: 'Replace generic state copy'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-feedback-message-copy',
        severity: 'warning',
        message: 'Generic toast',
        suggestion: 'Replace generic feedback copy'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-unnamed-content-section',
        severity: 'warning',
        message: 'Unnamed section',
        suggestion: 'Name each module'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-form-affordance',
        severity: 'warning',
        message: 'Weak form affordance',
        suggestion: 'Add helper text'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-lead-form-response',
        severity: 'warning',
        message: 'Lead form lacks response states',
        suggestion: 'Add submitting, success, and error feedback'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-form-field-labels',
        severity: 'warning',
        message: 'Generic lead form fields',
        suggestion: 'Replace generic form field labels'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-settings-control-labels',
        severity: 'warning',
        message: 'Generic settings controls',
        suggestion: 'Replace settings control labels'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-missing-navigation-current-state',
        severity: 'warning',
        message: 'Missing current navigation state',
        suggestion: 'Mark active page'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'weak-prototype-navigation-coverage',
        severity: 'warning',
        message: 'Only one sibling screen is linked',
        suggestion: 'Link additional prototype pages'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-color-system',
        severity: 'warning',
        message: 'Weak color system',
        suggestion: 'Add palette tokens'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-one-note-palette',
        severity: 'warning',
        message: 'One-note palette',
        suggestion: 'Add secondary accent'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-spacing-system',
        severity: 'warning',
        message: 'Weak spacing system',
        suggestion: 'Add spacing tokens'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-type-hierarchy',
        severity: 'warning',
        message: 'Flat type hierarchy',
        suggestion: 'Add type scale'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-wide-text-measure',
        severity: 'warning',
        message: 'Wide text measure',
        suggestion: 'Constrain prose'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-missing-layout-reset',
        severity: 'warning',
        message: 'Missing layout reset',
        suggestion: 'Add box sizing and fluid media rules'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-image-alt',
        severity: 'warning',
        message: 'Generic image descriptions',
        suggestion: 'Rewrite alt text'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-missing-interaction-states',
        severity: 'warning',
        message: 'No interaction states',
        suggestion: 'Add hover and disabled'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-center-everything-layout',
        severity: 'warning',
        message: 'Centered layout',
        suggestion: 'Add structure'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-state-laundry-list',
        severity: 'warning',
        message: 'State names only',
        suggestion: 'Design states'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-weak-first-screen-hierarchy',
        severity: 'warning',
        message: 'Weak first screen',
        suggestion: 'Add supporting content'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-meta-page-heading',
        severity: 'warning',
        message: 'Prompt-like H1',
        suggestion: 'Rewrite title'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-section-heading',
        severity: 'warning',
        message: 'Generic section headings',
        suggestion: 'Rewrite section headings'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-duplicated-card-copy',
        severity: 'warning',
        message: 'Duplicated card copy',
        suggestion: 'Rewrite repeated cards'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-missing-document-title',
        severity: 'warning',
        message: 'Missing document title',
        suggestion: 'Add title'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-generic-document-title',
        severity: 'warning',
        message: 'Generic document title',
        suggestion: 'Rename title'
      })
    ).toBe(true)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-thin-content',
        severity: 'info',
        message: 'Thin content',
        suggestion: 'Add content'
      })
    ).toBe(false)
    expect(
      shouldAutoRepairDesignHtmlFinding({
        code: 'runtime-unknown-polish-note',
        severity: 'warning',
        message: 'Unknown',
        suggestion: 'Review'
      })
    ).toBe(false)
  })

  it('normalizes untrusted webview results and caps noisy arrays', () => {
    const findings = normalizeRuntimeQualityFindings([
      { code: 'runtime-horizontal-overflow', severity: 'critical', message: 'Overflow', suggestion: 'Fix layout' },
      { code: '', severity: 'warning', message: 'bad', suggestion: 'bad' },
      { code: 'runtime-small-tap-targets', severity: 'unknown', message: 'Tiny', suggestion: 'Increase target size' }
    ])

    expect(findings).toEqual([
      { code: 'runtime-horizontal-overflow', severity: 'critical', message: 'Overflow', suggestion: 'Fix layout' },
      { code: 'runtime-small-tap-targets', severity: 'warning', message: 'Tiny', suggestion: 'Increase target size' }
    ])
  })

  it('caches runtime findings by normalized artifact path and merges by strongest severity', () => {
    clearDesignRuntimeQualityFindings('.kun-design/doc/page/v1.html')
    setDesignRuntimeQualityFindings('.kun-design\\doc\\page\\v1.html', [
      { code: 'runtime-low-contrast-text', severity: 'warning', message: 'Low contrast', suggestion: 'Darken text' }
    ])

    expect(getDesignRuntimeQualityFindings('.kun-design/doc/page/v1.html')).toMatchObject([
      { code: 'runtime-low-contrast-text', severity: 'warning' }
    ])

    const merged = mergeDesignHtmlQualityFindings(
      [{ code: 'runtime-low-contrast-text', severity: 'info', message: 'Less specific', suggestion: 'Review' }],
      getDesignRuntimeQualityFindings('.kun-design/doc/page/v1.html')
    )
    expect(merged).toMatchObject([
      { code: 'runtime-low-contrast-text', severity: 'warning', message: 'Low contrast' }
    ])
  })

  it('builds a DOM audit script for rendered layout and accessibility checks', () => {
    const script = buildDesignRuntimeQualityAuditScript()

    expect(script).toContain('runtime-horizontal-overflow')
    expect(script).toContain('runtime-fixed-desktop-frame')
    expect(script).toContain('runtime-center-everything-layout')
    expect(script).toContain('runtime-weak-color-system')
    expect(script).toContain('runtime-one-note-palette')
    expect(script).toContain('runtime-weak-spacing-system')
    expect(script).toContain('runtime-missing-layout-reset')
    expect(script).toContain('runtime-small-tap-targets')
    expect(script).toContain('runtime-weak-data-realism')
    expect(script).toContain('runtime-weak-content-depth')
    expect(script).toContain('runtime-weak-app-shell')
    expect(script).toContain('runtime-generic-product-navigation')
    expect(script).toContain('runtime-generic-breadcrumb-labels')
    expect(script).toContain('runtime-weak-brand-navigation')
    expect(script).toContain('runtime-weak-brand-identity')
    expect(script).toContain('runtime-weak-portfolio-structure')
    expect(script).toContain('runtime-generic-portfolio-project-detail')
    expect(script).toContain('runtime-weak-visual-anchor')
    expect(script).toContain('runtime-weak-product-preview-detail')
    expect(script).toContain('runtime-decorative-visual-anchor')
    expect(script).toContain('runtime-weak-trust-proof')
    expect(script).toContain('runtime-generic-trust-proof')
    expect(script).toContain('runtime-generic-vanity-metrics')
    expect(script).toContain('runtime-weak-testimonial-attribution')
    expect(script).toContain('runtime-generic-testimonial-copy')
    expect(script).toContain('runtime-weak-feature-anatomy')
    expect(script).toContain('runtime-generic-feature-card-detail')
    expect(script).toContain('runtime-weak-hero-viewport-composition')
    expect(script).toContain('runtime-weak-secondary-action-path')
    expect(script).toContain('runtime-weak-pricing-structure')
    expect(script).toContain('runtime-generic-pricing-plan-detail')
    expect(script).toContain('runtime-generic-pricing-plan-action-labels')
    expect(script).toContain('runtime-weak-conversion-close')
    expect(script).toContain('runtime-generic-conversion-close')
    expect(script).toContain('runtime-weak-faq-anatomy')
    expect(script).toContain('runtime-generic-faq-questions')
    expect(script).toContain('runtime-generic-faq-answers')
    expect(script).toContain('runtime-weak-site-footer')
    expect(script).toContain('runtime-generic-site-footer-detail')
    expect(script).toContain('runtime-state-laundry-list')
    expect(script).toContain('runtime-weak-typography-constraints')
    expect(script).toContain('runtime-weak-type-hierarchy')
    expect(script).toContain('runtime-wide-text-measure')
    expect(script).toContain('runtime-weak-chart-structure')
    expect(script).toContain('runtime-generic-chart-labels')
    expect(script).toContain('runtime-weak-table-structure')
    expect(script).toContain('runtime-generic-record-table-columns')
    expect(script).toContain('runtime-weak-list-structure')
    expect(script).toContain('runtime-weak-metric-context')
    expect(script).toContain('runtime-generic-metric-card-labels')
    expect(script).toContain('runtime-weak-record-actions')
    expect(script).toContain('runtime-generic-record-action-labels')
    expect(script).toContain('runtime-generic-record-item-labels')
    expect(script).toContain('runtime-weak-record-discovery-controls')
    expect(script).toContain('runtime-generic-record-discovery-controls')
    expect(script).toContain('runtime-weak-destructive-action-safety')
    expect(script).toContain('runtime-weak-dialog-affordance')
    expect(script).toContain('runtime-generic-dialog-title')
    expect(script).toContain('runtime-weak-tab-current-state')
    expect(script).toContain('runtime-generic-tab-labels')
    expect(script).toContain('runtime-weak-workflow-step-state')
    expect(script).toContain('runtime-generic-workflow-step-labels')
    expect(script).toContain('runtime-weak-status-affordance')
    expect(script).toContain('runtime-weak-state-recovery-action')
    expect(script).toContain('runtime-generic-recoverable-state-copy')
    expect(script).toContain('runtime-generic-feedback-message-copy')
    expect(script).toContain('runtime-unnamed-content-section')
    expect(script).toContain('runtime-weak-form-affordance')
    expect(script).toContain('runtime-weak-lead-form-response')
    expect(script).toContain('runtime-generic-form-field-labels')
    expect(script).toContain('runtime-generic-settings-control-labels')
    expect(script).toContain('runtime-low-contrast-text')
    expect(script).toContain('runtime-overlapping-text')
    expect(script).toContain('runtime-clipped-text')
    expect(script).toContain('runtime-dead-links')
    expect(script).toContain('runtime-missing-navigation-current-state')
    expect(script).toContain('runtime-weak-primary-action')
    expect(script).toContain('runtime-generic-action-copy')
    expect(script).toContain('runtime-missing-interaction-states')
    expect(script).toContain('runtime-weak-page-heading')
    expect(script).toContain('runtime-weak-first-screen-hierarchy')
    expect(script).toContain('runtime-nested-card-layout')
    expect(script).toContain('runtime-over-rounded-card-styling')
    expect(script).toContain('runtime-unlabeled-fields')
    expect(script).toContain('runtime-inert-form-submission')
    expect(script).toContain('runtime-unnamed-icon-controls')
    expect(script).toContain('runtime-vague-template-copy')
    expect(script).toContain('runtime-generic-page-heading')
    expect(script).toContain('runtime-meta-page-heading')
    expect(script).toContain('runtime-generic-section-heading')
    expect(script).toContain('runtime-duplicated-card-copy')
    expect(script).toContain('runtime-missing-document-title')
    expect(script).toContain('runtime-generic-document-title')
    expect(script).toContain('runtime-missing-image-alt')
    expect(script).toContain('runtime-generic-image-alt')
    expect(script).toContain('runtime-broken-images')
    expect(script).toContain('generating design preview')
  })

  it('summarizes runtime findings for the canvas quality badge', () => {
    expect(summarizeDesignHtmlQualityStatus([], false)).toMatchObject({
      kind: 'checking',
      label: 'Quality check'
    })

    expect(summarizeDesignHtmlQualityStatus([], true)).toMatchObject({
      kind: 'passed',
      label: 'Quality OK'
    })

    expect(
      summarizeDesignHtmlQualityStatus(
        [{ code: 'runtime-small-tap-targets', severity: 'warning', message: 'Tiny', suggestion: 'Fix' }],
        true
      )
    ).toMatchObject({ kind: 'critical', label: 'Auto repair 1', count: 1 })

    expect(
      summarizeDesignHtmlQualityStatus(
        [{ code: 'runtime-unknown-polish-note', severity: 'warning', message: 'Review spacing', suggestion: 'Review' }],
        true
      )
    ).toMatchObject({ kind: 'warning', label: 'Quality 1', count: 1 })

    expect(
      summarizeDesignHtmlQualityStatus(
        [
          { code: 'runtime-small-tap-targets', severity: 'warning', message: 'Tiny', suggestion: 'Fix' },
          { code: 'runtime-horizontal-overflow', severity: 'critical', message: 'Overflow', suggestion: 'Fix' }
        ],
        true
      )
    ).toMatchObject({ kind: 'critical', count: 2, label: 'Auto repair 2' })
  })

  it('builds compact detail rows for the canvas quality panel', () => {
    expect(summarizeDesignHtmlQualityDetails([], false)).toMatchObject({
      heading: 'Quality check running',
      rows: [],
      overflowCount: 0
    })

    expect(summarizeDesignHtmlQualityDetails([], true)).toMatchObject({
      heading: 'Quality OK',
      rows: [],
      overflowCount: 0
    })

    const details = summarizeDesignHtmlQualityDetails(
      [
        { code: 'runtime-low-contrast-text', severity: 'warning', message: 'Low contrast', suggestion: 'Darken text' },
        { code: 'runtime-weak-primary-action', severity: 'warning', message: 'No CTA', suggestion: 'Add CTA' },
        { code: 'runtime-weak-page-heading', severity: 'warning', message: 'No heading', suggestion: 'Add H1' },
        { code: 'runtime-clipped-text', severity: 'critical', message: 'Clipped text', suggestion: 'Allow wrapping' },
        { code: 'runtime-horizontal-overflow', severity: 'critical', message: 'Overflow', suggestion: 'Constrain layout' },
        { code: 'notes-missing-states', severity: 'info', message: 'No states', suggestion: 'Document states' }
      ],
      true,
      2
    )

    expect(details).toMatchObject({
      heading: 'Needs auto repair',
      body: '2 critical, 3 warnings, 1 note found in the rendered preview.',
      overflowCount: 4
    })
    expect(details.rows.map((finding) => finding.code)).toEqual([
      'runtime-clipped-text',
      'runtime-horizontal-overflow'
    ])
  })
})
