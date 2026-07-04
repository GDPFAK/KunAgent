import type { DesignHtmlQualityAuditInput, DesignHtmlQualityFinding } from './types'
import { stripHtmlComments, styleContent, textContent } from './helper-index'
import { auditDocumentAndStateQuality } from './static-audit-document-and-states'
import { auditProductAndMarketingQuality } from './static-audit-product-and-marketing'
import { auditCommerceAndStructureQuality } from './static-audit-commerce-and-structure'
import { auditLayoutAndInteractionQuality } from './static-audit-layout-and-interaction'
import { auditAccessibilityAndPrototypeQuality } from './static-audit-accessibility-and-prototype'

export function auditDesignHtmlQuality(input: DesignHtmlQualityAuditInput): DesignHtmlQualityFinding[] {
  const html = input.html ?? ''
  const normalized = stripHtmlComments(html)
  const styles = styleContent(html)
  const lower = normalized.toLowerCase()
  const visibleText = textContent(normalized)
  const findings: DesignHtmlQualityFinding[] = []
  const ctx = { html, normalized, styles, lower, visibleText }
  auditDocumentAndStateQuality(input, ctx, findings)
  auditProductAndMarketingQuality(input, ctx, findings)
  auditCommerceAndStructureQuality(input, ctx, findings)
  auditLayoutAndInteractionQuality(input, ctx, findings)
  auditAccessibilityAndPrototypeQuality(input, ctx, findings)
  return findings
}
