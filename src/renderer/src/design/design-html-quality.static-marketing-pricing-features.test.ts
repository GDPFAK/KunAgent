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

describe("auditDesignHtmlQuality marketing proof, pricing, and features", () => {
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
})
