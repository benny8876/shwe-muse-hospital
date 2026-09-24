import { useCallback, useEffect, useRef, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import Tabs from '../../components/Tabs'
import StatusBadge from '../../components/StatusBadge'
import ResultSlip from '../../components/ResultSlip'
import Alert from '../../components/Alert'
import SelectableCard from '../../components/SelectableCard'
import { formatDate } from '../../lib/format'
import RichTextEditor, { type RichTextEditorHandle } from '../../components/RichTextEditor'
import { parseRadiologyFindings, serializeRadiologyFindings, XRAY_QUICK_SNIPPETS } from '../../lib/radiologyReport'

type ActivePatient = {
  patient_id: number
  name: string
  uhid: string
  invoice_id: number
  invoice_number: string
  invoice_kind?: string
  total: number
  balance: number
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
  const [tab, setTab] = useState<'order' | 'results'>('order')
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
  const editorRef = useRef<RichTextEditorHandle>(null)
  const [busy, setBusy] = useState(false)

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
    api.get('/counter/xray-items').then((r) => setXrayItems(r.data)).catch((e) => toast.error(getApiError(e)))
    void loadActive()
    void loadOrders()
    const id = setInterval(() => { void loadActive(); void loadOrders() }, 8000)
    return () => clearInterval(id)
  }, [loadActive, loadOrders, toast])

  const pendingOrders = orders.filter((o) => o.status !== 'completed')

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
      || (p.invoice_kind || 'opd').toLowerCase().includes(q)
    )
  })

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
      setInvoice((prev: any) => prev ? { ...prev, total: data.total, balance: data.balance, number: data.invoice_number } : prev)
      await Promise.all([loadActive(), loadOrders()])
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Tabs tabs={[{ id: 'order', label: 'Order X-Ray' }, { id: 'results', label: `Findings (${pendingOrders.length} pending)` }]} active={tab} onChange={(t) => setTab(t as any)} />

      {tab === 'order' && (
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card space-y-3">
          <h3 className="font-semibold text-slate-800">Waiting Patients</h3>
          <p className="text-xs text-slate-500">Reception က register လုပ်ပြီးသား — နှိပ်ပြီး ရွေးပါ</p>
          <input
            className="input"
            placeholder="Search name / ID / bill #"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
          />
          <div className="max-h-72 overflow-auto space-y-2">
            {activePatients.length === 0 && (
              <div className="text-slate-500 text-sm py-4 text-center border rounded-lg">No open bills yet</div>
            )}
            {activePatients.length > 0 && filteredPatients.length === 0 && (
              <div className="text-slate-500 text-sm py-4 text-center border rounded-lg">No match for &quot;{listQuery}&quot;</div>
            )}
            {filteredPatients.map((p) => (
              <SelectableCard key={p.invoice_id} selected={patient?.invoice_id === p.invoice_id} onClick={() => selectPatient(p)}>
                <div className="font-semibold flex items-center gap-2">
                  {p.name}
                  <StatusBadge value={(p.invoice_kind || 'opd').toUpperCase()} />
                </div>
                <div className="text-xs text-slate-600">{p.uhid} · {p.invoice_number}</div>
              </SelectableCard>
            ))}
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-slate-600">Search other patient</summary>
            <div className="flex gap-2 mt-2">
              <input className="input" placeholder="ID / Name" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
              <button type="button" className="btn btn-secondary" onClick={search}>Go</button>
            </div>
            <div className="mt-2 space-y-1 max-h-32 overflow-auto">
              {searchResults.map((p) => (
                <button type="button" key={p.id} className="w-full text-left border rounded p-2 text-sm" onClick={() => {
                  const match = activePatients.find((a) => a.patient_id === p.id)
                  if (match) void selectPatient(match)
                  else toast.error('No open bill — Reception first')
                }}>
                  {p.name} · {p.uhid}
                </button>
              ))}
            </div>
          </details>

          {patient && invoice && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm">
              <div className="font-medium flex items-center gap-2">
                {patient.name}
                <StatusBadge value={(patient.invoice_kind || invoice.kind || 'opd').toUpperCase()} />
              </div>
              Bill: {invoice.number}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-3">
          {!patient && (
            <Alert tone="warning">
              ↑ လူနာ <strong>ရွေးပါ</strong> — ပြီးမှ X-ray type နှိပ်နိုင်ပါမယ်
            </Alert>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {xrayItems.map((item) => (
              <SelectableCard key={item.id} variant="tile" className={`min-h-[120px] ${!patient ? 'opacity-60' : ''}`} disabled={busy} onClick={() => orderXray(item)}>
                <div className="font-semibold text-lg">{item.name}</div>
                <div className="text-sm text-slate-500">{item.sku || 'Tap to add to bill'}</div>
              </SelectableCard>
            ))}
          </div>
          {!xrayItems.length && <div className="card text-slate-500">No X-ray services configured</div>}
        </div>
      </div>
      )}

      {tab === 'results' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="card space-y-2">
            <h3 className="font-semibold text-slate-800">Orders</h3>
            <div className="max-h-96 overflow-auto space-y-2">
              {orders.length === 0 && <div className="text-slate-500 text-sm py-4 text-center border rounded-lg">No X-ray orders yet</div>}
              {orders.map((o) => (
                <SelectableCard key={o.order_id} selected={selectedOrder?.order_id === o.order_id} onClick={() => {
                  setSelectedOrder(o)
                  const parsed = parseRadiologyFindings(o.findings)
                  setResultText(parsed.body)
                  setExamType(parsed.examType)
                  setImpression(parsed.impression)
                  setReporterName(parsed.reporterName)
                }}>
                  <div className="font-semibold flex items-center gap-2">{o.patient_name} <StatusBadge value={o.status} /></div>
                  <div className="text-xs text-slate-600">{o.uhid}</div>
                  <div className="text-xs text-slate-400">{formatDate(o.created_at || '')}</div>
                </SelectableCard>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 card space-y-3 no-print">
            {!selectedOrder ? (
              <p className="text-slate-500">Order list ကနေ ရွေးပါ</p>
            ) : (
              <>
                <h3 className="font-semibold">{selectedOrder.patient_name}</h3>
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
                <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={submitFindings}>Save Findings</button>
              </>
            )}
          </div>
          {selectedOrder && (
            <div className="lg:col-span-3">
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
