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

describe("auditDesignHtmlQuality dialogs, cards, and records", () => {
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
})
