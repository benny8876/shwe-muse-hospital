import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import Tabs from '../../components/Tabs'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ResultSlip from '../../components/ResultSlip'
import LabTemplateResult, { type LabResultValues } from '../../components/LabTemplateResult'
import LabReportView from '../../components/LabReportView'
import Alert from '../../components/Alert'
import Modal from '../../components/Modal'
import { formatAge, formatDate } from '../../lib/format'
import { findLabTemplate, LAB_TEMPLATES } from '../../lib/labTemplates'

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

type LabOrderRow = {
  order_id: number
  patient_id: number
  patient_name: string
  uhid: string
  tests: string
  result: string
  status: string
  sample_id?: string
  created_at: string | null
}

type CartLine = { item_id: number; name: string; sku: string; qty: number }

function localISODate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return localISODate(d)
}

export default function LabCounterPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const [tab, setTab] = useState<'order' | 'results' | 'history'>('order')
  const [listQuery, setListQuery] = useState('')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [activePatients, setActivePatients] = useState<ActivePatient[]>([])
  const [patient, setPatient] = useState<ActivePatient | null>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [patientDetail, setPatientDetail] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [labItems, setLabItems] = useState<any[]>([])
  const [testQuery, setTestQuery] = useState('')
  const [testHighlight, setTestHighlight] = useState(0)
  const testInputRef = useRef<HTMLInputElement>(null)
  const testRowRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [cart, setCart] = useState<CartLine[]>([])
  const [orders, setOrders] = useState<LabOrderRow[]>([])
  const [resultText, setResultText] = useState('')
  const [templateValues, setTemplateValues] = useState<LabResultValues>({})
  const [selectedOrder, setSelectedOrder] = useState<LabOrderRow | null>(null)
  const [selectedPatientDetail, setSelectedPatientDetail] = useState<any>(null)
  const [resultPatient, setResultPatient] = useState<{ patient_id: number; name: string; uhid: string } | null>(null)
  const [resultQuery, setResultQuery] = useState('')
  const [resultSearchResults, setResultSearchResults] = useState<any[]>([])
  const [resultListQuery, setResultListQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [walkInForm, setWalkInForm] = useState({
    name: '',
    phone: '',
    gender: 'F',
    age_years: '',
    age_months: '',
    age_days: '',
    referring_doctor: '',
  })
  const [historyFilters, setHistoryFilters] = useState({
    date_from: daysAgoISO(30),
    date_to: localISODate(new Date()),
    status: 'all',
    test: '',
    q: '',
  })
  const [history, setHistory] = useState<LabOrderRow[]>([])
  const [historyOrderId, setHistoryOrderId] = useState<number | null>(null)
  const selectedTemplate = selectedOrder ? findLabTemplate(selectedOrder.tests) : undefined

  const loadActive = useCallback(async () => {
    try {
      const { data } = await api.get('/counter/active-patients', { params: { branch_id: branchId } })
      setActivePatients(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/counter/lab/history', {
        params: { branch_id: branchId, ...historyFilters },
      })
      setHistory(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, historyFilters, toast])

  const loadOrders = useCallback(async () => {
    try {
      const { data } = await api.get('/counter/lab-orders', { params: { branch_id: branchId, status: 'all' } })
      setOrders(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  useEffect(() => {
    if (tab === 'history') void loadHistory()
    // Open the tab with the current filters. Later edits wait for Search,
    // so typing in the name box does not fire a request per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    api.get('/counter/lab-items').then((r) => setLabItems(r.data)).catch((e) => toast.error(getApiError(e)))
    void loadActive()
    void loadOrders()
    const id = setInterval(() => { void loadActive(); void loadOrders() }, 8000)
    return () => clearInterval(id)
  }, [loadActive, loadOrders, toast])

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

  const filteredTests = labItems.filter((item) => {
    const q = testQuery.trim().toLowerCase()
    if (!q) return true
    return (
      String(item.name || '').toLowerCase().includes(q)
      || String(item.name_mm || '').toLowerCase().includes(q)
      || String(item.sku || '').toLowerCase().includes(q)
    )
  })
  const visibleTests = filteredTests.slice(0, 12)

  const currentOrderLines = (invoice?.lines || []).filter((l: any) => l.source === 'lab')

  const orderRows = [
    ...cart.map((c) => ({ id: `cart-${c.item_id}`, item_id: c.item_id, description: c.name, qty: c.qty, status: 'pending' as const })),
    ...currentOrderLines.map((l: any) => ({ id: `line-${l.id}`, item_id: null, description: l.description, qty: l.qty, status: 'ordered' as const })),
  ]

  const pendingOrders = orders.filter((o) => o.status !== 'completed')

  const patientsWithOrders = useMemo(() => {
    const seen = new Map<number, { patient_id: number; name: string; uhid: string }>()
    for (const o of orders) {
      if (!seen.has(o.patient_id)) {
        seen.set(o.patient_id, { patient_id: o.patient_id, name: o.patient_name, uhid: o.uhid })
      }
    }
    return Array.from(seen.values())
  }, [orders])

  const filteredResultPatients = patientsWithOrders.filter((p) => {
    const q = resultListQuery.trim().toLowerCase()
    if (!q) return true
    return p.name.toLowerCase().includes(q) || p.uhid.toLowerCase().includes(q)
  })

  const patientOrders = resultPatient
    ? orders.filter((o) => o.patient_id === resultPatient.patient_id)
    : []

  async function selectPatient(p: ActivePatient) {
    setPatient(p)
    setCart([])
    setBusy(true)
    try {
      const [invoiceRes, detailRes] = await Promise.all([
        api.get(`/counter/patient/${p.patient_id}/invoice`, { params: { branch_id: branchId, invoice_id: p.invoice_id } }),
        api.get(`/patients/${p.patient_id}`).catch(() => null),
      ])
      setInvoice(invoiceRes.data)
      setPatientDetail(detailRes?.data || null)
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
      setCart([])
      api.get(`/patients/${p.id}`).then((r) => setPatientDetail(r.data)).catch(() => setPatientDetail(null))
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  function changePatient() {
    setPatient(null)
    setInvoice(null)
    setPatientDetail(null)
    setCart([])
    setQuery('')
    setSearchResults([])
  }

  function addToCart(item: any) {
    if (!patient) {
      toast.error('လူနာ ရွေးပါ')
      return
    }
    const itemId = Number(item.id)
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item_id === itemId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [...prev, { item_id: itemId, name: item.name, sku: item.sku || '', qty: 1 }]
    })
    setTestQuery('')
    setTestHighlight(0)
    testInputRef.current?.focus()
  }

  function updateCartQty(itemId: number, delta: number) {
    setCart((prev) => prev.map((c) => (c.item_id === itemId ? { ...c, qty: Math.max(1, c.qty + delta) } : c)))
  }

  function setCartQty(itemId: number, value: string) {
    const qty = Math.max(1, Number(value) || 1)
    setCart((prev) => prev.map((c) => (c.item_id === itemId ? { ...c, qty } : c)))
  }

  function removeFromCart(itemId: number) {
    setCart((prev) => prev.filter((c) => c.item_id !== itemId))
  }

  async function submitWalkIn() {
    if (!walkInForm.name.trim()) return toast.error('နာမည် ထည့်ပါ')
    const months = walkInForm.age_months === '' ? null : Number(walkInForm.age_months)
    const days = walkInForm.age_days === '' ? null : Number(walkInForm.age_days)
    const years = walkInForm.age_years === '' ? (months != null || days != null ? 0 : null) : Number(walkInForm.age_years)
    setBusy(true)
    try {
      const { data } = await api.post('/counter/lab/walk-in', {
        branch_id: branchId,
        name: walkInForm.name.trim(),
        phone: walkInForm.phone.trim(),
        gender: walkInForm.gender,
        age_years: years,
        age_months: months,
        age_days: days,
        referring_doctor: walkInForm.referring_doctor.trim(),
      })
      toast.success(`Walk-in patient created — ${data.uhid}`)
      setWalkInOpen(false)
      setWalkInForm({ name: '', phone: '', gender: 'F', age_years: '', age_months: '', age_days: '', referring_doctor: '' })
      setPatient({
        patient_id: data.patient_id,
        name: data.name,
        uhid: data.uhid,
        invoice_id: data.invoice_id,
        invoice_number: data.invoice_number,
        invoice_kind: data.invoice_kind,
        total: data.total,
        balance: data.balance,
      })
      setCart([])
      const [inv, detail] = await Promise.all([
        api.get(`/counter/patient/${data.patient_id}/invoice`, { params: { branch_id: branchId, invoice_id: data.invoice_id } }),
        api.get(`/patients/${data.patient_id}`).catch(() => null),
      ])
      setInvoice(inv.data)
      setPatientDetail(detail?.data || null)
      await loadActive()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  const confirmOrder = useCallback(async () => {
    if (!patient) return toast.error('လူနာ ရွေးပါ')
    if (cart.length === 0) return
    setBusy(true)
    let failed = false
    for (const line of cart) {
      try {
        await api.post('/counter/lab', {
          branch_id: branchId,
          patient_id: patient.patient_id,
          invoice_id: patient.invoice_id,
          item_id: line.item_id,
        })
        setCart((prev) => prev.filter((c) => c.item_id !== line.item_id))
      } catch (e) {
        toast.error(`${line.name}: ${getApiError(e)}`)
        failed = true
        break
      }
    }
    if (!failed) toast.success('Tests confirmed & ordered')
    const fresh = await api.get(`/counter/patient/${patient.patient_id}/invoice`, { params: { branch_id: branchId, invoice_id: patient.invoice_id } })
    setInvoice(fresh.data)
    await Promise.all([loadActive(), loadOrders()])
    setBusy(false)
  }, [branchId, cart, loadActive, loadOrders, patient, toast])

  useEffect(() => {
    if (tab !== 'order') return
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void confirmOrder()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [tab, confirmOrder])

  useEffect(() => {
    testRowRefs.current[testHighlight]?.scrollIntoView({ block: 'nearest' })
  }, [testHighlight])

  async function submitResult() {
    if (!selectedOrder) return
    const payload = selectedTemplate ? JSON.stringify(templateValues) : resultText
    setBusy(true)
    try {
      await api.patch(`/counter/lab/${selectedOrder.order_id}/result`, { order_id: selectedOrder.order_id, result: payload })
      toast.success('Result saved')
      await loadOrders()
      setSelectedOrder((prev) => (prev ? { ...prev, result: payload, status: 'completed' } : prev))
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  function selectOrder(o: LabOrderRow) {
    setSelectedOrder(o)
    setSelectedPatientDetail(null)
    const template = findLabTemplate(o.tests)
    if (template) {
      try {
        setTemplateValues(o.result ? JSON.parse(o.result) : {})
      } catch {
        setTemplateValues({})
      }
      api.get(`/patients/${o.patient_id}`).then((r) => setSelectedPatientDetail(r.data)).catch(() => setSelectedPatientDetail(null))
    } else {
      setResultText(o.result || '')
    }
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
    if (first) selectOrder(first)
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
        { id: 'order', label: 'Order Test' },
        { id: 'results', label: `Results (${pendingOrders.length} pending)` },
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
                <div className="flex gap-2 shrink-0">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailOpen(true)}>Detail</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={changePatient}>Change patient</button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-slate-800">Patient Select</h3>
                <div className="flex gap-2">
                  <input className="input" placeholder="Search name / ID / father / phone" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
                  <button type="button" disabled={busy} className="btn btn-secondary btn-sm shrink-0" onClick={search}>Go</button>
                  <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => setWalkInOpen(true)}>+ Walk-in</button>
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
                  {activePatients.length === 0 && (
                    <div className="text-slate-500 text-sm py-2">No open bills yet — register at Reception first</div>
                  )}
                  {activePatients.length > 0 && filteredPatients.length === 0 && (
                    <div className="text-slate-500 text-sm py-2">No match for &quot;{listQuery}&quot;</div>
                  )}
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
            <h3 className="font-semibold text-slate-800">Add Lab Test</h3>
            {!patient && <Alert tone="warning">↑ လူနာကို <strong>ရွေးပါ</strong></Alert>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {LAB_TEMPLATES.map((t) => {
                const item = labItems.find((i) => i.name === t.name)
                return (
                  <button
                    key={t.name}
                    type="button"
                    disabled={!patient || !item || busy}
                    className={`rounded-lg border px-2.5 py-2 text-left text-xs leading-snug transition-colors ${
                      patient && item
                        ? 'border-slate-300 hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)] cursor-pointer'
                        : 'border-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    title={!item ? 'Catalog item not found' : item.reagents?.length ? item.reagents.map((r: any) => `${r.name} ×${r.qty}`).join(', ') : undefined}
                    onClick={() => item && addToCart(item)}
                  >
                    <div>{t.name}</div>
                    {item?.reagents?.length > 0 && (
                      <div className="mt-1 text-[10px] leading-snug text-slate-500 line-clamp-2">
                        {item.reagents.map((r: any) => r.name).join(' · ')}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <input
              ref={testInputRef}
              className="input"
              placeholder="Search test name / SKU..."
              value={testQuery}
              onChange={(e) => { setTestQuery(e.target.value); setTestHighlight(0) }}
              onKeyDown={(e) => {
                if (!testQuery.trim()) return
                if (visibleTests.length === 0) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setTestHighlight((i) => Math.min(i + 1, visibleTests.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setTestHighlight((i) => Math.max(i - 1, 0))
                } else if (e.key === 'Enter') {
                  addToCart(visibleTests[Math.min(testHighlight, visibleTests.length - 1)])
                }
              }}
            />
            {testQuery.trim() && (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {visibleTests.length === 0 && (
                  <div className="text-slate-500 text-sm py-4 text-center">No test match for &quot;{testQuery}&quot;</div>
                )}
                {visibleTests.map((item, i) => (
                  <div
                    key={item.id}
                    ref={(el) => { testRowRefs.current[i] = el }}
                    className={`flex items-center gap-2 px-3 py-2 ${i === testHighlight ? 'bg-[var(--brand-50)]' : ''}`}
                    onMouseEnter={() => setTestHighlight(i)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{item.name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {item.reagents?.length
                          ? item.reagents.map((r: any) => `${r.name} ×${r.qty}`).join(' · ')
                          : (item.sku || '—')}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      className={`btn btn-sm shrink-0 ${patient ? 'btn-primary' : 'btn-secondary opacity-50'}`}
                      onClick={() => addToCart(item)}
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!labItems.length && <div className="text-slate-500 text-sm">No lab tests configured</div>}
          </div>

          <div className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-800">Current Order{patient ? ` — ${patient.name}` : ''}</h3>
              {cart.length > 0 && (
                <button type="button" disabled={busy} className="btn btn-primary btn-sm" onClick={confirmOrder} title="Ctrl+Enter">
                  Confirm & Order ({cart.length}) <span className="opacity-70 font-normal">(Ctrl+Enter)</span>
                </button>
              )}
            </div>
            <DataTable
              rows={orderRows}
              keyField="id"
              columns={[
                { key: 'description', label: 'Test', render: (r) => String(r.description) },
                { key: 'qty', label: 'Qty', className: 'text-right', render: (r) => (
                  r.status === 'pending' ? (
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" className="btn btn-secondary btn-sm !px-2" onClick={() => updateCartQty(r.item_id!, -1)} aria-label="Decrease quantity">−</button>
                      <input
                        className="input !w-14 text-center !py-1"
                        value={r.qty}
                        onChange={(e) => setCartQty(r.item_id!, e.target.value)}
                      />
                      <button type="button" className="btn btn-secondary btn-sm !px-2" onClick={() => updateCartQty(r.item_id!, 1)} aria-label="Increase quantity">+</button>
                      <button type="button" className="btn btn-secondary btn-sm !px-2 text-red-600" onClick={() => removeFromCart(r.item_id!)} aria-label="Remove">×</button>
                    </div>
                  ) : (
                    <span className="text-slate-600">{r.qty}</span>
                  )
                ) },
                { key: 'status', label: 'Status', render: (r) => (
                  <StatusBadge value={r.status === 'pending' ? 'PENDING' : 'ORDERED'} />
                ) },
              ]}
              emptyText={patient ? 'Test ထည့်ရန် Add Lab Test မှာ ရှာပြီး + Add နှိပ်ပါ' : 'လူနာ ရွေးပြီးမှ test order လုပ်နိုင်ပါမယ်'}
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
                      {patientOrders.length} lab order{patientOrders.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={changeResultPatient}>Change patient</button>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-slate-800">Patient Select</h3>
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="Search name / ID / father / phone"
                    value={resultQuery}
                    onChange={(e) => setResultQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchResultPatient()}
                  />
                  <button type="button" disabled={busy} className="btn btn-secondary btn-sm shrink-0" onClick={searchResultPatient}>Go</button>
                </div>
                {resultSearchResults.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                    {resultSearchResults.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        className="rounded-full border border-slate-300 px-3 py-1.5 text-sm hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)] cursor-pointer"
                        onClick={() => pickResultPatient(p)}
                      >
                        {p.name} · {p.uhid}
                      </button>
                    ))}
                  </div>
                )}
                <input
                  className="input"
                  placeholder="Filter patients with lab orders..."
                  value={resultListQuery}
                  onChange={(e) => setResultListQuery(e.target.value)}
                />
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {patientsWithOrders.length === 0 && (
                    <div className="text-slate-500 text-sm py-2">No lab orders yet</div>
                  )}
                  {patientsWithOrders.length > 0 && filteredResultPatients.length === 0 && (
                    <div className="text-slate-500 text-sm py-2">No match for &quot;{resultListQuery}&quot;</div>
                  )}
                  {filteredResultPatients.map((p) => (
                    <button
                      type="button"
                      key={p.patient_id}
                      onClick={() => pickResultPatient(p)}
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-sm cursor-pointer transition-colors hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)]"
                    >
                      {p.name} <span className="opacity-70">· {p.uhid}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {resultPatient && (
            <div className="card space-y-3 no-print">
              <h3 className="font-semibold text-slate-800">Tests — {resultPatient.name}</h3>
              {patientOrders.length === 0 ? (
                <p className="text-sm text-slate-500">ဒီလူနာအတွက် lab order မရှိသေးပါ</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {patientOrders.map((o) => (
                    <button
                      type="button"
                      key={o.order_id}
                      onClick={() => selectOrder(o)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        selectedOrder?.order_id === o.order_id
                          ? 'border-[var(--brand-600)] bg-[var(--brand-50)]'
                          : 'border-slate-300 hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)]'
                      }`}
                    >
                      <div className="font-medium flex items-center gap-2">
                        {o.tests}
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
            <div className="card no-print">
              <p className="text-slate-500 text-sm">↑ လူနာကို ရွေးပြီးရင် test result ထည့်နိုင်ပါမယ်</p>
            </div>
          )}

          {resultPatient && patientOrders.length > 0 && !selectedOrder && (
            <div className="card no-print">
              <p className="text-slate-500 text-sm">Test တစ်ခု ရွေးပါ</p>
            </div>
          )}

          {selectedOrder && selectedTemplate && (
            <div className="space-y-3">
              <div className="card flex flex-wrap items-center justify-between gap-3 no-print">
                <h3 className="font-semibold">{selectedOrder.tests}</h3>
                <button type="button" disabled={busy} className="btn btn-primary btn-sm" onClick={submitResult}>Save Result</button>
              </div>
              <LabTemplateResult
                key={selectedOrder.order_id}
                template={selectedTemplate}
                values={templateValues}
                onChange={setTemplateValues}
                patientName={selectedOrder.patient_name}
                uhid={selectedOrder.uhid}
                age={formatAge(selectedPatientDetail?.age_years, selectedPatientDetail?.age_months, selectedPatientDetail?.age_days)}
                ageYears={selectedPatientDetail?.age_years}
                ageMonths={selectedPatientDetail?.age_months}
                gender={selectedPatientDetail?.gender}
                date={selectedOrder.created_at}
                sampleId={selectedOrder.sample_id}
              />
            </div>
          )}

          {selectedOrder && !selectedTemplate && (
            <>
              <div className="card space-y-3 no-print">
                <h3 className="font-semibold">{selectedOrder.tests}</h3>
                <textarea
                  className="input min-h-32"
                  placeholder="Result / findings..."
                  value={resultText}
                  onChange={(e) => setResultText(e.target.value)}
                />
                <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={submitResult}>Save Result</button>
              </div>
              <ResultSlip
                title="Laboratory Report"
                patientName={selectedOrder.patient_name}
                uhid={selectedOrder.uhid}
                date={selectedOrder.created_at}
                bodyLabel={selectedOrder.tests}
                bodyText={resultText}
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
              Test
              <select
                className="input mt-1"
                value={historyFilters.test}
                onChange={(e) => setHistoryFilters({ ...historyFilters, test: e.target.value })}
              >
                <option value="">All tests</option>
                {LAB_TEMPLATES.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Search
              <input
                className="input mt-1"
                placeholder="Name / ID / test"
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
              { key: 'tests', label: 'Test', render: (r) => r.tests },
              { key: 'sample', label: 'Lab No', render: (r) => r.sample_id || '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
            ]}
            emptyText="No lab orders match these filters"
          />
        </div>
      )}

      {historyOrderId != null && (
        <Modal title="Lab report" onClose={() => setHistoryOrderId(null)} maxWidth="max-w-4xl">
          <div className="max-h-[75vh] overflow-auto">
            <LabReportView orderId={historyOrderId} />
          </div>
        </Modal>
      )}

      {walkInOpen && (
        <Modal title="Walk-in Lab" onClose={() => setWalkInOpen(false)}>
          <p className="text-xs text-slate-500">Reception မလိုပဲ Lab မှာ တိုက်ရိုက် စစ်မယ့် လူနာ — နာမည်နဲ့ အသက် ဖြည့်ပါ</p>
          <input className="input" placeholder="Name *" value={walkInForm.name} onChange={(e) => setWalkInForm({ ...walkInForm, name: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input className="input" type="number" min={0} placeholder="နှစ်" value={walkInForm.age_years} onChange={(e) => setWalkInForm({ ...walkInForm, age_years: e.target.value })} />
            <input className="input" type="number" min={0} max={11} placeholder="လ" value={walkInForm.age_months} onChange={(e) => setWalkInForm({ ...walkInForm, age_months: e.target.value })} />
            <input className="input" type="number" min={0} max={30} placeholder="ရက်" value={walkInForm.age_days} onChange={(e) => setWalkInForm({ ...walkInForm, age_days: e.target.value })} />
          </div>
          <p className="text-xs text-slate-500 -mt-1">အသက် — နှစ်၊ လ (၀–၁၁)၊ ရက် (၀–၃၀)</p>
          <select className="input" value={walkInForm.gender} onChange={(e) => setWalkInForm({ ...walkInForm, gender: e.target.value })}>
            <option value="F">Female</option>
            <option value="M">Male</option>
          </select>
          <input className="input" placeholder="Phone (optional)" value={walkInForm.phone} onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })} />
          <input className="input" placeholder="Referring doctor (optional)" value={walkInForm.referring_doctor} onChange={(e) => setWalkInForm({ ...walkInForm, referring_doctor: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={submitWalkIn}>Create & Select</button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setWalkInOpen(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {detailOpen && patient && (
        <Modal title={`${patient.name} (${patient.uhid})`} onClose={() => setDetailOpen(false)} maxWidth="max-w-lg">
          {patientDetail && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm border-b border-slate-200 pb-3">
              <div><span className="text-slate-500">Father:</span> <strong>{patientDetail.father_name || '—'}</strong></div>
              <div><span className="text-slate-500">Age:</span> <strong>{formatAge(patientDetail.age_years, patientDetail.age_months, patientDetail.age_days)}</strong></div>
              <div><span className="text-slate-500">Gender:</span> <strong>{patientDetail.gender || '—'}</strong></div>
              <div><span className="text-slate-500">Phone:</span> <strong>{patientDetail.phone || '—'}</strong></div>
              {patientDetail.allergies && (
                <div className="col-span-2 sm:col-span-3"><span className="text-slate-500">Allergies:</span> <strong className="text-[var(--status-danger-fg)]">{patientDetail.allergies}</strong></div>
              )}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">Lab orders — this visit</h3>
            <DataTable
              rows={currentOrderLines}
              keyField="id"
              columns={[
                { key: 'description', label: 'Test', render: (r) => String(r.description) },
                { key: 'qty', label: 'Qty', className: 'text-right', render: (r) => String(r.qty) },
              ]}
              emptyText="ဒီ visit မှာ lab test မမှာရသေးပါ"
            />
          </div>
          <button type="button" className="btn btn-secondary w-full" onClick={() => setDetailOpen(false)}>Close</button>
        </Modal>
      )}
    </div>
  )
}
