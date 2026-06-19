import type { ReactElement } from 'react'
import { Code2, FilePlus2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { WorkspaceModeTabs } from '../chat/WorkspaceModeTabs'
import { useDesignWorkspaceStore } from '../../design/design-workspace-store'
import type { DesignArtifact } from '../../design/design-types'

type Props = {
  onCodeOpen: () => void
  onWriteOpen: () => void
  onDesignOpen: () => void
  /** Hand the artifact to the coding agent (design → code spine). */
  onImplement: (artifact: DesignArtifact) => void
}

/** Design-mode left sidebar: mode tabs + artifact list with implement/provenance. */
export function DesignSidebar({ onCodeOpen, onWriteOpen, onDesignOpen, onImplement }: Props): ReactElement {
  const { t } = useTranslation('common')
  const artifacts = useDesignWorkspaceStore((s) => s.artifacts)
  const activeArtifactId = useDesignWorkspaceStore((s) => s.activeArtifactId)
  const setActiveArtifact = useDesignWorkspaceStore((s) => s.setActiveArtifact)

  return (
    <div className="ds-no-drag flex h-full min-h-0 flex-col bg-ds-sidebar px-1 pt-2">
      <WorkspaceModeTabs
        activeView="design"
        onCodeOpen={onCodeOpen}
        onWriteOpen={onWriteOpen}
        onDesignOpen={onDesignOpen}
      />
      <button
        type="button"
        onClick={() => setActiveArtifact(null)}
        className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-[#3b82d8] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
      >
        <FilePlus2 className="h-4 w-4" strokeWidth={1.9} />
        {t('designNewArtifact')}
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {artifacts.length === 0 ? (
          <div className="px-2 py-2 text-[13px] leading-relaxed text-[#646e7c] dark:text-white/55">
            {t('designSidebarEmpty')}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {artifacts.map((artifact) => {
              const active = artifact.id === activeArtifactId
              const implemented = Boolean(artifact.implementedAt)
              const drift = implemented && (artifact.implementedAt ?? '') < artifact.updatedAt
              return (
                <li
                  key={artifact.id}
                  className={`group/row flex items-center gap-1 rounded-md pr-1 ${
                    active
                      ? 'bg-black/[0.06] dark:bg-white/[0.08]'
                      : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveArtifact(artifact.id)}
                    title={artifact.title}
                    className={`flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-[13px] ${
                      active ? 'font-medium text-[#1f2733] dark:text-white' : 'text-[#646e7c] dark:text-white/55'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{artifact.title}</span>
                    {implemented ? (
                      <span
                        title={drift ? t('designDrift') : t('designImplemented')}
                        className={`shrink-0 text-[12px] leading-none ${drift ? 'text-[#c98a3a]' : 'text-[#2e9e6b]'}`}
                      >
                        {drift ? '⟳' : '✓'}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => onImplement(artifact)}
                    title={t('designImplement')}
                    aria-label={t('designImplement')}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#8b95a3] opacity-0 transition-opacity hover:text-[#3b82d8] focus-visible:opacity-100 group-hover/row:opacity-100 dark:text-white/45 dark:hover:text-[#6fb0e8]"
                  >
                    <Code2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
