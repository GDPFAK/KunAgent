import { isAbsolute, relative, resolve, sep } from 'node:path'
import { realpath } from 'node:fs/promises'
import {
  DEFAULT_SANDBOX_MODE,
  SandboxModeSchema,
  type SandboxMode
} from '../../contracts/policy.js'
import type { ToolHostContext } from '../../ports/tool-host.js'
import type { LocalTool } from './local-tool-host.js'
import { workspaceRoot } from './builtin-tool-utils.js'

export type SandboxBlock = {
  code: 'sandbox_read_only' | 'sandbox_command_blocked' | 'sandbox_write_blocked'
  message: string
}

/**
 * 安全的 realpath 包装，处理不存在的路径、权限错误等情况。
 * 防止符号链接绕过沙箱检查。
 */
async function safeRealpath(target: string): Promise<string | null> {
  try {
    return await realpath(target)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'EACCES' || code === 'ELOOP' || code === 'ENOTDIR') {
      return null
    }
    throw error
  }
}

export function effectiveSandboxMode(
  context?: Pick<ToolHostContext, 'sandboxMode'>
): SandboxMode {
  const parsed = SandboxModeSchema.safeParse(context?.sandboxMode)
  return parsed.success ? parsed.data : DEFAULT_SANDBOX_MODE
}

export function isToolAdvertisedInSandbox(
  tool: Pick<LocalTool, 'toolKind' | 'name'>,
  context?: Pick<ToolHostContext, 'sandboxMode'>
): boolean {
  if (!context) return true
  return sandboxBlockForTool(tool, context) === null
}

export function sandboxBlockForTool(
  tool: Pick<LocalTool, 'toolKind' | 'name'>,
  context: Pick<ToolHostContext, 'sandboxMode'>
): SandboxBlock | null {
  const mode = effectiveSandboxMode(context)
  if (mode === 'danger-full-access') return null
  if (isInteractiveGuiGateTool(tool.name)) return null

  if (tool.toolKind === 'file_change') {
    if (mode === 'workspace-write') return null
    return {
      code: mode === 'read-only' ? 'sandbox_read_only' : 'sandbox_write_blocked',
      message:
        mode === 'read-only'
          ? `tool ${tool.name} is blocked by the read-only sandbox`
          : `tool ${tool.name} is blocked because ${mode} does not allow in-process file mutation`
    }
  }

  if (tool.toolKind === 'command_execution') {
    // 允许 workspace-write 模式下执行 shell 命令（与文件写入策略一致）
    if (mode === 'workspace-write') return null
    return {
      code: 'sandbox_command_blocked',
      message:
        mode === 'read-only'
          ? `tool ${tool.name} is blocked by the read-only sandbox. To run terminal commands, set the sandbox mode to "workspace-write" or "danger-full-access" in Settings → Agents.`
          : `tool ${tool.name} is blocked because the "${mode}" sandbox mode does not run host shell commands. To enable terminal commands, set the sandbox mode to "workspace-write" or "danger-full-access" in Settings → Agents.`
    }
  }

  return null
}

export async function canWritePath(
  absolutePath: string,
  context: Pick<ToolHostContext, 'workspace' | 'sandboxMode'>
): Promise<{ ok: true } | { ok: false; block: SandboxBlock }> {
  const mode = effectiveSandboxMode(context)
  if (mode === 'danger-full-access') return { ok: true }
  if (mode === 'read-only') {
    return {
      ok: false,
      block: {
        code: 'sandbox_read_only',
        message: `writing is blocked by the read-only sandbox: ${absolutePath}`
      }
    }
  }
  if (mode === 'external-sandbox') {
    return {
      ok: false,
      block: {
        code: 'sandbox_write_blocked',
        message: `writing is blocked because external-sandbox is not enforced by in-process file tools: ${absolutePath}`
      }
    }
  }

  const root = workspaceRoot(context.workspace)
  const resolvedPath = isAbsolute(absolutePath) ? resolve(absolutePath) : resolve(root, absolutePath)

  // 符号链接安全校验：通过 realpath 解析真实路径，防止符号链接绕过沙箱
  try {
    const [resolvedRoot, resolvedTarget] = await Promise.all([
      safeRealpath(root),
      safeRealpath(resolvedPath)
    ])
    if (resolvedRoot && resolvedTarget) {
      if (isPathInsideOrEqual(resolvedRoot, resolvedTarget)) return { ok: true }
    } else if (isPathInsideOrEqual(root, resolvedPath)) {
      // realpath 失败时（如路径不存在）回退到词法检查
      return { ok: true }
    }
  } catch {
    // 异常时回退到词法检查
    if (isPathInsideOrEqual(root, resolvedPath)) return { ok: true }
  }

  return {
    ok: false,
    block: {
      code: 'sandbox_write_blocked',
      message: `writing is limited to the workspace sandbox: ${absolutePath}`
    }
  }
}

export async function assertCanWritePath(
  absolutePath: string,
  context: Pick<ToolHostContext, 'workspace' | 'sandboxMode'>
): Promise<void> {
  const decision = await canWritePath(absolutePath, context)
  if (!decision.ok) throw new Error(decision.block.message)
}

function isPathInsideOrEqual(root: string, candidate: string): boolean {
  const rootPath = resolve(root)
  const candidatePath = resolve(candidate)
  const rel = relative(rootPath, candidatePath)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

function isInteractiveGuiGateTool(toolName: string): boolean {
  return toolName === 'user_input' || toolName === 'request_user_input'
}
