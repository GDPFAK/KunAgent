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

describe("buildDesignHtmlQualityRepairPrompt product and marketing guidance", () => {
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
    it('keeps the selected app design target in quality repair prompts', () => {
      const prompt = buildDesignHtmlQualityRepairPrompt(
        [
          {
            code: 'runtime-horizontal-overflow',
            severity: 'critical',
            message: 'The rendered page is wider than the viewport.',
            suggestion: 'Remove fixed-width wrappers.'
          }
        ],
        'manual',
        { designTarget: 'app' }
      )
  
      expect(prompt).toContain('Design context')
      expect(prompt).toContain('Target: App')
      expect(prompt).toContain('390x844')
      expect(prompt).toContain('mobile-first app screens')
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
})
