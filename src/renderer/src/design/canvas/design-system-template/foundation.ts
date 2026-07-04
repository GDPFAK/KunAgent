import { useCanvasShapeStore } from "../canvas-shape-store"
import { useCanvasViewportStore } from "../canvas-viewport-store"
import {
  createDefaultShape,
  shapeGeometry,
  type CanvasShape,
  type Rect,
  type ShapeType
} from "../canvas-types"
import { placeRectInViewportAvoiding } from "../canvas-placement"
import { useDesignSystemStore } from "../design-system-store"
import { resolveTokenPatch, type ComponentDef, type DesignToken, type TokenProp } from "../design-system-types"
import type { OpError } from "../shape-ops"
import { normalizeDesignTarget, type DesignTarget } from "../../design-context"
import { useDesignWorkspaceStore } from "../../design-workspace-store"
import { cleanName, createTemplateBoard, finite, fontStack, positive } from './board-builders'
import { mix, normalizeHex, rotateHue } from './color-utils'

export type DesignSystemTemplateOperation = 'create' | 'update' | 'apply'

export type DesignSystemTemplateMode = 'light' | 'dark' | 'both'

export type DesignSystemTemplateKind = 'app' | 'saas' | 'game' | 'editor' | 'mobile' | 'portfolio'

export type DesignSystemTemplateTone = 'clean' | 'playful' | 'premium' | 'technical' | 'editorial'

export type DesignSystemTemplateOp = {
  op: 'design-system-template'
  operation: DesignSystemTemplateOperation
  name?: string
  seedColor?: string
  mode?: DesignSystemTemplateMode
  template?: DesignSystemTemplateKind
  tone?: DesignSystemTemplateTone
  sections?: string[]
  targetIds?: string[]
  x?: number
  y?: number
  width?: number
  height?: number
  dryRun?: boolean
}

export type TemplateFoundation = {
  name: string
  mode: Exclude<DesignSystemTemplateMode, 'both'>
  template: DesignSystemTemplateKind
  designTarget: DesignTarget
  tokenPrefix?: 'light' | 'dark'
  tokens: DesignToken[]
  colors: {
    primary: string
    secondary: string
    tertiary: string
    neutral: string
    canvas: string
    card: string
    elevated: string
    text: string
    muted: string
    border: string
    success: string
    warning: string
    danger: string
  }
  fonts: {
    headline: string
    body: string
    label: string
  }
}

export const DEFAULT_SEED = '#3B82D8'

export function defaultTemplateKind(): DesignSystemTemplateKind {
  const target = normalizeDesignTarget(useDesignWorkspaceStore.getState().designContext.designTarget)
  return target === 'app' ? 'mobile' : 'saas'
}

export function normalizeTemplateOp(op: DesignSystemTemplateOp): DesignSystemTemplateOp & { template: DesignSystemTemplateKind } {
  return {
    ...op,
    template: op.template ?? defaultTemplateKind()
  }
}

export function applyDesignSystemTemplateOp(
  op: DesignSystemTemplateOp,
  affectedIds: Set<string>,
  errors: OpError[]
): void {
  if (op.dryRun) return
  const normalizedOp = normalizeTemplateOp(op)

  if (normalizedOp.mode === 'both') {
    const baseName = cleanName(normalizedOp.name) || 'Design System'
    const defaultFoundation = buildFoundation({ ...normalizedOp, name: baseName, mode: 'dark' })
    const darkFoundation = buildFoundation({ ...normalizedOp, name: `${baseName} Dark`, mode: 'dark' }, 'dark')
    const lightFoundation = buildFoundation({ ...normalizedOp, name: `${baseName} Light`, mode: 'light' }, 'light')
    upsertTokens(defaultFoundation.tokens, op.targetIds, affectedIds)
    upsertTokens(darkFoundation.tokens, op.targetIds, affectedIds)
    upsertTokens(lightFoundation.tokens, op.targetIds, affectedIds)
    registerTemplateComponents(defaultFoundation)
    if (normalizedOp.operation !== 'apply') {
      const width = positive(normalizedOp.width) ?? 1580
      const x = finite(normalizedOp.x)
      createTemplateBoard({ ...normalizedOp, mode: 'dark', width, ...(x === undefined ? {} : { x }) }, darkFoundation, affectedIds, errors)
      createTemplateBoard(
        { ...normalizedOp, mode: 'light', width, ...(x === undefined ? {} : { x: x + width + 80 }) },
        lightFoundation,
        affectedIds,
        errors
      )
    }
    return
  }

  const foundation = buildFoundation(normalizedOp)
  upsertTokens(foundation.tokens, op.targetIds, affectedIds)
  registerTemplateComponents(foundation)
  if (normalizedOp.operation !== 'apply') {
    createTemplateBoard(normalizedOp, foundation, affectedIds, errors)
  }
}

export function buildFoundation(
  op: DesignSystemTemplateOp,
  tokenPrefix?: TemplateFoundation['tokenPrefix']
): TemplateFoundation {
  const mode = op.mode === 'light' ? 'light' : 'dark'
  const template = op.template ?? defaultTemplateKind()
  const designTarget = normalizeDesignTarget(useDesignWorkspaceStore.getState().designContext.designTarget)
  const primary = normalizeHex(op.seedColor) ?? DEFAULT_SEED
  const secondary = rotateHue(primary, template === 'game' || op.tone === 'playful' ? 86 : 42)
  const tertiary = mode === 'dark' ? '#050505' : '#111827'
  const neutral = mode === 'dark' ? '#F8FAFC' : '#FFFFFF'
  const canvas = mode === 'dark' ? '#111313' : '#F7F7F2'
  const card = mode === 'dark' ? '#1C1F1F' : '#FFFFFF'
  const elevated = mode === 'dark' ? '#262A2A' : '#ECEAE2'
  const text = mode === 'dark' ? '#F3F0E7' : '#171717'
  const muted = mode === 'dark' ? '#AFA792' : '#68645A'
  const border = mode === 'dark' ? mix(primary, '#111313', 0.52) : mix(primary, '#FFFFFF', 0.78)
  const fonts = fontStack(template, op.tone)
  const name = cleanName(op.name) || 'Design System'
  const tn = (value: string) => tokenPrefix ? `${tokenPrefix}/${value}` : value

  return {
    name,
    mode,
    template,
    designTarget,
    ...(tokenPrefix ? { tokenPrefix } : {}),
    colors: {
      primary,
      secondary,
      tertiary,
      neutral,
      canvas,
      card,
      elevated,
      text,
      muted,
      border,
      success: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626'
    },
    fonts,
    tokens: [
      { name: tn('brand/primary'), kind: 'color', value: primary },
      { name: tn('brand/secondary'), kind: 'color', value: secondary },
      { name: tn('brand/tertiary'), kind: 'color', value: tertiary },
      { name: tn('neutral/0'), kind: 'color', value: neutral },
      { name: tn('surface/canvas'), kind: 'color', value: canvas },
      { name: tn('surface/card'), kind: 'color', value: card },
      { name: tn('surface/elevated'), kind: 'color', value: elevated },
      { name: tn('text/primary'), kind: 'color', value: text },
      { name: tn('text/muted'), kind: 'color', value: muted },
      { name: tn('border/default'), kind: 'color', value: border },
      { name: tn('state/success'), kind: 'color', value: '#16A34A' },
      { name: tn('state/warning'), kind: 'color', value: '#D97706' },
      { name: tn('state/danger'), kind: 'color', value: '#DC2626' },
      {
        name: tn('type/headline'),
        kind: 'type',
        value: { fontSize: 72, fontWeight: 700, fontFamily: fonts.headline, lineHeight: 1.05, fontColor: text }
      },
      {
        name: tn('type/body'),
        kind: 'type',
        value: { fontSize: 48, fontWeight: 500, fontFamily: fonts.body, lineHeight: 1.2, fontColor: muted }
      },
      {
        name: tn('type/label'),
        kind: 'type',
        value: { fontSize: 24, fontWeight: 600, fontFamily: fonts.label, lineHeight: 1.25, fontColor: muted }
      },
      { name: tn('space/sm'), kind: 'space', value: 8 },
      { name: tn('space/md'), kind: 'space', value: 16 },
      { name: tn('space/lg'), kind: 'space', value: 28 },
      { name: tn('radius/control'), kind: 'radius', value: 8 },
      { name: tn('radius/card'), kind: 'radius', value: 28 },
      {
        name: tn('shadow/card'),
        kind: 'shadow',
        value: [{ type: 'drop', x: 0, y: 18, blur: 48, spread: 0, color: '#000000', opacity: mode === 'dark' ? 0.32 : 0.14 }]
      }
    ]
  }
}

export function upsertTokens(tokens: DesignToken[], targetIds: string[] | undefined, affectedIds: Set<string>): void {
  const ds = useDesignSystemStore.getState()
  const store = useCanvasShapeStore.getState()
  const tokenByName = new Map(tokens.map((token) => [token.name, token]))
  const scope = targetIds && targetIds.length > 0 ? collectScope(targetIds) : null
  for (const token of tokens) ds.setToken(token)

  for (const id of store.getAllShapeIds()) {
    if (scope && !scope.has(id)) continue
    const shape = store.getShape(id)
    if (!shape?.tokenBindings) continue
    const patch: Partial<CanvasShape> = {}
    let changed = false
    for (const [prop, tokenName] of Object.entries(shape.tokenBindings)) {
      const token = tokenByName.get(tokenName)
      if (!token) continue
      const resolved = resolveTokenPatch(token, prop as TokenProp, shape)
      if ('error' in resolved) continue
      Object.assign(patch, resolved)
      changed = true
    }
    if (changed) {
      store.updateShape(id, patch)
      affectedIds.add(id)
    }
  }
}

export function registerTemplateComponents(foundation: TemplateFoundation): void {
  const ds = useDesignSystemStore.getState()
  for (const component of [
    buttonComponent(foundation),
    searchInputComponent(foundation),
    cardComponent(foundation)
  ]) {
    ds.setComponent(component)
  }
}

export function buttonComponent(foundation: TemplateFoundation): ComponentDef {
  const root = componentShape('rect', 'Button', {
    width: 150,
    height: 48,
    cornerRadius: 8,
    fills: [{ type: 'solid', color: foundation.colors.primary, opacity: 1 }],
    tokenBindings: bindTokens(foundation, { fill: 'brand/primary', radius: 'radius/control' })
  })
  const label = componentShape('text', 'label', {
    parentId: root.id,
    x: 28,
    y: 12,
    width: 94,
    height: 24,
    textContent: 'Button',
    fontSize: 18,
    fontFamily: foundation.fonts.label,
    fontWeight: 700,
    fontColor: foundation.colors.tertiary,
    tokenBindings: bindTokens(foundation, { font: 'type/label', 'text-color': 'brand/tertiary' })
  })
  root.children = [label.id]
  return {
    id: 'component/button',
    name: 'Button',
    version: 1,
    tree: [root, label],
    slots: [{ path: 'label', kind: 'text', label: 'Label' }]
  }
}

export function searchInputComponent(foundation: TemplateFoundation): ComponentDef {
  const root = componentShape('frame', 'SearchInput', {
    width: 300,
    height: 62,
    cornerRadius: 8,
    fills: [{ type: 'solid', color: foundation.colors.elevated, opacity: 1 }],
    strokes: [{ color: foundation.colors.border, width: 2, opacity: 1, position: 'inside' }],
    tokenBindings: bindTokens(foundation, { fill: 'surface/elevated', stroke: 'border/default', radius: 'radius/control' })
  })
  const label = componentShape('text', 'placeholder', {
    parentId: root.id,
    x: 64,
    y: 17,
    width: 150,
    height: 28,
    textContent: 'Search',
    fontSize: 20,
    fontFamily: foundation.fonts.label,
    fontWeight: 600,
    fontColor: foundation.colors.muted,
    tokenBindings: bindTokens(foundation, { font: 'type/label', 'text-color': 'text/muted' })
  })
  root.children = [label.id]
  return {
    id: 'component/search-input',
    name: 'SearchInput',
    version: 1,
    tree: [root, label],
    slots: [{ path: 'placeholder', kind: 'text', label: 'Placeholder' }]
  }
}

export function cardComponent(foundation: TemplateFoundation): ComponentDef {
  const root = componentShape('frame', 'Card', {
    width: 280,
    height: 180,
    cornerRadius: 28,
    fills: [{ type: 'solid', color: foundation.colors.card, opacity: 1 }],
    tokenBindings: bindTokens(foundation, { fill: 'surface/card', radius: 'radius/card', shadow: 'shadow/card' }),
    shadows: [{ type: 'drop', x: 0, y: 18, blur: 48, spread: 0, color: '#000000', opacity: foundation.mode === 'dark' ? 0.32 : 0.14 }]
  })
  const title = componentShape('text', 'title', {
    parentId: root.id,
    x: 24,
    y: 26,
    width: 220,
    height: 34,
    textContent: 'Card title',
    fontSize: 24,
    fontFamily: foundation.fonts.label,
    fontWeight: 700,
    fontColor: foundation.colors.text,
    tokenBindings: bindTokens(foundation, { font: 'type/label', 'text-color': 'text/primary' })
  })
  const body = componentShape('text', 'body', {
    parentId: root.id,
    x: 24,
    y: 78,
    width: 220,
    height: 74,
    textContent: 'Reusable content block',
    fontSize: 18,
    fontFamily: foundation.fonts.body,
    fontWeight: 500,
    fontColor: foundation.colors.muted,
    tokenBindings: bindTokens(foundation, { font: 'type/body', 'text-color': 'text/muted' })
  })
  root.children = [title.id, body.id]
  return {
    id: 'component/card',
    name: 'Card',
    version: 1,
    tree: [root, title, body],
    slots: [
      { path: 'title', kind: 'text', label: 'Title' },
      { path: 'body', kind: 'text', label: 'Body' }
    ]
  }
}

export function componentShape(type: ShapeType, name: string, patch: Partial<CanvasShape>): CanvasShape {
  const shape = createDefaultShape(type, patch.x ?? 0, patch.y ?? 0)
  Object.assign(shape, patch, { name })
  return shape
}

export function tokenName(foundation: TemplateFoundation, token: string): string {
  return foundation.tokenPrefix ? `${foundation.tokenPrefix}/${token}` : token
}

export function bindTokens(foundation: TemplateFoundation, bindings: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(bindings).map(([prop, token]) => [prop, tokenName(foundation, token)])
  )
}

export function collectScope(rootIds: string[]): Set<string> {
  const store = useCanvasShapeStore.getState()
  const out = new Set<string>()
  const visit = (id: string): void => {
    if (out.has(id)) return
    const shape = store.getShape(id)
    if (!shape) return
    out.add(id)
    for (const child of shape.children) visit(child)
  }
  for (const id of rootIds) visit(id)
  return out
}
