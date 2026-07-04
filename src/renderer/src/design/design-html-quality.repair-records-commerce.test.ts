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

describe("buildDesignHtmlQualityRepairPrompt records and commerce guidance", () => {
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
})
