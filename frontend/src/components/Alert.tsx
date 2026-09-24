import type { ReactNode } from 'react'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const ICON: Record<Tone, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  danger: '✕',
}

export default function Alert({ tone = 'info', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div className={`alert alert-${tone} ${className}`.trim()}>
      <span className="shrink-0 font-bold leading-none mt-0.5">{ICON[tone]}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
