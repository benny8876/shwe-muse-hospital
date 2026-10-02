import { Fragment, useEffect, useMemo, useState } from 'react'
import { physicianReferenceRange, type LabRow, type LabTemplate } from '../lib/labTemplates'
import { formatDate } from '../lib/format'
import letterhead from '../assets/letterhead.png'

// Colors sampled from the hospital's official A4 lab report templates —
// match them exactly rather than the app's blue brand color, since this is
// the printed/patient-facing document, not app chrome. Exported so other
// printed reports (e.g. ResultSlip's X-ray/USG layout) can match the same
// branding instead of duplicating these hex values.
export const LAB_HEADER_BG = '#14532d'
export const LAB_SECTION_BG = '#dcebdc'

export type LabResultValues = Record<string, string | string[] | { col1: string; col2: string } | undefined>

type Props = {
  template: LabTemplate
  values: LabResultValues
  onChange: (values: LabResultValues) => void
  patientName: string
  uhid: string
  age?: number | string | null
  ageYears?: number | null
  ageMonths?: number | null
  gender?: string
  doctorName?: string
  date?: string | null
  sampleId?: string
  // View-only mode (e.g. opening a patient-history line item in its own tab) —
  // skips the editable entry form and shows the formatted A4 report directly
  // on screen, not just when printing.
  readOnly?: boolean
}

function setField(values: LabResultValues, onChange: Props['onChange'], id: string, value: LabResultValues[string]) {
  onChange({ ...values, [id]: value })
}

// Each test row has its own "include in print" checkbox — a big panel like
// General Physician Panel has 80+ rows but only a handful get done in any
// one visit, so the printed report should only show the ones the lab tech
// actually ticked, not every blank row in the template.
const includeKey = (id: string) => `${id}__inc`
const remarkKey = (id: string) => `${id}__remark`

const QUICK_TESTS: { label: string; ids: string[] }[] = [
  { label: 'ESR', ids: ['esr'] },
  { label: 'Creatinine', ids: ['creatinine'] },
  { label: 'Electrolyte', ids: ['sodium', 'potassium', 'chloride', 'bicarb'] },
  { label: 'Lipid', ids: ['tchol', 'trig', 'hdl', 'ldl'] },
  { label: 'LFT', ids: ['tbili', 'alp', 'sgpt', 'sgot'] },
  { label: 'HbA1C', ids: ['hba1c'] },
  { label: 'Thyroid', ids: ['ft3', 'ft4', 'tsh'] },
  { label: 'CRP', ids: ['crp_quant'] },
]

type PhysicianGroup = {
  key: string
  label: string
  items: Extract<LabRow, { kind: 'row' }>[]
}

function physicianGroups(rows: LabRow[]): PhysicianGroup[] {
  const groups: PhysicianGroup[] = []
  let current: PhysicianGroup | null = null
  for (const r of rows) {
    if (r.kind === 'section') {
      current = { key: r.label, label: r.label, items: [] }
      groups.push(current)
    } else if (r.kind === 'row') {
      if (!current) {
        current = { key: '__general', label: 'တစ်ခုချင်း Test', items: [] }
        groups.push(current)
      }
      current.items.push(r)
    }
  }
  return groups
}

function PhysicianEntry({
  template,
  values,
  onChange,
  rangeFor,
  editCols,
}: {
  template: LabTemplate
  values: LabResultValues
  onChange: (values: LabResultValues) => void
  rangeFor: (id: string, fallback?: string) => string
  editCols: number
}) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'all' | 'selected'>(() => (
    template.rows.some((r) => r.kind === 'row' && values[includeKey(r.id)] === 'yes') ? 'selected' : 'all'
  ))
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [focusId, setFocusId] = useState<string | null>(null)
  const groups = useMemo(() => physicianGroups(template.rows), [template])
  const q = query.trim().toLowerCase()
  const searching = q.length > 0
  const selectedOnly = mode === 'selected' && !searching

  const selectedCount = template.rows.filter((r) => r.kind === 'row' && values[includeKey(r.id)] === 'yes').length

  useEffect(() => {
    if (!focusId) return
    document.getElementById(`lab-res-${focusId}`)?.focus()
    setFocusId(null)
  }, [focusId])

  function checked(id: string) {
    return values[includeKey(id)] === 'yes'
  }

  function matches(label: string, section: string) {
    if (!q) return true
    return label.toLowerCase().includes(q) || section.toLowerCase().includes(q)
  }

  function toggleSection(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }))
  }

  function setAllOpen(next: boolean) {
    const state: Record<string, boolean> = {}
    for (const g of groups) state[g.key] = next
    setOpen(state)
  }

  const allOpen = groups.length > 0 && groups.every((g) => open[g.key])

  function applyQuick(ids: string[]) {
    const allOn = ids.every((id) => checked(id))
    const next = { ...values }
    for (const id of ids) next[includeKey(id)] = allOn ? '' : 'yes'
    onChange(next)
    if (!allOn) {
      setMode('selected')
      setQuery('')
      setFocusId(ids[0])
    }
  }

  const visible = groups.map((g) => {
    const items = g.items.filter((r) => {
      if (selectedOnly && !checked(r.id)) return false
      return matches(r.label, g.label)
    })
    const sectionChecked = g.items.filter((r) => checked(r.id)).length
    const forcedOpen = searching || selectedOnly
    return {
      ...g,
      items,
      sectionChecked,
      expanded: items.length > 0 && (forcedOpen || (open[g.key] ?? false)),
    }
  }).filter((g) => g.items.length > 0)

  const firstVisibleId = visible.find((g) => g.expanded)?.items[0]?.id

  return (
    <div className="no-print card overflow-hidden p-0">
      <div className="border-b border-slate-200 bg-white p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="input min-w-[14rem] flex-1"
            placeholder="Test ရှာပါ — ESR, Creatinine, SGPT…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && firstVisibleId) {
                e.preventDefault()
                document.getElementById(`lab-res-${firstVisibleId}`)?.focus()
              }
            }}
          />
          <div className="flex gap-1">
            <button type="button" className={`btn btn-sm ${mode === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('all')}>
              အားလုံး
            </button>
            <button type="button" className={`btn btn-sm ${mode === 'selected' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setMode('selected'); setQuery('') }}>
              ရွေးထားတာ ({selectedCount})
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 mr-1">အမြန်ရွေး</span>
          {QUICK_TESTS.map((chip) => {
            const on = chip.ids.every((id) => checked(id))
            return (
              <button
                key={chip.label}
                type="button"
                className={`btn btn-sm ${on ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => applyQuick(chip.ids)}
              >
                {chip.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {searching
              ? `“${query.trim()}” နဲ့ ကိုက်တာ ပြနေသည်`
              : 'Result ရိုက်ရင် print မှာ အလိုအလျောက် ပါမည်'}
          </span>
          {mode === 'all' && !searching && (
            <button type="button" className="underline" onClick={() => setAllOpen(!allOpen)}>
              {allOpen ? 'အားလုံးပိတ်' : 'အားလုံးဖွင့်'}
            </button>
          )}
        </div>
      </div>
      <div className="max-h-[32rem] overflow-auto">
        {visible.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-slate-500">
            {searching ? `“${query.trim()}” နဲ့ ကိုက်တဲ့ test မရှိပါ` : 'အမြန်ရွေး နှိပ်ပါ၊ သို့မဟုတ် အားလုံး ထဲက test ရှာပါ'}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="text-left" style={{ background: LAB_HEADER_BG }}>
                <th className="px-2 py-2 font-semibold text-white text-xs uppercase text-center whitespace-nowrap" title="Include in print">✓</th>
                <th className="px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap">Test</th>
                <th className="px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap">Result</th>
                {template.hasUnit && <th className="px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap">Unit</th>}
                {template.hasRange && <th className="px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap">Range</th>}
                <th className="px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap">Remark</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => {
                const total = groups.find((x) => x.key === g.key)?.items.length ?? g.items.length
                return (
                <Fragment key={g.key}>
                  <tr style={{ background: LAB_SECTION_BG }}>
                    <td colSpan={editCols} className="p-0">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left font-semibold text-slate-700"
                        onClick={() => { if (!searching && !selectedOnly) toggleSection(g.key) }}
                      >
                        <span>{searching || selectedOnly ? g.label : `${g.expanded ? '▾' : '▸'} ${g.label}`}</span>
                        <span className="text-xs font-normal text-slate-600">{g.sectionChecked}/{total}</span>
                      </button>
                    </td>
                  </tr>
                  {g.expanded && g.items.map((r) => (
                    <tr key={r.id} className={`border-b border-slate-100 ${searching ? 'bg-amber-50' : ''}`}>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={checked(r.id)}
                          onChange={(e) => setField(values, onChange, includeKey(r.id), e.target.checked ? 'yes' : '')}
                        />
                      </td>
                      <td className="px-3 py-2 break-words">{r.label}</td>
                      <td className="px-3 py-2">
                        <input
                          id={`lab-res-${r.id}`}
                          className="input !py-1"
                          value={(values[r.id] as string) || ''}
                          onChange={(e) => {
                            const next = { ...values, [r.id]: e.target.value }
                            if (e.target.value.trim()) next[includeKey(r.id)] = 'yes'
                            onChange(next)
                          }}
                        />
                      </td>
                      {template.hasUnit && <td className="px-3 py-2 text-slate-500 break-words">{r.unit || '—'}</td>}
                      {template.hasRange && <td className="px-3 py-2 text-slate-500 break-words">{rangeFor(r.id, r.range)}</td>}
                      <td className="px-3 py-2">
                        <input
                          className="input !py-1"
                          placeholder={r.remark || '—'}
                          value={(values[remarkKey(r.id)] as string) ?? r.remark ?? ''}
                          onChange={(e) => setField(values, onChange, remarkKey(r.id), e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              )})}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function LabTemplateResult({ template, values, onChange, patientName, uhid, age, ageYears, ageMonths, gender, doctorName, date, sampleId, readOnly }: Props) {
  const hasRemark = template.hasRemark !== false
  // A row2 row (e.g. Widal's O/H Antibody pair) needs two real value columns
  // instead of one Result column — grab the first row2's col1/col2 labels to
  // head those columns, rather than squeezing both values into one cell under
  // a single generic "Result" header.
  const row2Row = template.rows.find((r): r is Extract<LabRow, { kind: 'row2' }> => r.kind === 'row2')
  const cols = (row2Row ? 3 : 2) + (template.hasUnit ? 1 : 0) + (template.hasRange ? 1 : 0) + (hasRemark ? 1 : 0)
  const editCols = cols + 1
  const physician = template.name === 'General Physician Panel'
  // Templates built entirely from free-text/checkbox rows (e.g. Blood Film
  // Report) have no use for the Test Description/Result/Remark table header —
  // every row already prints as its own full-width "Label: value" line.
  const hasTabularRows = template.rows.some((r) => r.kind === 'row' || r.kind === 'row2')
  function rangeFor(id: string, fallback?: string) {
    if (!physician) return fallback || '—'
    return physicianReferenceRange(id, ageYears, ageMonths, gender) || fallback || '—'
  }

  // A section header only prints if at least one row under it (before the
  // next section) is checked — otherwise an empty "Electrolyte" band with
  // nothing beneath it would print for no reason.
  function sectionHasVisibleRows(fromIdx: number): boolean {
    for (let i = fromIdx + 1; i < template.rows.length; i++) {
      const row = template.rows[i]
      if (row.kind === 'section') return false
      if (row.kind === 'row') {
        if (values[includeKey(row.id)] === 'yes') return true
      } else {
        return true
      }
    }
    return false
  }

  return (
    <>
      <div className="no-print flex justify-end">
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print (A4)</button>
      </div>

      {/* Editable entry form. General Physician is long enough that browsing
          the full table is the slow part — search, quick-add, and a selected-only
          view sit on top of the same include-in-print checkboxes. */}
      {!readOnly && physician && (
        <PhysicianEntry template={template} values={values} onChange={onChange} rangeFor={rangeFor} editCols={editCols} />
      )}
      {!readOnly && !physician && (
      <div className="no-print card overflow-auto p-0">
        <table className="w-full text-sm border-collapse">
          {hasTabularRows && (
            <thead>
              <tr className="text-left" style={{ background: LAB_HEADER_BG }}>
                <th className="px-2 py-2 font-semibold text-white text-xs uppercase text-center whitespace-nowrap" title="Include in print">✓</th>
                <th className="px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap">Test</th>
                {row2Row ? (
                  <>
                    <th className="px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap">{row2Row.col1}</th>
                    <th className="px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap">{row2Row.col2}</th>
                  </>
                ) : (
                  <th className={`px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap ${hasRemark ? '' : 'w-2/5'}`}>Result</th>
                )}
                {template.hasUnit && <th className="px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap">Unit</th>}
                {template.hasRange && <th className="px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap">Range</th>}
                {hasRemark && <th className="px-3 py-2 font-semibold text-white text-xs uppercase whitespace-nowrap">Remark</th>}
              </tr>
            </thead>
          )}
          <tbody>
            {template.rows.map((r, idx) => {
              if (r.kind === 'section') {
                return (
                  <tr key={`s-${idx}`} style={{ background: LAB_SECTION_BG }}>
                    <td colSpan={editCols} className="px-3 py-1.5 font-semibold text-slate-700">{r.label}</td>
                  </tr>
                )
              }
              if (r.kind === 'info') {
                return (
                  <tr key={`i-${idx}`}>
                    <td colSpan={editCols} className="px-3 py-2">
                      <table className="w-full text-xs border border-slate-200">
                        <thead>
                          <tr className="bg-slate-100">
                            {r.headers.map((h) => <th key={h} className="px-2 py-1 text-left font-medium text-slate-600">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {r.rows.map((row_, i) => (
                            <tr key={i} className="border-t border-slate-200">
                              {row_.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )
              }
              if (r.kind === 'text') {
                return (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td colSpan={editCols} className="px-3 py-2">
                      <div className="text-xs font-medium text-slate-600 mb-1">{r.label}</div>
                      <textarea
                        className="input min-h-16"
                        value={(values[r.id] as string) || ''}
                        onChange={(e) => setField(values, onChange, r.id, e.target.value)}
                      />
                    </td>
                  </tr>
                )
              }
              if (r.kind === 'checkboxGroup') {
                const selected = (values[r.id] as string[]) || []
                return (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td colSpan={editCols} className="px-3 py-2">
                      <div className="text-xs font-medium text-slate-600 mb-1">{r.label}</div>
                      <div className="flex flex-wrap gap-4">
                        {r.options.map((opt) => (
                          <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected.includes(opt)}
                              onChange={(e) => {
                                const next = e.target.checked ? [...selected, opt] : selected.filter((o) => o !== opt)
                                setField(values, onChange, r.id, next)
                              }}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              }
              if (r.kind === 'row2') {
                const val = (values[r.id] as { col1: string; col2: string }) || { col1: '', col2: '' }
                return (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-2 py-2" />
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2">
                      <input className="input" placeholder={r.col1} value={val.col1} onChange={(e) => setField(values, onChange, r.id, { ...val, col1: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <input className="input" placeholder={r.col2} value={val.col2} onChange={(e) => setField(values, onChange, r.id, { ...val, col2: e.target.value })} />
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={values[includeKey(r.id)] === 'yes'}
                      onChange={(e) => setField(values, onChange, includeKey(r.id), e.target.checked ? 'yes' : '')}
                    />
                  </td>
                  <td className="px-3 py-2 break-words">{r.label}</td>
                  <td className="px-3 py-2">
                    <input className="input !py-1" value={(values[r.id] as string) || ''} onChange={(e) => setField(values, onChange, r.id, e.target.value)} />
                  </td>
                  {template.hasUnit && <td className="px-3 py-2 text-slate-500 break-words">{r.unit || '—'}</td>}
                  {template.hasRange && <td className="px-3 py-2 text-slate-500 break-words">{rangeFor(r.id, r.range)}</td>}
                  {hasRemark && (
                    <td className="px-3 py-2">
                      <input
                        className="input !py-1"
                        placeholder={r.remark || '—'}
                        value={(values[remarkKey(r.id)] as string) ?? r.remark ?? ''}
                        onChange={(e) => setField(values, onChange, remarkKey(r.id), e.target.value)}
                      />
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}

      {!readOnly && template.footnotesOptional && (
        <label className="no-print card flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={values.clinical_footnotes === 'yes'}
            onChange={(e) => setField(values, onChange, 'clinical_footnotes', e.target.checked ? 'yes' : '')}
          />
          Print &quot;Please correlate with clinical condition.&quot; / &quot;Recollected second sample if needed confirmation.&quot;
        </label>
      )}

      {!readOnly && template.hasConfirmationNote && (
        <label className="no-print card flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={values.confirmation_needed === 'yes'}
            onChange={(e) => setField(values, onChange, 'confirmation_needed', e.target.checked ? 'yes' : '')}
          />
          Positive result — print &quot;Confirmation will be necessary.&quot; note
        </label>
      )}

      {/* A4 print layout — always rendered when readOnly (visible on screen too), otherwise print-only.
          No forced page-height box here any more: an earlier version used flex-col + min-h-[273mm] +
          mt-auto to push the confidentiality note to the bottom of a single page, but that requires
          the box's rendered height to match the printable area to the sub-millimeter — any rounding
          from borders/line-height nudges it a fraction of a mm over, which is enough for the browser
          to spill onto a second, near-blank page. The note is now a separate `.print-footer` element
          (position: fixed in print — see index.css) so it repeats at the bottom of every printed page
          regardless of how many pages the report actually takes, instead of trying to pin it once. */}
      {/* print:pb-16 reserves clear space at the bottom of every page for the fixed `.print-footer`
          below, which doesn't take up flow space of its own — without this, a report long enough to
          nearly fill a page could have its last line of content print underneath the footer text. */}
      <div className={`${readOnly ? '' : 'print-only hidden'} p-8 print:pb-16`}>
        <img src={letterhead} alt="Shwe Muse Hospital" className="w-full mb-4" />
        <div className="grid grid-cols-2 gap-1 text-sm border-t border-b py-2 mb-3">
          <div>{template.patientLabel || "Patient's Name"}: <strong>{patientName}</strong></div>
          <div>Received Date: <strong>{date ? formatDate(date) : formatDate(new Date().toISOString())}</strong></div>
          <div>Age & Gender: <strong>{age ?? '—'} / {gender || '—'}</strong></div>
          <div>Reported Date: <strong>{formatDate(new Date().toISOString())}</strong></div>
          <div>ID: <strong>{uhid}</strong></div>
          <div>Lab No: <strong>{sampleId || '—'}</strong></div>
          {doctorName && <div>Referred by (Dr.): <strong>{doctorName}</strong></div>}
        </div>
        <div className="text-center text-lg font-bold py-1 mb-3" style={{ background: LAB_SECTION_BG }}>LABORATORY REPORT</div>
        <table className="w-full text-sm border-collapse mb-3 table-fixed">
          {hasTabularRows && (
            <thead>
              <tr className="text-left" style={{ background: LAB_HEADER_BG, color: 'white' }}>
                <th className="border border-slate-300 px-2 py-1 whitespace-nowrap">Test</th>
                {row2Row ? (
                  <>
                    <th className="border border-slate-300 px-2 py-1 whitespace-nowrap">{row2Row.col1}</th>
                    <th className="border border-slate-300 px-2 py-1 whitespace-nowrap">{row2Row.col2}</th>
                  </>
                ) : (
                  <th className={`border border-slate-300 px-2 py-1 whitespace-nowrap ${hasRemark ? '' : 'w-2/5'}`}>Result</th>
                )}
                {template.hasUnit && <th className="border border-slate-300 px-2 py-1 whitespace-nowrap">Unit</th>}
                {template.hasRange && <th className="border border-slate-300 px-2 py-1 whitespace-nowrap">Range</th>}
                {hasRemark && <th className="border border-slate-300 px-2 py-1 whitespace-nowrap">Remark</th>}
              </tr>
            </thead>
          )}
          <tbody>
            {template.rows.map((r, idx) => {
              if (r.kind === 'section') {
                if (!sectionHasVisibleRows(idx)) return null
                return (
                  <tr key={`s-${idx}`} style={{ background: LAB_SECTION_BG }}>
                    <td colSpan={cols} className="border border-slate-300 px-2 py-1 font-semibold">{r.label}</td>
                  </tr>
                )
              }
              if (r.kind === 'info') {
                return (
                  <tr key={`i-${idx}`}>
                    <td colSpan={cols} className="border border-slate-300 px-2 py-2">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr style={{ background: LAB_HEADER_BG, color: 'white' }}>
                            {r.headers.map((h) => <th key={h} className="border border-slate-300 px-1 py-0.5 text-left">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {r.rows.map((row_, i) => (
                            <tr key={i}>
                              {row_.map((c, j) => <td key={j} className="border border-slate-300 px-1 py-0.5">{c}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )
              }
              if (r.kind === 'text') {
                return (
                  <tr key={r.id}>
                    <td colSpan={cols} className="border border-slate-300 px-2 py-1 break-words">
                      <strong>{r.label}:</strong> {(values[r.id] as string) || '—'}
                    </td>
                  </tr>
                )
              }
              if (r.kind === 'checkboxGroup') {
                const selected = (values[r.id] as string[]) || []
                if (selected.length === 0) return null
                return (
                  <tr key={r.id}>
                    <td colSpan={cols} className="border border-slate-300 px-2 py-1 break-words">
                      <strong>{r.label}:</strong> {selected.join(', ')}
                    </td>
                  </tr>
                )
              }
              if (r.kind === 'row2') {
                const val = (values[r.id] as { col1: string; col2: string }) || { col1: '', col2: '' }
                return (
                  <tr key={r.id}>
                    <td className="border border-slate-300 px-2 py-1 break-words">{r.label}</td>
                    <td className="border border-slate-300 px-2 py-1 break-words">{val.col1 || '—'}</td>
                    <td className="border border-slate-300 px-2 py-1 break-words">{val.col2 || '—'}</td>
                  </tr>
                )
              }
              if (values[includeKey(r.id)] !== 'yes') return null
              return (
                <tr key={r.id}>
                  <td className="border border-slate-300 px-2 py-1 break-words">{r.label}</td>
                  <td className={`border border-slate-300 px-2 py-1 font-semibold break-words ${hasRemark ? '' : 'w-2/5'}`}>{(values[r.id] as string) || ''}</td>
                  {template.hasUnit && <td className="border border-slate-300 px-2 py-1 break-words">{r.unit || ''}</td>}
                  {template.hasRange && <td className="border border-slate-300 px-2 py-1 break-words">{(() => { const range = rangeFor(r.id, r.range); return range === '—' ? '' : range })()}</td>}
                  {hasRemark && <td className="border border-slate-300 px-2 py-1 break-words">{(values[remarkKey(r.id)] as string) ?? r.remark ?? ''}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
        {((template.footnotes && (!template.footnotesOptional || values.clinical_footnotes === 'yes')) || (template.hasConfirmationNote && values.confirmation_needed === 'yes')) && (
          <div className="text-xs italic text-slate-600 mb-6">
            {(!template.footnotesOptional || values.clinical_footnotes === 'yes') && template.footnotes?.map((f) => <div key={f}>{f}</div>)}
            {template.hasConfirmationNote && values.confirmation_needed === 'yes' && <div>Confirmation will be necessary.</div>}
          </div>
        )}
        {template.hasBloodDonorNotice ? (
          <>
            <div className="flex justify-end text-sm mb-4">
              <div>Done By: <span className="inline-block w-48 border-b border-slate-400">&nbsp;</span></div>
            </div>
            <div className="text-sm border-t border-slate-300 pt-3">
              <div className="font-bold mb-1.5">** Please Attention</div>
              <ol className="list-decimal ml-5 space-y-1.5">
                <li>No blood should be transfused without being checked by two person.</li>
                <li>If the transfusion is not immediately required, blood should be kept in the ward refrigerator. ( Not more than 30 minutes at room temperature)</li>
                <li>In case of transfusion reaction, a report must be made to the blood issued section, with a prescribed form accompanied by BLOOD ISSUED SECTION and a post transfusion clot sample 5 cc from vein different from transfused one.</li>
              </ol>
            </div>
            <div className="flex justify-between mt-10 text-sm">
              <div>Issued by: <span className="inline-block w-40 border-b border-slate-400">&nbsp;</span></div>
              <div>Received By: <span className="inline-block w-40 border-b border-slate-400">&nbsp;</span></div>
            </div>
          </>
        ) : (
          <div className="flex justify-between mt-10 text-sm">
            <div>_____________________<br />Referring Doctor</div>
            <div>_____________________<br />Consultant Pathologist</div>
          </div>
        )}
      </div>
      {/* Repeats on every printed page via `.print-footer` (position: fixed, see index.css) — a running
          footer, not content pinned once, so it stays correct no matter how many pages the report takes. */}
      <div className={`${readOnly ? 'mt-8' : 'print-only print-footer hidden'} text-center text-xs font-medium text-slate-600 pt-2`}>
        ဓာတ်ခွဲခန်းအဖြေများကိုသက်ဆိုင်ရာဆရာဝန်များနှင့်သာမေးမြန်းဆွေးနွေးပါရန်
      </div>
    </>
  )
}
