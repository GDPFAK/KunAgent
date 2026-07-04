import { describe, expect, it } from 'vitest'
import { isKunHealthResponseBody } from './kun-health'

describe('isKunHealthResponseBody', () => {
  it('accepts Kun serve health responses', () => {
    expect(isKunHealthResponseBody(JSON.stringify({
      status: 'ok',
      service: 'kun',
      mode: 'serve',
      version: '0.1.0',
      buildHash: 'hash-1'
    }))).toBe(true)
  })

  it('requires the expected runtime version when provided', () => {
    const body = JSON.stringify({
      status: 'ok',
      service: 'kun',
      mode: 'serve',
      version: '0.1.0',
      buildHash: 'hash-1'
    })
    expect(isKunHealthResponseBody(body, { expectedVersion: '0.1.0' })).toBe(true)
    expect(isKunHealthResponseBody(body, { expectedVersion: '0.1.1' })).toBe(false)
    expect(isKunHealthResponseBody(JSON.stringify({
      status: 'ok',
      service: 'kun',
      mode: 'serve'
    }), { expectedVersion: '0.1.0' })).toBe(false)
  })

  it('requires the expected build hash when provided', () => {
    const body = JSON.stringify({
      status: 'ok',
      service: 'kun',
      mode: 'serve',
      version: '0.1.0',
      buildHash: 'hash-1'
    })
    expect(isKunHealthResponseBody(body, { expectedBuildHash: 'hash-1' })).toBe(true)
    expect(isKunHealthResponseBody(body, { expectedBuildHash: 'hash-2' })).toBe(false)
    expect(isKunHealthResponseBody(JSON.stringify({
      status: 'ok',
      service: 'kun',
      mode: 'serve',
      version: '0.1.0'
    }), { expectedBuildHash: 'hash-1' })).toBe(false)
  })

  it('rejects generic or legacy runtime health responses', () => {
    expect(isKunHealthResponseBody(JSON.stringify({ status: 'ok' }))).toBe(false)
    expect(isKunHealthResponseBody(JSON.stringify({
      status: 'ok',
      service: 'codewhale',
      mode: 'serve'
    }))).toBe(false)
  })
})
