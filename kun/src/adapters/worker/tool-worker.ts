import { parentPort } from 'node:worker_threads'
import { execSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'

export type WorkerTaskRequest = {
  taskId: string
  tool: 'read' | 'ls' | 'bash'
  args: Record<string, unknown>
}

export type WorkerTaskResult =
  | { ok: true; taskId: string; result: unknown }
  | { ok: false; taskId: string; error: string }

if (parentPort) {
  parentPort.on('message', async (msg: WorkerTaskRequest) => {
    const { taskId, tool, args } = msg
    try {
      let result: unknown
      switch (tool) {
        case 'read':
          result = { content: await readFile(args.path as string, 'utf8') }
          break
        case 'ls':
          result = { entries: (await readdir(args.path as string, { withFileTypes: true })).length }
          break
        case 'bash': {
          const output = execSync(args.command as string, {
            encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
            timeout: (args.timeoutMs as number) ?? 60_000,
            ...(args.cwd ? { cwd: args.cwd as string } : {})
          })
          result = { exit_code: 0, output }
          break
        }
      }
      parentPort!.postMessage({ ok: true, taskId, result } satisfies WorkerTaskResult)
    } catch (error) {
      parentPort!.postMessage({ ok: false, taskId, error: error instanceof Error ? error.message : String(error) } satisfies WorkerTaskResult)
    }
  })
}
