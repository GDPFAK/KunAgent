import { describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InMemoryPublisherTrustStore, loadPublisherTrustStore } from './publisher-trust-store.js'

describe('PublisherTrustStore', () => {
  it('returns a trusted key by publisher id and lists trusted ids', () => {
    const store = new InMemoryPublisherTrustStore({ acme: 'PEM-A', globex: 'PEM-B' })
    expect(store.getPublisherKey('acme')).toBe('PEM-A')
    expect(store.getPublisherKey('unknown')).toBeUndefined()
    expect(store.trustedPublisherIds().sort()).toEqual(['acme', 'globex'])
  })

  it('ignores empty ids/keys', () => {
    const store = new InMemoryPublisherTrustStore({ '': 'x', acme: '' } as Record<string, string>)
    expect(store.trustedPublisherIds()).toEqual([])
    expect(store.getPublisherKey('')).toBeUndefined()
  })

  it('loads from a JSON file and fails closed on a missing/malformed file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'kun-trust-'))
    try {
      const path = join(dir, 'keys.json')
      await writeFile(path, JSON.stringify({ acme: 'PEM-A', bad: 123 }), 'utf8')
      const store = await loadPublisherTrustStore(path)
      expect(store.getPublisherKey('acme')).toBe('PEM-A')
      // Non-string value is dropped.
      expect(store.getPublisherKey('bad')).toBeUndefined()

      const missing = await loadPublisherTrustStore(join(dir, 'nope.json'))
      expect(missing.trustedPublisherIds()).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
