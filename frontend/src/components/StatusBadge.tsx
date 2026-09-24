type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'

const TONE_BY_STATUS: Record<string, Tone> = {
  open: 'info',
  partial: 'warning',
  paid: 'success',
  draft: 'neutral',
  waiting: 'warning',
  serving: 'success',
  done: 'neutral',
  admitted: 'info',
  discharged: 'neutral',
  ordered: 'info',
  collected: 'info',
  approved: 'success',
  pending: 'warning',
  scheduled: 'info',
  completed: 'success',
  dispensed: 'success',
  opd: 'info',
  ipd: 'info',
  available: 'success',
  occupied: 'danger',
  maintenance: 'warning',
}

const TONE_STYLE: Record<Tone, string> = {
  info: 'bg-[var(--status-info-bg)] text-[var(--status-info-fg)]',
  success: 'bg-[var(--status-success-bg)] text-[var(--status-success-fg)]',
  warning: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]',
  danger: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]',
  neutral: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]',
}

export default function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span>—</span>
  const tone = TONE_BY_STATUS[value.toLowerCase()] || 'neutral'
  return <span className={`badge ${TONE_STYLE[tone]}`}>{value}</span>
}
