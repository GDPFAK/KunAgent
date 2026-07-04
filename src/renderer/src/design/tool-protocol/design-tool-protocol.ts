import { executeBindCodeInvocation } from './bind-code-executor'
import { executeDesignCritiqueInvocation } from './critique-executor'
import { executeDesignExportInvocation } from './export-executor'
import { executeGenerateDirectionsInvocation } from './generate-directions-executor'
import { executeGenerateScreenInvocation } from './generate-screen-executor'
import { executeImplementInvocation } from './implement-executor'
import { executeDesignOpsInvocation } from './ops-executor'
import { executeDesignPlanInvocation } from './plan-executor'
import { executeRepairInvocation } from './repair-executor'
import { executeDesignSystemInvocation } from './system-executor'
import type { DesignToolInvocation, DesignToolInvocationResult } from './protocol-types'
export type { DesignToolInvocation, DesignToolInvocationResult } from './protocol-types'

export type DesignToolProtocolCategory =
  | 'planning'
  | 'generation'
  | 'operations'
  | 'review'
  | 'system'
  | 'code'
  | 'export'

export type DesignToolProtocolTool = {
  id: string
  category: DesignToolProtocolCategory
  purpose: string
  inputs: string[]
  outputs: string[]
  operationTypes?: string[]
  requiresSelection?: boolean
  requiresCodeBinding?: boolean
}

export type DesignToolProtocolManifest = {
  version: 1
  kind: 'kun.design.tool-protocol'
  source: 'kun-design-mode'
  tools: DesignToolProtocolTool[]
}

export const DESIGN_TOOL_PROTOCOL_RESOURCE_ID = 'design-tool-protocol'

export const DESIGN_TOOL_PROTOCOL_TOOLS: DesignToolProtocolTool[] = [
  {
    id: 'design.plan',
    category: 'planning',
    purpose: 'Produce the work plan, direction strategy, constraints, and next operation sequence.',
    inputs: ['user request', 'Design Graph', 'DESIGN.md', 'selected objects', 'direction scorecards'],
    outputs: ['plan summary', 'direction strategy', 'tool sequence']
  },
  {
    id: 'design.ops',
    category: 'operations',
    purpose: 'Apply validated Design Operations against the canvas source of truth.',
    inputs: ['DesignOperation[]', 'target object ids'],
    outputs: ['operation journal entry', 'affected ids', 'schema errors'],
    operationTypes: [
      'create_frame',
      'create_shape',
      'update_shape',
      'move_shape',
      'resize_shape',
      'apply_token',
      'define_component',
      'link_prototype'
    ]
  },
  {
    id: 'design.generate_screen',
    category: 'generation',
    purpose: 'Create or iterate one screen from prompt, image, references, and existing design context.',
    inputs: ['prompt', 'design target', 'tokens', 'components', 'nearby canvas context'],
    outputs: ['HtmlFrame', 'screen DESIGN.md', 'operation journal entry']
  },
  {
    id: 'design.generate_directions',
    category: 'generation',
    purpose: 'Create multiple named UI directions for the same product goal.',
    inputs: ['prompt', 'direction count', 'design target', 'reference assets'],
    outputs: ['direction frames', 'rationale', 'direction scorecards']
  },
  {
    id: 'design.critique',
    category: 'review',
    purpose: 'Evaluate selected frames or flows for layout, hierarchy, tokens, accessibility, and code readiness.',
    inputs: ['selected object ids', 'Design Graph', 'quality checks'],
    outputs: ['agentNote findings', 'validation journal entry'],
    requiresSelection: true
  },
  {
    id: 'design.repair',
    category: 'review',
    purpose: 'Repair critique findings through focused design operations.',
    inputs: ['agentNote findings', 'operation journal', 'selected objects'],
    outputs: ['DesignOperation[]', 'resolved findings']
  },
  {
    id: 'design.system',
    category: 'system',
    purpose: 'Define, update, validate, or apply tokens, components, variants, and states.',
    inputs: ['selected objects', 'DesignSystem graph summary', 'style samples'],
    outputs: ['tokens', 'components', 'variant matrix', 'lint findings'],
    operationTypes: ['define_token', 'apply_token', 'define_component', 'instantiate_component', 'lint_design']
  },
  {
    id: 'design.bind_code',
    category: 'code',
    purpose: 'Create or refresh code bindings from running app frames, DOM/source ids, routes, and components.',
    inputs: ['running app frames', 'DOM source snapshot', 'existing bindings'],
    outputs: ['CodeBinding[]', 'stale/missing binding report'],
    requiresCodeBinding: false
  },
  {
    id: 'design.implement',
    category: 'code',
    purpose: 'Apply bound design changes to source code through grouped code transforms.',
    inputs: ['operation journal', 'active CodeBinding[]', 'workspace adapter'],
    outputs: ['code change requests', 'written files', 'skipped requests'],
    requiresCodeBinding: true
  },
  {
    id: 'design.export',
    category: 'export',
    purpose: 'Export DESIGN.md, Penpot handoff, MCP resources, image/prototype, or code handoff payloads.',
    inputs: ['DesignDocument', 'Design Graph', 'DesignSystem', 'artifacts'],
    outputs: ['DESIGN.md', 'resource surface', 'handoff packages']
  }
]

export function buildDesignToolProtocolManifest(): DesignToolProtocolManifest {
  return {
    version: 1,
    kind: 'kun.design.tool-protocol',
    source: 'kun-design-mode',
    tools: DESIGN_TOOL_PROTOCOL_TOOLS
  }
}

export function designToolProtocolSummaryLines(
  tools: readonly DesignToolProtocolTool[] = DESIGN_TOOL_PROTOCOL_TOOLS
): string[] {
  return tools.map((tool) => {
    const flags = [
      tool.requiresSelection ? 'selection required' : '',
      tool.requiresCodeBinding ? 'code binding required' : ''
    ].filter(Boolean)
    const suffix = flags.length > 0 ? `; ${flags.join('; ')}` : ''
    return `- ${tool.id} (${tool.category}): ${tool.purpose}${suffix}`
  })
}

export function designToolProtocolById(
  id: string,
  tools: readonly DesignToolProtocolTool[] = DESIGN_TOOL_PROTOCOL_TOOLS
): DesignToolProtocolTool | undefined {
  return tools.find((tool) => tool.id === id)
}

function unsupportedToolResult(invocation: DesignToolInvocation): DesignToolInvocationResult {
  const tool = designToolProtocolById(invocation.toolId)
  return {
    ok: false,
    toolId: invocation.toolId,
    status: 'unsupported',
    affectedIds: [],
    errors: [{
      code: 'UNSUPPORTED_TOOL',
      message: tool
        ? `${invocation.toolId} is declared but does not have a local executor yet.`
        : `Unknown design tool: ${invocation.toolId}`
    }],
    summaryLines: [
      tool
        ? `${invocation.toolId}: executor pending`
        : `${invocation.toolId}: unknown design tool`
    ]
  }
}

export function executeDesignToolInvocation(
  invocation: DesignToolInvocation
): DesignToolInvocationResult {
  if (invocation.toolId === 'design.plan') return executeDesignPlanInvocation(invocation)
  if (invocation.toolId === 'design.ops') return executeDesignOpsInvocation(invocation)
  if (invocation.toolId === 'design.generate_screen') return executeGenerateScreenInvocation(invocation)
  if (invocation.toolId === 'design.generate_directions') return executeGenerateDirectionsInvocation(invocation)
  if (invocation.toolId === 'design.critique') return executeDesignCritiqueInvocation(invocation)
  if (invocation.toolId === 'design.repair') return executeRepairInvocation(invocation)
  if (invocation.toolId === 'design.system') return executeDesignSystemInvocation(invocation)
  if (invocation.toolId === 'design.bind_code') return executeBindCodeInvocation(invocation)
  if (invocation.toolId === 'design.implement') return executeImplementInvocation(invocation)
  if (invocation.toolId === 'design.export') return executeDesignExportInvocation(invocation)
  return unsupportedToolResult(invocation)
}
