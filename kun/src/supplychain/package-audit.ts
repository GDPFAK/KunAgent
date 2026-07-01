/**
 * Skill / MCP supply-chain security (P2 #2).
 *
 * Before installing a Skill or MCP server, surface what it can do and whether it
 * is trustworthy: requested permissions, version pinning, publisher, content
 * hash, and a diff against any previously installed version. Supports version
 * locking, signature presence, a basic malicious-package (typosquat) heuristic,
 * and an install/auto-update decision. Pure + dependency-free so it runs before
 * any download and is unit-testable.
 */

import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto'

export type PackageSource = 'skill' | 'mcp'

export type PackageManifest = {
  name: string
  version: string
  publisher?: string
  /** Declared permissions/capabilities (network, fs, exec, secrets, ...). */
  permissions?: string[]
  /** SHA-256 (or similar) of the package contents. */
  contentHash?: string
  /** Signature blob presence (verification is the caller's crypto job). */
  signed?: boolean
  /** Detached signature over the package bytes (base64), verified against a trusted publisher key. */
  signatureBase64?: string
}

export type AuditFinding = {
  severity: 'info' | 'warn' | 'block'
  code: string
  message: string
}

export type PackageAuditResult = {
  name: string
  version: string
  findings: AuditFinding[]
  /** True when no `block`-severity finding is present. */
  installable: boolean
  /** Permissions that require explicit user consent before install. */
  sensitivePermissions: string[]
  /** Result of verifying the downloaded bytes against the declared hash, when content was provided. */
  hashVerified?: boolean
  /** Result of cryptographically verifying the signature against a trusted publisher key. */
  signatureVerified?: boolean
  policy: 'advisory' | 'strict'
}

/** Compute the canonical content hash (sha256 hex) of downloaded package bytes. */
export function computeContentHash(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

/** Constant-time-ish hash compare (case-insensitive hex). */
export function verifyContentHash(content: string | Buffer, expectedHash: string): boolean {
  const actual = computeContentHash(content).toLowerCase()
  const expected = expectedHash.trim().toLowerCase().replace(/^sha256:/, '')
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i += 1) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

/**
 * Verify a detached signature over the package bytes against a trusted publisher
 * public key (PEM). Supports Ed25519/Ed448 (algorithm = null) and RSA/EC
 * (sha256). Returns false on any malformed key/signature rather than throwing,
 * so a bad signature is a verification failure, not a crash.
 */
export function verifyPackageSignature(input: {
  content: string | Buffer
  signatureBase64: string
  publisherPublicKeyPem: string
}): boolean {
  try {
    const key = createPublicKey(input.publisherPublicKeyPem)
    const signature = Buffer.from(input.signatureBase64, 'base64')
    if (signature.length === 0) return false
    const data = Buffer.isBuffer(input.content) ? input.content : Buffer.from(input.content, 'utf8')
    const keyType = key.asymmetricKeyType
    const algorithm = keyType === 'ed25519' || keyType === 'ed448' ? null : 'sha256'
    return cryptoVerify(algorithm, data, key, signature)
  } catch {
    return false
  }
}

const SENSITIVE_PERMISSIONS = new Set(['exec', 'shell', 'secrets', 'env', 'network', 'filesystem-write', 'process'])

/** Well-known package names used by the typosquat heuristic. */
export type KnownPackages = {
  /** Names the user already trusts/installed (for diff + squat distance). */
  trusted: string[]
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
  }
  return dp[a.length][b.length]
}

function isVersionPinned(version: string): boolean {
  // Reject open ranges; require an exact x.y.z (optionally with prerelease).
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version.trim())
}

/**
 * Audit a package manifest before install. Produces findings the install card
 * shows; a single `block` finding makes it non-installable until resolved.
 */
export function auditPackage(input: {
  source: PackageSource
  manifest: PackageManifest
  known?: KnownPackages
  previous?: PackageManifest
  /** The downloaded package bytes; when present, the declared hash is VERIFIED (not trusted). */
  content?: string | Buffer
  /** Trusted publisher public keys (PEM), keyed by publisher id; enables signature verification. */
  trustedPublisherKeys?: Record<string, string>
  /** Strict mode turns unverifiable identity/integrity warnings into blocks. */
  strict?: boolean
  /** Explicit consent captured by the installer for sensitive permissions. */
  sensitivePermissionConsent?: boolean
}): PackageAuditResult {
  const findings: AuditFinding[] = []
  const { manifest } = input
  const policy = input.strict ? 'strict' : 'advisory'
  const severity = (advisory: AuditFinding['severity']): AuditFinding['severity'] =>
    input.strict && advisory === 'warn' ? 'block' : advisory

  if (!isVersionPinned(manifest.version)) {
    findings.push({ severity: severity('warn'), code: 'unpinned_version', message: `version "${manifest.version}" is not exactly pinned; pin to an exact x.y.z` })
  }
  if (!manifest.publisher) {
    findings.push({ severity: severity('warn'), code: 'unknown_publisher', message: 'package has no declared publisher' })
  }

  // Hash handling: when the downloaded bytes are provided we VERIFY them against
  // the declared hash (real integrity check) rather than trusting the manifest.
  let hashVerified: boolean | undefined
  if (input.content !== undefined) {
    if (!manifest.contentHash) {
      findings.push({ severity: severity('warn'), code: 'no_content_hash', message: 'no declared hash to verify the downloaded bytes against' })
      hashVerified = false
    } else if (verifyContentHash(input.content, manifest.contentHash)) {
      hashVerified = true
      findings.push({ severity: 'info', code: 'hash_verified', message: 'downloaded bytes match the declared content hash' })
    } else {
      hashVerified = false
      findings.push({ severity: 'block', code: 'hash_mismatch', message: 'downloaded bytes do NOT match the declared content hash (possible tampering)' })
    }
  } else if (!manifest.contentHash) {
    findings.push({ severity: severity('warn'), code: 'no_content_hash', message: 'package has no content hash to verify integrity' })
  } else {
    findings.push({ severity: input.strict ? 'block' : 'info', code: 'hash_declared_unverified', message: 'content hash is declared but the bytes were not provided for verification' })
  }

  // Signature: cryptographically verify when a signature + the content + a
  // trusted publisher key are all available. Presence alone is not trust.
  let signatureVerified: boolean | undefined
  if (manifest.signatureBase64 && input.content !== undefined) {
    const publisherKey = manifest.publisher ? input.trustedPublisherKeys?.[manifest.publisher] : undefined
    if (!publisherKey) {
      findings.push({ severity: severity('warn'), code: 'unknown_signer', message: 'package is signed but the publisher is not in the trusted key set; signature cannot be verified' })
    } else if (verifyPackageSignature({ content: input.content, signatureBase64: manifest.signatureBase64, publisherPublicKeyPem: publisherKey })) {
      signatureVerified = true
      findings.push({ severity: 'info', code: 'signature_verified', message: `signature verified against trusted publisher "${manifest.publisher}"` })
    } else {
      signatureVerified = false
      findings.push({ severity: 'block', code: 'signature_invalid', message: 'package signature does not verify against the trusted publisher key (possible tampering or wrong signer)' })
    }
  } else if (!manifest.signed && !manifest.signatureBase64) {
    findings.push({ severity: input.strict ? 'block' : 'info', code: 'unsigned', message: 'package is not signed' })
  } else if (manifest.signatureBase64 && input.content === undefined) {
    findings.push({ severity: input.strict ? 'block' : 'info', code: 'signature_unverified', message: 'package is signed but bytes were not provided for verification' })
  }

  const sensitivePermissions = (manifest.permissions ?? []).filter((perm) => SENSITIVE_PERMISSIONS.has(perm))
  if (sensitivePermissions.length > 0) {
    findings.push({
      severity: input.strict && !input.sensitivePermissionConsent ? 'block' : 'warn',
      code: 'sensitive_permissions',
      message: `requests sensitive permission(s): ${sensitivePermissions.join(', ')} — explicit consent required`
    })
  }

  // Typosquat heuristic: a NEW package whose name is 1 edit away from a trusted
  // one (but not equal) is a likely impersonation → block.
  for (const trusted of input.known?.trusted ?? []) {
    if (manifest.name === trusted) continue
    const distance = levenshtein(manifest.name.toLowerCase(), trusted.toLowerCase())
    if (distance > 0 && distance <= 1) {
      findings.push({
        severity: 'block',
        code: 'possible_typosquat',
        message: `name "${manifest.name}" is suspiciously similar to trusted package "${trusted}"`
      })
    }
  }

  // Content-hash change without a version bump → tampering signal → block.
  if (input.previous && input.previous.version === manifest.version &&
      input.previous.contentHash && manifest.contentHash &&
      input.previous.contentHash !== manifest.contentHash) {
    findings.push({
      severity: 'block',
      code: 'hash_mismatch_same_version',
      message: `content hash changed without a version bump (was ${input.previous.version})`
    })
  }

  return {
    name: manifest.name,
    version: manifest.version,
    findings,
    installable: !findings.some((f) => f.severity === 'block'),
    sensitivePermissions,
    ...(hashVerified !== undefined ? { hashVerified } : {}),
    ...(signatureVerified !== undefined ? { signatureVerified } : {}),
    policy
  }
}

export type UpdateDecision = {
  allowed: boolean
  requiresConsent: boolean
  reason: string
}

/**
 * Decide whether an update may apply. A locked package never auto-updates; a
 * major version jump or newly added sensitive permissions require consent.
 */
export function evaluateUpdate(input: {
  current: PackageManifest
  next: PackageManifest
  locked?: boolean
  autoUpdate?: boolean
}): UpdateDecision {
  if (input.locked) {
    return { allowed: false, requiresConsent: true, reason: 'package version is locked' }
  }
  const currentMajor = Number.parseInt(input.current.version.split('.')[0] ?? '0', 10)
  const nextMajor = Number.parseInt(input.next.version.split('.')[0] ?? '0', 10)
  const newPerms = (input.next.permissions ?? []).filter(
    (perm) => SENSITIVE_PERMISSIONS.has(perm) && !(input.current.permissions ?? []).includes(perm)
  )
  if (nextMajor > currentMajor) {
    return { allowed: false, requiresConsent: true, reason: `major version change ${input.current.version} → ${input.next.version}` }
  }
  if (newPerms.length > 0) {
    return { allowed: false, requiresConsent: true, reason: `new sensitive permission(s): ${newPerms.join(', ')}` }
  }
  if (!input.autoUpdate) {
    return { allowed: false, requiresConsent: true, reason: 'auto-update is disabled' }
  }
  return { allowed: true, requiresConsent: false, reason: 'minor/patch update within policy' }
}
