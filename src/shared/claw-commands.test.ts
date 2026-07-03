import { describe, expect, it } from 'vitest'
import { parseClawCommand } from './claw-commands'

describe('parseClawCommand', () => {
  it('parses IM help and new-topic commands', () => {
    expect(parseClawCommand('/help')).toEqual({ kind: 'help' })
    expect(parseClawCommand('/new')).toEqual({ kind: 'clear' })
    expect(parseClawCommand('/stop')).toEqual({ kind: 'stop' })
    expect(parseClawCommand('/停止')).toEqual({ kind: 'stop' })
  })

  it('parses IM skill and goal commands', () => {
    expect(parseClawCommand('/list-skills')).toEqual({ kind: 'showSkills' })
    expect(parseClawCommand('/skills')).toEqual({ kind: 'showSkills' })
    expect(parseClawCommand('/list-mcp')).toEqual({ kind: 'showMcp' })
    expect(parseClawCommand('/mcp')).toEqual({ kind: 'showMcp' })
    expect(parseClawCommand('/list-goal')).toEqual({ kind: 'showGoal' })
    expect(parseClawCommand('/goal')).toEqual({ kind: 'invalidGoal' })
    expect(parseClawCommand('/goal   ')).toEqual({ kind: 'invalidGoal' })
    expect(parseClawCommand('/goal 完成文档阅读')).toEqual({
      kind: 'setGoal',
      objective: '完成文档阅读'
    })
  })

  it('parses IM thread list commands', () => {
    expect(parseClawCommand('/threads')).toEqual({ kind: 'showThreads' })
    expect(parseClawCommand('-列表')).toEqual({ kind: 'showThreads' })
    expect(parseClawCommand('任务列表')).toEqual({ kind: 'showThreads' })
  })

  it('parses IM current-thread commands', () => {
    expect(parseClawCommand('/current')).toEqual({ kind: 'showCurrentThread' })
    expect(parseClawCommand('/当前会话')).toEqual({ kind: 'showCurrentThread' })
    expect(parseClawCommand('当前会话')).toEqual({ kind: 'showCurrentThread' })
  })

  it('parses IM thread switch commands', () => {
    expect(parseClawCommand('/switch 2')).toEqual({ kind: 'switchThread', target: '2' })
    expect(parseClawCommand('-切换到 文档阅读')).toEqual({ kind: 'switchThread', target: '文档阅读' })
    expect(parseClawCommand('切换到 文档阅读')).toEqual({ kind: 'switchThread', target: '文档阅读' })
  })
})
