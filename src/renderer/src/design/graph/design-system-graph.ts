import type { CanvasDocument, CanvasShape } from '../canvas/canvas-types'
import type { ComponentDef, DesignSystem, DesignToken } from '../canvas/design-system-types'
import type {
  DesignGraphDesignSystem,
  DesignGraphObject,
  DesignGraphTokenUsage
} from './design-graph-types'

const MAX_USAGE_PER_ENTRY = 24

function slug(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  return cleaned.slice(0, 96) || 'unnamed'
}

export function tokenGraphObjectId(tokenName: string): string {
  return `token_${slug(tokenName)}`
}

export function componentGraphObjectId(componentId: string): string {
  return `component_${slug(componentId)}`
}

function shapes(document?: CanvasDocument): CanvasShape[] {
  return Object.values(document?.objects ?? {}).filter((shape): shape is CanvasShape => Boolean(shape))
}

function tokenUsage(document?: CanvasDocument): Map<string, DesignGraphTokenUsage[]> {
  const map = new Map<string, DesignGraphTokenUsage[]>()
  for (const shape of shapes(document)) {
    for (const [prop, tokenName] of Object.entries(shape.tokenBindings ?? {})) {
      if (!tokenName) continue
      const list = map.get(tokenName) ?? []
      list.push({ objectId: shape.id, prop })
      map.set(tokenName, list)
    }
  }
  return map
}

function componentUsage(document?: CanvasDocument): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const shape of shapes(document)) {
    if (!shape.componentId) continue
    const list = map.get(shape.componentId) ?? []
    list.push(shape.id)
    map.set(shape.componentId, list)
  }
  return map
}

function tokenValue(token: DesignToken): unknown {
  return token.value
}

function tokenSummary(token: DesignToken, usage: DesignGraphTokenUsage[]) {
  return {
    name: token.name,
    kind: token.kind,
    usageCount: usage.length,
    usedBy: usage.slice(0, MAX_USAGE_PER_ENTRY)
  }
}

function componentSummary(component: ComponentDef, instanceIds: string[]) {
  return {
    id: component.id,
    name: component.name,
    version: component.version,
    slotCount: component.slots.length,
    rootShapeCount: component.tree.length,
    usageCount: instanceIds.length,
    instanceIds: instanceIds.slice(0, MAX_USAGE_PER_ENTRY)
  }
}

export function summarizeDesignSystemForGraph(
  system: DesignSystem | undefined,
  document?: CanvasDocument
): DesignGraphDesignSystem | undefined {
  if (!system) return undefined
  const tokenUsageByName = tokenUsage(document)
  const componentUsageById = componentUsage(document)
  const tokens = Object.values(system.tokens)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((token) => tokenSummary(token, tokenUsageByName.get(token.name) ?? []))
  const components = Object.values(system.components)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((component) => componentSummary(component, componentUsageById.get(component.id) ?? []))
  return {
    tokenCount: tokens.length,
    componentCount: components.length,
    tokenUsageCount: tokens.reduce((sum, token) => sum + token.usageCount, 0),
    componentInstanceCount: components.reduce((sum, component) => sum + component.usageCount, 0),
    tokens,
    components
  }
}

function tokenGraphObject(token: DesignToken, usage: DesignGraphTokenUsage[]): DesignGraphObject {
  return {
    id: tokenGraphObjectId(token.name),
    kind: 'token',
    name: token.name,
    parentId: null,
    children: [],
    source: { tokenName: token.name },
    metadata: {
      kind: token.kind,
      value: tokenValue(token),
      usageCount: usage.length,
      usedBy: usage.slice(0, MAX_USAGE_PER_ENTRY)
    }
  }
}

function componentGraphObject(component: ComponentDef, instanceIds: string[]): DesignGraphObject {
  return {
    id: componentGraphObjectId(component.id),
    kind: 'component',
    name: component.name,
    parentId: null,
    children: [],
    source: { componentId: component.id },
    metadata: {
      version: component.version,
      slots: component.slots,
      rootShapeCount: component.tree.length,
      usageCount: instanceIds.length,
      instanceIds: instanceIds.slice(0, MAX_USAGE_PER_ENTRY)
    }
  }
}

export function designSystemToGraphObjects(
  system: DesignSystem | undefined,
  document?: CanvasDocument
): Record<string, DesignGraphObject> {
  if (!system) return {}
  const tokenUsageByName = tokenUsage(document)
  const componentUsageById = componentUsage(document)
  const objects: Record<string, DesignGraphObject> = {}
  for (const token of Object.values(system.tokens)) {
    const object = tokenGraphObject(token, tokenUsageByName.get(token.name) ?? [])
    objects[object.id] = object
  }
  for (const component of Object.values(system.components)) {
    const object = componentGraphObject(component, componentUsageById.get(component.id) ?? [])
    objects[object.id] = object
  }
  return objects
}
