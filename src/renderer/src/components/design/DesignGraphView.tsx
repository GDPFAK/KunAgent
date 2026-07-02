import '@xyflow/react/dist/style.css'
import type { ReactElement } from 'react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ExternalLink, Image as ImageIcon, Loader2, MessageSquare, Play, Plus, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes
} from '@xyflow/react'
import type { DesignArtifact } from '../../design/design-types'
import {
  createGraphNodeId,
  emptyDesignGraph,
  parseDesignGraph,
  serializeDesignGraph,
  topoSortDesignGraph,
  type DesignGraphDoc,
  type DesignGraphNodeData,
  type DesignGraphNodeKind
} from '../../design/design-graph'
import { runDesignNode } from '../../design/design-graph-run'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'

type Props = { artifact: DesignArtifact; workspaceRoot: string }

type GraphActions = {
  updateBrief: (id: string, brief: string) => void
  previewOutput: (path: string) => void
  deleteNode: (id: string) => void
  workspaceRoot: string
}
const GraphContext = createContext<GraphActions>({
  updateBrief: () => {},
  previewOutput: () => {},
  deleteNode: () => {},
  workspaceRoot: ''
})

const btnGhost =
  'ds-no-drag inline-flex items-center gap-1 rounded-lg border border-[var(--ds-sidebar-row-ring)] bg-white/90 px-2.5 py-1.5 text-[12px] font-medium text-[#1f2733] shadow-sm transition-colors hover:bg-white dark:bg-[#1f242c]/90 dark:text-white/85'
const btnPrimary =
  'ds-no-drag inline-flex items-center gap-1.5 rounded-lg bg-[#3b82d8] px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-[#3577c4] disabled:cursor-not-allowed disabled:opacity-50'

function nodeData(data: NodeProps['data']): DesignGraphNodeData {
  const d = data as Partial<DesignGraphNodeData>
  return {
    kind: d.kind === 'prompt' ? 'prompt' : d.kind === 'image' ? 'image' : 'design',
    label: typeof d.label === 'string' ? d.label : '',
    brief: typeof d.brief === 'string' ? d.brief : '',
    status: d.status,
    outputPath: d.outputPath
  }
}

function StatusBadge({ status }: { status?: DesignGraphNodeData['status'] }): ReactElement | null {
  if (status === 'running') return <Loader2 className="h-3 w-3 animate-spin text-[#3b82d8]" strokeWidth={2} />
  if (status === 'done') return <span className="text-[11px] leading-none text-[#2e9e6b]">✓</span>
  if (status === 'error') return <span className="text-[11px] leading-none text-[#c0392b]">!</span>
  return null
}

function NodeImage({ path, workspaceRoot }: { path: string; workspaceRoot: string }): ReactElement | null {
  const [url, setUrl] = useState('')
  useEffect(() => {
    setUrl('')
    if (!path || !workspaceRoot || typeof window.kunGui?.readWorkspaceImage !== 'function') return
    let cancelled = false
    void window.kunGui
      .readWorkspaceImage({ path, workspaceRoot })
      .then((r) => {
        if (!cancelled && r.ok) setUrl(r.dataUrl)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [path, workspaceRoot])
  if (!url) return null
  return <img src={url} alt="" className="nodrag mt-1 max-h-28 w-full rounded object-contain" />
}

function GraphNode({ id, data }: NodeProps): ReactElement {
  const { t } = useTranslation('common')
  const { updateBrief, previewOutput, deleteNode, workspaceRoot } = useContext(GraphContext)
  const d = nodeData(data)
  const isPrompt = d.kind === 'prompt'
  const isImage = d.kind === 'image'
  return (
    <div
      className={`group relative min-w-[170px] max-w-[230px] rounded-lg border bg-white px-2 py-1.5 shadow-sm dark:bg-[#1f242c] ${
        isPrompt ? 'border-[#8b95a3]/45' : 'border-[#3b82d8]/55'
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          deleteNode(id)
        }}
        title={t('designDeleteNode')}
        aria-label={t('designDeleteNode')}
        className="nodrag absolute -right-1.5 -top-1.5 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#c0392b] text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
      >
        <X className="h-2.5 w-2.5" strokeWidth={2.5} />
      </button>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-[#3b82d8]" />
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[#8b95a3]">
          {isPrompt ? (
            <MessageSquare className="h-3 w-3" strokeWidth={2} />
          ) : isImage ? (
            <ImageIcon className="h-3 w-3" strokeWidth={2} />
          ) : (
            <Sparkles className="h-3 w-3" strokeWidth={2} />
          )}
          {isPrompt ? t('designNodePrompt') : isImage ? t('designNodeImage') : t('designNodeDesign')}
        </span>
        <StatusBadge status={d.status} />
      </div>
      <textarea
        value={d.brief}
        onChange={(e) => updateBrief(id, e.target.value)}
        rows={2}
        placeholder={
          isPrompt
            ? t('designNodePromptPlaceholder')
            : isImage
              ? t('designNodeImagePlaceholder')
              : t('designNodeDesignPlaceholder')
        }
        className="nodrag w-full resize-none bg-transparent text-[12px] text-[#1f2733] outline-none dark:text-white/90"
      />
      {isImage && d.outputPath ? (
        <NodeImage path={d.outputPath} workspaceRoot={workspaceRoot} />
      ) : !isPrompt && d.outputPath ? (
        <button
          type="button"
          onClick={() => previewOutput(d.outputPath as string)}
          className="nodrag mt-1 text-[11px] text-[#3b82d8] hover:underline"
        >
          {t('designNodeOpenOutput')}
        </button>
      ) : null}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-[#3b82d8]" />
    </div>
  )
}

const nodeTypes: NodeTypes = { designStep: GraphNode }

function dirOf(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const i = normalized.lastIndexOf('/')
  return i >= 0 ? normalized.slice(0, i) : ''
}

/**
 * Node-canvas editor + run engine for a 'graph' design artifact. Prompt nodes
 * carry text; design nodes generate HTML from their brief + upstream text.
 * "Run" executes design nodes in topological order, awaiting each one's output.
 */
export function DesignGraphView({ artifact, workspaceRoot }: Props): ReactElement {
  const { t } = useTranslation('common')
  const setFileError = useDesignWorkspaceStore((s) => s.setFileError)
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const readyRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  nodesRef.current = nodes
  edgesRef.current = edges

  useEffect(() => {
    readyRef.current = false
    let cancelled = false
    if (!artifact.relativePath || !workspaceRoot || typeof window.kunGui?.readWorkspaceFile !== 'function') {
      setNodes([])
      setEdges([])
      readyRef.current = true
      return
    }
    void window.kunGui
      .readWorkspaceFile({ path: artifact.relativePath, workspaceRoot })
      .then((res) => {
        if (cancelled) return
        const doc = res.ok ? parseDesignGraph(res.content) : emptyDesignGraph()
        setNodes(doc.nodes.map((n) => ({ id: n.id, type: 'designStep', position: n.position, data: { ...n.data } })))
        setEdges(doc.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })))
        readyRef.current = true
      })
      .catch(() => {
        if (!cancelled) readyRef.current = true
      })
    return () => {
      cancelled = true
    }
  }, [artifact.relativePath, workspaceRoot])

  const persist = useCallback(() => {
    if (!readyRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      if (typeof window.kunGui?.writeWorkspaceFile !== 'function') return
      const doc: DesignGraphDoc = {
        version: 1,
        nodes: nodesRef.current.map((n) => ({ id: n.id, position: n.position, data: nodeData(n.data) })),
        edges: edgesRef.current.map((e) => ({ id: e.id, source: e.source, target: e.target }))
      }
      void window.kunGui.writeWorkspaceFile({ path: artifact.relativePath, workspaceRoot, content: serializeDesignGraph(doc) })
    }, 600)
  }, [artifact.relativePath, workspaceRoot])

  const onNodesChange = useCallback((c: NodeChange[]) => { setNodes((ns) => applyNodeChanges(c, ns)); persist() }, [persist])
  const onEdgesChange = useCallback((c: EdgeChange[]) => { setEdges((es) => applyEdgeChanges(c, es)); persist() }, [persist])
  const onConnect = useCallback((conn: Connection) => { setEdges((es) => addEdge(conn, es)); persist() }, [persist])

  const updateBrief = useCallback((id: string, brief: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, brief } } : n)))
    persist()
  }, [persist])

  const patchNode = useCallback((id: string, patch: Partial<DesignGraphNodeData>) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
  }, [])

  const [previewPath, setPreviewPath] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  useEffect(() => {
    setPreviewUrl('')
    if (!previewPath || !workspaceRoot || typeof window.kunGui?.authorizeWritePrototype !== 'function') return
    let cancelled = false
    void window.kunGui
      .authorizeWritePrototype({ path: previewPath, workspaceRoot })
      .then((r) => {
        if (!cancelled && r.ok) setPreviewUrl(r.fileUrl)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [previewPath, workspaceRoot])
  const openExternal = useCallback(() => {
    if (previewPath && typeof window.kunGui?.openWritePrototype === 'function') {
      void window.kunGui.openWritePrototype({ path: previewPath, workspaceRoot })
    }
  }, [previewPath, workspaceRoot])
  const deleteNode = useCallback(
    (id: string) => {
      setNodes((ns) => ns.filter((n) => n.id !== id))
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
      persist()
    },
    [persist]
  )

  const addNode = useCallback((kind: DesignGraphNodeKind) => {
    const count = nodesRef.current.length
    const node: Node = {
      id: createGraphNodeId(),
      type: 'designStep',
      position: { x: 90 + (count % 4) * 220, y: 110 + Math.floor(count / 4) * 150 },
      data: { kind, label: '', brief: '' }
    }
    setNodes((ns) => [...ns, node])
    persist()
  }, [persist])

  const runGraph = useCallback(async () => {
    if (running) return
    setRunError('')
    setFileError(null)
    const order = topoSortDesignGraph(
      nodesRef.current.map((n) => ({ id: n.id })),
      edgesRef.current.map((e) => ({ source: e.source, target: e.target }))
    )
    if (!order) {
      setRunError(t('designGraphCycle'))
      return
    }
    const graphDir = dirOf(artifact.relativePath)
    setRunning(true)
    let failures = 0
    try {
      for (const nodeId of order) {
        const node = nodesRef.current.find((n) => n.id === nodeId)
        if (!node) continue
        const nodeKind = nodeData(node.data).kind
        if (nodeKind !== 'design' && nodeKind !== 'image') continue
        const upstream = edgesRef.current
          .filter((e) => e.target === nodeId)
          .map((e) => {
            const src = nodesRef.current.find((n) => n.id === e.source)
            if (!src) return ''
            const sd = nodeData(src.data)
            return [sd.label, sd.brief].filter(Boolean).join(': ')
          })
          .filter(Boolean)
          .join('\n')
        const ext = nodeKind === 'image' ? 'png' : 'html'
        const outputRelativePath = graphDir ? `${graphDir}/${nodeId}.${ext}` : `${nodeId}.${ext}`
        patchNode(nodeId, { status: 'running' })
        const ok = await runDesignNode({
          kind: nodeKind,
          brief: nodeData(node.data).brief,
          upstreamContext: upstream,
          outputRelativePath,
          workspaceRoot
        })
        if (!ok) failures += 1
        patchNode(nodeId, { status: ok ? 'done' : 'error', outputPath: ok ? outputRelativePath : undefined })
        persist()
      }
    } finally {
      setRunning(false)
    }
    if (failures > 0) setFileError(t('designGraphRunFailed', { count: failures }))
  }, [running, artifact.relativePath, workspaceRoot, persist, patchNode, t, setFileError])

  return (
    <GraphContext.Provider value={{ updateBrief, previewOutput: setPreviewPath, deleteNode, workspaceRoot }}>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1">
        <div className="ds-no-drag absolute left-3 top-3 z-10 flex items-center gap-1.5">
          <button type="button" onClick={() => addNode('prompt')} className={btnGhost}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            {t('designAddPrompt')}
          </button>
          <button type="button" onClick={() => addNode('design')} className={btnGhost}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            {t('designAddDesign')}
          </button>
          <button type="button" onClick={() => addNode('image')} className={btnGhost}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            {t('designAddImage')}
          </button>
          <button type="button" onClick={() => void runGraph()} disabled={running} className={btnPrimary}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Play className="h-3.5 w-3.5" strokeWidth={2} />}
            {running ? t('designGraphRunning') : t('designRunGraph')}
          </button>
          {runError ? <span className="text-[11px] text-[#c0392b]">{runError}</span> : null}
        </div>
        {nodes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-[#646e7c] dark:text-white/55">
            {t('designGraphEmpty')}
          </div>
        ) : null}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ width: '100%', height: '100%' }}
        >
          <Background gap={16} size={1} />
          <Controls />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => (nodeData(n.data).kind === 'prompt' ? '#8b95a3' : '#3b82d8')}
            className="!h-[88px] !w-[128px] !rounded-md"
          />
        </ReactFlow>
        </div>
        {previewPath ? (
          <div className="flex min-h-0 w-[380px] shrink-0 flex-col bg-ds-main shadow-[inset_1px_0_0_var(--ds-sidebar-row-ring)]">
            <div className="flex shrink-0 items-center justify-between px-3 py-2 shadow-[inset_0_-1px_0_var(--ds-sidebar-row-ring)]">
              <span className="truncate text-[12px] font-medium text-[#1f2733] dark:text-white">
                {t('designNodeOutputPreview')}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={openExternal}
                  title={t('designOpenExternal')}
                  aria-label={t('designOpenExternal')}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#8b95a3] transition-colors hover:text-[#1f2733] dark:text-white/45 dark:hover:text-white/85"
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPath('')}
                  title={t('close')}
                  aria-label={t('close')}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#8b95a3] transition-colors hover:text-[#1f2733] dark:text-white/45 dark:hover:text-white/85"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-white">
              {previewUrl ? (
                <webview
                  key={`graph-preview:${previewUrl}`}
                  src={previewUrl}
                  partition="kun-proto"
                  webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] text-[#646e7c] dark:text-white/55">
                  …
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </GraphContext.Provider>
  )
}
