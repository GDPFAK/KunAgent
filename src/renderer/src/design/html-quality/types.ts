export type DesignHtmlQualitySeverity = 'critical' | 'warning' | 'info'
export type DesignHtmlQualityFinding = {
  code: string
  severity: DesignHtmlQualitySeverity
  message: string
  suggestion: string
}
export type DesignRuntimeQualityPayload = {
  artifactId: string
  artifactRelativePath: string
  shapeId?: string
  findings: DesignHtmlQualityFinding[]
}
export type DesignHtmlQualityStatus =
  | { kind: 'checking'; label: string; title: string; count: 0 }
  | { kind: 'passed'; label: string; title: string; count: 0 }
  | { kind: 'warning'; label: string; title: string; count: number }
  | { kind: 'critical'; label: string; title: string; count: number }
export type DesignHtmlQualityDetails = {
  heading: string
  body: string
  rows: DesignHtmlQualityFinding[]
  overflowCount: number
}
export type DesignHtmlQualityAuditSibling = {
  name?: string
  htmlPath: string
  prototypeHref?: string
}
export type DesignHtmlQualityAuditInput = {
  html: string
  designNotes?: string
  siblingScreens?: DesignHtmlQualityAuditSibling[]
}
export type ParsedCssColor = {
  h: number
  s: number
  l: number
}
