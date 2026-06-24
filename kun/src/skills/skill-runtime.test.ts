import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SkillRuntime } from './skill-runtime.js'

describe('SkillRuntime', () => {
  let tempRoot = ''

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'kun-skill-runtime-'))
  })

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true })
  })

  it('excludes disabled skill ids from catalog, diagnostics, matching, and load_skill', async () => {
    const root = join(tempRoot, 'skills')
    await writeSkill(root, 'gmail', 'Gmail')
    await writeSkill(root, 'vercel-agent', 'Vercel Agent')

    const runtime = await SkillRuntime.create({
      enabled: true,
      roots: [root],
      disabledIds: ['gmail'],
      legacySkillMd: true
    })

    const diagnostics = runtime.diagnostics()
    expect(diagnostics.skills.map((skill) => skill.id)).toEqual(['vercel-agent'])
    expect(runtime.catalogInstruction()).toContain('vercel-agent')
    expect(runtime.catalogInstruction()).not.toContain('gmail')
    expect(runtime.resolveTurn({ prompt: 'use /skill:gmail', workspace: tempRoot }).activeSkillIds)
      .toEqual([])
    expect(runtime.loadSkillById('gmail')).toMatchObject({
      error: expect.stringContaining('unknown skill id')
    })
    expect(runtime.loadSkillById('vercel-agent')).toMatchObject({
      skillId: 'vercel-agent',
      name: 'Vercel Agent'
    })
  })
})

async function writeSkill(root: string, id: string, name: string): Promise<void> {
  const skillRoot = join(root, id)
  await mkdir(skillRoot, { recursive: true })
  await writeFile(join(skillRoot, 'SKILL.md'), [
    '---',
    `id: ${id}`,
    `name: ${name}`,
    'description: Test skill.',
    '---',
    '',
    'Follow the test instructions.'
  ].join('\n'), 'utf8')
}
