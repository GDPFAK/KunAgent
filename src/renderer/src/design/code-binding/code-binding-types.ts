export type DesignCodeBindingKind = 'dom-node' | 'component' | 'route' | 'file' | 'generated-code'

export type DesignCodeBindingStatus = 'active' | 'stale' | 'missing'

export type DesignCodeBindingTarget = {
  sourceFile?: string
  componentName?: string
  exportName?: string
  domId?: string
  onlookId?: string
  astPath?: string
  routePath?: string
  line?: number
  column?: number
}

export type DesignCodeBinding = {
  id: string
  designObjectId: string
  kind: DesignCodeBindingKind
  target: DesignCodeBindingTarget
  status: DesignCodeBindingStatus
  createdAt: string
  updatedAt?: string
  metadata?: Record<string, unknown>
}
