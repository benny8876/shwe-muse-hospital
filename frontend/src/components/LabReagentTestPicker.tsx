import { useMemo, useState } from 'react'

export type LabTestOption = { id: number; sku: string; name: string }
export type LabTestLink = { test_item_id: number; qty: number }

type Props = {
  tests: LabTestOption[]
  value: LabTestLink[]
  onChange: (links: LabTestLink[]) => void
  disabled?: boolean
}

export default function LabReagentTestPicker({ tests, value, onChange, disabled }: Props) {
  const [filter, setFilter] = useState('')
  const selected = useMemo(() => new Map(value.map((l) => [l.test_item_id, l.qty])), [value])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return tests
    return tests.filter((t) => t.name.toLowerCase().includes(q) || t.sku.toLowerCase().includes(q))
  }, [tests, filter])

  function toggle(testId: number, on: boolean) {
    if (disabled) return
    if (on) {
      if (selected.has(testId)) return
      onChange([...value, { test_item_id: testId, qty: 1 }])
    } else {
      onChange(value.filter((l) => l.test_item_id !== testId))
    }
  }

  function setQty(testId: number, qty: number) {
    const n = Math.max(1, qty || 1)
    onChange(value.map((l) => (l.test_item_id === testId ? { ...l, qty: n } : l)))
  }

  return (
    <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50/80">
      <div>
        <div className="text-sm font-medium text-slate-800">Used for lab tests</div>
        <p className="text-xs text-slate-500 mt-0.5">
          ဒီ reagent က ဘယ် test မှာ တစ်ကြိမ်ဘယ်လောက် သုံးမလဲ — test order တိုင်း stock ကနေ နှုတ်မယ်
        </p>
      </div>
      <input
        className="input"
        placeholder="Filter tests..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        disabled={disabled}
      />
      <div className="max-h-48 overflow-y-auto space-y-1">
        {filtered.length === 0 && <div className="text-slate-500 text-sm py-2">No tests match</div>}
        {filtered.map((t) => {
          const on = selected.has(t.id)
          return (
            <div key={t.id} className="flex items-center gap-2 text-sm py-1">
              <input
                type="checkbox"
                className="shrink-0"
                checked={on}
                disabled={disabled}
                onChange={(e) => toggle(t.id, e.target.checked)}
              />
              <span className="flex-1 min-w-0 truncate" title={t.name}>
                {t.name}
                <span className="text-slate-400 text-xs ml-1">{t.sku}</span>
              </span>
              {on && (
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="input w-16 !py-1 text-right shrink-0"
                  value={selected.get(t.id) ?? 1}
                  disabled={disabled}
                  onChange={(e) => setQty(t.id, Number(e.target.value))}
                  aria-label={`Qty per test for ${t.name}`}
                />
              )}
            </div>
          )
        })}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-slate-600">{value.length} test(s) linked</p>
      )}
    </div>
  )
}
