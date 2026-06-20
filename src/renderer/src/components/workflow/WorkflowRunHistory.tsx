import { useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, X } from 'lucide-react'
import type {
  WorkflowNodeRunResultV1,
  WorkflowNodeRunStatus,
  WorkflowNodeV1,
  WorkflowRunV1
} from '@shared/app-settings'

function statusClass(status: WorkflowNodeRunStatus | WorkflowRunV1['status'] | undefined): string {
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

function fmtTime(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

function fmtDuration(startedAt: string, finishedAt: string): string {
  const start = new Date(startedAt).getTime()
  const end = new Date(finishedAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return ''
  const ms = end - start
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

/** Read-only viewer of a Create Loop's past runs: per-node inputs/outputs/timing/retries. */
export function WorkflowRunHistory({
  runs,
  nodes,
  onClose
}: {
  runs: WorkflowRunV1[]
  nodes: WorkflowNodeV1[]
  onClose: () => void
}): ReactElement {
  const { t } = useTranslation('common')
  const ordered = useMemo(() => [...runs].reverse(), [runs])
  const nodeName = useMemo(() => {
    const map = new Map<string, string>()
    for (const node of nodes) map.set(node.id, node.name.trim() || t(`workflowNode_${node.type}`))
    return map
  }, [nodes, t])
  const [selectedId, setSelectedId] = useState<string | null>(ordered[0]?.id ?? null)
  const selected = ordered.find((run) => run.id === selectedId) ?? ordered[0] ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="flex h-[80vh] w-[860px] flex-col overflow-hidden rounded-2xl border border-ds-border bg-ds-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ds-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-ds-muted" strokeWidth={1.8} />
            <span className="text-[14px] font-semibold text-ds-ink">{t('workflowRunHistory')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ds-faint transition hover:bg-ds-hover hover:text-ds-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </header>

        {ordered.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-[13px] text-ds-faint">
            {t('workflowRunHistoryEmpty')}
          </p>
        ) : (
          <div className="flex min-h-0 flex-1">
            <aside className="w-[240px] shrink-0 overflow-y-auto border-r border-ds-border">
              {ordered.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => setSelectedId(run.id)}
                  className={`flex w-full flex-col gap-0.5 border-b border-ds-border/60 px-4 py-2.5 text-left transition hover:bg-ds-hover ${
                    run.id === selected?.id ? 'bg-ds-hover' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${statusClass(run.status)}`} />
                    <span className="truncate text-[12.5px] font-medium text-ds-ink">{fmtTime(run.startedAt)}</span>
                  </div>
                  <span className="pl-4 text-[11px] text-ds-faint">
                    {run.trigger} · {fmtDuration(run.startedAt, run.finishedAt) || t(`workflowRunStatus_${run.status}`)}
                  </span>
                </button>
              ))}
            </aside>

            <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4">
              {selected ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-ds-muted">
                    <span className={`h-2 w-2 rounded-full ${statusClass(selected.status)}`} />
                    <span className="font-medium text-ds-ink">{t(`workflowRunStatus_${selected.status}`)}</span>
                    <span className="text-ds-faint">·</span>
                    <span>{fmtTime(selected.startedAt)}</span>
                    {fmtDuration(selected.startedAt, selected.finishedAt) ? (
                      <>
                        <span className="text-ds-faint">·</span>
                        <span>{fmtDuration(selected.startedAt, selected.finishedAt)}</span>
                      </>
                    ) : null}
                  </div>
                  {selected.message ? (
                    <p className="rounded-lg bg-ds-subtle px-3 py-2 text-[12px] text-ds-muted">{selected.message}</p>
                  ) : null}
                  {selected.nodeResults.map((result) => (
                    <NodeResultRow key={result.nodeId} result={result} name={nodeName.get(result.nodeId) ?? result.nodeId} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NodeResultRow({ result, name }: { result: WorkflowNodeRunResultV1; name: string }): ReactElement {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const duration = fmtDuration(result.startedAt, result.finishedAt)
  return (
    <div className="rounded-xl border border-ds-border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${statusClass(result.status)}`} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ds-ink">{name}</span>
        {typeof result.retries === 'number' && result.retries > 0 ? (
          <span className="rounded-full bg-amber-500/15 px-1.5 text-[10.5px] font-medium text-amber-600">
            {t('workflowRetriesBadge', { n: result.retries })}
          </span>
        ) : null}
        {duration ? <span className="shrink-0 text-[11px] text-ds-faint">{duration}</span> : null}
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-ds-border px-3 py-2.5">
          {result.error ? (
            <Block label={t('workflowResultError')} value={result.error} tone="error" />
          ) : null}
          {result.message ? <Block label={t('workflowResultMessage')} value={result.message} /> : null}
          {result.inputJson ? <Block label={t('workflowResultInput')} value={result.inputJson} mono /> : null}
          {result.outputJson ? <Block label={t('workflowResultOutput')} value={result.outputJson} mono /> : null}
          {result.threadId ? <Block label={t('workflowResultThread')} value={result.threadId} mono /> : null}
        </div>
      ) : null}
    </div>
  )
}

function Block({
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
      <span className="text-[11px] font-medium uppercase tracking-wide text-ds-faint">{label}</span>
      <pre
        className={`max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-[11.5px] leading-5 ${
          tone === 'error' ? 'bg-red-500/10 text-red-600' : 'bg-ds-subtle text-ds-muted'
        } ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </pre>
    </div>
  )
}
