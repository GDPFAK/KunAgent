/**
 * Runtime-owned publisher trust store (P0-06).
 *
 * The supply-chain audit verifies a package signature against a TRUSTED
 * publisher key. That trust root must belong to the runtime — never to the
 * caller of the audit endpoint. If the requester could supply the "trusted"
 * keys (as an earlier version allowed), an attacker would simply send their own
 * key alongside their own signature and every forged package would verify. This
 * store holds the publisher keys the runtime trusts and is the ONLY source the
 * audit route consults; the request body's keys are ignored.
 *
 * Keys are loaded from a runtime-controlled location (a JSON map of
 * `publisherId -> PEM public key`). Absent / unreadable config = an empty trust
 * store = no signature can be verified (fail closed, not fail open).
 */

import { readFile } from 'node:fs/promises'

export interface PublisherTrustStore {
  /** Trusted PEM public key for a publisher id, or undefined when untrusted. */
  getPublisherKey(publisherId: string): string | undefined
  /** Trusted publisher ids (for diagnostics; never the key material). */
  trustedPublisherIds(): string[]
}

export class InMemoryPublisherTrustStore implements PublisherTrustStore {
  private readonly keys: Map<string, string>

  constructor(keys: Record<string, string> = {}) {
    this.keys = new Map(
      Object.entries(keys).filter(([id, pem]) => typeof id === 'string' && id.length > 0 && typeof pem === 'string' && pem.length > 0)
    )
  }

  getPublisherKey(publisherId: string): string | undefined {
    if (!publisherId) return undefined
    return this.keys.get(publisherId)
  }

  trustedPublisherIds(): string[] {
    return [...this.keys.keys()]
  }
}

/**
 * Load a publisher trust store from a runtime-controlled JSON file mapping
 * `publisherId -> PEM`. A missing or malformed file yields an empty (fail-closed)
 * store rather than throwing, so the runtime always starts with a well-defined
 * trust root.
 */
export async function loadPublisherTrustStore(filePath: string): Promise<PublisherTrustStore> {
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
      return new InMemoryPublisherTrustStore(Object.fromEntries(entries))
    }
  } catch {
    // Missing / unreadable / malformed → empty trust store (fail closed).
  }
  return new InMemoryPublisherTrustStore({})
}
