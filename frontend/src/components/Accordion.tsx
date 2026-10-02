import { useState, type ReactNode } from 'react'

type Props = {
  title: string
  defaultOpen?: boolean
  // Small hint shown next to the title even while collapsed (e.g. "Discount: 5,000 MMK")
  // so a section that already has something set doesn't look empty/forgotten.
  badge?: ReactNode
  // e.g. "no-print" — the section is an interactive form that shouldn't show
  // up when the enclosing page is sent to window.print().
  className?: string
  children: ReactNode
}

// Collapsible section for grouping occasional/secondary actions (Add Item,
// Discount, Refund, ...) behind a tap, so a bill-detail panel's primary action
// (Pay) isn't buried under permanently-visible forms most bills never touch.
export default function Accordion({ title, defaultOpen = false, badge, className = '', children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`border-t pt-3 ${className}`}>
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 font-medium text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{title}</span>
        <span className="flex items-center gap-2 text-sm font-normal text-slate-500 shrink-0">
          {badge}
          <span className={`inline-block transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {open && <div className="space-y-2 pt-2">{children}</div>}
    </div>
  )
}
