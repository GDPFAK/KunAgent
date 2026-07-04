import type { DomSourceBindingMatch, DomSourceSnapshot } from '../code-binding/dom-source-adapter'
import { invocationInputRecord, type DesignToolInvocation } from './protocol-types'

export type BindCodeInput = {
  selectedIds?: string[]
  matches?: DomSourceBindingMatch[]
  snapshotsByFrameId?: Record<string, DomSourceSnapshot>
  capturedAt: string
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const ids = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
  return ids.length > 0 ? ids : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function domMatch(value: unknown): DomSourceBindingMatch | null {
  if (!isRecord(value) || typeof value.designObjectId !== 'string' || !isRecord(value.node)) return null
  const tagName = typeof value.node.tagName === 'string' ? value.node.tagName.trim() : ''
  if (!tagName) return null
  return {
    designObjectId: value.designObjectId.trim(),
    node: {
      ...value.node,
      tagName
    }
  } as DomSourceBindingMatch
}

function domMatches(value: unknown): DomSourceBindingMatch[] | undefined {
  if (!Array.isArray(value)) return undefined
  const matches = value.map(domMatch).filter((match): match is DomSourceBindingMatch => Boolean(match))
  return matches.length > 0 ? matches : undefined
}

function domSnapshot(value: unknown): DomSourceSnapshot | null {
  if (!isRecord(value) || !Array.isArray(value.nodes)) return null
  const nodes = value.nodes.filter((node): node is DomSourceSnapshot['nodes'][number] =>
    isRecord(node) && typeof node.tagName === 'string'
  )
  if (nodes.length === 0) return null
  return {
    capturedAt: typeof value.capturedAt === 'string' ? value.capturedAt : new Date().toISOString(),
    ...(typeof value.routePath === 'string' ? { routePath: value.routePath } : {}),
    ...(typeof value.sourceFile === 'string' ? { sourceFile: value.sourceFile } : {}),
    nodes
  }
}

function snapshotsByFrameId(value: unknown): Record<string, DomSourceSnapshot> | undefined {
  if (!isRecord(value)) return undefined
  const entries = Object.entries(value)
    .map(([frameId, snapshot]) => [frameId, domSnapshot(snapshot)] as const)
    .filter((entry): entry is readonly [string, DomSourceSnapshot] => Boolean(entry[1]))
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function bindInput(invocation: DesignToolInvocation): BindCodeInput {
  const record = invocationInputRecord(invocation.input)
  return {
    selectedIds:
      stringArray(record?.selectedIds) ??
      stringArray(record?.scopeIds) ??
      stringArray(record?.frameIds) ??
      stringArray(record?.targetIds),
    matches: domMatches(record?.matches),
    snapshotsByFrameId: snapshotsByFrameId(record?.snapshotsByFrameId),
    capturedAt: typeof record?.capturedAt === 'string' ? record.capturedAt : new Date().toISOString()
  }
}
