import { jsonResponse, type JsonResponse } from '../response.js'
import { ERRORS } from './runtime-error.js'
import { auditPackage, evaluateUpdate, type PackageManifest } from '../../supplychain/package-audit.js'
import type { ServerRuntime } from './server-runtime.js'
import { readJsonBody } from '../read-json-body.js'

const MAX_AUDIT_CONTENT_BYTES = 16 * 1024 * 1024

/**
 * POST /v1/supply-chain/audit — pre-install audit of a Skill/MCP package
 * (P2 #2, P0-06). The GUI install card sends the manifest (+ optional known
 * trusted names / previous version / downloaded bytes) and gets back findings,
 * installability, and the sensitive permissions that require explicit consent.
 *
 * SECURITY: the trusted publisher signing keys come ONLY from the runtime-owned
 * trust store (`runtime.supplyChainTrust`), never from the request body. The
 * request references a publisher by id (`manifest.publisher`); it cannot supply
 * the key its own signature would verify against.
 */
export async function auditSupplyChainPackage(runtime: ServerRuntime, request: Request): Promise<JsonResponse> {
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_AUDIT_CONTENT_BYTES * 2) {
    return ERRORS.validation(`package audit request exceeds ${MAX_AUDIT_CONTENT_BYTES * 2} byte limit`)
  }
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  const input = body.value as {
    source?: 'skill' | 'mcp'
    manifest?: PackageManifest
    known?: { trusted: string[] }
    previous?: PackageManifest
    /** Optional base64 of the downloaded package bytes for real hash/signature verification. */
    contentBase64?: string
    strict?: boolean
    sensitivePermissionConsent?: boolean
  }
  if (!input.manifest || typeof input.manifest.name !== 'string' || typeof input.manifest.version !== 'string') {
    return ERRORS.validation('manifest with name + version is required')
  }
  // Resolve the publisher's trusted signing key from the RUNTIME trust store,
  // keyed by the manifest's publisher id. The request body cannot influence
  // which key is trusted (P0-06). No trust store / unknown publisher → no key,
  // and the audit reports the signature as unverifiable rather than verified.
  const publisherKey = input.manifest.publisher
    ? runtime.supplyChainTrust?.getPublisherKey(input.manifest.publisher)
    : undefined
  const trustedPublisherKeys = publisherKey && input.manifest.publisher
    ? { [input.manifest.publisher]: publisherKey }
    : undefined
  let content: Buffer | undefined
  if (typeof input.contentBase64 === 'string') {
    if (
      input.contentBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(input.contentBase64)
    ) return ERRORS.validation('contentBase64 is invalid')
    content = Buffer.from(input.contentBase64, 'base64')
    if (content.byteLength > MAX_AUDIT_CONTENT_BYTES) return ERRORS.validation(`package content exceeds ${MAX_AUDIT_CONTENT_BYTES} byte audit limit`)
  }
  const result = auditPackage({
    source: input.source ?? 'mcp',
    manifest: input.manifest,
    ...(input.known ? { known: input.known } : {}),
    ...(input.previous ? { previous: input.previous } : {}),
    ...(content ? { content } : {}),
    ...(trustedPublisherKeys ? { trustedPublisherKeys } : {}),
    strict: input.strict ?? true,
    sensitivePermissionConsent: input.sensitivePermissionConsent === true
  })
  return jsonResponse(result)
}

/**
 * POST /v1/supply-chain/update-check — decide whether an update may apply
 * (locked / major bump / new sensitive permission / auto-update policy).
 */
export async function checkSupplyChainUpdate(request: Request): Promise<JsonResponse> {
  const body = await readJsonBody(request)
  if (!body.ok) return body.response
  const input = body.value as {
    current?: PackageManifest
    next?: PackageManifest
    locked?: boolean
    autoUpdate?: boolean
  }
  if (!input.current || !input.next) {
    return ERRORS.validation('current and next manifests are required')
  }
  return jsonResponse(evaluateUpdate({
    current: input.current,
    next: input.next,
    ...(input.locked !== undefined ? { locked: input.locked } : {}),
    ...(input.autoUpdate !== undefined ? { autoUpdate: input.autoUpdate } : {})
  }))
}
