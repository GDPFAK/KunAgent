import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadWorkspaceAgentProfiles } from '../src/delegation/workspace-agents.js'

describe('loadWorkspaceAgentProfiles', () => {
  let workspace: string

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'kun-ws-agents-'))
    await mkdir(join(workspace, '.kun', 'agents'), { recursive: true })
  })

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true }).catch(() => undefined)
  })

  it('returns an empty list when the agents directory is missing', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'kun-ws-empty-'))
    expect(await loadWorkspaceAgentProfiles(empty)).toEqual([])
    await rm(empty, { recursive: true, force: true })
  })

  it('parses a minimal frontmatter agent file', async () => {
    await writeFile(
      join(workspace, '.kun', 'agents', 'reviewer.md'),
      [
        '---',
        'name: Reviewer',
        'description: 检查代码',
        'mode: subagent',
        'toolPolicy: readOnly',
        '---',
        'You are a careful reviewer.'
      ].join('\n')
    )
    const profiles = await loadWorkspaceAgentProfiles(workspace)
    expect(profiles).toHaveLength(1)
    const entry = profiles[0]!
    expect(entry.id).toBe('reviewer')
    expect(entry.profile.name).toBe('Reviewer')
    expect(entry.profile.description).toBe('检查代码')
    expect(entry.profile.mode).toBe('subagent')
    expect(entry.profile.toolPolicy).toBe('readOnly')
    // Body becomes the systemPrompt when no explicit field is given.
    expect(entry.profile.systemPrompt).toBe('You are a careful reviewer.')
  })

  it('uses explicit id, parses allowedTools list, and falls back to subagent mode', async () => {
    await writeFile(
      join(workspace, '.kun', 'agents', 'security.md'),
      [
        '---',
        'id: security-reviewer',
        'name: Security Reviewer',
        'allowedTools: [read, grep, ls]',
        'model: deepseek-chat',
        'providerId: deepseek',
        'color: "#10b981"',
        '---'
      ].join('\n')
    )
    const profiles = await loadWorkspaceAgentProfiles(workspace)
    expect(profiles).toHaveLength(1)
    const entry = profiles[0]!
    expect(entry.id).toBe('security-reviewer')
    expect(entry.profile.allowedTools).toEqual(['read', 'grep', 'ls'])
    expect(entry.profile.providerId).toBe('deepseek')
    expect(entry.profile.color).toBe('#10b981')
    expect(entry.profile.mode).toBe('subagent')
  })

  it('parses blockedTools / blockedMcpServers / blockedSkills deny-lists from frontmatter', async () => {
    await writeFile(
      join(workspace, '.kun', 'agents', 'scoped.md'),
      [
        '---',
        'id: scoped',
        'name: Scoped',
        'toolPolicy: inherit',
        'blockedTools: [bash, write]',
        'blockedMcpServers: [github]',
        'blockedSkills: [deep-research, pdf]',
        '---'
      ].join('\n')
    )
    const profiles = await loadWorkspaceAgentProfiles(workspace)
    const entry = profiles.find((p) => p.id === 'scoped')!
    expect(entry.profile.blockedTools).toEqual(['bash', 'write'])
    expect(entry.profile.blockedMcpServers).toEqual(['github'])
    expect(entry.profile.blockedSkills).toEqual(['deep-research', 'pdf'])
  })

  it('drops files without frontmatter silently', async () => {
    await writeFile(
      join(workspace, '.kun', 'agents', 'no-front.md'),
      'Plain markdown without YAML frontmatter.'
    )
    await writeFile(
      join(workspace, '.kun', 'agents', 'real.md'),
      '---\nname: Real\nmode: all\ntoolPolicy: inherit\n---\nBody.'
    )
    const profiles = await loadWorkspaceAgentProfiles(workspace)
    expect(profiles.map((p) => p.id)).toEqual(['real'])
  })
})
