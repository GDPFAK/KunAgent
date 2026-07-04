import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { canWritePath, sandboxBlockForTool } from '../src/adapters/tool/sandbox-policy.js'

const TEST_WORKSPACE = resolve(__dirname, '../test-workspace-sandbox')

describe('shell sandbox security tests', () => {
  beforeEach(async () => {
    await mkdir(TEST_WORKSPACE, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  describe('sandbox policy for shell commands', () => {
    it('允许 bash 在 workspace-write 模式下执行', () => {
      const result = sandboxBlockForTool(
        { name: 'bash', toolKind: 'command_execution' },
        { sandboxMode: 'workspace-write' }
      )
      expect(result).toBeNull()
    })

    it('阻止 bash 在 read-only 模式下执行', () => {
      const result = sandboxBlockForTool(
        { name: 'bash', toolKind: 'command_execution' },
        { sandboxMode: 'read-only' }
      )
      expect(result?.code).toBe('sandbox_command_blocked')
    })

    it('允许 bash 在 danger-full-access 模式下执行', () => {
      const result = sandboxBlockForTool(
        { name: 'bash', toolKind: 'command_execution' },
        { sandboxMode: 'danger-full-access' }
      )
      expect(result).toBeNull()
    })

    it('阻止 bash 在 external-sandbox 模式下执行', () => {
      const result = sandboxBlockForTool(
        { name: 'bash', toolKind: 'command_execution' },
        { sandboxMode: 'external-sandbox' }
      )
      expect(result?.code).toBe('sandbox_command_blocked')
    })
  })

  describe('workspace boundary validation', () => {
    it('允许工作区内的写入', async () => {
      const testFile = join(TEST_WORKSPACE, 'test.txt')
      const result = await canWritePath(testFile, {
        workspace: TEST_WORKSPACE,
        sandboxMode: 'workspace-write'
      })
      expect(result.ok).toBe(true)
    })

    it('阻止工作区外的写入', async () => {
      const outsideFile = resolve(TEST_WORKSPACE, '../outside.txt')
      const result = await canWritePath(outsideFile, {
        workspace: TEST_WORKSPACE,
        sandboxMode: 'workspace-write'
      })
      expect(!result.ok && result.block?.code).toBe('sandbox_write_blocked')
    })

    it('阻止符号链接逃逸尝试', async () => {
      const evilLink = join(TEST_WORKSPACE, 'evil-link')
      const outsideTarget = resolve(TEST_WORKSPACE, '../outside-target.txt')

      // 先创建目标文件，使 realpath 能解析到它
      await writeFile(outsideTarget, 'outside content')
      await symlink(outsideTarget, evilLink, 'file')

      const result = await canWritePath(evilLink, {
        workspace: TEST_WORKSPACE,
        sandboxMode: 'workspace-write'
      })

      // 符号链接应被解析并阻止
      expect(!result.ok && result.block?.code).toBe('sandbox_write_blocked')
    })

    it('允许 danger-full-access 模式下写入任何位置', async () => {
      const outsideFile = resolve(TEST_WORKSPACE, '../outside.txt')
      const result = await canWritePath(outsideFile, {
        workspace: TEST_WORKSPACE,
        sandboxMode: 'danger-full-access'
      })
      expect(result.ok).toBe(true)
    })

    it('阻止 read-only 模式下的所有写入', async () => {
      const testFile = join(TEST_WORKSPACE, 'test.txt')
      const result = await canWritePath(testFile, {
        workspace: TEST_WORKSPACE,
        sandboxMode: 'read-only'
      })
      expect(!result.ok && result.block?.code).toBe('sandbox_read_only')
    })
  })

  describe('path traversal prevention', () => {
    it('阻止相对路径遍历', async () => {
      const traversalPath = join(TEST_WORKSPACE, '../../etc/passwd')
      const result = await canWritePath(traversalPath, {
        workspace: TEST_WORKSPACE,
        sandboxMode: 'workspace-write'
      })
      expect(!result.ok).toBe(true)
    })

    it('正确处理绝对路径', async () => {
      const absolutePath = resolve(TEST_WORKSPACE, 'subdir/file.txt')
      const result = await canWritePath(absolutePath, {
        workspace: TEST_WORKSPACE,
        sandboxMode: 'workspace-write'
      })
      expect(result.ok).toBe(true)
    })
  })
})
