import { Worker } from 'node:worker_threads'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { ChildRunExecutor } from '../../delegation/delegation-runtime.js'

/**
 * Creates a ChildRunExecutor that runs each child AgentLoop inside a
 * dedicated Worker thread. The Worker and its temp workspace are destroyed
 * when the child finishes, ensuring complete resource isolation.
 */
export function createWorkerAgentExecutor(events?: { record(event: unknown): void }): ChildRunExecutor {
  return async (input) => {
    let tmpDir: string | undefined
    const workerPath = join(dirname(fileURLToPath(import.meta.url)), 'child-agent-worker.js')

    try {
      tmpDir = mkdtempSync(join(tmpdir(), 'kun-task-'))

      const worker = new Worker(workerPath, {
        workerData: {
          childId: input.childId,
          parentThreadId: input.parentThreadId,
          parentTurnId: input.parentTurnId,
          prompt: input.prompt,
          profile: input.profile,
          workspace: tmpDir,
          toolPolicy: input.toolPolicy,
          systemPrompt: input.systemPrompt,
          promptPreamble: input.promptPreamble,
          model: input.model,
          reasoningEffort: input.reasoningEffort,
          allowedTools: input.allowedTools,
          blockedTools: input.blockedTools
        }
      })

      const result = await new Promise<{ summary: string; usage?: unknown; toolInvocations?: number }>((resolve, reject) => {
        worker.on('message', (msg) => {
          if (msg && typeof msg === 'object' && msg._relay === 'event' && msg.event && events) {
            events.record(msg.event);
            return;
          }
          resolve(msg);
        })
        worker.on('error', (err) => reject(err instanceof Error ? err : new Error(String(err))))
        worker.on('exit', (code) => {
          if (code !== 0) reject(new Error('worker exited with code ' + code))
        })
      })

      await worker.terminate()
      return {
        summary: result.summary,
        usage: result.usage as any,
        toolInvocations: result.toolInvocations,
        prefixReused: true,
        inheritedHistoryItems: 0
      }
    } finally {
      if (tmpDir) {
        try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* best effort */ }
      }
    }
  }
}
