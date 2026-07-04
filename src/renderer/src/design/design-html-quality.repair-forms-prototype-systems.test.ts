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

describe("buildDesignHtmlQualityRepairPrompt forms, prototype, and system guidance", () => {
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
      expect(prompt).toContain('data-prototype-href')
      expect(prompt).toContain('data-prototype-target')
      expect(prompt).toContain('history.back()')
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
      expect(prompt).toContain('data-href')
      expect(prompt).toContain('provided prototype hrefs or exact screen titles')
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
