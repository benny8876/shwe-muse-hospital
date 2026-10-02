import type { ReactNode } from 'react'

type Props = {
  label: string
  value: string
  tone?: 'default' | 'success' | 'danger'
  hint?: ReactNode
  icon?: ReactNode
  highlight?: boolean
}

const TONE_CHIP_BG: Record<NonNullable<Props['tone']>, string> = {
  default: 'var(--brand-600)',
  success: 'var(--status-success-fg)',
  danger: 'var(--status-danger-fg)',
}

const TONE_TEXT: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-slate-800',
  success: 'text-[var(--status-success-fg)]',
  danger: 'text-[var(--status-danger-fg)]',
}

export default function StatCard({ label, value, tone = 'default', hint, icon, highlight }: Props) {
  // A "highlight" tile (one per stat grid, e.g. the Net card) gets a bold
  // solid-color fill instead of a white card — the same accent-card trick
  // reference mobile dashboards use to draw the eye to one headline number.
  if (highlight) {
    return (
      <div className="rounded-2xl p-4 shadow-sm" style={{ background: 'var(--brand-600)' }}>
        {icon && (
          <div className="h-9 w-9 rounded-full flex items-center justify-center mb-2" style={{ background: 'rgba(255,255,255,0.2)' }}>
            {icon}
          </div>
        )}
        <div className="text-xs uppercase tracking-wide text-white/70 font-medium">{label}</div>
        <div className="text-2xl font-bold mt-1 text-white">{value}</div>
        {hint && <div className="text-xs text-white/60 mt-0.5">{hint}</div>}
      </div>
    )
  }

  return (
    <div className="card rounded-2xl shadow-sm border-0">
      {icon && (
        <div className="h-9 w-9 rounded-full flex items-center justify-center mb-2" style={{ background: TONE_CHIP_BG[tone] }}>
          {icon}
        </div>
      )}
      <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${TONE_TEXT[tone]}`}>{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
    </div>
  )
}
