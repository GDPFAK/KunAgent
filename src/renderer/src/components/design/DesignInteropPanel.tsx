import { useMemo, useState, type ReactElement } from 'react'
import { CheckCircle2, FileJson2, Loader2, Network, PackageOpen, ScanLine, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCanvasShapeStore } from '../../design/canvas/canvas-shape-store'
import { useDesignSystemStore } from '../../design/canvas/design-system-store'
import type { DesignDocument } from '../../design/design-types'
import {
  buildPenpotHandoffPackage,
  PENPOT_HANDOFF_PACKAGE_PATH,
  serializePenpotHandoffPackage
} from '../../design/interop/penpot-handoff-package'
import {
  buildDesignResourceSurface,
  DESIGN_RESOURCE_SURFACE_PATH,
  serializeDesignResourceSurface
} from '../../design/interop/design-resource-surface'
import {
  buildOpenUiNormalizationReport,
  OPENUI_NORMALIZATION_REPORT_PATH,
  serializeOpenUiNormalizationReport
} from '../../design/generator-lane/openui-html-normalizer'
import {
  SidebarCommandRow,
  SidebarIconButton,
  SidebarSectionHeader
} from '../sidebar/SidebarPrimitives'

type Props = {
  workspaceRoot: string
  document: DesignDocument | null
}

type ExportState =
  | { status: 'idle' }
  | { status: 'exporting' }
  | { status: 'exported'; path: string }
  | { status: 'error'; message: string }

function statusToneClass(state: ExportState): string {
  if (state.status === 'exported') return 'text-[#2e9e6b]'
  if (state.status === 'error') return 'text-[#c0392b]'
  return 'text-ds-faint'
}

function statusText(state: ExportState, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (state.status === 'exporting') return t('designInteropExporting')
  if (state.status === 'exported') return t('designInteropExported', { path: state.path })
  if (state.status === 'error') return state.message
  return ''
}

export function DesignInteropPanel({ workspaceRoot, document }: Props): ReactElement | null {
  const { t } = useTranslation('common')
  const canvasDocument = useCanvasShapeStore((s) => s.document)
  const designSystem = useDesignSystemStore((s) => s.system)
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const pkg = useMemo(
    () => buildPenpotHandoffPackage({ document, canvasDocument, designSystem }),
    [canvasDocument, designSystem, document]
  )
  const resources = useMemo(
    () => buildDesignResourceSurface({ document, canvasDocument, designSystem }),
    [canvasDocument, designSystem, document]
  )
  const htmlArtifactCount = document?.artifacts.filter((artifact) => artifact.kind === 'html').length ?? 0

  if (!document) return null

  const disabledHint = !workspaceRoot ? t('designInteropNoWorkspace') : ''
  const exportDisabled = !workspaceRoot || exportState.status === 'exporting'
  const status = statusText(exportState, t)

  const exportPenpotPackage = async (): Promise<void> => {
    if (exportDisabled) return
    if (typeof window.kunGui?.writeWorkspaceFile !== 'function') {
      setExportState({ status: 'error', message: t('designInteropUnavailable') })
      return
    }
    setExportState({ status: 'exporting' })
    try {
      const latest = buildPenpotHandoffPackage({
        document,
        canvasDocument: useCanvasShapeStore.getState().document,
        designSystem: useDesignSystemStore.getState().system
      })
      await window.kunGui.writeWorkspaceFile({
        path: PENPOT_HANDOFF_PACKAGE_PATH,
        workspaceRoot,
        content: serializePenpotHandoffPackage(latest)
      })
      setExportState({ status: 'exported', path: PENPOT_HANDOFF_PACKAGE_PATH })
    } catch (error) {
      setExportState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const exportDesignResources = async (): Promise<void> => {
    if (exportDisabled) return
    if (typeof window.kunGui?.writeWorkspaceFile !== 'function') {
      setExportState({ status: 'error', message: t('designInteropUnavailable') })
      return
    }
    setExportState({ status: 'exporting' })
    try {
      const latest = buildDesignResourceSurface({
        document,
        canvasDocument: useCanvasShapeStore.getState().document,
        designSystem: useDesignSystemStore.getState().system
      })
      await window.kunGui.writeWorkspaceFile({
        path: DESIGN_RESOURCE_SURFACE_PATH,
        workspaceRoot,
        content: serializeDesignResourceSurface(latest)
      })
      setExportState({ status: 'exported', path: DESIGN_RESOURCE_SURFACE_PATH })
    } catch (error) {
      setExportState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const exportOpenUiReport = async (): Promise<void> => {
    if (exportDisabled) return
    if (
      typeof window.kunGui?.readWorkspaceFile !== 'function' ||
      typeof window.kunGui?.writeWorkspaceFile !== 'function'
    ) {
      setExportState({ status: 'error', message: t('designInteropUnavailable') })
      return
    }
    setExportState({ status: 'exporting' })
    try {
      const htmlArtifacts = (document?.artifacts ?? []).filter((artifact) => artifact.kind === 'html')
      const items = []
      for (const artifact of htmlArtifacts) {
        const result = await window.kunGui.readWorkspaceFile({ path: artifact.relativePath, workspaceRoot })
        if (result?.ok) items.push({ artifact, html: result.content })
      }
      const report = buildOpenUiNormalizationReport({ items })
      await window.kunGui.writeWorkspaceFile({
        path: OPENUI_NORMALIZATION_REPORT_PATH,
        workspaceRoot,
        content: serializeOpenUiNormalizationReport(report)
      })
      setExportState({ status: 'exported', path: OPENUI_NORMALIZATION_REPORT_PATH })
    } catch (error) {
      setExportState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <section>
      <SidebarSectionHeader
        label={t('designInteropTitle')}
        actions={
          <SidebarIconButton
            onClick={() => void exportPenpotPackage()}
            title={exportDisabled && disabledHint ? disabledHint : t('designInteropExportPenpot')}
            ariaLabel={t('designInteropExportPenpot')}
            disabled={exportDisabled}
            tone="accent"
          >
            {exportState.status === 'exporting' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.9} />
            ) : (
              <PackageOpen className="h-3.5 w-3.5" strokeWidth={1.9} />
            )}
          </SidebarIconButton>
        }
      />
      <SidebarCommandRow
        icon={<FileJson2 className="h-4 w-4" strokeWidth={1.85} />}
        label={t('designInteropPenpotPackage')}
        disabled={exportDisabled}
        disabledHint={disabledHint}
        onClick={() => void exportPenpotPackage()}
        trailing={<span className="shrink-0 text-[11.5px] text-ds-faint">JSON</span>}
      />
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designInteropPenpotSummary', {
          frames: pkg.frames.length,
          tokens: pkg.tokens.length,
          components: pkg.components.length,
          assets: pkg.assets.length
        })}
      </div>
      <SidebarCommandRow
        icon={<Network className="h-4 w-4" strokeWidth={1.85} />}
        label={t('designInteropResources')}
        disabled={exportDisabled}
        disabledHint={disabledHint}
        onClick={() => void exportDesignResources()}
        trailing={<span className="shrink-0 text-[11.5px] text-ds-faint">MCP</span>}
      />
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designInteropResourcesSummary', {
          count: resources.resources.length,
          frames: resources.counts.frame,
          directions: resources.counts.direction
        })}
      </div>
      <SidebarCommandRow
        icon={<ScanLine className="h-4 w-4" strokeWidth={1.85} />}
        label={t('designInteropOpenUiReport')}
        disabled={exportDisabled || htmlArtifactCount === 0}
        disabledHint={htmlArtifactCount === 0 ? t('designGeneratorLaneNeedsScreen') : disabledHint}
        onClick={() => void exportOpenUiReport()}
        trailing={<span className="shrink-0 text-[11.5px] text-ds-faint">HTML</span>}
      />
      <div className="px-2.5 pt-1 text-[11.5px] leading-5 text-ds-faint">
        {t('designInteropOpenUiSummary', { count: htmlArtifactCount })}
      </div>
      {status || disabledHint ? (
        <div className={`flex items-start gap-1.5 px-2.5 pt-1 text-[11.5px] leading-5 ${statusToneClass(exportState)}`}>
          {exportState.status === 'exported' ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          ) : exportState.status === 'error' ? (
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          ) : null}
          <span className="min-w-0 flex-1">{status || disabledHint}</span>
        </div>
      ) : null}
    </section>
  )
}
