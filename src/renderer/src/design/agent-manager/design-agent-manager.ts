import type { CanvasDocument } from '../canvas/canvas-types'
import { isHtmlFrame } from '../canvas/canvas-types'
import type { DesignSystem } from '../canvas/design-system-types'
import { buildDesignModeSurfaceManifest } from '../design-mode/design-mode-surface'
import type {
  DesignPagesRunState,
  ParallelDesignPageState
} from '../design-workspace-store-types'
import type { DesignArtifact, DesignDocument, DesignIntentMode } from '../design-types'
import { attachWorkflowToAgentRoles } from './design-agent-manager-workflow'

export type DesignAgentManagerRoleId =
  | 'planner'
  | 'generator'
  | 'systemizer'
  | 'critic'
  | 'code-binder'
  | 'exporter'

export type DesignAgentManagerStatus = 'running' | 'ready' | 'idle' | 'blocked'

export type DesignAgentManagerRole = {
  id: DesignAgentManagerRoleId
  labelKey: string
  status: DesignAgentManagerStatus
  detailKey: string
  detailOptions?: Record<string, number | string>
  progress?: { done: number; total: number }
  intentMode?: DesignIntentMode
  actionPrompt?: string
  workflowStepId?: string
  workflowToolId?: string
  workflowToolCallLine?: string
}

export type DesignAgentManagerModel = {
  roles: DesignAgentManagerRole[]
  screenCount: number
  directionCount: number
  objectCount: number
  runningCount: number
  blockedCount: number
  readyCount: number
  recommendedRoleId: DesignAgentManagerRoleId | null
}

export type BuildDesignAgentManagerModelOptions = {
  document: DesignDocument | null
  canvasDocument: CanvasDocument
  designSystem: DesignSystem
  pagesRun: DesignPagesRunState | null
  parallelPageStates: Record<string, ParallelDesignPageState>
  artifacts?: readonly DesignArtifact[]
}

type AgentManagerCounts = {
  screenCount: number
  directionCount: number
  objectCount: number
  tokenCount: number
  componentCount: number
  activeBindingCount: number
  staleBindingCount: number
  missingBindingCount: number
  journalEntryCount: number
  critiqueEntryCount: number
}

type RoleAction = {
  intentMode: DesignIntentMode
  prompt: string
}

const ROLE_LABEL_KEYS: Record<DesignAgentManagerRoleId, string> = {
  planner: 'designAgentManagerPlanner',
  generator: 'designAgentManagerGenerator',
  systemizer: 'designAgentManagerSystemizer',
  critic: 'designAgentManagerCritic',
  'code-binder': 'designAgentManagerCodeBinder',
  exporter: 'designAgentManagerExporter'
}

function htmlScreenArtifacts(artifacts: readonly DesignArtifact[]): DesignArtifact[] {
  return artifacts.filter((artifact) => artifact.kind === 'html' && !artifact.role)
}

function countHtmlFrames(doc: CanvasDocument): number {
  return Object.values(doc.objects).filter((shape) => shape && isHtmlFrame(shape)).length
}

function countDirections(artifacts: readonly DesignArtifact[]): number {
  const ids = new Set<string>()
  for (const artifact of artifacts) {
    if (artifact.direction && artifact.direction.status !== 'archived') ids.add(artifact.direction.id)
  }
  return ids.size
}

function countCritiqueEntries(doc: CanvasDocument): number {
  return (doc.operationJournal ?? []).filter((entry) =>
    entry.operations.some((operation) => operation.type === 'lint_design') ||
    /critique|lint|repair|validate/i.test(entry.label)
  ).length
}

function countsFor(options: BuildDesignAgentManagerModelOptions): AgentManagerCounts {
  const artifacts = options.artifacts ?? options.document?.artifacts ?? []
  const codeBindings = options.canvasDocument.codeBindings ?? []
  return {
    screenCount: Math.max(htmlScreenArtifacts(artifacts).length, countHtmlFrames(options.canvasDocument)),
    directionCount: countDirections(artifacts),
    objectCount: Math.max(0, Object.keys(options.canvasDocument.objects).length - 1),
    tokenCount: Object.keys(options.designSystem.tokens).length,
    componentCount: Object.keys(options.designSystem.components).length,
    activeBindingCount: codeBindings.filter((binding) => binding.status === 'active').length,
    staleBindingCount: codeBindings.filter((binding) => binding.status === 'stale').length,
    missingBindingCount: codeBindings.filter((binding) => binding.status === 'missing').length,
    journalEntryCount: options.canvasDocument.operationJournal?.length ?? 0,
    critiqueEntryCount: countCritiqueEntries(options.canvasDocument)
  }
}

function role(
  id: DesignAgentManagerRoleId,
  status: DesignAgentManagerStatus,
  detailKey: string,
  detailOptions?: Record<string, number | string>,
  progress?: DesignAgentManagerRole['progress'],
  roleAction?: RoleAction
): DesignAgentManagerRole {
  return {
    id,
    labelKey: ROLE_LABEL_KEYS[id],
    status,
    detailKey,
    ...(detailOptions ? { detailOptions } : {}),
    ...(progress ? { progress } : {}),
    ...(roleAction ? { intentMode: roleAction.intentMode, actionPrompt: roleAction.prompt } : {})
  }
}

function action(intentMode: DesignIntentMode, lines: string[]): RoleAction {
  return { intentMode, prompt: lines.join('\n') }
}

function plannerAction(counts: AgentManagerCounts): RoleAction {
  return action('generate', [
    'Act as the design planning agent for this design mode board.',
    `Current state: ${counts.directionCount} direction(s), ${counts.screenCount} screen(s), ${counts.objectCount} canvas object(s).`,
    'Create or refine distinct product directions with names, tradeoffs, target users, key screens, and design-system implications.',
    'Use structured design-mode outputs that can become directions, DESIGN.md decisions, and canvas operations.'
  ])
}

function generatorAction(counts: AgentManagerCounts): RoleAction {
  return action('generate', [
    'Act as the screen generation agent for this design mode board.',
    `Current state: ${counts.screenCount} screen(s), ${counts.directionCount} direction(s), ${counts.tokenCount} token(s), ${counts.componentCount} component(s).`,
    'Generate the next useful screen or improve the first screen if none exists.',
    'Prefer reusable layout patterns, clear responsive behavior, and canvas operations that preserve Design Graph ids.'
  ])
}

function criticAction(counts: AgentManagerCounts): RoleAction {
  return action('modify', [
    'Act as the design critic agent for the current direction.',
    `Current state: ${counts.screenCount} screen(s), ${counts.critiqueEntryCount} critique pass(es), ${counts.journalEntryCount} operation journal entry(s).`,
    'Review visual hierarchy, accessibility, spacing, responsive behavior, interaction states, and design-system consistency.',
    'Attach precise, repairable agent notes to affected canvas objects before making broad changes.'
  ])
}

function systemizerAction(counts: AgentManagerCounts): RoleAction {
  return action('modify', [
    'Act as the design system agent for this design mode board.',
    `Current state: ${counts.screenCount} screen(s), ${counts.tokenCount} token(s), ${counts.componentCount} component(s).`,
    'Extract semantic tokens, reusable components, variants, and states from the current screens.',
    'Apply the system back to repeated patterns so later directions and code binding share one Design Graph contract.'
  ])
}

function codeBinderAction(counts: AgentManagerCounts): RoleAction {
  return action('modify', [
    'Act as the code binding agent for this design board.',
    `Current state: ${counts.activeBindingCount} active, ${counts.staleBindingCount} stale, ${counts.missingBindingCount} missing code binding(s).`,
    'Map generated screens or selected frames to source files, routes, components, and DOM anchors.',
    'Repair stale bindings before proposing implementation changes.'
  ])
}

function exporterAction(counts: AgentManagerCounts): RoleAction {
  return action('preview', [
    'Act as the design handoff agent for this project.',
    `Current state: ${counts.screenCount} screen(s), ${counts.objectCount} canvas object(s), ${counts.tokenCount} token(s), ${counts.componentCount} component(s).`,
    'Prepare DESIGN.md-ready decisions, direction summaries, implementation notes, reusable tokens/components, and open questions.',
    'Keep handoff content grounded in the Design Graph and current canvas state.'
  ])
}

function generationProgress(
  pagesRun: DesignPagesRunState | null,
  parallelPageStates: Record<string, ParallelDesignPageState>
): { done: number; total: number } | undefined {
  if (pagesRun) return { done: pagesRun.done, total: pagesRun.total }
  const states = Object.values(parallelPageStates)
  if (states.length === 0) return undefined
  return {
    done: states.filter((state) => state.status === 'done').length,
    total: states.length
  }
}

function buildPlannerRole(
  options: BuildDesignAgentManagerModelOptions,
  counts: AgentManagerCounts
): DesignAgentManagerRole {
  if (options.pagesRun?.phase === 'foundation' || options.pagesRun?.phase === 'planning') {
    return role('planner', 'running', 'designAgentManagerPlannerRunning', {
      phase: options.pagesRun.phase
    }, undefined, plannerAction(counts))
  }
  if (counts.directionCount > 0) {
    return role('planner', 'ready', 'designAgentManagerPlannerReady', {
      directions: counts.directionCount,
      screens: counts.screenCount
    }, undefined, plannerAction(counts))
  }
  return role('planner', 'idle', 'designAgentManagerPlannerIdle', undefined, undefined, plannerAction(counts))
}

function buildGeneratorRole(
  options: BuildDesignAgentManagerModelOptions,
  counts: AgentManagerCounts
): DesignAgentManagerRole {
  const progress = generationProgress(options.pagesRun, options.parallelPageStates)
  const running =
    options.pagesRun?.phase === 'generating' ||
    Object.values(options.parallelPageStates).some((state) => state.status === 'queued' || state.status === 'running')
  if (running) {
    return role('generator', 'running', 'designAgentManagerGeneratorRunning', {
      done: progress?.done ?? 0,
      total: progress?.total ?? 0
    }, progress, generatorAction(counts))
  }
  if (counts.screenCount > 0) {
    return role('generator', 'ready', 'designAgentManagerGeneratorReady', {
      screens: counts.screenCount,
      tokens: counts.tokenCount,
      components: counts.componentCount
    }, undefined, generatorAction(counts))
  }
  return role('generator', 'idle', 'designAgentManagerGeneratorIdle', undefined, undefined, generatorAction(counts))
}

function buildCriticRole(counts: AgentManagerCounts): DesignAgentManagerRole {
  if (counts.screenCount === 0) return role('critic', 'blocked', 'designAgentManagerCriticBlocked')
  if (counts.critiqueEntryCount > 0) {
    return role('critic', 'ready', 'designAgentManagerCriticReady', {
      count: counts.critiqueEntryCount
    }, undefined, criticAction(counts))
  }
  return role('critic', 'idle', 'designAgentManagerCriticIdle', undefined, undefined, criticAction(counts))
}

function buildSystemizerRole(counts: AgentManagerCounts): DesignAgentManagerRole {
  const systemCount = counts.tokenCount + counts.componentCount
  if (counts.screenCount === 0) return role('systemizer', 'blocked', 'designAgentManagerSystemizerBlocked')
  if (systemCount > 0) {
    return role('systemizer', 'ready', 'designAgentManagerSystemizerReady', {
      tokens: counts.tokenCount,
      components: counts.componentCount
    }, undefined, systemizerAction(counts))
  }
  return role('systemizer', 'idle', 'designAgentManagerSystemizerIdle', undefined, undefined, systemizerAction(counts))
}

function buildCodeBinderRole(counts: AgentManagerCounts): DesignAgentManagerRole {
  if (counts.activeBindingCount > 0) {
    return role('code-binder', 'ready', 'designAgentManagerCodeBinderReady', {
      active: counts.activeBindingCount,
      stale: counts.staleBindingCount,
      missing: counts.missingBindingCount
    }, undefined, codeBinderAction(counts))
  }
  if (counts.screenCount === 0) return role('code-binder', 'blocked', 'designAgentManagerCodeBinderBlocked')
  return role('code-binder', 'idle', 'designAgentManagerCodeBinderIdle', undefined, undefined, codeBinderAction(counts))
}

function buildExporterRole(
  options: BuildDesignAgentManagerModelOptions,
  counts: AgentManagerCounts
): DesignAgentManagerRole {
  if (!options.document) return role('exporter', 'blocked', 'designAgentManagerExporterBlocked')
  if (counts.screenCount > 0 || counts.objectCount > 0 || counts.tokenCount > 0) {
    return role('exporter', 'ready', 'designAgentManagerExporterReady', {
      screens: counts.screenCount,
      objects: counts.objectCount
    }, undefined, exporterAction(counts))
  }
  return role('exporter', 'idle', 'designAgentManagerExporterIdle')
}

function recommendedRoleId(roles: readonly DesignAgentManagerRole[]): DesignAgentManagerRoleId | null {
  return roles.find((agent) => agent.status === 'running')?.id ??
    roles.find((agent) => agent.status === 'idle')?.id ??
    roles.find((agent) => agent.status === 'blocked')?.id ??
    null
}

export function buildDesignAgentManagerModel(
  options: BuildDesignAgentManagerModelOptions
): DesignAgentManagerModel {
  const counts = countsFor(options)
  const roles = attachWorkflowToAgentRoles([
    buildPlannerRole(options, counts),
    buildGeneratorRole(options, counts),
    buildSystemizerRole(counts),
    buildCriticRole(counts),
    buildCodeBinderRole(counts),
    buildExporterRole(options, counts)
  ], buildDesignModeSurfaceManifest({
    document: options.document,
    canvasDocument: options.canvasDocument,
    designSystem: options.designSystem,
    artifacts: options.artifacts ?? options.document?.artifacts
  }).workflow)
  return {
    roles,
    screenCount: counts.screenCount,
    directionCount: counts.directionCount,
    objectCount: counts.objectCount,
    runningCount: roles.filter((agent) => agent.status === 'running').length,
    blockedCount: roles.filter((agent) => agent.status === 'blocked').length,
    readyCount: roles.filter((agent) => agent.status === 'ready').length,
    recommendedRoleId: recommendedRoleId(roles)
  }
}
