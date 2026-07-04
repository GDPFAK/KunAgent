import { describe, expect, it } from 'vitest'
import { parseClawCommand } from './claw-commands'

describe('parseClawCommand', () => {
  it('parses IM help and new-topic commands', () => {
    expect(parseClawCommand('/help')).toEqual({ kind: 'help' })
    expect(parseClawCommand('/new')).toEqual({ kind: 'clear' })
    expect(parseClawCommand('/clear')).toEqual({ kind: 'clear' })
    expect(parseClawCommand('-clear')).toEqual({ kind: 'clear' })
    expect(parseClawCommand('/stop')).toEqual({ kind: 'stop' })
    expect(parseClawCommand('-stop')).toEqual({ kind: 'stop' })
  })

  it('parses IM skill and goal commands', () => {
    expect(parseClawCommand('/list-skills')).toEqual({ kind: 'showSkills' })
    expect(parseClawCommand('/list-mcp')).toEqual({ kind: 'showMcp' })
    expect(parseClawCommand('/list-goal')).toEqual({ kind: 'showGoal' })
    expect(parseClawCommand('/goal')).toEqual({ kind: 'invalidGoal' })
    expect(parseClawCommand('/goal   ')).toEqual({ kind: 'invalidGoal' })
    expect(parseClawCommand('/goal 完成文档阅读')).toEqual({
      kind: 'setGoal',
      objective: '完成文档阅读'
    })
  })

  it('parses IM thread list commands', () => {
    expect(parseClawCommand('/list-threads')).toEqual({ kind: 'showThreads' })
    expect(parseClawCommand('-list-threads')).toEqual({ kind: 'showThreads' })
  })

  it('parses IM current-thread commands', () => {
    expect(parseClawCommand('/current')).toEqual({ kind: 'showCurrentThread' })
    expect(parseClawCommand('-current')).toEqual({ kind: 'showCurrentThread' })
  })

  it('parses IM thread switch commands', () => {
    expect(parseClawCommand('/switch 2')).toEqual({ kind: 'switchThread', target: '2' })
    expect(parseClawCommand('-switch 2')).toEqual({ kind: 'switchThread', target: '2' })
  })

  it('parses IM model commands', () => {
    expect(parseClawCommand('/list-model')).toEqual({ kind: 'showModel' })
    expect(parseClawCommand('/model')).toEqual({ kind: 'showModel' })
    expect(parseClawCommand('/model 3')).toEqual({ kind: 'model', model: '3' })
  })

  it('parses IM workspace and usage commands', () => {
    expect(parseClawCommand('/pwd')).toEqual({ kind: 'showWorkspace' })
    expect(parseClawCommand('/usage')).toEqual({ kind: 'showUsage' })
  })

  it('leaves unknown slash commands for normal AI handling', () => {
    expect(parseClawCommand('/wat')).toBeNull()
    expect(parseClawCommand('/threads')).toBeNull()
    expect(parseClawCommand('/list-models')).toBeNull()
    expect(parseClawCommand('/停止')).toBeNull()
    expect(parseClawCommand('任务列表')).toBeNull()
    expect(parseClawCommand('当前会话')).toBeNull()
    expect(parseClawCommand('切换到 文档阅读')).toBeNull()
    expect(parseClawCommand('/provider')).toBeNull()
    expect(parseClawCommand('/provider minimax')).toBeNull()
    expect(parseClawCommand('／wat')).toBeNull()
    expect(parseClawCommand('-wat')).toBeNull()
  })
})
