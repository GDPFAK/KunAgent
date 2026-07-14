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
        description: 'Assign a sub-task to a child agent that runs independently with its own model context and tools. Use for any sub-task that can be isolated: research, file changes, refactoring, or analysis. The child returns a summary and its results are visible in the conversation.',
        inputSchema: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Short name for this subagent (2-4 words), shown in the UI. Always provide so results are identifiable.' },
            prompt: { type: 'string', description: 'The full task description for the child agent. Be self-contained: include all context, file paths, and requirements the child needs to complete the task without referencing the parent conversation.' },
            workspace: { type: 'string', description: 'Workspace root path. Defaults to the parent workspace.' },
            model: { type: 'string', description: 'Override the child model. Defaults to the profile model or main model.' },
            profile: profileNames.length
              ? { type: 'string', enum: profileNames, description: 'Subagent role. Determines tool access: "explore"=read-only, "coder"=full access.' }
              : { type: 'string', description: 'Subagent role. Determines tool access: "explore"=read-only, "coder"=full access.' },
            detach: {
              type: 'boolean',
              description: 'Fire-and-forget: the child runs in background and reports progress via the UI. Use for slow operations like batch migrations.'
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
