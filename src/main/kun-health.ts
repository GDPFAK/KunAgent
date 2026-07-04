export type KunHealthExpectation = {
  expectedVersion?: string
  expectedBuildHash?: string
}

export function isKunHealthResponseBody(body: string, expectation: KunHealthExpectation = {}): boolean {
  let parsed: unknown
  try {
    parsed = JSON.parse(body) as unknown
  } catch {
    return false
  }
  if (!parsed || typeof parsed !== 'object') return false
  const record = parsed as Record<string, unknown>
  if (record.status !== 'ok' || record.service !== 'kun' || record.mode !== 'serve') return false
  const expectedVersion = expectation.expectedVersion?.trim()
  if (expectedVersion && record.version !== expectedVersion) {
    return false
  }
  const expectedBuildHash = expectation.expectedBuildHash?.trim()
  if (expectedBuildHash && record.buildHash !== expectedBuildHash) {
    return false
  }
  return true
}
