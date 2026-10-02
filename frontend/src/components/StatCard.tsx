import type { ReactNode } from 'react'

type Props = {
  label: string
  value: string
  tone?: 'default' | 'success' | 'danger'
  hint?: ReactNode
  icon?: ReactNode
  highlight?: boolean
}

const TONE_TEXT: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-slate-800',
  success: 'text-[var(--status-success-fg)]',
  danger: 'text-[var(--status-danger-fg)]',
}

export default function StatCard({ label, value, tone = 'default', hint, icon, highlight }: Props) {
  return (
    <div
      className={`card rounded-2xl ${highlight ? 'border-[var(--brand-100)]' : ''}`}
      style={highlight ? { background: 'var(--brand-50)' } : undefined}
    >
      {icon && (
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center mb-2"
          style={{ background: highlight ? 'rgba(255,255,255,0.7)' : 'var(--surface-muted)' }}
        >
          {icon}
        </div>
      )}
      <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${TONE_TEXT[tone]}`}>{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
    </div>
  )
}
