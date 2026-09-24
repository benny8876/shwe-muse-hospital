type Tab = { id: string; label: string }

export default function Tabs({ tabs, active, onChange }: { tabs: Tab[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 mb-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-4 py-2.5 text-sm font-medium transition cursor-pointer border-b-2 -mb-px ${
            active === t.id
              ? 'border-[var(--brand-600)] text-[var(--brand-600)]'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
