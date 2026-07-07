import type { DelegationRuntime } from "./delegation-runtime.js"
import type { AgentRoleId } from "../contracts/agent-role.js"
import type { KunAgentRoleRegistry } from "./role-registry.js"
import type { RuntimeEventRecorder } from "../services/runtime-event-recorder.js"

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

  private async executeDAG(subTasks: PlannerSubTask[], parentThreadId: string, parentTurnId: string, workspace: string | undefined, signal: AbortSignal): Promise<SubTaskResult[]> {
    const results: SubTaskResult[] = []
    const completedIds = new Set<string>()
    const remaining = [...subTasks]
    while (remaining.length > 0) {
      if (signal.aborted) { for (const t of remaining) results.push({ subTaskId: t.id, status: "aborted", summary: "Aborted" }); break }
      const runnable = remaining.filter((t) => t.dependsOn.every((d) => completedIds.has(d)))
      if (runnable.length === 0) { for (const t of remaining) results.push({ subTaskId: t.id, status: "failed", summary: "Blocked", error: "Circular dependency" }); break }
      const batch = await Promise.all(runnable.map(async (task) => {
        try {
          const record = await this.delegation.runChild({ parentThreadId, parentTurnId, label: "planner:" + task.id, prompt: task.input, workspace, profile: task.assignedRole, signal })
          return { subTaskId: task.id, status: record.status, summary: record.summary ?? "", durationMs: record.durationMs } as SubTaskResult
        } catch (e) { return { subTaskId: task.id, status: "failed", summary: "Error", error: String(e) } as SubTaskResult }
      }))
      for (const r of batch) { results.push(r); if (r.status === "completed") completedIds.add(r.subTaskId) }
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
