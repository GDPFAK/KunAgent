import { describe, expect, it } from 'vitest'
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import {
  auditPackage,
  computeContentHash,
  evaluateUpdate,
  verifyContentHash,
  verifyPackageSignature,
  type PackageManifest
} from './package-audit.js'

function manifest(overrides: Partial<PackageManifest> = {}): PackageManifest {
  return { name: 'awesome-mcp', version: '1.2.3', publisher: 'acme', contentHash: 'abc', signed: true, ...overrides }
}

describe('auditPackage', () => {
  it('passes a clean pinned signed package', () => {
    const result = auditPackage({ source: 'mcp', manifest: manifest() })
    expect(result.installable).toBe(true)
    expect(result.findings.every((f) => f.severity !== 'block')).toBe(true)
  })

  it('warns on unpinned version and missing publisher/hash', () => {
    const result = auditPackage({ source: 'skill', manifest: manifest({ version: '^1.0.0', publisher: undefined, contentHash: undefined }) })
    const codes = result.findings.map((f) => f.code)
    expect(codes).toContain('unpinned_version')
    expect(codes).toContain('unknown_publisher')
    expect(codes).toContain('no_content_hash')
    expect(result.installable).toBe(true) // warnings don't block
  })

  it('surfaces sensitive permissions requiring consent', () => {
    const result = auditPackage({ source: 'mcp', manifest: manifest({ permissions: ['network', 'exec', 'read'] }) })
    expect(result.sensitivePermissions).toEqual(['network', 'exec'])
  })

  it('blocks a likely typosquat of a trusted package', () => {
    const result = auditPackage({ source: 'mcp', manifest: manifest({ name: 'awesome-mcq' }), known: { trusted: ['awesome-mcp'] } })
    expect(result.installable).toBe(false)
    expect(result.findings.some((f) => f.code === 'possible_typosquat')).toBe(true)
  })

  it('blocks a content-hash change without a version bump', () => {
    const result = auditPackage({
      source: 'mcp',
      manifest: manifest({ contentHash: 'new' }),
      previous: manifest({ contentHash: 'old' })
    })
    expect(result.installable).toBe(false)
    expect(result.findings.some((f) => f.code === 'hash_mismatch_same_version')).toBe(true)
  })

  it('VERIFIES downloaded bytes against the declared hash and passes on a match', () => {
    const content = Buffer.from('package bytes here')
    const result = auditPackage({ source: 'mcp', manifest: manifest({ contentHash: computeContentHash(content) }), content })
    expect(result.hashVerified).toBe(true)
    expect(result.installable).toBe(true)
    expect(result.findings.some((f) => f.code === 'hash_verified')).toBe(true)
  })

  it('BLOCKS when downloaded bytes do not match the declared hash (tampering)', () => {
    const result = auditPackage({ source: 'mcp', manifest: manifest({ contentHash: computeContentHash('expected') }), content: Buffer.from('TAMPERED') })
    expect(result.hashVerified).toBe(false)
    expect(result.installable).toBe(false)
    expect(result.findings.some((f) => f.code === 'hash_mismatch')).toBe(true)
  })

  it('verifyContentHash accepts a sha256: prefix and is case-insensitive', () => {
    const h = computeContentHash('abc')
    expect(verifyContentHash('abc', `sha256:${h.toUpperCase()}`)).toBe(true)
    expect(verifyContentHash('abc', 'deadbeef')).toBe(false)
  })

  it('cryptographically verifies a valid Ed25519 signature and blocks an invalid one', () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const content = Buffer.from('package bytes')
    const signatureBase64 = cryptoSign(null, content, privateKey).toString('base64')

    // Valid signature from the trusted publisher → verified + installable.
    const ok = auditPackage({
      source: 'mcp',
      manifest: manifest({ signatureBase64, contentHash: computeContentHash(content) }),
      content,
      trustedPublisherKeys: { acme: pem }
    })
    expect(ok.signatureVerified).toBe(true)
    expect(ok.installable).toBe(true)

    // Tampered content (hash still matches the tampered bytes) → only the
    // signature fails → block on signature_invalid.
    const tampered = Buffer.from('TAMPERED')
    const bad = auditPackage({
      source: 'mcp',
      manifest: manifest({ signatureBase64, contentHash: computeContentHash(tampered) }),
      content: tampered,
      trustedPublisherKeys: { acme: pem }
    })
    expect(bad.signatureVerified).toBe(false)
    expect(bad.installable).toBe(false)
    expect(bad.findings.some((f) => f.code === 'signature_invalid')).toBe(true)
  })

  it('warns when a signed package has no trusted publisher key', () => {
    const result = auditPackage({
      source: 'mcp',
      manifest: manifest({ signatureBase64: 'AAAA' }),
      content: Buffer.from('x')
    })
    expect(result.findings.some((f) => f.code === 'unknown_signer')).toBe(true)
  })

  it('verifyPackageSignature returns false on a malformed key', () => {
    expect(verifyPackageSignature({ content: 'x', signatureBase64: 'AAAA', publisherPublicKeyPem: 'not-a-key' })).toBe(false)
  })
})

describe('evaluateUpdate', () => {
  it('never auto-updates a locked package', () => {
    const d = evaluateUpdate({ current: manifest(), next: manifest({ version: '1.2.4' }), locked: true, autoUpdate: true })
    expect(d.allowed).toBe(false)
    expect(d.requiresConsent).toBe(true)
  })

  it('requires consent for a major version jump', () => {
    const d = evaluateUpdate({ current: manifest({ version: '1.9.9' }), next: manifest({ version: '2.0.0' }), autoUpdate: true })
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('major version')
  })

  it('requires consent when a new sensitive permission appears', () => {
    const d = evaluateUpdate({
      current: manifest({ permissions: ['read'] }),
      next: manifest({ version: '1.2.4', permissions: ['read', 'exec'] }),
      autoUpdate: true
    })
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('exec')
  })

  it('allows a minor update within policy when auto-update is on', () => {
    const d = evaluateUpdate({ current: manifest(), next: manifest({ version: '1.3.0' }), autoUpdate: true })
    expect(d.allowed).toBe(true)
  })

  it('blocks auto-update when disabled', () => {
    const d = evaluateUpdate({ current: manifest(), next: manifest({ version: '1.2.4' }), autoUpdate: false })
    expect(d.allowed).toBe(false)
    expect(d.reason).toContain('auto-update is disabled')
  })
})
