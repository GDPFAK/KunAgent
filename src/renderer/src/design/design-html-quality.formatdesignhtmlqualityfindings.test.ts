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

describe("formatDesignHtmlQualityFindings", () => {
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
