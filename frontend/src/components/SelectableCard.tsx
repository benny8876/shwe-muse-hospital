import type { ReactNode } from 'react'

type Props = {
  selected?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
  variant?: 'list' | 'tile'
  children: ReactNode
}

/**
 * A clickable bordered card used for "pick one" lists — waiting patients, orders,
 * catalog items to order. Centralizes the border/background highlight pattern that
 * used to be repeated inline (with a hardcoded #005293) across every counter page.
 */
export default function SelectableCard({ selected, disabled, onClick, className = '', variant = 'list', children }: Props) {
  const base = variant === 'tile'
    ? 'card text-left border-2 min-h-[100px] flex flex-col justify-between transition-colors'
    : 'w-full text-left border-2 rounded-lg p-3 transition-colors'
  const state = disabled
    ? 'opacity-60 border-slate-100 cursor-not-allowed'
    : selected
      ? 'border-[var(--brand-600)] bg-[var(--brand-50)] cursor-pointer'
      : 'border-slate-200 hover:border-[var(--brand-600)]/50 cursor-pointer'
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`${base} ${state} ${className}`.trim()}>
      {children}
    </button>
  )
}
