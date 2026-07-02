import { useChatStore } from '../store/chat-store'
import { providerIdForComposerModel } from '../store/chat-store-helpers'
import { buildDesignImageNodePrompt, buildDesignTurnPrompt } from './design-turn-prompt'
import { useDesignWorkspaceStore } from './design-workspace-store'

const POLL_INTERVAL_MS = 1200
const DEFAULT_TIMEOUT_MS = 180_000

/** Resolve once the reserved file exists and is a complete HTML document. */
async function waitForCompleteFile(
  path: string,
  workspaceRoot: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<boolean> {
  if (typeof window.kunGui?.readWorkspaceFile !== 'function') return false
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await window.kunGui.readWorkspaceFile({ path, workspaceRoot })
      if (res.ok && res.content.trim().toLowerCase().endsWith('</html>')) return true
    } catch {
      /* not written yet */
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  return false
}

/** Resolve once a named file appears in the given workspace directory. */
async function waitForFile(
  dirRelativePath: string,
  fileName: string,
  workspaceRoot: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<boolean> {
  if (typeof window.kunGui?.listWorkspaceDirectory !== 'function') return false
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await window.kunGui
      .listWorkspaceDirectory({ path: dirRelativePath, workspaceRoot })
      .catch(() => null)
    if (res && res.ok && res.entries.some((e) => e.name === fileName && e.type === 'file')) return true
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  return false
}

export type RunDesignNodeParams = {
  /** What the node produces: 'design' = HTML, 'image' = a generated .png. */
  kind: 'design' | 'image'
  /** The node's own design instruction. */
  brief: string
  /** Text flowing in from upstream nodes. */
  upstreamContext: string
  /** Workspace-relative path the node writes its HTML to. */
  outputRelativePath: string
  workspaceRoot: string
}

/**
 * Run one design node: dispatch a design turn (with the node's brief + upstream
 * context) into the design thread, then resolve once the node's HTML output is
 * a complete document. Sequential graph execution awaits this per node.
 */
export async function runDesignNode(params: RunDesignNodeParams): Promise<boolean> {
  const chat = useChatStore.getState()
  const threadId = await chat.ensureDesignThreadForWorkspace(params.workspaceRoot)
  if (!threadId) return false

  const design = useDesignWorkspaceStore.getState()
  const text = [params.upstreamContext, params.brief]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n')
  const prompt =
    params.kind === 'image'
      ? buildDesignImageNodePrompt({
          text,
          outputRelativePath: params.outputRelativePath,
          workspaceRoot: params.workspaceRoot,
          designContext: design.designContext
        })
      : buildDesignTurnPrompt({
          target: 'html',
          mode: 'text',
          text,
          artifactRelativePath: params.outputRelativePath,
          workspaceRoot: params.workspaceRoot,
          customPrompt: design.generationPrompt || undefined,
          designContext: design.designContext
        })
  const model = design.assistantModel.trim()
  const providerId =
    design.assistantProviderId.trim() || providerIdForComposerModel(chat.composerModelGroups, model)
  const started = await chat.sendMessage(prompt, 'agent', {
    displayText: params.brief || 'Design node',
    ...(model ? { model } : {}),
    ...(providerId ? { providerId } : {})
  })
  if (!started) return false
  if (params.kind === 'image') {
    const normalized = params.outputRelativePath.replace(/\\/g, '/')
    const slash = normalized.lastIndexOf('/')
    const dir = slash >= 0 ? normalized.slice(0, slash) : ''
    const file = slash >= 0 ? normalized.slice(slash + 1) : normalized
    return waitForFile(dir, file, params.workspaceRoot)
  }
  return waitForCompleteFile(params.outputRelativePath, params.workspaceRoot)
}
