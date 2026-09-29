import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import Tabs from '../../components/Tabs'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ResultSlip from '../../components/ResultSlip'
import RadiologyReportView from '../../components/RadiologyReportView'
import Alert from '../../components/Alert'
import Modal from '../../components/Modal'
import { formatDate } from '../../lib/format'
import RichTextEditor, { type RichTextEditorHandle } from '../../components/RichTextEditor'
import { parseRadiologyFindings, serializeRadiologyFindings, XRAY_QUICK_SNIPPETS } from '../../lib/radiologyReport'

type ActivePatient = {
  patient_id: number
  name: string
  uhid: string
  phone?: string
  invoice_id: number
  invoice_number: string
  invoice_kind?: string
  total?: number
  balance?: number
}

function localISODate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return localISODate(d)
}

type RadiologyOrderRow = {
  order_id: number
  patient_id: number
  patient_name: string
  uhid: string
  modality: string
  findings: string
  status: string
  created_at: string | null
}

export default function XrayCounterPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const [tab, setTab] = useState<'order' | 'results' | 'history'>('order')
  const [listQuery, setListQuery] = useState('')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [activePatients, setActivePatients] = useState<ActivePatient[]>([])
  const [patient, setPatient] = useState<ActivePatient | null>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [xrayItems, setXrayItems] = useState<any[]>([])
  const [orders, setOrders] = useState<RadiologyOrderRow[]>([])
  const [resultText, setResultText] = useState('')
  const [examType, setExamType] = useState('')
  const [impression, setImpression] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<RadiologyOrderRow | null>(null)
  const [resultPatient, setResultPatient] = useState<{ patient_id: number; name: string; uhid: string } | null>(null)
  const [resultQuery, setResultQuery] = useState('')
  const [resultSearchResults, setResultSearchResults] = useState<any[]>([])
  const [resultListQuery, setResultListQuery] = useState('')
  const editorRef = useRef<RichTextEditorHandle>(null)
  const [busy, setBusy] = useState(false)
  const [historyFilters, setHistoryFilters] = useState({
    date_from: daysAgoISO(30),
    date_to: localISODate(new Date()),
    status: 'all',
    exam: '',
    q: '',
  })
  const [history, setHistory] = useState<(RadiologyOrderRow & { exam_name: string })[]>([])
  const [historyOrderId, setHistoryOrderId] = useState<number | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/counter/xray/history', {
        params: { branch_id: branchId, ...historyFilters },
      })
      setHistory(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, historyFilters, toast])

  const loadOrders = useCallback(async () => {
    try {
      const { data } = await api.get('/counter/radiology-orders', { params: { branch_id: branchId, modality: 'xray', status: 'all' } })
      setOrders(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  const loadActive = useCallback(async () => {
    try {
      const { data } = await api.get('/counter/active-patients', { params: { branch_id: branchId } })
      setActivePatients(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  useEffect(() => {
    if (tab === 'history') void loadHistory()
    // Open the tab with the current filters. Later edits wait for Search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    api.get('/counter/xray-items').then((r) => setXrayItems(r.data)).catch((e) => toast.error(getApiError(e)))
    void loadActive()
    void loadOrders()
    const id = setInterval(() => { void loadActive(); void loadOrders() }, 8000)
    return () => clearInterval(id)
  }, [loadActive, loadOrders, toast])

  const pendingOrders = orders.filter((o) => o.status !== 'completed')

  function applyFindings(o: RadiologyOrderRow) {
    setSelectedOrder(o)
    const parsed = parseRadiologyFindings(o.findings)
    setResultText(parsed.body)
    setExamType(parsed.examType)
    setImpression(parsed.impression)
    setReporterName(parsed.reporterName)
  }

  async function submitFindings() {
    if (!selectedOrder) return
    setBusy(true)
    try {
      const findings = serializeRadiologyFindings({ examType, body: resultText, impression, reporterName })
      await api.patch(`/counter/radiology/${selectedOrder.order_id}/result`, { order_id: selectedOrder.order_id, findings })
      toast.success('Findings saved')
      await loadOrders()
      setSelectedOrder((prev) => (prev ? { ...prev, findings, status: 'completed' } : prev))
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function selectPatient(p: ActivePatient) {
    setPatient(p)
    setBusy(true)
    try {
      const { data } = await api.get(`/counter/patient/${p.patient_id}/invoice`, { params: { branch_id: branchId } })
      setInvoice(data)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function search() {
    if (!query.trim()) return
    setBusy(true)
    try {
      const { data } = await api.get('/patients', { params: { q: query } })
      setSearchResults(data)
      if (!data.length) toast.error('Patient not found')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  const filteredPatients = activePatients.filter((p) => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q)
      || p.uhid.toLowerCase().includes(q)
      || p.invoice_number.toLowerCase().includes(q)
      || (p.phone || '').toLowerCase().includes(q)
      || (p.invoice_kind || 'opd').toLowerCase().includes(q)
    )
  })

  const currentOrderLines = (invoice?.lines || []).filter((l: any) => l.source === 'radiology')

  const patientsWithOrders = useMemo(() => {
    const seen = new Map<number, { patient_id: number; name: string; uhid: string }>()
    for (const o of orders) {
      if (!seen.has(o.patient_id)) seen.set(o.patient_id, { patient_id: o.patient_id, name: o.patient_name, uhid: o.uhid })
    }
    return Array.from(seen.values())
  }, [orders])

  const filteredResultPatients = patientsWithOrders.filter((p) => {
    const q = resultListQuery.trim().toLowerCase()
    if (!q) return true
    return p.name.toLowerCase().includes(q) || p.uhid.toLowerCase().includes(q)
  })

  const patientOrders = resultPatient ? orders.filter((o) => o.patient_id === resultPatient.patient_id) : []

  async function orderXray(item: any) {
    if (!patient) {
      toast.error('လူနာ ရွေးပါ — ဘယ်ဘက် list ကနေ နှိပ်ပါ')
      return
    }
    setBusy(true)
    try {
      const { data } = await api.post('/counter/xray', {
        branch_id: branchId,
        patient_id: patient.patient_id,
        item_id: item.id,
      })
      toast.success(`${data.item_name} added to bill`)
      if (patient) {
        const fresh = await api.get(`/counter/patient/${patient.patient_id}/invoice`, { params: { branch_id: branchId } })
        setInvoice(fresh.data)
      }
      await Promise.all([loadActive(), loadOrders()])
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function selectFromSearch(p: any) {
    const match = activePatients.find((a) => a.patient_id === p.id)
    if (match) {
      await selectPatient(match)
      return
    }
    setBusy(true)
    try {
      const { data } = await api.get(`/counter/patient/${p.id}/invoice`, { params: { branch_id: branchId } })
      if (!data) {
        toast.error('No open bill — send to Reception first')
        return
      }
      const row: ActivePatient = {
        patient_id: p.id,
        name: p.name,
        uhid: p.uhid,
        phone: p.phone,
        invoice_id: data.id,
        invoice_number: data.number,
        invoice_kind: data.kind,
        total: data.total,
        balance: data.balance,
      }
      setPatient(row)
      setInvoice(data)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  function changePatient() {
    setPatient(null)
    setInvoice(null)
    setQuery('')
    setSearchResults([])
  }

  async function searchResultPatient() {
    if (!resultQuery.trim()) return
    setBusy(true)
    try {
      const { data } = await api.get('/patients', { params: { q: resultQuery } })
      setResultSearchResults(data)
      if (!data.length) toast.error('Patient not found')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  function pickResultPatient(p: { patient_id?: number; id?: number; name: string; uhid: string }) {
    const patientId = p.patient_id ?? p.id!
    setResultPatient({ patient_id: patientId, name: p.name, uhid: p.uhid })
    setResultQuery('')
    setResultSearchResults([])
    const matches = orders.filter((o) => o.patient_id === patientId)
    const first = matches.find((o) => o.status !== 'completed') ?? matches[0]
    if (first) applyFindings(first)
    else setSelectedOrder(null)
  }

  function changeResultPatient() {
    setResultPatient(null)
    setSelectedOrder(null)
    setResultQuery('')
    setResultSearchResults([])
  }

  return (
    <div>
      <Tabs tabs={[
        { id: 'order', label: 'Order X-Ray' },
        { id: 'results', label: `Findings (${pendingOrders.length} pending)` },
        { id: 'history', label: 'History' },
      ]} active={tab} onChange={(t) => setTab(t as 'order' | 'results' | 'history')} />

      {tab === 'order' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            {patient ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center font-semibold text-sm">
                    {patient.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                      {patient.name} <span className="text-slate-500 font-normal">· {patient.uhid}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      Bill {invoice?.number || patient.invoice_number}
                      <StatusBadge value={(patient.invoice_kind || invoice?.kind || 'opd').toUpperCase()} />
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={changePatient}>Change patient</button>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-slate-800">Patient Select</h3>
                <div className="flex gap-2">
                  <input className="input" placeholder="Search name / ID / father / phone" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
                  <button type="button" disabled={busy} className="btn btn-secondary btn-sm shrink-0" onClick={search}>Go</button>
                </div>
                {searchResults.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                    {searchResults.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        className="rounded-full border border-slate-300 px-3 py-1.5 text-sm hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)] cursor-pointer"
                        onClick={() => selectFromSearch(p)}
                      >
                        {p.name} · {p.uhid}
                      </button>
                    ))}
                  </div>
                )}
                <input className="input" placeholder="Filter waiting patients..." value={listQuery} onChange={(e) => setListQuery(e.target.value)} />
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {activePatients.length === 0 && <div className="text-slate-500 text-sm py-2">No open bills yet — register at Reception first</div>}
                  {activePatients.length > 0 && filteredPatients.length === 0 && <div className="text-slate-500 text-sm py-2">No match for &quot;{listQuery}&quot;</div>}
                  {filteredPatients.map((p) => (
                    <button
                      type="button"
                      key={p.invoice_id}
                      onClick={() => selectPatient(p)}
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-sm cursor-pointer transition-colors hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)]"
                    >
                      {p.name} <span className="opacity-70">· {p.uhid}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-800">Add X-Ray</h3>
            {!patient && <Alert tone="warning">↑ လူနာကို <strong>ရွေးပါ</strong></Alert>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {xrayItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={!patient || busy}
                  className={`rounded-lg border px-2.5 py-2 text-left text-xs leading-snug transition-colors ${
                    patient
                      ? 'border-slate-300 hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)] cursor-pointer'
                      : 'border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  onClick={() => orderXray(item)}
                >
                  {item.name}
                </button>
              ))}
            </div>
            {!xrayItems.length && <div className="text-slate-500 text-sm">No X-ray services configured</div>}
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-800">Current Order{patient ? ` — ${patient.name}` : ''}</h3>
            <DataTable
              rows={currentOrderLines}
              keyField="id"
              columns={[
                { key: 'description', label: 'Exam', render: (r) => String(r.description) },
                { key: 'qty', label: 'Qty', className: 'text-right', render: (r) => String(r.qty) },
                { key: 'status', label: 'Status', render: () => <StatusBadge value="ORDERED" /> },
              ]}
              emptyText={patient ? 'X-ray type နှိပ်ပြီး မှာပါ' : 'လူနာ ရွေးပြီးမှ X-ray order လုပ်နိုင်ပါမယ်'}
            />
          </div>
        </div>
      )}

      {tab === 'results' && (
        <div className="space-y-4">
          <div className="card space-y-3 no-print">
            {resultPatient ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center font-semibold text-sm">
                    {resultPatient.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                      {resultPatient.name} <span className="text-slate-500 font-normal">· {resultPatient.uhid}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {patientOrders.length} X-ray order{patientOrders.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={changeResultPatient}>Change patient</button>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-slate-800">Patient Select</h3>
                <div className="flex gap-2">
                  <input className="input" placeholder="Search name / ID / father / phone" value={resultQuery} onChange={(e) => setResultQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchResultPatient()} />
                  <button type="button" disabled={busy} className="btn btn-secondary btn-sm shrink-0" onClick={searchResultPatient}>Go</button>
                </div>
                {resultSearchResults.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                    {resultSearchResults.map((p) => (
                      <button type="button" key={p.id} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)] cursor-pointer" onClick={() => pickResultPatient(p)}>
                        {p.name} · {p.uhid}
                      </button>
                    ))}
                  </div>
                )}
                <input className="input" placeholder="Filter patients with X-ray orders..." value={resultListQuery} onChange={(e) => setResultListQuery(e.target.value)} />
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {patientsWithOrders.length === 0 && <div className="text-slate-500 text-sm py-2">No X-ray orders yet</div>}
                  {patientsWithOrders.length > 0 && filteredResultPatients.length === 0 && <div className="text-slate-500 text-sm py-2">No match for &quot;{resultListQuery}&quot;</div>}
                  {filteredResultPatients.map((p) => (
                    <button type="button" key={p.patient_id} onClick={() => pickResultPatient(p)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm cursor-pointer transition-colors hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)]">
                      {p.name} <span className="opacity-70">· {p.uhid}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {resultPatient && (
            <div className="card space-y-3 no-print">
              <h3 className="font-semibold text-slate-800">Exams — {resultPatient.name}</h3>
              {patientOrders.length === 0 ? (
                <p className="text-sm text-slate-500">ဒီလူနာအတွက် X-ray order မရှိသေးပါ</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {patientOrders.map((o) => (
                    <button
                      type="button"
                      key={o.order_id}
                      onClick={() => applyFindings(o)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        selectedOrder?.order_id === o.order_id
                          ? 'border-[var(--brand-600)] bg-[var(--brand-50)]'
                          : 'border-slate-300 hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)]'
                      }`}
                    >
                      <div className="font-medium flex items-center gap-2">
                        {o.modality}
                        <StatusBadge value={o.status} />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{formatDate(o.created_at || '')}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!resultPatient && (
            <div className="card no-print"><p className="text-slate-500 text-sm">↑ လူနာကို ရွေးပြီးရင် findings ထည့်နိုင်ပါမယ်</p></div>
          )}

          {selectedOrder && (
            <>
              <div className="card space-y-3 no-print">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">{selectedOrder.modality}</h3>
                  <button type="button" disabled={busy} className="btn btn-primary btn-sm" onClick={submitFindings}>Save Findings</button>
                </div>
                <input className="input" placeholder="Exam type (e.g. Chest PA)" value={examType} onChange={(e) => setExamType(e.target.value)} />
                <div className="flex flex-wrap gap-1.5">
                  {XRAY_QUICK_SNIPPETS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => editorRef.current?.insertHtml(s.snippet)}
                    >
                      + {s.label}
                    </button>
                  ))}
                </div>
                <RichTextEditor
                  key={selectedOrder.order_id}
                  ref={editorRef}
                  initialValue={resultText}
                  onChange={setResultText}
                  placeholder="Findings / description..."
                  minHeightClass="min-h-64"
                />
                <textarea className="input min-h-16" placeholder="Impression (optional)" value={impression} onChange={(e) => setImpression(e.target.value)} />
                <input className="input" placeholder="Reporting doctor name (optional — for signature line)" value={reporterName} onChange={(e) => setReporterName(e.target.value)} />
              </div>
              <ResultSlip
                title="X-Ray Report"
                patientName={selectedOrder.patient_name}
                uhid={selectedOrder.uhid}
                date={selectedOrder.created_at}
                bodyLabel="Findings"
                bodyText={resultText}
                bodyIsHtml
                examType={examType}
                impression={impression}
                reporterName={reporterName}
              />
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="card space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs text-slate-500">
              From
              <input
                className="input mt-1"
                type="date"
                value={historyFilters.date_from}
                onChange={(e) => setHistoryFilters({ ...historyFilters, date_from: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-500">
              To
              <input
                className="input mt-1"
                type="date"
                value={historyFilters.date_to}
                onChange={(e) => setHistoryFilters({ ...historyFilters, date_to: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-500">
              Status
              <select
                className="input mt-1"
                value={historyFilters.status}
                onChange={(e) => setHistoryFilters({ ...historyFilters, status: e.target.value })}
              >
                <option value="all">All</option>
                <option value="ordered">Ordered</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Exam
              <select
                className="input mt-1"
                value={historyFilters.exam}
                onChange={(e) => setHistoryFilters({ ...historyFilters, exam: e.target.value })}
              >
                <option value="">All exams</option>
                {xrayItems.map((item) => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Search
              <input
                className="input mt-1"
                placeholder="Name / ID / exam"
                value={historyFilters.q}
                onChange={(e) => setHistoryFilters({ ...historyFilters, q: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && loadHistory()}
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => loadHistory()}>Search</button>
          </div>
          <DataTable
            rows={history}
            keyField="order_id"
            onRowClick={(row) => setHistoryOrderId(row.order_id)}
            columns={[
              { key: 'date', label: 'Date', render: (r) => formatDate(r.created_at || '') },
              { key: 'patient', label: 'Patient', render: (r) => r.patient_name },
              { key: 'uhid', label: 'ID', render: (r) => r.uhid },
              { key: 'exam', label: 'Exam', render: (r) => r.exam_name },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
            ]}
            emptyText="No X-ray orders match these filters"
          />
        </div>
      )}

      {historyOrderId != null && (
        <Modal title="X-ray report" onClose={() => setHistoryOrderId(null)} maxWidth="max-w-4xl">
          <div className="max-h-[75vh] overflow-auto">
            <RadiologyReportView orderId={historyOrderId} />
          </div>
        </Modal>
      )}
    </div>
  )
}
