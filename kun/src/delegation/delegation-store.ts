import type { ChildRunRecord } from './delegation-runtime.js'

/**
 * Persistence contract for child run records. The runtime uses this to
 * save/query sub-session states so orphaned tasks can be reconciled
 * after a restart.
 */
export interface DelegationStore {
  upsert(record: ChildRunRecord): Promise<void>
  list(parentThreadId?: string): Promise<ChildRunRecord[]>
  get?(id: string): Promise<ChildRunRecord | null>
  listByStatus?(status: ChildRunRecord['status']): Promise<ChildRunRecord[]>
  listActive?(): Promise<ChildRunRecord[]>
  close?(): Promise<void>
}
