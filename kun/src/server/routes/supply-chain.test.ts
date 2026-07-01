import { describe, expect, it } from 'vitest'
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto'
import { auditSupplyChainPackage, checkSupplyChainUpdate } from './supply-chain.js'
import { InMemoryPublisherTrustStore } from '../../supplychain/publisher-trust-store.js'
import type { ServerRuntime } from './server-runtime.js'

function jsonReq(body: unknown): Request {
  return new Request('http://127.0.0.1/v1/supply-chain/audit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  })
}

/** A runtime with an optional publisher trust store (the rest is unused here). */
function runtime(trust?: InMemoryPublisherTrustStore): ServerRuntime {
  return { ...(trust ? { supplyChainTrust: trust } : {}) } as unknown as ServerRuntime
}

describe('supply-chain audit route', () => {
  it('fails closed in strict mode when bytes and signature cannot be verified', async () => {
    const response = await auditSupplyChainPackage(runtime(), jsonReq({
      source: 'mcp',
      manifest: { name: 'good-pkg', version: '1.0.0', publisher: 'acme', contentHash: 'h', signed: true }
    }))
    const body = JSON.parse(response.body)
    expect(body.installable).toBe(false)
    expect(body.policy).toBe('strict')
  })

  it('blocks a typosquat', async () => {
    const response = await auditSupplyChainPackage(runtime(), jsonReq({
      manifest: { name: 'good-pkh', version: '1.0.0' },
      known: { trusted: ['good-pkg'] }
    }))
    const body = JSON.parse(response.body)
    expect(body.installable).toBe(false)
  })

  it('validates the manifest is present', async () => {
    const response = await auditSupplyChainPackage(runtime(), jsonReq({ source: 'mcp' }))
    expect(response.status).toBe(400)
  })

  it('rejects oversized audit requests by content length before parsing', async () => {
    const response = await auditSupplyChainPackage(runtime(), new Request('http://127.0.0.1/v1/supply-chain/audit', {
      method: 'POST',
      headers: { 'content-length': String(64 * 1024 * 1024) },
      body: '{}'
    }))
    expect(response.status).toBe(400)
  })

  it('verifies a signature against the RUNTIME trust store, not request-supplied keys (P0-06)', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const content = Buffer.from('package bytes v1')
    const signatureBase64 = cryptoSign(null, content, privateKey).toString('base64')
    const publisherPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

    // The runtime trusts "acme" with the real key → signature verifies.
    const trust = new InMemoryPublisherTrustStore({ acme: publisherPem })
    const response = await auditSupplyChainPackage(runtime(trust), jsonReq({
      manifest: { name: 'pkg', version: '1.0.0', publisher: 'acme', signatureBase64 },
      contentBase64: content.toString('base64')
    }))
    const body = JSON.parse(response.body)
    expect(body.signatureVerified).toBe(true)
  })

  it('ignores attacker-supplied trustedPublisherKeys in the request body (P0-06)', async () => {
    // Attacker signs with their OWN key and tries to smuggle the matching
    // "trusted" key in the request. The runtime trust store is empty, so the
    // forged key is ignored and the signature is NOT reported as verified.
    const { publicKey, privateKey } = generateKeyPairSync('ed25519')
    const content = Buffer.from('forged bytes')
    const signatureBase64 = cryptoSign(null, content, privateKey).toString('base64')
    const attackerPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

    const response = await auditSupplyChainPackage(runtime(new InMemoryPublisherTrustStore({})), jsonReq({
      manifest: { name: 'evil', version: '1.0.0', publisher: 'evil-co', signatureBase64 },
      contentBase64: content.toString('base64'),
      // This must be IGNORED by the route.
      trustedPublisherKeys: { 'evil-co': attackerPem }
    }))
    const body = JSON.parse(response.body)
    expect(body.signatureVerified).not.toBe(true)
  })

  it('decides an update requires consent for a major bump', async () => {
    const response = await checkSupplyChainUpdate(new Request('http://127.0.0.1/v1/supply-chain/update-check', {
      method: 'POST',
      body: JSON.stringify({ current: { name: 'p', version: '1.0.0' }, next: { name: 'p', version: '2.0.0' }, autoUpdate: true })
    }))
    const body = JSON.parse(response.body)
    expect(body.allowed).toBe(false)
    expect(body.requiresConsent).toBe(true)
  })
})
