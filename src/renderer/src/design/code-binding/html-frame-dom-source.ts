import type {
  DomSourceBindingMatch,
  DomSourceSnapshot,
  DomSourceSnapshotNode
} from './dom-source-adapter'

const MAX_HOST_NODES = 160
const MAX_HOST_DEPTH = 5
const MAX_TEXT_LENGTH = 300

export type HtmlFrameDomSourceScriptExecutor = (code: string) => Promise<unknown> | null

export const HTML_FRAME_DOM_SOURCE_GUEST_SRC = `(() => {
  try {
    const MAX_NODES = 140;
    const MAX_DEPTH = 4;
    let count = 0;
    const attr = (element, names) => {
      for (const name of names) {
        const value = element.getAttribute(name);
        if (value) return value;
      }
      return '';
    };
    const textFor = (element) => {
      const text = (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim();
      return text.slice(0, 300);
    };
    const rectFor = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    };
    const nodeFor = (element, depth) => {
      if (!element || element.nodeType !== Node.ELEMENT_NODE || count >= MAX_NODES) return null;
      count += 1;
      const node = {
        tagName: element.tagName.toLowerCase(),
        text: textFor(element),
        rect: rectFor(element)
      };
      const id = element.getAttribute('id') || '';
      const domId = attr(element, ['data-kun-source-id', 'data-dom-id']) || id;
      const onlookId = attr(element, ['data-onlook-id']);
      const sourceFile = attr(element, ['data-kun-source-file', 'data-source-file', 'data-onlook-source-file']);
      const componentName = attr(element, ['data-kun-component', 'data-component', 'data-onlook-component']);
      const exportName = attr(element, ['data-kun-export', 'data-export']);
      const astPath = attr(element, ['data-kun-ast-path', 'data-ast-path']);
      const routePath = attr(element, ['data-kun-route', 'data-route']);
      if (id) node.id = id;
      if (domId) node.domId = domId;
      if (onlookId) node.onlookId = onlookId;
      if (sourceFile) node.sourceFile = sourceFile;
      if (componentName) node.componentName = componentName;
      if (exportName) node.exportName = exportName;
      if (astPath) node.astPath = astPath;
      if (routePath) node.routePath = routePath;
      if (depth < MAX_DEPTH) {
        const children = Array.from(element.children)
          .map((child) => nodeFor(child, depth + 1))
          .filter(Boolean);
        if (children.length) node.children = children;
      }
      return node;
    };
    const root = document.body || document.documentElement;
    const routePath = attr(root, ['data-kun-route', 'data-route']) ||
      ((location.protocol === 'http:' || location.protocol === 'https:') ? location.pathname : '');
    const sourceFile = attr(root, ['data-kun-source-file', 'data-source-file', 'data-onlook-source-file']);
    return {
      capturedAt: new Date().toISOString(),
      routePath: routePath || undefined,
      sourceFile: sourceFile || undefined,
      nodes: Array.from(root.children).map((child) => nodeFor(child, 0)).filter(Boolean)
    };
  } catch {
    return null;
  }
})()`

function cleanString(value: unknown, maxLength = MAX_TEXT_LENGTH): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, maxLength) : undefined
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function cleanRect(value: unknown): DomSourceSnapshotNode['rect'] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const left = cleanNumber(raw.left)
  const top = cleanNumber(raw.top)
  const width = cleanNumber(raw.width)
  const height = cleanNumber(raw.height)
  if (left === undefined || top === undefined || width === undefined || height === undefined) return undefined
  return { left, top, width, height }
}

function normalizeNode(raw: unknown, depth: number, remaining: { count: number }): DomSourceSnapshotNode | null {
  if (!raw || typeof raw !== 'object' || remaining.count <= 0 || depth > MAX_HOST_DEPTH) return null
  const obj = raw as Record<string, unknown>
  const tagName = cleanString(obj.tagName, 48)
  if (!tagName) return null
  remaining.count -= 1
  const children = Array.isArray(obj.children)
    ? obj.children
        .map((child) => normalizeNode(child, depth + 1, remaining))
        .filter((child): child is DomSourceSnapshotNode => Boolean(child))
    : []
  return {
    tagName: tagName.toLowerCase(),
    ...(cleanString(obj.id, 120) ? { id: cleanString(obj.id, 120) } : {}),
    ...(cleanString(obj.text) ? { text: cleanString(obj.text) } : {}),
    ...(cleanRect(obj.rect) ? { rect: cleanRect(obj.rect) } : {}),
    ...(cleanString(obj.sourceFile, 260) ? { sourceFile: cleanString(obj.sourceFile, 260) } : {}),
    ...(cleanString(obj.componentName, 160) ? { componentName: cleanString(obj.componentName, 160) } : {}),
    ...(cleanString(obj.exportName, 160) ? { exportName: cleanString(obj.exportName, 160) } : {}),
    ...(cleanString(obj.domId, 160) ? { domId: cleanString(obj.domId, 160) } : {}),
    ...(cleanString(obj.onlookId, 160) ? { onlookId: cleanString(obj.onlookId, 160) } : {}),
    ...(cleanString(obj.astPath, 260) ? { astPath: cleanString(obj.astPath, 260) } : {}),
    ...(cleanString(obj.routePath, 260) ? { routePath: cleanString(obj.routePath, 260) } : {}),
    ...(typeof obj.line === 'number' ? { line: obj.line } : {}),
    ...(typeof obj.column === 'number' ? { column: obj.column } : {}),
    ...(children.length > 0 ? { children } : {})
  }
}

export function normalizeHtmlFrameDomSourceSnapshot(raw: unknown): DomSourceSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.nodes)) return null
  const capturedAt = cleanString(obj.capturedAt, 80) ?? new Date().toISOString()
  const remaining = { count: MAX_HOST_NODES }
  const nodes = obj.nodes
    .map((node) => normalizeNode(node, 0, remaining))
    .filter((node): node is DomSourceSnapshotNode => Boolean(node))
  if (nodes.length === 0) return null
  return {
    capturedAt,
    ...(cleanString(obj.routePath, 260) ? { routePath: cleanString(obj.routePath, 260) } : {}),
    ...(cleanString(obj.sourceFile, 260) ? { sourceFile: cleanString(obj.sourceFile, 260) } : {}),
    nodes
  }
}

function flattenNodes(nodes: readonly DomSourceSnapshotNode[]): DomSourceSnapshotNode[] {
  const flat: DomSourceSnapshotNode[] = []
  const visit = (node: DomSourceSnapshotNode): void => {
    flat.push(node)
    for (const child of node.children ?? []) visit(child)
  }
  for (const node of nodes) visit(node)
  return flat
}

function nodeScore(node: DomSourceSnapshotNode): number {
  const rectArea = node.rect ? Math.max(0, node.rect.width) * Math.max(0, node.rect.height) : 0
  return (
    (node.onlookId ? 90 : 0) +
    (node.domId ? 70 : 0) +
    (node.sourceFile ? 60 : 0) +
    (node.componentName ? 45 : 0) +
    (node.routePath ? 35 : 0) +
    (node.astPath ? 30 : 0) +
    (['main', 'section', 'article'].includes(node.tagName) ? 20 : 0) +
    Math.min(25, rectArea / 20_000) +
    Math.min(10, (node.text?.length ?? 0) / 80)
  )
}

export function bestHtmlFrameDomSourceNode(snapshot: DomSourceSnapshot): DomSourceSnapshotNode | null {
  const candidates = flattenNodes(snapshot.nodes).filter((node) => {
    if (!node.rect) return true
    return node.rect.width > 2 && node.rect.height > 2
  })
  if (candidates.length === 0) return null
  return [...candidates].sort((a, b) => nodeScore(b) - nodeScore(a))[0] ?? null
}

export function htmlFrameDomSourceBindingMatches({
  shapeId,
  artifactRelativePath,
  snapshot
}: {
  shapeId: string
  artifactRelativePath: string | undefined
  snapshot: DomSourceSnapshot
}): DomSourceBindingMatch[] {
  const best = bestHtmlFrameDomSourceNode(snapshot)
  if (!best) return []
  return [{
    designObjectId: shapeId,
    node: {
      ...best,
      ...(best.sourceFile || !snapshot.sourceFile ? {} : { sourceFile: snapshot.sourceFile }),
      ...(best.routePath || !snapshot.routePath ? {} : { routePath: snapshot.routePath }),
      ...(best.sourceFile || snapshot.sourceFile || !artifactRelativePath ? {} : { sourceFile: artifactRelativePath })
    }
  }]
}

export async function captureHtmlFrameDomSourceSnapshot(
  executeScript: HtmlFrameDomSourceScriptExecutor
): Promise<DomSourceSnapshot | null> {
  const result = executeScript(HTML_FRAME_DOM_SOURCE_GUEST_SRC)
  if (!result) return null
  try {
    return normalizeHtmlFrameDomSourceSnapshot(await result)
  } catch {
    return null
  }
}
