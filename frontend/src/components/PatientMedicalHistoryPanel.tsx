import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { getApiError } from '../lib/api'
import { useToast } from '../lib/toast'
import { formatAge, formatDate } from '../lib/format'
import PatientSelect from './PatientSelect'
import StatusBadge from './StatusBadge'
import Modal from './Modal'
import DataTable from './DataTable'
import LabReportView from './LabReportView'
import RadiologyReportView from './RadiologyReportView'

type TreatmentGroup = {
  category: string
  label: string
  items: { description: string; qty: number; source?: string }[]
}

type LabOrderSummary = { order_id: number; tests: string; status: string }
type RadiologyOrderSummary = { order_id: number; modality: string; status: string }

type VisitRecord = {
  invoice_id: number
  bill_number: string
  visit_date: string | null
  type: string
  status: string
  doctor_name: string
  treatments: TreatmentGroup[]
  radiology_findings: string
  lab_orders?: LabOrderSummary[]
  radiology_orders?: RadiologyOrderSummary[]
}

type ClinicalNote = {
  date: string | null
  doctor_name: string
  chief_complaint: string
  diagnosis: string
  notes: string
}

type MedicalHistory = {
  patient: {
    name: string
    uhid: string
    father_name?: string
    phone?: string
    gender?: string
    age_years?: number | null
    age_months?: number | null
    age_days?: number | null
    address?: string
    allergies?: string
  }
  visits: VisitRecord[]
  clinical_notes: ClinicalNote[]
}

export default function PatientMedicalHistoryPanel({
  branchId,
  initialPatientId = '',
  showRegisterVisit = false,
}: {
  branchId: number
  initialPatientId?: string
  showRegisterVisit?: boolean
}) {
  const toast = useToast()
  const [patientId, setPatientId] = useState(initialPatientId)
  const [data, setData] = useState<MedicalHistory | null>(null)
  const [busy, setBusy] = useState(false)
  const [expandedVisit, setExpandedVisit] = useState<number | null>(null)
  const [viewingLabOrderId, setViewingLabOrderId] = useState<number | null>(null)
  const [viewingRadiologyOrderId, setViewingRadiologyOrderId] = useState<number | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ date_from: '', date_to: '', kind: '', source: '', q: '' })
  const [results, setResults] = useState<any[] | null>(null)
  const [searchBusy, setSearchBusy] = useState(false)
  const [visitFilter, setVisitFilter] = useState({ date_from: '', date_to: '', source: '', q: '' })
  const [resultsView, setResultsView] = useState<'open' | 'collapsed'>('open')
  const detailRef = useRef<HTMLDivElement>(null)
  const scrollToDetailAfterLoad = useRef(false)

  function selectPatient(id: string, collapseResults = false) {
    setPatientId(id)
    if (!id) return
    if (collapseResults || results?.length) {
      setResultsView('collapsed')
      scrollToDetailAfterLoad.current = true
    }
  }

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId)
  }, [initialPatientId])

  useEffect(() => {
    if (!patientId) {
      setData(null)
      setExpandedVisit(null)
      return
    }
    setBusy(true)
    api.get('/counter/patient-medical-history', { params: { patient_id: patientId, branch_id: branchId } })
      .then((r) => {
        setData(r.data)
        setExpandedVisit(r.data.visits[0]?.invoice_id ?? null)
      })
      .catch((e) => toast.error(getApiError(e)))
      .finally(() => setBusy(false))
  }, [patientId, branchId, toast])

  useEffect(() => {
    if (busy || !data || !scrollToDetailAfterLoad.current) return
    scrollToDetailAfterLoad.current = false
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [busy, data])

  async function runAdvancedSearch() {
    if (!filters.date_from && !filters.date_to && !filters.kind && !filters.source && !filters.q.trim()) {
      toast.error('ရက်စွဲ၊ အမျိုးအစား၊ သို့မဟုတ် ခေါင်းစဉ် တစ်ခုထည့်ပါ')
      return
    }
    setSearchBusy(true)
    try {
      const { data: rows } = await api.get('/counter/patient-records/search', {
        params: {
          branch_id: branchId,
          date_from: filters.date_from,
          date_to: filters.date_to,
          kind: filters.kind,
          source: filters.source,
          q: filters.q.trim(),
        },
      })
      setResults(rows)
      setResultsView('open')
      if (!rows.length) toast.error('ကိုက်ညီတဲ့ လူနာ မတွေ့ပါ')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setSearchBusy(false)
    }
  }

  const visibleVisits = (data?.visits || []).filter((visit) => {
    const day = (visit.visit_date || '').slice(0, 10)
    if (visitFilter.date_from && day && day < visitFilter.date_from) return false
    if (visitFilter.date_to && day && day > visitFilter.date_to) return false
    const q = visitFilter.q.trim().toLowerCase()
    const texts = visit.treatments.flatMap((g) => [g.label, ...g.items.map((i) => i.description)])
    const labNames = (visit.lab_orders || []).map((o) => o.tests)
    if (visitFilter.source) {
      const hit = visit.treatments.some((g) => g.category === visitFilter.source)
        || (visitFilter.source === 'xray' && (visit.radiology_orders || []).some((o) => o.modality === 'xray'))
        || (visitFilter.source === 'usg' && (visit.radiology_orders || []).some((o) => o.modality === 'usg'))
      if (!hit) return false
    }
    if (q && ![...texts, ...labNames, visit.doctor_name, visit.bill_number].some((t) => String(t || '').toLowerCase().includes(q))) {
      return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold text-slate-800">Search Patient</h3>
        <p className="text-xs text-slate-500">ID၊ အမည်၊ အဖအမည်၊ ဖုန်းနံပါတ်နဲ့ ရှာပြီး လူနာရဲ့ medical history ကြည့်ပါ</p>
        <PatientSelect className="input" value={patientId} onChange={(id) => selectPatient(id, false)} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFiltersOpen((v) => !v)}>
          {filtersOpen ? 'Hide advanced filters' : 'Advanced filters'}
        </button>
        {filtersOpen && (
          <div className="space-y-3 border-t border-slate-200 pt-3">
            <p className="text-xs text-slate-500">ရက်စွဲ၊ visit အမျိုးအစား၊ lab / ဆေး / x-ray ခေါင်းစဉ်နဲ့ လူနာစာရင်း ရှာပါ။ အပေါ်က ID ရှာတာ အတိုင်း ဆက်သုံးနိုင်ပါတယ်။</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <label className="text-xs text-slate-500">From
                <input className="input" type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
              </label>
              <label className="text-xs text-slate-500">To
                <input className="input" type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
              </label>
              <label className="text-xs text-slate-500">Visit type
                <select className="input" value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}>
                  <option value="">Any</option>
                  <option value="opd">OPD</option>
                  <option value="ipd">IPD</option>
                  <option value="pos">Pharmacy walk-in</option>
                  <option value="lab">Lab</option>
                </select>
              </label>
              <label className="text-xs text-slate-500">Service
                <select className="input" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
                  <option value="">Any</option>
                  <option value="lab">Lab test</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="xray">X-ray</option>
                  <option value="usg">USG</option>
                  <option value="opd">Consultation</option>
                </select>
              </label>
              <label className="text-xs text-slate-500 sm:col-span-2">Test / medicine / exam name
                <input className="input" placeholder="e.g. CBC, Paracetamol, Chest X-Ray" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
              </label>
            </div>
            <button type="button" disabled={searchBusy} className="btn btn-primary btn-sm" onClick={runAdvancedSearch}>
              {searchBusy ? 'Searching...' : 'Search patients'}
            </button>
          </div>
        )}
      </div>

      {results && resultsView === 'collapsed' && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResultsView('open')}>
            ← Back to filter results ({results.length})
          </button>
          {patientId && data && (
            <span className="text-sm text-slate-600">
              Viewing <strong>{data.patient.name}</strong> ({data.patient.uhid})
            </span>
          )}
        </div>
      )}

      {results && resultsView === 'open' && (
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-800">Filter results ({results.length})</h3>
            <p className="text-xs text-slate-500">Row နှိပ်ပါ သို့မဟုတ် View — ရှာဖွေစာရင်း ပိတ်ပြီး မှတ်တမ်း အပေါ်သို့ ရောက်ပါမယ်</p>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            <DataTable
              rows={results}
              keyField="patient_id"
              wrapperClassName="border-0 shadow-none rounded-none"
              onRowClick={(r) => selectPatient(String(r.patient_id), true)}
              isRowSelected={(r) => patientId === String(r.patient_id)}
              columns={[
                { key: 'name', label: 'Patient', render: (r) => String(r.name) },
                { key: 'uhid', label: 'ID', render: (r) => String(r.uhid) },
                { key: 'phone', label: 'Phone', render: (r) => String(r.phone || '—') },
                { key: 'last', label: 'Last match', render: (r) => formatDate(r.last_visit) },
                { key: 'n', label: 'Visits', render: (r) => String(r.match_count) },
                { key: 'matches', label: 'Matched', render: (r) => (r.matches || []).join(', ') || '—' },
                { key: 'act', label: '', render: (r) => (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      selectPatient(String(r.patient_id), true)
                    }}
                  >
                    View
                  </button>
                ) },
              ]}
              emptyText="No matching patients"
            />
          </div>
        </div>
      )}

      <div ref={detailRef} className="scroll-mt-4 space-y-4">
      {patientId && busy && (
        <div className="card text-center text-slate-500 py-8">Loading medical history...</div>
      )}

      {patientId && !busy && data && (
        <>
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-[var(--brand-600)]">{data.patient.name}</h3>
                <StatusBadge value={data.patient.uhid} />
              </div>
              {showRegisterVisit && (
                <Link
                  to={`/counter/reception?patient_id=${patientId}`}
                  className="btn btn-primary btn-sm"
                >
                  Register Visit →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
              <div><span className="text-slate-500">Father:</span> <strong>{data.patient.father_name || '—'}</strong></div>
              <div><span className="text-slate-500">Age:</span> <strong>{formatAge(data.patient.age_years, data.patient.age_months, data.patient.age_days)}</strong></div>
              <div><span className="text-slate-500">Gender:</span> <strong>{data.patient.gender || '—'}</strong></div>
              <div><span className="text-slate-500">Phone:</span> <strong>{data.patient.phone || '—'}</strong></div>
              {data.patient.allergies && (
                <div className="col-span-2 sm:col-span-4">
                  <span className="text-slate-500">Allergies:</span>{' '}
                  <strong className="text-[var(--status-danger-fg)]">{data.patient.allergies}</strong>
                </div>
              )}
            </div>
          </div>

          {data.clinical_notes.length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-slate-800">Clinical Notes</h3>
              {data.clinical_notes.map((note, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{formatDate(note.date)}</span>
                    {note.doctor_name && <span>· Dr. {note.doctor_name}</span>}
                  </div>
                  {note.chief_complaint && <div><span className="text-slate-500">Complaint:</span> {note.chief_complaint}</div>}
                  {note.diagnosis && <div><span className="text-slate-500">Diagnosis:</span> <strong>{note.diagnosis}</strong></div>}
                  {note.notes && <div><span className="text-slate-500">Notes:</span> {note.notes}</div>}
                </div>
              ))}
            </div>
          )}

          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-800">Visit History ({visibleVisits.length}{visibleVisits.length !== data.visits.length ? ` / ${data.visits.length}` : ''})</h3>
            {data.visits.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <input className="input" type="date" value={visitFilter.date_from} onChange={(e) => setVisitFilter({ ...visitFilter, date_from: e.target.value })} />
                <input className="input" type="date" value={visitFilter.date_to} onChange={(e) => setVisitFilter({ ...visitFilter, date_to: e.target.value })} />
                <select className="input" value={visitFilter.source} onChange={(e) => setVisitFilter({ ...visitFilter, source: e.target.value })}>
                  <option value="">All services</option>
                  <option value="lab">Lab</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="xray">X-ray</option>
                  <option value="usg">USG</option>
                  <option value="opd">Consultation</option>
                </select>
                <input className="input" placeholder="Filter this history..." value={visitFilter.q} onChange={(e) => setVisitFilter({ ...visitFilter, q: e.target.value })} />
              </div>
            )}
            {data.visits.length === 0 ? (
              <p className="text-sm text-slate-500">Visit မှတ်တမ်း မရှိသေးပါ</p>
            ) : visibleVisits.length === 0 ? (
              <p className="text-sm text-slate-500">Filter နဲ့ ကိုက်ညီတဲ့ visit မရှိပါ</p>
            ) : (
              <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
                {visibleVisits.map((visit) => {
                  const open = expandedVisit === visit.invoice_id
                  return (
                    <div key={visit.invoice_id} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-[var(--brand-50)] flex flex-wrap items-center gap-2 justify-between"
                        onClick={() => setExpandedVisit(open ? null : visit.invoice_id)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{formatDate(visit.visit_date)}</span>
                          <StatusBadge value={visit.type.toUpperCase()} />
                          <span className="text-sm text-slate-600">Bill {visit.bill_number}</span>
                          {visit.doctor_name && <span className="text-sm text-slate-500">· Dr. {visit.doctor_name}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge value={visit.status} />
                          <span className="text-slate-400">{open ? '▲' : '▼'}</span>
                        </div>
                      </button>
                      {open && (
                        <div className="px-4 py-3 space-y-3 text-sm border-t border-slate-200">
                          {visit.treatments.length === 0 ? (
                            <p className="text-slate-500">ကုသမှု မှတ်တမ်း မရှိပါ</p>
                          ) : (
                            visit.treatments.map((group) => {
                              const labQueue: Record<string, number[]> = {}
                              for (const o of visit.lab_orders || []) (labQueue[o.tests] ||= []).push(o.order_id)
                              const radiologyQueue: Record<string, number[]> = {}
                              for (const o of visit.radiology_orders || []) (radiologyQueue[o.modality] ||= []).push(o.order_id)
                              return (
                              <div key={group.category}>
                                <div className="font-medium text-[var(--brand-600)] mb-1">{group.label}</div>
                                <ul className="space-y-1 pl-1">
                                  {group.items.map((item, i) => {
                                    const labOrderId = item.source === 'lab' ? labQueue[item.description]?.shift() : undefined
                                    const radiologyOrderId = item.source === 'xray' || item.source === 'usg' ? radiologyQueue[item.source]?.shift() : undefined
                                    return (
                                    <li key={i} className="flex justify-between gap-3 text-slate-700">
                                      {labOrderId ? (
                                        <button type="button" className="text-left text-[var(--brand-600)] hover:underline" onClick={() => setViewingLabOrderId(labOrderId)}>
                                          {item.description}
                                        </button>
                                      ) : radiologyOrderId ? (
                                        <button type="button" className="text-left text-[var(--brand-600)] hover:underline" onClick={() => setViewingRadiologyOrderId(radiologyOrderId)}>
                                          {item.description}
                                        </button>
                                      ) : (
                                        <span>{item.description}</span>
                                      )}
                                      <span className="text-slate-500 shrink-0">×{item.qty}</span>
                                    </li>
                                    )
                                  })}
                                </ul>
                              </div>
                              )
                            })
                          )}
                          {visit.radiology_findings && (
                            <div className="border-t border-slate-100 pt-2">
                              <div className="font-medium text-slate-700 mb-1">X-ray / Radiology Findings</div>
                              <p className="text-slate-600 whitespace-pre-wrap">{visit.radiology_findings}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
      </div>

      {!patientId && !results && (
        <div className="card text-sm text-slate-500">လူနာတစ်ယောက် ရွေးပြီးရင် visit history ပြမယ်</div>
      )}

      {viewingLabOrderId !== null && (
        <Modal title="Lab Report" onClose={() => setViewingLabOrderId(null)} maxWidth="max-w-4xl">
          <div className="max-h-[80vh] overflow-y-auto">
            <LabReportView orderId={viewingLabOrderId} />
          </div>
        </Modal>
      )}
      {viewingRadiologyOrderId !== null && (
        <Modal title="Radiology Report" onClose={() => setViewingRadiologyOrderId(null)} maxWidth="max-w-4xl">
          <div className="max-h-[80vh] overflow-y-auto">
            <RadiologyReportView orderId={viewingRadiologyOrderId} />
          </div>
        </Modal>
      )}
    </div>
  )
}
