import { useCallback, useEffect, useRef, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import Tabs from '../../components/Tabs'
import ResultSlip from '../../components/ResultSlip'
import Alert from '../../components/Alert'
import SelectableCard from '../../components/SelectableCard'
import RichTextEditor, { type RichTextEditorHandle } from '../../components/RichTextEditor'
import { parseRadiologyFindings, serializeRadiologyFindings, USG_QUICK_SNIPPETS } from '../../lib/radiologyReport'

type ActivePatient = {
  patient_id: number
  name: string
  uhid: string
  invoice_id: number
  invoice_number: string
  invoice_kind?: string
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

export default function UsgCounterPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const [tab, setTab] = useState<'order' | 'results' | 'history'>('order')
  const [listQuery, setListQuery] = useState('')
  const [ordersQuery, setOrdersQuery] = useState('')
  const [activePatients, setActivePatients] = useState<ActivePatient[]>([])
  const [patient, setPatient] = useState<ActivePatient | null>(null)
  const [usgItems, setUsgItems] = useState<any[]>([])
  const [orders, setOrders] = useState<RadiologyOrderRow[]>([])
  const [resultText, setResultText] = useState('')
  const [examType, setExamType] = useState('')
  const [impression, setImpression] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<RadiologyOrderRow | null>(null)
  const [busy, setBusy] = useState(false)
  const editorRef = useRef<RichTextEditorHandle>(null)

  const loadActive = useCallback(async () => {
    try {
      const { data } = await api.get('/counter/active-patients', { params: { branch_id: branchId } })
      setActivePatients(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  const loadOrders = useCallback(async () => {
    try {
      const { data } = await api.get('/counter/radiology-orders', { params: { branch_id: branchId, modality: 'usg', status: 'all' } })
      setOrders(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  useEffect(() => {
    api.get('/counter/usg-items').then((r) => setUsgItems(r.data)).catch((e) => toast.error(getApiError(e)))
    void loadActive()
    void loadOrders()
    const id = setInterval(() => { void loadActive(); void loadOrders() }, 8000)
    return () => clearInterval(id)
  }, [loadActive, loadOrders, toast])

  const filteredPatients = activePatients.filter((p) => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return true
    return p.name.toLowerCase().includes(q) || p.uhid.toLowerCase().includes(q) || p.invoice_number.toLowerCase().includes(q)
  })

  const pendingOrders = orders.filter((o) => o.status !== 'completed')
  const completedOrders = orders.filter((o) => o.status === 'completed')
  const filteredOrders = orders.filter((o) => {
    const q = ordersQuery.trim().toLowerCase()
    if (!q) return true
    return o.patient_name.toLowerCase().includes(q) || o.uhid.toLowerCase().includes(q)
  })
  const filteredPendingOrders = filteredOrders.filter((o) => o.status !== 'completed')
  const filteredCompletedOrders = filteredOrders.filter((o) => o.status === 'completed')

  async function orderScan(item: any) {
    if (!patient) {
      toast.error('လူနာ ရွေးပါ')
      return
    }
    setBusy(true)
    try {
      const { data } = await api.post('/counter/usg', { branch_id: branchId, patient_id: patient.patient_id, item_id: item.id })
      toast.success(`${data.item_name} ordered`)
      await Promise.all([loadActive(), loadOrders()])
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function submitResult() {
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

  // Shared by Findings (pending list) and USG History (completed list) — both
  // tabs pick an order from their own list, then show/edit it here.
  const orderDetail = (
    <>
      <div className="card space-y-3 no-print">
        {!selectedOrder ? (
          <p className="text-slate-500">Order list ကနေ ရွေးပါ</p>
        ) : (
          <>
            <h3 className="font-semibold">{selectedOrder.patient_name}</h3>
            <input
              className="input"
              placeholder="Exam type — e.g. Abdomen and Pelvis, Pregnancy (ULTRASOUND (...) ခေါင်းစဉ်ထဲ ဖြည့်မယ်)"
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
            />
            <div className="flex flex-wrap gap-1.5">
              {USG_QUICK_SNIPPETS.map((s) => (
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
            <textarea
              className="input min-h-16"
              placeholder="Impression (optional)"
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
            />
            <input
              className="input"
              placeholder="Reporting doctor name (optional — for signature line)"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
            />
            <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={submitResult}>Save Findings</button>
          </>
        )}
      </div>
      {selectedOrder && (
        <ResultSlip
          title="Ultrasound"
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
      )}
    </>
  )

  // Compact pill list (same look as Patient Select's chips) — a filter box
  // plus the given orders, so Findings only shows pending ones and USG
  // History only shows completed ones instead of one long mixed list.
  function renderOrderList(list: RadiologyOrderRow[]) {
    return (
      <div className="card space-y-3 no-print">
        <h3 className="font-semibold text-slate-800">Orders</h3>
        <input
          className="input"
          placeholder="Filter patient name / ID..."
          value={ordersQuery}
          onChange={(e) => setOrdersQuery(e.target.value)}
        />
        {list.length === 0 && (
          <div className="text-slate-500 text-sm py-4 text-center border rounded-lg">
            {ordersQuery.trim() ? `No match for "${ordersQuery}"` : 'No USG orders yet'}
          </div>
        )}
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {list.map((o) => (
            <button
              type="button"
              key={o.order_id}
              onClick={() => {
                setSelectedOrder(o)
                const parsed = parseRadiologyFindings(o.findings)
                setResultText(parsed.body)
                setExamType(parsed.examType)
                setImpression(parsed.impression)
                setReporterName(parsed.reporterName)
              }}
              className={`rounded-full border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                selectedOrder?.order_id === o.order_id
                  ? 'border-[var(--brand-600)] bg-[var(--brand-50)]'
                  : 'border-slate-300 hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)]'
              }`}
            >
              {o.patient_name} <span className="opacity-70">· {o.uhid}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Tabs
        tabs={[
          { id: 'order', label: 'Order Scan' },
          { id: 'results', label: `Findings (${pendingOrders.length} pending)` },
          { id: 'history', label: `USG History (${completedOrders.length})` },
        ]}
        active={tab}
        onChange={(t) => {
          setTab(t as any)
          setSelectedOrder(null)
        }}
      />

      {tab === 'order' && (
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-800">Waiting Patients</h3>
            <input className="input" placeholder="Search name / ID / bill #" value={listQuery} onChange={(e) => setListQuery(e.target.value)} />
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {filteredPatients.length === 0 && <div className="text-slate-500 text-sm py-2">No open bills</div>}
              {filteredPatients.map((p) => (
                <button
                  type="button"
                  key={p.invoice_id}
                  onClick={() => setPatient(p)}
                  className={`rounded-full border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                    patient?.invoice_id === p.invoice_id
                      ? 'border-[var(--brand-600)] bg-[var(--brand-50)]'
                      : 'border-slate-300 hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)]'
                  }`}
                >
                  {p.name} <span className="opacity-70">· {p.uhid}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-800">Order Scan</h3>
            {!patient && <Alert tone="warning">↑ လူနာ ရွေးပါ — ပြီးမှ scan ရွေးနိုင်ပါမယ်</Alert>}
            <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {usgItems.map((item) => (
                <SelectableCard key={item.id} variant="tile" disabled={busy || !patient} onClick={() => orderScan(item)}>
                  <div className="font-semibold text-sm">{item.name}</div>
                  <div className="text-xs text-slate-500">{item.sku || '—'}</div>
                </SelectableCard>
              ))}
            </div>
            {!usgItems.length && <div className="text-slate-500 text-sm">No USG services configured</div>}
          </div>
        </div>
      )}

      {tab === 'results' && (
        <div className="space-y-4">
          {renderOrderList(filteredPendingOrders)}
          {orderDetail}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {renderOrderList(filteredCompletedOrders)}
          {orderDetail}
        </div>
      )}
    </div>
  )
}
