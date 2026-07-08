import type { DelegationRuntime } from "./delegation-runtime.js"
import type { AgentRoleId } from "../contracts/agent-role.js"
import type { KunAgentRoleRegistry } from "./role-registry.js"
import type { RuntimeEventRecorder } from "../services/runtime-event-recorder.js"

/**
 * Structured output from a role's sub-task execution. Downstream tasks
 * consume the upstream's findings, decisions, and file references to
 * build on completed work without repeating it.
 */
export type RoleOutput = {
  /** Which role produced this output. */
  role: AgentRoleId
  /** Natural-language summary of what was done. */
  summary: string
  /** Files that were read during the task. */
  filesRead: string[]
  /** Files that were modified or created. */
  filesModified: string[]
  /** Key technical findings or discoveries. */
  keyFindings: string[]
  /** Decisions made that downstream tasks should respect. */
  decisions: string[]
  /** Questions that remain open for downstream tasks. */
  pendingQuestions?: string[]
  /** How confident the role is in its output. */
  confidence: 'high' | 'medium' | 'low'
}

export type PlannerSubTask = {
  id: string
  description: string
  assignedRole: AgentRoleId
  dependsOn: string[]
  input: string
}

export type Plan = {
  title: string
  subTasks: PlannerSubTask[]
}

export type SubTaskResult = {
  subTaskId: string
  status: "completed" | "failed" | "aborted"
  summary: string
  durationMs?: number
  error?: string
  /** Structured output from the role, present when completed. */
  roleOutput?: RoleOutput
}

export type PlanExecutionResult = {
  title: string
  subTaskResults: SubTaskResult[]
  aggregatedSummary: string
  totalDurationMs: number
  allCompleted: boolean
}

export type AggregationStrategy = "concatenate" | "merge" | "diff"

const PLANNER_DECOMPOSITION_TIMEOUT_MS = 15_000

export class PlannerAgent {
  constructor(
    private readonly delegation: DelegationRuntime,
    private readonly roleRegistry: KunAgentRoleRegistry | undefined,
    private readonly events: RuntimeEventRecorder | undefined,
    private readonly decompositionTimeoutMs: number = PLANNER_DECOMPOSITION_TIMEOUT_MS
  ) {}

  async plan(input: {
    taskDescription: string
    parentThreadId: string
    parentTurnId: string
    workspace?: string
    signal: AbortSignal
  }): Promise<Plan> {
    return {
      title: input.taskDescription.slice(0, 60),
      subTasks: [{ id: "1", description: input.taskDescription, assignedRole: "coder" as AgentRoleId, dependsOn: [], input: input.taskDescription }]
    }
  }

  async execute(input: {
    plan: Plan
    parentThreadId: string
    parentTurnId: string
    workspace?: string
    signal: AbortSignal
    strategy?: AggregationStrategy
  }): Promise<PlanExecutionResult> {
    const startTime = Date.now()
    const strategy = input.strategy ?? "concatenate"
    const results = await this.executeDAG(input.plan.subTasks, input.parentThreadId, input.parentTurnId, input.workspace, input.signal)
    const allCompleted = results.every((r) => r.status === "completed")
    return { title: input.plan.title, subTaskResults: results, aggregatedSummary: this.aggregateResults(results, strategy), totalDurationMs: Date.now() - startTime, allCompleted }
  }

  /** Build a context string from completed upstream RoleOutputs for a downstream task. */
  private buildUpstreamContext(task: PlannerSubTask, completedOutputs: Map<string, RoleOutput>): string {
    if (task.dependsOn.length === 0) return ''

    const parts: string[] = ['', 'Context from completed upstream tasks:']
    for (const depId of task.dependsOn) {
      const output = completedOutputs.get(depId)
      if (!output) continue
      parts.push(`--- ${output.role} (${depId}) ---`)
      if (output.summary) parts.push(`Summary: ${output.summary}`)
      if (output.filesModified.length > 0) parts.push(`Files modified: ${output.filesModified.join(', ')}`)
      if (output.filesRead.length > 0) parts.push(`Files read: ${output.filesRead.join(', ')}`)
      if (output.keyFindings.length > 0) parts.push(`Key findings: ${output.keyFindings.join('; ')}`)
      if (output.decisions.length > 0) parts.push(`Decisions: ${output.decisions.join('; ')}`)
    }
    return parts.join('\n')
  }

  /** Extract a structured RoleOutput from a child run's summary text.
   *  When parsing fails, wraps the free-text summary into a minimal RoleOutput. */
  private parseRoleOutput(role: AgentRoleId, summary: string): RoleOutput {
    // Try to parse JSON-structured output first
    const jsonStart = summary.indexOf('{')
    const jsonEnd = summary.lastIndexOf('}')
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      try {
        const parsed = JSON.parse(summary.slice(jsonStart, jsonEnd + 1))
        if (parsed && typeof parsed === 'object') {
          return {
            role: parsed.role ?? role,
            summary: parsed.summary ?? summary,
            filesRead: Array.isArray(parsed.filesRead) ? parsed.filesRead : [],
            filesModified: Array.isArray(parsed.filesModified) ? parsed.filesModified : [],
            keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
            decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
            confidence: parsed.confidence ?? 'medium'
          }
        }
      } catch {
        // Fall through to wrapping
      }
    }
    // Fallback: wrap free-text summary
    return {
      role,
      summary,
      filesRead: [],
      filesModified: [],
      keyFindings: [],
      decisions: [],
      confidence: 'medium'
    }
  }

  private async executeDAG(subTasks: PlannerSubTask[], parentThreadId: string, parentTurnId: string, workspace: string | undefined, signal: AbortSignal): Promise<SubTaskResult[]> {
    const results: SubTaskResult[] = []
    const completedOutputs = new Map<string, RoleOutput>()
    const remaining = [...subTasks]
    while (remaining.length > 0) {
      if (signal.aborted) { for (const t of remaining) results.push({ subTaskId: t.id, status: "aborted", summary: "Aborted" }); break }
      const runnable = remaining.filter((t) => t.dependsOn.every((d) => completedOutputs.has(d) || results.some((r) => r.subTaskId === d && r.status === 'completed')))
      if (runnable.length === 0) { for (const t of remaining) results.push({ subTaskId: t.id, status: "failed", summary: "Blocked", error: "Circular dependency" }); break }
      const batch = await Promise.all(runnable.map(async (task) => {
        try {
          // Build prompt enriched with upstream context
          const upstreamContext = this.buildUpstreamContext(task, completedOutputs)
          const enrichedPrompt = upstreamContext ? `${task.input}\n${upstreamContext}` : task.input
          const record = await this.delegation.runChild({ parentThreadId, parentTurnId, label: "planner:" + task.id, prompt: enrichedPrompt, workspace, profile: task.assignedRole, signal })
          const summary = record.summary ?? ""
          const roleOutput = this.parseRoleOutput(task.assignedRole, summary)
          return { subTaskId: task.id, status: record.status, summary, durationMs: record.durationMs, roleOutput } as SubTaskResult
        } catch (e) { return { subTaskId: task.id, status: "failed", summary: "Error", error: String(e) } as SubTaskResult }
      }))
      for (const r of batch) {
        results.push(r)
        if (r.status === "completed" && r.roleOutput) {
          completedOutputs.set(r.subTaskId, r.roleOutput)
        }
      }
      const doneIds = new Set(runnable.map((t) => t.id))
      remaining.length = 0; remaining.push(...subTasks.filter((t) => !doneIds.has(t.id)))
    }
    return results
  }

  private aggregateResults(results: SubTaskResult[], strategy: AggregationStrategy): string {
    if (strategy === "merge") return results.filter((r) => r.status === "completed").map((r) => r.summary).filter(Boolean).join("\n\n")
    if (strategy === "diff") return results.map((r) => (r.status === "completed" ? "[+] " : "[-] ") + r.subTaskId + ": " + r.summary.slice(0, 200)).join("\n")
    return results.map((r) => "[" + r.subTaskId + "] " + r.status.toUpperCase() + ": " + r.summary).join("\n")
  }
}
