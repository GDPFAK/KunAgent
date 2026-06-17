import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('renderer content security policy', () => {
  it('allows blob image URLs for local attachment previews', () => {
    const source = readFileSync(resolve('src/main/index.ts'), 'utf8')
    const cspMatch = source.match(/strictCsp\s*=\s*"([^"]+)"/)
    expect(cspMatch).not.toBeNull()
    const csp = cspMatch![1]
    const imgSrc = csp.match(/img-src\s+([^;]+)/)?.[1] ?? ''

    expect(imgSrc.split(/\s+/)).toContain('blob:')
  })
})
