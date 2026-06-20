import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ApprovalPolicy, SandboxMode } from '@shared/app-settings'

export type ComposerExecutionSettings = {
  approvalPolicy: ApprovalPolicy
  sandboxMode: SandboxMode
}

type Props = {
  value: ComposerExecutionSettings
  applying?: boolean
  disabled?: boolean
  onChange: (patch: Partial<ComposerExecutionSettings>) => void
}

type ApprovalOption = {
  value: ApprovalPolicy
  labelKey: string
}

type SandboxOption = {
  value: SandboxMode
  labelKey: string
}

const APPROVAL_OPTIONS: ApprovalOption[] = [
  { value: 'auto', labelKey: 'approvalAutoShort' },
  { value: 'on-request', labelKey: 'approvalOnRequestShort' },
  { value: 'untrusted', labelKey: 'approvalUntrustedShort' },
  { value: 'suggest', labelKey: 'approvalSuggestShort' },
  { value: 'never', labelKey: 'approvalNeverShort' }
]

const SANDBOX_OPTIONS: SandboxOption[] = [
  { value: 'workspace-write', labelKey: 'sandboxWorkspaceWriteShort' },
  { value: 'read-only', labelKey: 'sandboxReadOnlyShort' },
  { value: 'danger-full-access', labelKey: 'sandboxFullAccessShort' },
  { value: 'external-sandbox', labelKey: 'sandboxExternalShort' }
]

function approvalLabelKey(policy: ApprovalPolicy): string {
  return APPROVAL_OPTIONS.find((option) => option.value === policy)?.labelKey ?? 'approvalAutoShort'
}

function sandboxLabelKey(mode: SandboxMode): string {
  return SANDBOX_OPTIONS.find((option) => option.value === mode)?.labelKey ?? 'sandboxWorkspaceWriteShort'
}

export function FloatingComposerExecutionPicker({
  value,
  applying = false,
  disabled = false,
  onChange
}: Props): ReactElement {
  const { t } = useTranslation('common')
  const [openMenu, setOpenMenu] = useState<'approval' | 'sandbox' | null>(null)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement | null>(null)
  const approvalButtonRef = useRef<HTMLButtonElement | null>(null)
  const sandboxButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const fullAccess = value.sandboxMode === 'danger-full-access'
  const SandboxIcon = fullAccess ? ShieldAlert : ShieldCheck
  const title = `${t('composerApprovalShort')}: ${t(approvalLabelKey(value.approvalPolicy))} / ${t('composerAccessShort')}: ${t(sandboxLabelKey(value.sandboxMode))}`

  const updateMenuPosition = (menu: 'approval' | 'sandbox' = openMenu ?? 'approval'): void => {
    const button = menu === 'approval' ? approvalButtonRef.current : sandboxButtonRef.current
    const rect = button?.getBoundingClientRect()
    if (!rect) return
    const menuWidth = menu === 'approval' ? 156 : 184
    const estimatedMenuHeight = menu === 'approval' ? 228 : 190
    const menuHeight = menuRef.current?.offsetHeight ?? estimatedMenuHeight
    const anchorLeft = rect.left + (rect.width / 2) - (menuWidth / 2)
    const topAbove = rect.top - menuHeight - 8
    const top = topAbove >= 12 ? topAbove : rect.bottom + 8
    setMenuStyle({
      top: Math.min(Math.max(12, top), Math.max(12, window.innerHeight - menuHeight - 12)),
      left: Math.min(Math.max(12, anchorLeft), Math.max(12, window.innerWidth - menuWidth - 12)),
      width: menuWidth
    })
  }

  useEffect(() => {
    if (!openMenu) return
    updateMenuPosition(openMenu)
    const frame = window.requestAnimationFrame(() => updateMenuPosition(openMenu))
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (target instanceof Node && rootRef.current?.contains(target)) return
      if (target instanceof Node && menuRef.current?.contains(target)) return
      setOpenMenu(null)
    }
    const onUpdatePosition = (): void => updateMenuPosition(openMenu)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', onUpdatePosition)
    window.addEventListener('scroll', onUpdatePosition, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', onUpdatePosition)
      window.removeEventListener('scroll', onUpdatePosition, true)
    }
  }, [openMenu])

  const update = (patch: Partial<ComposerExecutionSettings>): void => {
    onChange(patch)
    setOpenMenu(null)
  }

  const toggleMenu = (menu: 'approval' | 'sandbox'): void => {
    updateMenuPosition(menu)
    setOpenMenu((current) => (current === menu ? null : menu))
  }

  const menu =
    openMenu && typeof document !== 'undefined' ? (
      <div
        ref={menuRef}
        role="menu"
        style={menuStyle}
        className="fixed z-50 overflow-hidden rounded-2xl border border-ds-border bg-white p-2 text-[13px] text-ds-ink shadow-[0_18px_48px_rgba(20,47,95,0.16)] dark:bg-ds-card"
      >
        {openMenu === 'approval'
          ? APPROVAL_OPTIONS.map((option) => (
              <ExecutionRow
                key={option.value}
                selected={value.approvalPolicy === option.value}
                label={t(option.labelKey)}
                onClick={() => update({ approvalPolicy: option.value })}
              />
            ))
          : SANDBOX_OPTIONS.map((option) => (
              <ExecutionRow
                key={option.value}
                selected={value.sandboxMode === option.value}
                label={t(option.labelKey)}
                onClick={() => update({ sandboxMode: option.value })}
              />
            ))}
      </div>
    ) : null

  return (
    <>
      <div
        ref={rootRef}
        className="ds-no-drag relative inline-flex shrink-0 items-center gap-1"
        title={title}
      >
        <button
          ref={approvalButtonRef}
          type="button"
          disabled={disabled || applying}
          onClick={() => toggleMenu('approval')}
          className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-ds-border-muted bg-ds-card/72 px-2.5 py-0.5 text-[12.5px] font-semibold text-ds-muted shadow-sm transition hover:bg-ds-hover hover:text-ds-ink disabled:cursor-not-allowed disabled:opacity-55"
          title={t(approvalLabelKey(value.approvalPolicy))}
          aria-expanded={openMenu === 'approval'}
          aria-haspopup="menu"
          aria-label={t('composerApprovalShort')}
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          {applying ? (
            <span className="max-w-[120px] truncate">{t('composerExecutionApplying')}</span>
          ) : (
            <span className="max-w-[92px] truncate">{t(approvalLabelKey(value.approvalPolicy))}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        </button>

        <button
          ref={sandboxButtonRef}
          type="button"
          disabled={disabled || applying}
          onClick={() => toggleMenu('sandbox')}
          className={`inline-flex min-h-7 items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-[12.5px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-55 ${
            fullAccess
              ? 'border-orange-300/70 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-800/70 dark:bg-orange-950/30 dark:text-orange-200'
              : 'border-ds-border-muted bg-ds-card/72 text-ds-muted hover:bg-ds-hover hover:text-ds-ink'
          }`}
          title={t(sandboxLabelKey(value.sandboxMode))}
          aria-expanded={openMenu === 'sandbox'}
          aria-haspopup="menu"
          aria-label={t('composerAccessShort')}
        >
          <SandboxIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          {applying ? (
            <span className="max-w-[120px] truncate">{t('composerExecutionApplying')}</span>
          ) : (
            <span className="max-w-[112px] truncate">{t(sandboxLabelKey(value.sandboxMode))}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        </button>
      </div>
      {menu ? createPortal(menu, document.body) : null}
    </>
  )
}

function ExecutionRow({
  selected,
  label,
  onClick
}: {
  selected: boolean
  label: string
  onClick: () => void
}): ReactElement {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-ds-ink transition ${
        selected ? 'bg-ds-hover' : 'hover:bg-ds-hover/70'
      }`}
    >
      <span className="min-w-0 truncate font-medium">{label}</span>
      {selected ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2} /> : null}
    </button>
  )
}
