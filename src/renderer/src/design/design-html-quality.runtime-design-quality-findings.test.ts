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

describe("runtime design quality findings", () => {
    it('limits automatic repair to critical rendered failures', () => {
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
          code: 'runtime-horizontal-overflow',
          severity: 'critical',
          message: 'Overflow',
          suggestion: 'Fix layout'
        })
      ).toBe(true)
      expect(
        shouldAutoRepairDesignHtmlFinding({
          code: 'runtime-small-tap-targets',
          severity: 'warning',
          message: 'Tiny',
          suggestion: 'Increase target size'
        })
      ).toBe(false)
      expect(
        shouldAutoRepairDesignHtmlFinding({
          code: 'runtime-weak-data-realism',
          severity: 'warning',
          message: 'Thin data',
          suggestion: 'Add concrete data'
        })
      ).toBe(false)
      expect(
        shouldAutoRepairDesignHtmlFinding({
          code: 'runtime-thin-content',
          severity: 'info',
          message: 'Thin content',
          suggestion: 'Add content'
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
      expect(script).toContain('isPrototypeBackHandler')
      expect(script).toContain('history\\\\.back')
      expect(script).toContain('history\\\\.go')
      expect(script).toContain('runtime-missing-navigation-current-state')
      expect(script).toContain('isLocalPrototypeRouteHref')
      expect(script).toContain('hashRouteHref')
      expect(script).toContain('startsWith(\'#\')')
      expect(script).toContain("raw.startsWith('?')")
      expect(script).toContain('mailto')
      expect(script).toContain('url.host !== base.host')
      expect(script).toContain('[data-href]')
      expect(script).toContain('[data-prototype-href]')
      expect(script).toContain("form.getAttribute('data-prototype-target')")
      expect(script).toContain('button[data-prototype-target]')
      expect(script).toContain('history\\\\.(?:pushState|replaceState)')
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
      expect(new Function(`return ${script}`)()).toEqual([])
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
      ).toMatchObject({ kind: 'warning', label: 'Quality 1', count: 1 })
  
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
      ).toMatchObject({ kind: 'critical', count: 1, label: 'Auto repair 1' })
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
