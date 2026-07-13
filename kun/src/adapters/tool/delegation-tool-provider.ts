import type { DelegationRuntime } from '../../delegation/delegation-runtime.js'
import type { CapabilityToolProvider } from './capability-registry.js'
import { LocalToolHost } from './local-tool-host.js'

export function buildDelegationToolProviders(runtime: DelegationRuntime | undefined): CapabilityToolProvider[] {
  if (!runtime) return []
  // Only subagent/all roles are delegation targets; primary-only personas
  // are for starting a session, not for delegate_task.
  const profiles = runtime.listProfiles().filter((profile) => profile.mode !== 'primary')
  const profileNames = profiles.map((profile) => profile.name)
  return [{
    id: 'delegation',
    kind: 'delegation',
    enabled: true,
    available: true,
    tools: [
      LocalToolHost.defineTool({
        name: 'delegate_task',
        description: buildDelegateTaskDescription(runtime, profiles),
        inputSchema: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'A 2-4 word name for this subagent, shown in the UI as its title (e.g. "审查登录流程", "fix failing test", "greet user"). ALWAYS provide it so the user can tell subagents apart, especially when delegating several in parallel. Prefer a distinct label per call.' },
            prompt: { type: 'string', description: 'The task for the child agent.' },
            workspace: { type: 'string' },
            model: { type: 'string', description: 'Override the child model. Defaults to the profile model or server default.' },
            profile: profileNames.length
              ? { type: 'string', enum: profileNames, description: 'Subagent role to apply (model, preamble, tool policy).' }
              : { type: 'string', description: 'Subagent role to apply (model, preamble, tool policy).' },
            detach: {
              type: 'boolean',
              description: 'Fire-and-forget. The call returns immediately with a queued/running record; the child keeps executing in the background and can be checked via diagnostics or aborted from the GUI.'
            }
          },
          required: ['prompt'],
          additionalProperties: false
        },
        policy: 'auto',
        execute: async (args, context, onUpdate) => {
          const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : ''
          if (!prompt) return { output: { error: 'prompt is required' }, isError: true }
          const record = await runtime.runChild({
            parentThreadId: context.threadId,
            parentTurnId: context.turnId,
            label: typeof args.label === 'string' ? args.label : undefined,
            prompt,
            workspace: typeof args.workspace === 'string' ? args.workspace : context.workspace,
            ...(typeof args.model === 'string' ? { model: args.model } : {}),
            ...(typeof args.profile === 'string' ? { profile: args.profile } : {}),
            ...(args.detach === true ? { detach: true } : {}),
            onStart: (childId, profile) => {
              void onUpdate?.({
                output: { childId, status: 'running', ...(profile ? { profile } : {}) },
                isError: false
              })
            },
            signal: context.abortSignal
          })
          return {
            output: {
              childId: record.id,
              status: record.status,
              summary: record.summary,
              error: record.error,
              usage: record.usage,
              ...(record.profile ? { profile: record.profile } : {}),
              ...(record.toolPolicy ? { toolPolicy: record.toolPolicy } : {}),
              ...(record.toolInvocations !== undefined ? { toolInvocations: record.toolInvocations } : {}),
              ...(record.durationMs !== undefined ? { durationMs: record.durationMs } : {}),
              ...(record.queuedMs ? { queuedMs: record.queuedMs } : {})
            },
            isError: record.status === 'failed' || record.status === 'aborted'
          }
        }
      }),
      LocalToolHost.defineTool({
        name: 'delegation_diagnostics',
        description: 'Query the delegation subsystem status: active/queued children, Worker pool health (idle/busy workers), and recent child run records. Useful for monitoring long-running background tasks, detecting stuck workers, and inspecting past delegation results.',
        inputSchema: {
          type: 'object',
          properties: {
            parentThreadId: { type: 'string', description: 'Filter child runs by parent thread. Omit to see all.' },
            limit: { type: 'number', description: 'Max child run records to return. Default 10.' }
          },
          additionalProperties: false
        },
        policy: 'auto',
        execute: async (args) => {
          const parentThreadId = typeof args.parentThreadId === 'string' ? args.parentThreadId.trim() : undefined
          const limit = Math.min(Math.max(1, typeof args.limit === 'number' ? args.limit : 10), 50)
          const diag = await runtime.diagnostics(parentThreadId)
          return {
            output: {
              delegationEnabled: diag.enabled,
              activeChildren: diag.active,
              queuedChildren: diag.queued,
              workerPoolIdle: diag.workerPoolIdle,
              workerPoolBusy: diag.workerPoolBusy,
              profiles: runtime.listProfiles().map((p) => p.name),
              recentRuns: diag.childRuns.slice(-limit).map((r) => ({
                id: r.id,
                profile: r.profile,
                status: r.status,
                summary: r.summary,
                error: r.error,
                durationMs: r.durationMs,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt
              })),
              aggregates: diag.aggregates.slice(0, 10)
            }
          }
        }
      })
    ]
  }]
}

function buildDelegateTaskDescription(
  runtime: DelegationRuntime,
  profiles: { name: string; mode: string; toolPolicy: string; model?: string; providerId?: string; description?: string }[]
): string {
  const lines = [
    'Run independent sub-tasks in parallel child agents. CRITICAL: to run children IN PARALLEL, issue MULTIPLE delegate_task calls in a SINGLE response — each gets its own worker and they execute concurrently. Issuing one delegate_task per turn runs them sequentially, losing the parallelism benefit. Each child is an isolated Worker thread with its own model context, tool set, and crash recovery.',
    '',
    'Example — call multiple in one response for parallelism:',
    '  delegate_task({ label: "调研现有API", profile: "research", prompt: "搜索项目中所有API路由定义" })',
    '  delegate_task({ label: "编写新模块", profile: "coder", prompt: "基于文档实现用户管理模块" })',
    '',
    'WHEN TO USE — three patterns where delegation saves turns and time:',
    '',
    '1. "Research + Implement" split: Delegate research/exploration to a read-only child (profile: "research" / "explore") while you keep designing in the main thread. The child returns findings you act on — no context-switching.',
    '2. "Split a complex task": Instead of implementing files A, B, C sequentially, delegate each to its own child in one message. They run in parallel; you get three summaries back at once. For page-replication from a screenshot: read the image in the main thread to capture the design spec, then delegate the HTML/CSS implementation to a child so the image data does not crowd your working context.',
    '3. "Background long-runners": Offload a slow operation (batch migration, large refactor, heavy test run) with detach=true. It reports progress via GUI while you continue the main conversation.',
    '',
    'Read-only profiles (research, explore) are cheap — they use less context and have no write/exec permission. Default profile when none specified: coder (full read/write/shell access).',
    `Available profiles: ${
      profiles.length
        ? profiles
            .map((p) => `${p.name} (${p.toolPolicy}${p.model ? `, ${p.model}` : ''}${p.providerId ? ` @${p.providerId}` : ''}${p.description ? ` — ${p.description}` : ''}`)
            .join('; ')
        : 'coder (inherit, full access)'
    }.`
  ]
  if (runtime.defaultProfileName) {
    lines.push(`Default profile when omitted: ${runtime.defaultProfileName}.`)
  }
  return lines.join(' ')
}
