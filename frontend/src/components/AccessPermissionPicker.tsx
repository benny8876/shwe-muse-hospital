type TabDef = { key: string; label: string }
type CounterDef = { key: string; label: string; subtitle: string }

type Props = {
  counters: CounterDef[]
  counterTabs: Record<string, TabDef[]>
  selectedCounters: string[]
  selectedFeatures: string[]
  onChange: (counters: string[], features: string[]) => void
}

function featureKey(counter: string, tab: string) {
  return `${counter}.${tab}`
}

export default function AccessPermissionPicker({
  counters,
  counterTabs,
  selectedCounters,
  selectedFeatures,
  onChange,
}: Props) {
  function toggleFeature(counter: string, tab: string) {
    const key = featureKey(counter, tab)
    const has = selectedFeatures.includes(key)
    const nextFeatures = has
      ? selectedFeatures.filter((f) => f !== key)
      : [...selectedFeatures, key]
    const nextCounters = has
      ? (nextFeatures.some((f) => f.startsWith(`${counter}.`)) ? selectedCounters : selectedCounters.filter((c) => c !== counter))
      : (selectedCounters.includes(counter) ? selectedCounters : [...selectedCounters, counter])
    onChange(nextCounters, nextFeatures)
  }

  function selectAllTabs(counter: string) {
    const tabs = counterTabs[counter] || []
    const added = tabs.map((t) => featureKey(counter, t.key))
    onChange(
      selectedCounters.includes(counter) ? selectedCounters : [...selectedCounters, counter],
      [...new Set([...selectedFeatures, ...added])],
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium block mb-1">Navbar / Counter ခွင့်ပြုချက်</label>
        <p className="text-xs text-slate-500 mb-2">Ctrl (Mac: Cmd) နှိပ်ပြီး counter တစ်ခုထက်ပို ရွေးနိုင်ပါတယ်</p>
        <select
          multiple
          className="input min-h-[9rem]"
          value={selectedCounters}
          onChange={(e) => {
            const next = Array.from(e.target.selectedOptions, (o) => o.value)
            const added = next.filter((c) => !selectedCounters.includes(c))
            let feats = selectedFeatures.filter((f) => next.includes(f.split('.')[0]))
            for (const counter of added) {
              const tabs = counterTabs[counter] || []
              feats = [...feats, ...tabs.map((t) => featureKey(counter, t.key))]
            }
            onChange(next, [...new Set(feats)])
          }}
        >
          {counters.map((c) => (
            <option key={c.key} value={c.key}>{c.label} — {c.subtitle}</option>
          ))}
        </select>
      </div>

      {selectedCounters.map((counter) => {
        const def = counters.find((c) => c.key === counter)
        const tabs = counterTabs[counter] || []
        if (!def || tabs.length === 0) return null
        return (
          <div key={counter} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-800">{def.label} — ခွင့်ပြုမည့် tabs</div>
              <button type="button" className="text-xs text-[var(--brand-600)] hover:underline shrink-0" onClick={() => selectAllTabs(counter)}>
                အားလုံး ရွေးမယ်
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {tabs.map((tab) => {
                const key = featureKey(counter, tab.key)
                const checked = selectedFeatures.includes(key)
                return (
                  <label key={key} className={`flex items-center gap-2 text-sm rounded-md px-2 py-1.5 cursor-pointer border ${checked ? 'bg-[var(--brand-50)] border-[var(--brand-200)]' : 'bg-white border-slate-200'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFeature(counter, tab.key)}
                    />
                    {tab.label}
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      {selectedCounters.length === 0 && (
        <p className="text-xs text-slate-500">Counter မရွေးထားရင် role default သုံးမယ်</p>
      )}
    </div>
  )
}
