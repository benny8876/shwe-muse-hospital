import { useEffect, useRef, useState } from 'react'
import api from '../lib/api'

type Patient = { id: number; name: string; uhid: string; father_name?: string; phone?: string }

function patientLabel(p: Patient) {
  const parts = [p.name, `(${p.uhid})`]
  if (p.father_name) parts.push(`· ${p.father_name}`)
  if (p.phone) parts.push(`· ${p.phone}`)
  return parts.join(' ')
}

export default function PatientSelect({
  value,
  onChange,
  className = 'input',
}: {
  value: string
  onChange: (patientId: string) => void
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Patient[]>([])
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Patient | null>(null)

  useEffect(() => {
    if (!value) {
      setSelected(null)
      return
    }
    const id = Number(value)
    if (selected?.id === id) return
    api.get(`/patients/${id}`)
      .then((r) => setSelected(r.data))
      .catch(() => setSelected(null))
  }, [value, selected?.id])

  useEffect(() => {
    if (!open) {
      setResults([])
      return
    }
    const q = query.trim()
    if (q.length < 1) {
      setResults([])
      return
    }
    const timer = window.setTimeout(() => {
      setBusy(true)
      api.get('/patients', { params: { q } })
        .then((r) => setResults(r.data))
        .catch(() => setResults([]))
        .finally(() => setBusy(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query, open])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pick(p: Patient) {
    setSelected(p)
    onChange(String(p.id))
    setQuery('')
    setOpen(false)
  }

  function clear() {
    setSelected(null)
    onChange('')
    setQuery('')
    setOpen(true)
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div ref={rootRef} className="relative">
      {selected && !open ? (
        <div className={`flex items-center gap-2 ${className} !py-2`}>
          <button
            type="button"
            className="flex-1 min-w-0 text-left truncate"
            onClick={() => setOpen(true)}
            title={patientLabel(selected)}
          >
            <span className="font-medium">{selected.name}</span>
            <span className="text-slate-500"> ({selected.uhid})</span>
            {selected.father_name && <span className="text-slate-500"> · {selected.father_name}</span>}
            {selected.phone && <span className="text-slate-500"> · {selected.phone}</span>}
          </button>
          <button
            type="button"
            className="shrink-0 text-slate-400 hover:text-slate-700 px-1"
            onClick={clear}
            aria-label="Clear patient"
          >
            ×
          </button>
        </div>
      ) : (
        <input
          className={className}
          placeholder="Search ID + name + father name + phone (space-separated)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
      )}

      {showDropdown && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {busy ? (
            <div className="px-3 py-2 text-sm text-slate-500">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">No patients found</div>
          ) : (
            <ul className="py-1">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--brand-50)]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(p)}
                  >
                    <div className="font-medium text-slate-800">{p.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span>{p.uhid}</span>
                      {p.father_name && <span> · Father: {p.father_name}</span>}
                      {p.phone && <span> · {p.phone}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
