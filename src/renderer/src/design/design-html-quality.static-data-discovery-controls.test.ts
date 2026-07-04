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

describe("auditDesignHtmlQuality data discovery and controls", () => {
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
})
