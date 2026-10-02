type Option = { value: string; label: string }

type Props = {
  options: Option[]
  value: string
  onChange: (value: string) => void
  className?: string
  variant?: 'default' | 'pill'
}

export default function ToggleGroup({ options, value, onChange, className = '', variant = 'default' }: Props) {
  if (variant === 'pill') {
    // A dark, rounded segmented-control bar (app-style period/filter switcher)
    // — used where a lighter visual touch than the default bordered buttons fits
    // better, e.g. the Owner Panel's period selector.
    return (
      <div
        className={`flex gap-1 overflow-x-auto rounded-full p-1 ${className}`.trim()}
        style={{ background: 'var(--brand-700)' }}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
              value === o.value ? 'bg-white text-[var(--brand-700)]' : 'text-white/70 hover:text-white'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    // Mobile: a single-line horizontally-scrollable chip row (buttons sized to
    // their own text) — the old flex-1 equal-width buttons wrapped long labels
    // ("This Month", "All Branches") onto 2-3 lines on a phone. Desktop/tablet
    // (sm:) keeps the original equal-width segmented-control look untouched.
    <div className={`flex gap-2 overflow-x-auto sm:overflow-visible sm:flex-wrap pb-1 sm:pb-0 ${className}`.trim()}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`btn shrink-0 whitespace-nowrap sm:flex-1 sm:whitespace-normal ${value === o.value ? 'btn-primary' : 'btn-secondary'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
