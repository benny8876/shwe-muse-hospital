type Option = { value: string; label: string }

type Props = {
  options: Option[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export default function ToggleGroup({ options, value, onChange, className = '' }: Props) {
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
