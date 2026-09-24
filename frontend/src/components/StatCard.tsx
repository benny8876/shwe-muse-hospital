import type { ReactNode } from 'react'

type Props = {
  label: string
  value: string
  tone?: 'default' | 'success' | 'danger'
  hint?: ReactNode
}

const TONE_TEXT: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-slate-800',
  success: 'text-[var(--status-success-fg)]',
  danger: 'text-[var(--status-danger-fg)]',
}

export default function StatCard({ label, value, tone = 'default', hint }: Props) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${TONE_TEXT[tone]}`}>{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
    </div>
  )
}
