type Option = { value: string; label: string }

type Props = {
  options: Option[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export default function ToggleGroup({ options, value, onChange, className = '' }: Props) {
  return (
    <div className={`flex gap-2 ${className}`.trim()}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`btn flex-1 ${value === o.value ? 'btn-primary' : 'btn-secondary'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
