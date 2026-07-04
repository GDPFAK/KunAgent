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

describe("auditDesignHtmlQuality brand, portfolio, type, and actions", () => {
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
})
