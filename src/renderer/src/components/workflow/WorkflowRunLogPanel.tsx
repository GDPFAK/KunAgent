import { useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Loader2 } from 'lucide-react'
import type { WorkflowNodeRunResultV1, WorkflowNodeRunStatus, WorkflowNodeV1 } from '@shared/app-settings'

function statusDotClass(status: WorkflowNodeRunStatus | undefined): string {
  switch (status) {
    case 'running':
      return 'bg-amber-500'
    case 'success':
      return 'bg-emerald-500'
    case 'error':
      return 'bg-red-500'
    case 'skipped':
      return 'bg-ds-border'
    default:
      return 'bg-ds-border/50'
  }
}

function fmtDuration(startedAt: string, finishedAt: string): string {
  if (!startedAt || !finishedAt) return ''
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

/**
 * Live run log shown in the editor's right sidebar: each node that has run, in
 * execution order, with its input and output (streams as the run progresses).
 */
export function WorkflowRunLogPanel({
  nodes,
  results,
  running,
  hideHeader = false
}: {
  nodes: WorkflowNodeV1[]
  results: Record<string, WorkflowNodeRunResultV1>
  running: boolean
  /** Hide the panel's own header when embedded under another header (e.g. the chat run drawer). */
  hideHeader?: boolean
}): ReactElement {
  const { t } = useTranslation('common')
  const nameOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of nodes) map.set(node.id, node.name.trim() || t(`workflowNode_${node.type}`))
    return map
  }, [nodes, t])

  // Execution order: by start time, falling back to the node's position in the graph.
  const ordered = useMemo(() => {
    const order = new Map(nodes.map((node, index) => [node.id, index]))
    return Object.values(results).sort((a, b) => {
      if (a.startedAt && b.startedAt && a.startedAt !== b.startedAt) return a.startedAt < b.startedAt ? -1 : 1
      return (order.get(a.nodeId) ?? 0) - (order.get(b.nodeId) ?? 0)
    })
  }, [results, nodes])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {hideHeader ? null : (
        <div className="flex items-center gap-2 border-b border-ds-border px-4 py-3">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" strokeWidth={2} /> : null}
          <h2 className="text-[13px] font-semibold text-ds-ink">{t('workflowRunLog')}</h2>
          {ordered.length > 0 ? <span className="text-[11px] text-ds-faint">{ordered.length}</span> : null}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {ordered.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12.5px] leading-5 text-ds-faint">{t('workflowRunLogEmpty')}</p>
        ) : (
          ordered.map((result) => (
            <RunLogRow
              key={result.nodeId}
              result={result}
              name={nameOf.get(result.nodeId) ?? result.nodeId}
            />
          ))
        )}
      </div>
    </div>
  )
}

function RunLogRow({ result, name }: { result: WorkflowNodeRunResultV1; name: string }): ReactElement {
  const { t } = useTranslation('common')
  const isRunning = result.status === 'running'
  const isError = result.status === 'error'
  const [open, setOpen] = useState(isRunning || isError)
  const duration = fmtDuration(result.startedAt, result.finishedAt)
  return (
    <div className={`rounded-xl border ${isError ? 'border-red-500/40' : 'border-ds-border'}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-ds-faint transition-transform ${open ? 'rotate-90' : ''}`} strokeWidth={2} />
        {isRunning ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-500" strokeWidth={2.4} />
        ) : (
          <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(result.status)}`} />
        )}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ds-ink">{name}</span>
        {typeof result.retries === 'number' && result.retries > 0 ? (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 text-[10px] font-medium text-amber-600">
            {t('workflowRetriesBadge', { n: result.retries })}
          </span>
        ) : null}
        {duration ? <span className="shrink-0 text-[10.5px] text-ds-faint">{duration}</span> : null}
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-ds-border px-2.5 py-2">
          {result.error ? <LogBlock label={t('workflowResultError')} value={result.error} tone="error" /> : null}
          {result.message ? <LogBlock label={t('workflowResultMessage')} value={result.message} /> : null}
          <LogBlock label={t('workflowResultInput')} value={result.inputJson || '—'} mono />
          {result.status !== 'running' ? (
            <LogBlock label={t('workflowResultOutput')} value={result.outputJson || '—'} mono />
          ) : (
            <p className="text-[11px] italic text-ds-faint">{t('workflowRunLogWaiting')}</p>
          )}
          {result.threadId ? <LogBlock label={t('workflowResultThread')} value={result.threadId} mono /> : null}
        </div>
      ) : null}
    </div>
  )
}

function LogBlock({
  label,
  value,
  mono,
  tone
}: {
  label: string
  value: string
  mono?: boolean
  tone?: 'error'
}): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-ds-faint">{label}</span>
      <pre
        className={`max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg px-2 py-1.5 text-[11px] leading-[1.45] ${
          tone === 'error' ? 'bg-red-500/10 text-red-600' : 'bg-ds-subtle text-ds-muted'
        } ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </pre>
    </div>
  )
}
