import type { DragEvent, ReactElement } from 'react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnConnectEnd,
  type OnConnectStart
} from '@xyflow/react'
import { ArrowLeft, MousePointerClick, Play, Plus, Save, Square } from 'lucide-react'
import type {
  AppSettingsV1,
  WorkflowNodeKind,
  WorkflowNodeRunResultV1,
  WorkflowNodeRunStatus,
  WorkflowNodeV1,
  WorkflowV1
} from '@shared/app-settings'
import {
  NODE_ICONS,
  WorkflowNodeActionsContext,
  WorkflowRunStatusContext,
  workflowNodeTypes,
  type WorkflowNodeActions
} from './WorkflowNodes'
import { NodeConfigPanel } from './NodeConfigPanel'
import {
  TRIGGER_KINDS,
  WORKFLOW_PALETTE,
  createWorkflowNode,
  flowToWorkflowGraph,
  toFlowEdges,
  toFlowNodes,
  type WorkflowFlowEdge,
  type WorkflowFlowNode
} from './workflow-types'

type ConnectMenuState = {
  x: number
  y: number
  flowPos: { x: number; y: number }
  sourceId: string
  sourceHandle: string
}

const DND_MIME = 'application/x-workflow-node'

type WorkflowConnectionsArg = ReturnType<typeof flowToWorkflowGraph>['connections']

type Props = {
  workflow: WorkflowV1
  settings: AppSettingsV1
  runStatus: Record<string, WorkflowNodeRunStatus>
  lastResults: Record<string, WorkflowNodeRunResultV1>
  running: boolean
  onPersist: (patch: {
    name: string
    enabled: boolean
    nodes: WorkflowNodeV1[]
    connections: WorkflowConnectionsArg
  }) => Promise<void>
  onRun: () => Promise<void> | void
  onRunNode: (nodeId: string) => Promise<void> | void
  onStop: () => Promise<void> | void
  onBack: () => void
}

function WorkflowEditorInner({
  workflow,
  settings,
  runStatus,
  lastResults,
  running,
  onPersist,
  onRun,
  onRunNode,
  onStop,
  onBack
}: Props): ReactElement {
  const { t } = useTranslation('common')
  const { screenToFlowPosition } = useReactFlow()
  const [name, setName] = useState(workflow.name)
  const [enabled, setEnabled] = useState(workflow.enabled)
  const [rfNodes, setRfNodes] = useState<WorkflowFlowNode[]>(() => toFlowNodes(workflow.nodes))
  const [rfEdges, setRfEdges] = useState<WorkflowFlowEdge[]>(() => toFlowEdges(workflow.connections))
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [connectMenu, setConnectMenu] = useState<ConnectMenuState | null>(null)
  const connectingRef = useRef<{ nodeId: string; handleId: string } | null>(null)

  const styledEdges = useMemo(
    () => toFlowEdges(flowToWorkflowGraph(rfNodes, rfEdges).connections, runStatus),
    [rfEdges, rfNodes, runStatus]
  )

  const selectedNode = useMemo(
    () => (selectedNodeId ? rfNodes.find((node) => node.id === selectedNodeId)?.data.node ?? null : null),
    [rfNodes, selectedNodeId]
  )

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes((nodes) => applyNodeChanges(changes, nodes) as WorkflowFlowNode[])
    if (changes.some((change) => change.type !== 'select' && change.type !== 'dimensions')) {
      setDirty(true)
    }
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((edges) => applyEdgeChanges(changes, edges) as WorkflowFlowEdge[])
    if (changes.some((change) => change.type !== 'select')) setDirty(true)
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    setRfEdges((edges) => addEdge(connection, edges) as WorkflowFlowEdge[])
    setDirty(true)
  }, [])

  const onConnectStart = useCallback<OnConnectStart>((_, params) => {
    connectingRef.current = params.nodeId
      ? { nodeId: params.nodeId, handleId: params.handleId ?? 'out' }
      : null
  }, [])

  // Dragging a connection onto empty canvas opens a picker to add + connect the next node (n8n-style).
  const onConnectEnd = useCallback<OnConnectEnd>(
    (event) => {
      const source = connectingRef.current
      connectingRef.current = null
      if (!source) return
      const target = event.target as HTMLElement | null
      if (!target || !target.classList.contains('react-flow__pane')) return
      const clientX = 'clientX' in event ? event.clientX : 0
      const clientY = 'clientY' in event ? event.clientY : 0
      setConnectMenu({
        x: clientX,
        y: clientY,
        flowPos: screenToFlowPosition({ x: clientX, y: clientY }),
        sourceId: source.nodeId,
        sourceHandle: source.handleId
      })
    },
    [screenToFlowPosition]
  )

  const addConnectedNode = useCallback(
    (kind: WorkflowNodeKind) => {
      setConnectMenu((menu) => {
        if (!menu) return null
        const node = createWorkflowNode(kind, menu.flowPos)
        setRfNodes((nodes) => [...nodes, { id: node.id, type: node.type, position: node.position, data: { node } }])
        setRfEdges(
          (edges) =>
            addEdge(
              { source: menu.sourceId, sourceHandle: menu.sourceHandle, target: node.id, targetHandle: 'in' },
              edges
            ) as WorkflowFlowEdge[]
        )
        setSelectedNodeId(node.id)
        setDirty(true)
        return null
      })
    },
    []
  )

  const insertNode = useCallback((kind: WorkflowNodeKind, position: { x: number; y: number }) => {
    const node = createWorkflowNode(kind, position)
    setRfNodes((nodes) => [...nodes, { id: node.id, type: node.type, position: node.position, data: { node } }])
    setSelectedNodeId(node.id)
    setDirty(true)
  }, [])

  const addNode = useCallback(
    (kind: WorkflowNodeKind) => {
      const offset = rfNodes.length * 28
      insertNode(kind, { x: 360 + (offset % 180), y: 140 + offset })
    },
    [insertNode, rfNodes.length]
  )

  const onPaletteDragStart = useCallback((event: DragEvent, kind: WorkflowNodeKind) => {
    event.dataTransfer.setData(DND_MIME, kind)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const onCanvasDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onCanvasDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      const kind = event.dataTransfer.getData(DND_MIME) as WorkflowNodeKind
      if (!kind || !WORKFLOW_PALETTE.includes(kind)) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      insertNode(kind, position)
    },
    [insertNode, screenToFlowPosition]
  )

  const handleNodeChange = useCallback((updated: WorkflowNodeV1) => {
    setRfNodes((nodes) =>
      nodes.map((node) => (node.id === updated.id ? { ...node, type: updated.type, data: { node: updated } } : node))
    )
    setDirty(true)
  }, [])

  const handleDeleteNode = useCallback((nodeId: string) => {
    setRfNodes((nodes) => nodes.filter((node) => node.id !== nodeId))
    setRfEdges((edges) => edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setSelectedNodeId((current) => (current === nodeId ? null : current))
    setDirty(true)
  }, [])

  const handleToggleDisabled = useCallback((nodeId: string) => {
    setRfNodes((nodes) =>
      nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { node: { ...node.data.node, disabled: !node.data.node.disabled } } }
          : node
      )
    )
    setDirty(true)
  }, [])

  const buildGraph = useCallback(() => {
    const graph = flowToWorkflowGraph(rfNodes, rfEdges)
    return { name: name.trim() || t('workflowUntitled'), enabled, nodes: graph.nodes, connections: graph.connections }
  }, [enabled, name, rfEdges, rfNodes, t])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await onPersist(buildGraph())
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }, [buildGraph, onPersist])

  const handleRun = useCallback(async () => {
    await onPersist(buildGraph())
    setDirty(false)
    await onRun()
  }, [buildGraph, onPersist, onRun])

  const handleRunNode = useCallback(
    async (nodeId: string) => {
      await onPersist(buildGraph())
      setDirty(false)
      await onRunNode(nodeId)
    },
    [buildGraph, onPersist, onRunNode]
  )

  const nodeActions = useMemo<WorkflowNodeActions>(
    () => ({
      runNode: (nodeId) => void handleRunNode(nodeId),
      toggleDisabled: handleToggleDisabled,
      deleteNode: handleDeleteNode
    }),
    [handleDeleteNode, handleRunNode, handleToggleDisabled]
  )

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ds-main">
      <header className="ds-drag ds-window-controls-safe-inset flex shrink-0 items-center gap-3 border-b border-ds-border py-2.5 pr-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ds-border bg-ds-card px-3 text-[13px] text-ds-muted transition hover:bg-ds-hover hover:text-ds-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          {t('workflowBack')}
        </button>
        <input
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-[15px] font-medium text-ds-ink outline-none focus:border-ds-border focus:bg-ds-card"
          value={name}
          placeholder={t('workflowNamePlaceholder')}
          onChange={(event) => {
            setName(event.target.value)
            setDirty(true)
          }}
        />
        <label className="flex shrink-0 items-center gap-2 text-[13px] font-medium text-ds-muted">
          {t('workflowEnabled')}
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked)
              setDirty(true)
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ds-border bg-ds-card px-3 text-[13px] font-medium text-ds-ink transition hover:bg-ds-hover disabled:opacity-60"
        >
          <Save className="h-4 w-4" strokeWidth={1.8} />
          {dirty ? t('workflowSave') : t('workflowSaved')}
        </button>
        {running ? (
          <button
            type="button"
            onClick={() => void onStop()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-red-500/90 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-500"
          >
            <Square className="h-3.5 w-3.5" strokeWidth={2} />
            {t('workflowStop')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleRun()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ds-userbubble px-4 text-[13px] font-semibold text-ds-userbubbleFg shadow-sm transition hover:opacity-90"
          >
            <Play className="h-4 w-4" strokeWidth={2} />
            {t('workflowRunNow')}
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[184px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-ds-border bg-ds-card/40 px-2 py-3">
          <span className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ds-faint">
            {t('workflowPalette')}
          </span>
          {WORKFLOW_PALETTE.map((kind) => {
            const Icon = NODE_ICONS[kind]
            return (
              <button
                key={kind}
                type="button"
                draggable
                onDragStart={(event) => onPaletteDragStart(event, kind)}
                onClick={() => addNode(kind)}
                className="flex cursor-grab items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left text-[12.5px] text-ds-ink transition hover:border-ds-border hover:bg-ds-hover active:cursor-grabbing"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1 truncate">{t(`workflowNode_${kind}`)}</span>
                <Plus className="h-3.5 w-3.5 shrink-0 text-ds-faint" strokeWidth={1.8} />
              </button>
            )
          })}
        </aside>

        <div className="relative min-w-0 flex-1" onDrop={onCanvasDrop} onDragOver={onCanvasDragOver}>
          <WorkflowRunStatusContext.Provider value={runStatus}>
            <WorkflowNodeActionsContext.Provider value={nodeActions}>
              <ReactFlow
                className="ds-workflow-canvas"
                nodes={rfNodes}
                edges={styledEdges}
                nodeTypes={workflowNodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                onPaneClick={() => setSelectedNodeId(null)}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
                <Controls showInteractive={false} />
                <MiniMap pannable zoomable />
              </ReactFlow>
            </WorkflowNodeActionsContext.Provider>
          </WorkflowRunStatusContext.Provider>
          {rfNodes.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <MousePointerClick className="h-8 w-8 text-ds-faint" strokeWidth={1.4} />
              <p className="text-[13px] text-ds-faint">{t('workflowEmptyCanvas')}</p>
            </div>
          ) : null}
          {connectMenu ? (
            <>
              <div className="fixed inset-0 z-[70]" onClick={() => setConnectMenu(null)} />
              <div
                className="fixed z-[71] max-h-[60vh] w-44 overflow-y-auto rounded-lg border border-ds-border bg-ds-card p-1 shadow-lg"
                style={{ left: connectMenu.x, top: connectMenu.y }}
              >
                {WORKFLOW_PALETTE.filter((kind) => !TRIGGER_KINDS.has(kind)).map((kind) => {
                  const Icon = NODE_ICONS[kind]
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => addConnectedNode(kind)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-ds-ink transition hover:bg-ds-hover"
                    >
                      <Icon className="h-3.5 w-3.5 text-accent" strokeWidth={1.9} />
                      {t(`workflowNode_${kind}`)}
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}
        </div>

        <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-l border-ds-border bg-ds-card/40">
          <NodeConfigPanel
            node={selectedNode}
            settings={settings}
            lastResult={selectedNodeId ? lastResults[selectedNodeId] ?? null : null}
            onChange={handleNodeChange}
            onDelete={handleDeleteNode}
          />
        </aside>
      </div>
    </div>
  )
}

export function WorkflowEditorView(props: Props): ReactElement {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner {...props} />
    </ReactFlowProvider>
  )
}

export type WorkflowEditorProps = Props
