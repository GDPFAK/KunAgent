import { DESIGN_RESIZE_RESPONSIVE_LINES, formatDesignContextLines, type DesignContext } from '../design-context'
import type { DesignHtmlQualityFinding, DesignHtmlQualitySeverity } from './types'
import { designQualityRepairDirective, mergeDesignHtmlQualityFindings } from './layout-and-runtime-findings'

export function buildDesignHtmlQualityRepairPrompt(
  findings: DesignHtmlQualityFinding[],
  mode: 'auto' | 'manual',
  designContext?: DesignContext
): string {
  const repairFindings = mergeDesignHtmlQualityFindings(findings)
  const issueLimit = mode === 'auto' ? 3 : 6
  const directiveLimit = 8
  const designContextLines = designContext ? formatDesignContextLines(designContext) : []
  const directives = repairFindings.reduce<string[]>((items, finding) => {
    const directive = designQualityRepairDirective(finding.code)
    if (directive && !items.includes(directive)) items.push(directive)
    return items
  }, [])
  const issueSummary = repairFindings
    .slice(0, issueLimit)
    .map((finding) => `- [${finding.severity}] ${finding.code}: ${finding.message}\n  建议：${finding.suggestion}`)

  return [
    mode === 'auto'
      ? '自动修复这个页面预览中的设计质量问题。'
      : '修复这个页面预览中的设计质量问题。',
    '只修改当前选中的 screen/page；保留页面意图、品牌风格和已有可用内容，不要整页重写。',
    ...(designContextLines.length > 0 ? ['', ...designContextLines] : []),
    '',
    '优先修复以下审计项：',
    ...issueSummary,
    ...(directives.length > 0
      ? ['', '修复 playbook:', ...directives.slice(0, directiveLimit).map((directive) => `- ${directive}`)]
      : []),
    '',
    'Resize 自适应硬性要求:',
    ...DESIGN_RESIZE_RESPONSIVE_LINES.slice(1).map((line) => `- ${line.replace(/^- /, '')}`),
    '',
    '完成要求：HTML 必须跟随画布 frame/webview resize 自动适应，无文本重叠、无横向溢出、无裁切；补真实内容、可见状态和可用交互；同步更新 DESIGN.md 的相关说明。'
  ].join('\n')
}

export function severityRank(severity: DesignHtmlQualitySeverity): number {
  switch (severity) {
    case 'critical':
      return 0
    case 'warning':
      return 1
    case 'info':
      return 2
  }
}
