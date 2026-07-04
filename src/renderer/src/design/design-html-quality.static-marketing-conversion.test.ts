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

describe("auditDesignHtmlQuality marketing conversion sections", () => {
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
})
