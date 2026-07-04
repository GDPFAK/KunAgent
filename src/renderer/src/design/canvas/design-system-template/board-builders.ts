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
import type { DesignSystemTemplateKind, DesignSystemTemplateOp, DesignSystemTemplateTone, TemplateFoundation } from './foundation'
import { bindTokens, tokenName } from './foundation'
import { mix } from './color-utils'

export function createTemplateBoard(
  op: DesignSystemTemplateOp,
  foundation: TemplateFoundation,
  affectedIds: Set<string>,
  errors: OpError[]
): void {
  const viewport = useCanvasViewportStore.getState().vbox
  const width = positive(op.width) ?? 1580
  const height = positive(op.height) ?? 880
  const autoRect = placeRectInViewportAvoiding(
    { width, height },
    viewport,
    rootContentRects()
  )
  const x = finite(op.x) ?? autoRect.x
  const y = finite(op.y) ?? autoRect.y
  const board = addShape('frame', {
    name: `${foundation.name} Style Kit`,
    x,
    y,
    width,
    height,
    cornerRadius: 30,
    clipContent: true,
    fills: [{ type: 'solid', color: foundation.colors.canvas, opacity: 1 }],
    strokes: [{ color: foundation.colors.border, width: 2, opacity: 1, position: 'inside' }],
    shadows: [{ type: 'drop', x: 0, y: 28, blur: 80, spread: 0, color: '#000000', opacity: foundation.mode === 'dark' ? 0.42 : 0.18 }],
    tokenBindings: bindTokens(foundation, { fill: 'surface/canvas', stroke: 'border/default', radius: 'radius/card', shadow: 'shadow/card' })
  }, undefined, affectedIds)

  if (!board) {
    errors.push({ code: 'INVALID_OP', message: 'Could not create design-system template board' })
    return
  }

  const pad = 34
  const col1 = x + pad
  const col2 = x + 390
  const col3 = x + 790
  const col4 = x + 1180
  const top = y + pad
  addLabel(foundation, `${foundation.name}`, col1, y + 12, board, affectedIds, 'type/label')
  addLabel(foundation, templateBadgeLabel(foundation), col4, y + 12, board, affectedIds, 'type/label')

  paletteCard(foundation, 'Primary', 'brand/primary', foundation.colors.primary, col1, top, board, affectedIds)
  paletteCard(foundation, 'Secondary', 'brand/secondary', foundation.colors.secondary, col1, top + 220, board, affectedIds)
  paletteCard(foundation, 'Tertiary', 'brand/tertiary', foundation.colors.tertiary, col1, top + 440, board, affectedIds)
  paletteCard(foundation, 'Neutral', 'neutral/0', foundation.colors.neutral, col1, top + 660, board, affectedIds)

  typeCard(foundation, 'Headline', foundation.fonts.headline, 'type/headline', col2, top, 350, 260, board, affectedIds)
  typeCard(foundation, 'Body', foundation.fonts.body, 'type/body', col2, top + 290, 350, 260, board, affectedIds)
  typeCard(foundation, 'Label', foundation.fonts.label, 'type/label', col2, top + 580, 350, 260, board, affectedIds)

  componentCard(foundation, 'Buttons', col3, top, 370, 260, board, affectedIds, (parent) => {
    button(foundation, 'Primary', col3 + 28, top + 80, 'brand/primary', 'brand/tertiary', parent, affectedIds)
    button(foundation, 'Secondary', col3 + 200, top + 80, 'surface/elevated', 'text/primary', parent, affectedIds)
    button(foundation, 'Inverted', col3 + 28, top + 146, 'neutral/0', 'brand/tertiary', parent, affectedIds)
    outlineButton(foundation, 'Outlined', col3 + 200, top + 146, parent, affectedIds)
  })

  componentCard(foundation, 'Search', col4, top, 370, 260, board, affectedIds, (parent) => {
    addShape('rect', {
      name: 'Search input',
      x: col4 + 34,
      y: top + 100,
      width: 300,
      height: 62,
      cornerRadius: 0,
      fills: [{ type: 'solid', color: foundation.colors.elevated, opacity: 1 }],
      strokes: [{ color: foundation.colors.border, width: 2, opacity: 0.7, position: 'inside' }],
      tokenBindings: bindTokens(foundation, { fill: 'surface/elevated', stroke: 'border/default' })
    }, parent, affectedIds)
    addLabel(foundation, 'Search', col4 + 98, top + 115, parent, affectedIds, 'type/label')
    addIcon(foundation, 'magnifier', col4 + 58, top + 119, parent, affectedIds)
  })

  componentCard(foundation, 'Progress', col3, top + 290, 370, 260, board, affectedIds, (parent) => {
    progress(foundation, col3 + 34, top + 102, 250, 'brand/primary', parent, affectedIds)
    progress(foundation, col3 + 34, top + 142, 292, 'brand/secondary', parent, affectedIds)
    progress(foundation, col3 + 34, top + 182, 198, 'neutral/0', parent, affectedIds)
  })

  componentCard(foundation, 'Navigation', col4, top + 290, 370, 260, board, affectedIds, (parent) => {
    if (usesBottomNavigation(foundation.template)) {
      addShape('rect', {
        name: 'Bottom nav surface',
        x: col4 + 42,
        y: top + 112 + 290,
        width: 285,
        height: 78,
        cornerRadius: 36,
        fills: [{ type: 'solid', color: foundation.colors.elevated, opacity: 1 }],
        tokenBindings: bindTokens(foundation, { fill: 'surface/elevated', radius: 'radius/card' })
      }, parent, affectedIds)
      iconButton(foundation, 'home', col4 + 100, top + 125 + 290, 'brand/primary', parent, affectedIds)
      addIcon(foundation, 'magnifier', col4 + 198, top + 148 + 290, parent, affectedIds)
      addIcon(foundation, 'user', col4 + 276, top + 148 + 290, parent, affectedIds)
      return
    }
    addShape('rect', {
      name: 'Top nav surface',
      x: col4 + 34,
      y: top + 108 + 290,
      width: 300,
      height: 62,
      cornerRadius: 8,
      fills: [{ type: 'solid', color: foundation.colors.elevated, opacity: 1 }],
      strokes: [{ color: foundation.colors.border, width: 2, opacity: 0.72, position: 'inside' }],
      tokenBindings: bindTokens(foundation, { fill: 'surface/elevated', stroke: 'border/default', radius: 'radius/control' })
    }, parent, affectedIds)
    addLabel(foundation, 'Product', col4 + 54, top + 124 + 290, parent, affectedIds, 'type/label', 'text/primary')
    addLabel(foundation, 'Docs', col4 + 154, top + 124 + 290, parent, affectedIds, 'type/label')
    addShape('rect', {
      name: 'Sign in nav action',
      x: col4 + 240,
      y: top + 121 + 290,
      width: 78,
      height: 36,
      cornerRadius: 8,
      fills: [{ type: 'solid', color: foundation.colors.primary, opacity: 1 }],
      tokenBindings: bindTokens(foundation, { fill: 'brand/primary', radius: 'radius/control' })
    }, parent, affectedIds)
    addLabel(foundation, 'Sign in', col4 + 250, top + 127 + 290, parent, affectedIds, 'type/label', 'brand/tertiary')
  })

  componentCard(foundation, 'Icon Buttons', col4, top + 580, 370, 260, board, affectedIds, (parent) => {
    iconButton(foundation, 'spark', col4 + 76, top + 700, 'brand/primary', parent, affectedIds)
    iconButton(foundation, 'shapes', col4 + 146, top + 700, 'brand/secondary', parent, affectedIds)
    iconButton(foundation, 'tag', col4 + 216, top + 700, 'neutral/0', parent, affectedIds)
    iconButton(foundation, 'trash', col4 + 286, top + 700, 'state/danger', parent, affectedIds)
  })

  componentCard(foundation, 'Controls', col3, top + 580, 170, 260, board, affectedIds, (parent) => {
    iconButton(foundation, 'edit', col3 + 72, top + 700, 'neutral/0', parent, affectedIds)
  })
  componentCard(foundation, 'Label Button', col3 + 198, top + 580, 172, 260, board, affectedIds, (parent) => {
    button(foundation, 'Label', col3 + 226, top + 710, 'brand/primary', 'brand/tertiary', parent, affectedIds)
  })
}

export function rootContentRects(): Rect[] {
  const { document } = useCanvasShapeStore.getState()
  const root = document.objects[document.rootId]
  if (!root) return []
  return root.children
    .map((id) => document.objects[id])
    .filter((shape): shape is CanvasShape => Boolean(shape) && shape.visible !== false)
    .map((shape) => shapeGeometry(shape).selrect)
    .filter((rect) => rect.width > 0 && rect.height > 0)
}

export function templateBadgeLabel(foundation: TemplateFoundation): string {
  const target = foundation.designTarget === 'app' ? 'App target' : 'Web target'
  return `${target} - ${foundation.template} kit`
}

export function paletteCard(
  foundation: TemplateFoundation,
  label: string,
  token: string,
  color: string,
  x: number,
  y: number,
  parentId: string,
  affectedIds: Set<string>
): void {
  const card = addShape('frame', {
    name: `${label} palette`,
    x,
    y,
    width: 330,
    height: 190,
    cornerRadius: 24,
    fills: [{ type: 'solid', color, opacity: 1 }],
    tokenBindings: bindTokens(foundation, { fill: token, radius: 'radius/card' })
  }, parentId, affectedIds)
  if (!card) return
  const textToken = label === 'Neutral' ? 'brand/tertiary' : 'text/primary'
  addLabel(foundation, label, x + 24, y + 28, card, affectedIds, 'type/label', textToken)
  addLabel(foundation, color.toUpperCase(), x + 210, y + 28, card, affectedIds, 'type/label', textToken)
  const rampY = y + 116
  for (let i = 0; i < 10; i += 1) {
    addShape('rect', {
      name: `${label} ramp ${i + 1}`,
      x: x + 28 + i * 27,
      y: rampY,
      width: 27,
      height: 58,
      fills: [{ type: 'solid', color: mix(color, i < 5 ? '#000000' : '#FFFFFF', i < 5 ? 0.72 - i * 0.12 : (i - 4) * 0.14), opacity: 1 }]
    }, card, affectedIds)
  }
}

export function typeCard(
  foundation: TemplateFoundation,
  label: string,
  family: string,
  token: string,
  x: number,
  y: number,
  width: number,
  height: number,
  parentId: string,
  affectedIds: Set<string>
): void {
  componentCard(foundation, label, x, y, width, height, parentId, affectedIds, (parent) => {
    addLabel(foundation, family.split(',')[0] ?? family, x + width - 170, y + 30, parent, affectedIds, 'type/label')
    addShape('text', {
      name: `${label} specimen`,
      x: x + 120,
      y: y + 82,
      width: 180,
      height: 120,
      textContent: 'Aa',
      fontFamily: family,
      fontSize: label === 'Label' ? 112 : 132,
      fontWeight: label === 'Headline' ? 700 : 600,
      lineHeight: 1,
      fontColor: label === 'Headline' ? foundation.colors.text : foundation.colors.muted,
      tokenBindings: bindTokens(foundation, { font: token, 'text-color': label === 'Headline' ? 'text/primary' : 'text/muted' })
    }, parent, affectedIds)
  })
}

export function componentCard(
  foundation: TemplateFoundation,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  parentId: string,
  affectedIds: Set<string>,
  children?: (parentId: string) => void
): void {
  const card = addShape('frame', {
    name: `${label} card`,
    x,
    y,
    width,
    height,
    cornerRadius: 22,
    fills: [{ type: 'solid', color: foundation.colors.card, opacity: 1 }],
    tokenBindings: bindTokens(foundation, { fill: 'surface/card', radius: 'radius/card' })
  }, parentId, affectedIds)
  if (!card) return
  addLabel(foundation, label, x + 24, y + 28, card, affectedIds, 'type/label')
  children?.(card)
}

export function button(
  foundation: TemplateFoundation,
  label: string,
  x: number,
  y: number,
  fillToken: string,
  textToken: string,
  parentId: string,
  affectedIds: Set<string>
): void {
  const btn = addShape('rect', {
    name: `${label} button`,
    x,
    y,
    width: 150,
    height: 52,
    cornerRadius: 0,
    fills: [{ type: 'solid', color: tokenColor(foundation, fillToken), opacity: 1 }],
    tokenBindings: bindTokens(foundation, { fill: fillToken, radius: 'radius/control' })
  }, parentId, affectedIds)
  if (btn) addLabel(foundation, label, x + 34, y + 14, btn, affectedIds, 'type/label', textToken)
}

export function outlineButton(
  foundation: TemplateFoundation,
  xlabel: string,
  x: number,
  y: number,
  parentId: string,
  affectedIds: Set<string>
): void {
  const btn = addShape('rect', {
    name: `${xlabel} button`,
    x,
    y,
    width: 150,
    height: 52,
    cornerRadius: 0,
    fills: [{ type: 'solid', color: 'transparent', opacity: 0 }],
    strokes: [{ color: tokenColor(foundation, 'border/default'), width: 2, opacity: 1, position: 'inside' }],
    tokenBindings: bindTokens(foundation, { stroke: 'border/default', radius: 'radius/control' })
  }, parentId, affectedIds)
  if (btn) addLabel(foundation, xlabel, x + 34, y + 14, btn, affectedIds, 'type/label')
}

export function progress(
  foundation: TemplateFoundation,
  x: number,
  y: number,
  filledWidth: number,
  token: string,
  parentId: string,
  affectedIds: Set<string>
): void {
  addShape('rect', {
    name: 'Progress track',
    x,
    y,
    width: 310,
    height: 10,
    fills: [{ type: 'solid', color: foundation.colors.elevated, opacity: 1 }],
    tokenBindings: bindTokens(foundation, { fill: 'surface/elevated' })
  }, parentId, affectedIds)
  addShape('rect', {
    name: 'Progress value',
    x,
    y,
    width: filledWidth,
    height: 10,
    fills: [{ type: 'solid', color: tokenColor(foundation, token), opacity: 1 }],
    tokenBindings: bindTokens(foundation, { fill: token })
  }, parentId, affectedIds)
}

export function iconButton(
  foundation: TemplateFoundation,
  icon: string,
  x: number,
  y: number,
  fillToken: string,
  parentId: string,
  affectedIds: Set<string>
): void {
  const buttonId = addShape('rect', {
    name: `${icon} icon button`,
    x,
    y,
    width: 52,
    height: 52,
    cornerRadius: 0,
    fills: [{ type: 'solid', color: tokenColor(foundation, fillToken), opacity: 1 }],
    tokenBindings: bindTokens(foundation, { fill: fillToken, radius: 'radius/control' })
  }, parentId, affectedIds)
  if (buttonId) addIcon(foundation, icon, x + 16, y + 16, buttonId, affectedIds)
}

export function addIcon(
  foundation: TemplateFoundation,
  icon: string,
  x: number,
  y: number,
  parentId: string,
  affectedIds: Set<string>
): void {
  addShape('text', {
    name: `${icon} icon`,
    x,
    y,
    width: 34,
    height: 28,
    textContent: iconGlyph(icon),
    fontSize: 24,
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    fontWeight: 700,
    fontColor: tokenColor(foundation, 'text/muted'),
    tokenBindings: bindTokens(foundation, { 'text-color': 'text/muted', font: 'type/label' })
  }, parentId, affectedIds)
}

export function addLabel(
  foundation: TemplateFoundation,
  text: string,
  x: number,
  y: number,
  parentId: string,
  affectedIds: Set<string>,
  fontToken = 'type/label',
  colorToken = 'text/muted'
): void {
  addShape('text', {
    name: `${text} label`,
    x,
    y,
    width: Math.max(90, text.length * 14),
    height: 34,
    textContent: text,
    fontSize: 20,
    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
    fontWeight: 600,
    lineHeight: 1.2,
    fontColor: tokenColor(foundation, colorToken),
    tokenBindings: bindTokens(foundation, { font: fontToken, 'text-color': colorToken })
  }, parentId, affectedIds)
}

export function addShape(
  type: ShapeType,
  patch: Partial<CanvasShape>,
  parentId: string | undefined,
  affectedIds: Set<string>
): string | null {
  const shape = createDefaultShape(type, patch.x ?? 0, patch.y ?? 0)
  Object.assign(shape, patch)
  useCanvasShapeStore.getState().addShape(shape, parentId)
  affectedIds.add(shape.id)
  return shape.id
}

export function tokenColor(foundation: TemplateFoundation, token: string): string {
  const found = useDesignSystemStore.getState().getToken(tokenName(foundation, token))
  return found?.kind === 'color' ? found.value : '#FFFFFF'
}

export function fontStack(template: DesignSystemTemplateKind | undefined, tone: DesignSystemTemplateTone | undefined): TemplateFoundation['fonts'] {
  if (template === 'game' || tone === 'playful') {
    return {
      headline: 'Montserrat, Inter, system-ui, sans-serif',
      body: 'Plus Jakarta Sans, Inter, system-ui, sans-serif',
      label: 'JetBrains Mono, ui-monospace, monospace'
    }
  }
  if (tone === 'editorial' || template === 'portfolio') {
    return {
      headline: 'Fraunces, Georgia, serif',
      body: 'Inter, system-ui, sans-serif',
      label: 'JetBrains Mono, ui-monospace, monospace'
    }
  }
  return {
    headline: 'Inter, system-ui, sans-serif',
    body: 'Plus Jakarta Sans, Inter, system-ui, sans-serif',
    label: 'JetBrains Mono, ui-monospace, monospace'
  }
}

export function usesBottomNavigation(template: DesignSystemTemplateKind): boolean {
  return template === 'mobile' || template === 'app' || template === 'game'
}

export function iconGlyph(icon: string): string {
  switch (icon) {
    case 'home':
      return 'H'
    case 'magnifier':
      return 'Q'
    case 'user':
      return 'U'
    case 'spark':
      return '*'
    case 'shapes':
      return 'A'
    case 'tag':
      return 'T'
    case 'trash':
      return 'X'
    case 'edit':
      return 'E'
    default:
      return '.'
  }
}

export function cleanName(value: string | undefined): string {
  return value?.trim().slice(0, 80) ?? ''
}

export function positive(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

export function finite(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
