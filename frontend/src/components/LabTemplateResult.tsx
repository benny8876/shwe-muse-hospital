import type { LabTemplate } from '../lib/labTemplates'
import { formatDate } from '../lib/format'
import letterhead from '../assets/letterhead.png'

// Colors sampled from the hospital's official A4 lab report templates —
// match them exactly rather than the app's blue brand color, since this is
// the printed/patient-facing document, not app chrome.
const LAB_HEADER_BG = '#14532d'
const LAB_SECTION_BG = '#dcebdc'

export type LabResultValues = Record<string, string | string[] | { col1: string; col2: string } | undefined>

type Props = {
  template: LabTemplate
  values: LabResultValues
  onChange: (values: LabResultValues) => void
  patientName: string
  uhid: string
  age?: number | null
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

export default function LabTemplateResult({ template, values, onChange, patientName, uhid, age, gender, doctorName, date, sampleId, readOnly }: Props) {
  const cols = 2 + (template.hasUnit ? 1 : 0) + (template.hasRange ? 1 : 0) + 1
  const editCols = cols + 1

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

      {/* Editable entry form */}
      {!readOnly && (
      <div className="no-print card overflow-auto p-0">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left" style={{ background: LAB_HEADER_BG }}>
              <th className="px-2 py-2 font-semibold text-white text-xs uppercase text-center" title="Include in print">✓</th>
              <th className="px-3 py-2 font-semibold text-white text-xs uppercase">Test Description</th>
              <th className="px-3 py-2 font-semibold text-white text-xs uppercase">Result</th>
              {template.hasUnit && <th className="px-3 py-2 font-semibold text-white text-xs uppercase">Unit</th>}
              {template.hasRange && <th className="px-3 py-2 font-semibold text-white text-xs uppercase">Reference Range</th>}
              <th className="px-3 py-2 font-semibold text-white text-xs uppercase">Remark</th>
            </tr>
          </thead>
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
                    <td colSpan={cols - 1} className="px-3 py-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input" placeholder={r.col1} value={val.col1} onChange={(e) => setField(values, onChange, r.id, { ...val, col1: e.target.value })} />
                        <input className="input" placeholder={r.col2} value={val.col2} onChange={(e) => setField(values, onChange, r.id, { ...val, col2: e.target.value })} />
                      </div>
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
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2">
                    <input className="input !py-1" value={(values[r.id] as string) || ''} onChange={(e) => setField(values, onChange, r.id, e.target.value)} />
                  </td>
                  {template.hasUnit && <td className="px-3 py-2 text-slate-500">{r.unit || '—'}</td>}
                  {template.hasRange && <td className="px-3 py-2 text-slate-500">{r.range || '—'}</td>}
                  <td className="px-3 py-2">
                    <input
                      className="input !py-1"
                      placeholder={r.remark || '—'}
                      value={(values[remarkKey(r.id)] as string) ?? r.remark ?? ''}
                      onChange={(e) => setField(values, onChange, remarkKey(r.id), e.target.value)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
          flex-col + min-h-[297mm] so the confidentiality note (mt-auto) is pinned to the bottom of
          the page rather than sitting right under the signature. */}
      <div className={`${readOnly ? '' : 'print-only hidden'} p-8 flex flex-col min-h-[297mm]`}>
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
        <table className="w-full text-sm border-collapse mb-3">
          <thead>
            <tr className="text-left" style={{ background: LAB_HEADER_BG, color: 'white' }}>
              <th className="border border-slate-300 px-2 py-1">Test Description</th>
              <th className="border border-slate-300 px-2 py-1">Result</th>
              {template.hasUnit && <th className="border border-slate-300 px-2 py-1">Unit</th>}
              {template.hasRange && <th className="border border-slate-300 px-2 py-1">Reference Range</th>}
              <th className="border border-slate-300 px-2 py-1">Remark</th>
            </tr>
          </thead>
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
                    <td colSpan={cols} className="border border-slate-300 px-2 py-1">
                      <strong>{r.label}:</strong> {(values[r.id] as string) || '—'}
                    </td>
                  </tr>
                )
              }
              if (r.kind === 'checkboxGroup') {
                const selected = (values[r.id] as string[]) || []
                return (
                  <tr key={r.id}>
                    <td colSpan={cols} className="border border-slate-300 px-2 py-1">
                      <strong>{r.label}:</strong>{' '}
                      {r.options.map((opt) => `${selected.includes(opt) ? '☑' : '☐'} ${opt}`).join('   ')}
                    </td>
                  </tr>
                )
              }
              if (r.kind === 'row2') {
                const val = (values[r.id] as { col1: string; col2: string }) || { col1: '', col2: '' }
                return (
                  <tr key={r.id}>
                    <td className="border border-slate-300 px-2 py-1">{r.label}</td>
                    <td colSpan={cols - 1} className="border border-slate-300 px-2 py-1">
                      {r.col1}: {val.col1 || '—'} &nbsp;&nbsp; {r.col2}: {val.col2 || '—'}
                    </td>
                  </tr>
                )
              }
              if (values[includeKey(r.id)] !== 'yes') return null
              return (
                <tr key={r.id}>
                  <td className="border border-slate-300 px-2 py-1">{r.label}</td>
                  <td className="border border-slate-300 px-2 py-1 font-semibold">{(values[r.id] as string) || ''}</td>
                  {template.hasUnit && <td className="border border-slate-300 px-2 py-1">{r.unit || ''}</td>}
                  {template.hasRange && <td className="border border-slate-300 px-2 py-1">{r.range || ''}</td>}
                  <td className="border border-slate-300 px-2 py-1">{(values[remarkKey(r.id)] as string) ?? r.remark ?? ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {(template.footnotes || (template.hasConfirmationNote && values.confirmation_needed === 'yes')) && (
          <div className="text-xs italic text-slate-600 mb-6">
            {template.footnotes?.map((f) => <div key={f}>{f}</div>)}
            {template.hasConfirmationNote && values.confirmation_needed === 'yes' && <div>Confirmation will be necessary.</div>}
          </div>
        )}
        <div className="flex justify-end mt-10 text-sm">
          <div>_____________________<br />Consultant Pathologist</div>
        </div>
        <div className="text-center text-xs font-medium text-slate-600 mt-auto pt-8">
          ဓာတ်ခွဲခန်းအဖြေများကိုသက်ဆိုင်ရာဆရာဝန်များနှင့်သာမေးမြန်းဆွေးနွေးပါရန်
        </div>
      </div>
    </>
  )
}
