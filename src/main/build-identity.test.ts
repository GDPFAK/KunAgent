import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { KUN_RUNTIME_BUILD_HASH } from '../../kun/src/version'
import { KUN_GUI_BUILD_HASH, KUN_GUI_VERSION } from '../shared/build-identity'

describe('build identity', () => {
  it('embeds the same git commit hash in GUI and runtime code', () => {
    expect(KUN_GUI_BUILD_HASH).toBe(KUN_RUNTIME_BUILD_HASH)
    expect(KUN_GUI_BUILD_HASH).toMatch(/^[0-9a-f]{40}$/)

    const head = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: new URL('../..', import.meta.url),
      encoding: 'utf8'
    }).trim()
    expect(KUN_GUI_BUILD_HASH).toBe(head)
  })

  it('embeds the package versions generated at build time', () => {
    expect(KUN_GUI_VERSION).toBe('0.1.0')
  })
})
