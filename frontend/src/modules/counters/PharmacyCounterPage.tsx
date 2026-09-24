import { useCallback, useEffect, useRef, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import Tabs from '../../components/Tabs'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Alert from '../../components/Alert'
import Modal from '../../components/Modal'
import { formatDate, formatMoney } from '../../lib/format'

type ActivePatient = {
  patient_id: number
  name: string
  uhid: string
  phone?: string
  invoice_id: number
  invoice_number: string
  invoice_kind?: string
  total: number
  balance: number
}

const emptyWalkInForm = { name: '', phone: '' }

export default function PharmacyCounterPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const [tab, setTab] = useState<'sale' | 'wardOrders' | 'history'>('sale')

  // --- Sale tab state (unchanged) ---
  const [listQuery, setListQuery] = useState('')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [activePatients, setActivePatients] = useState<ActivePatient[]>([])
  const [patient, setPatient] = useState<ActivePatient | null>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [medicineQuery, setMedicineQuery] = useState('')
  const [medicineHighlight, setMedicineHighlight] = useState(0)
  const medicineInputRef = useRef<HTMLInputElement>(null)
  const qtyInputRefs = useRef<Record<number, HTMLInputElement | null>>({})
  const medicineRowRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [lastAddedItemId, setLastAddedItemId] = useState<number | null>(null)
  const [patientDetail, setPatientDetail] = useState<any>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [cart, setCart] = useState<{ item_id: number; name: string; unit: string; qty: number; unit_price: number }[]>([])
  const [busy, setBusy] = useState(false)
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [walkInForm, setWalkInForm] = useState(emptyWalkInForm)
  const [wardOrders, setWardOrders] = useState<any[]>([])

  // --- History state ---
  const [history, setHistory] = useState<any[]>([])
  const [historyQuery, setHistoryQuery] = useState('')

  const loadActive = useCallback(async () => {
    try {
      const { data } = await api.get('/counter/active-patients', { params: { branch_id: branchId } })
      setActivePatients(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  const loadItems = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory/items')
      setItems(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [toast])

  useEffect(() => {
    void loadItems()
    api.get('/inventory/warehouses').then((r) => {
      setWarehouses(r.data)
      if (r.data[0]) setWarehouseId(String(r.data[0].id))
    }).catch((e) => toast.error(getApiError(e)))
    void loadActive()
    const id = setInterval(() => { void loadActive() }, 8000)
    return () => clearInterval(id)
  }, [loadActive, loadItems, toast])

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/counter/pharmacy/history', { params: { branch_id: branchId, q: historyQuery, days: 90 } })
      setHistory(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, historyQuery, toast])

  const loadWardOrders = useCallback(async () => {
    try {
      const { data } = await api.get('/ward-orders/pending', { params: { branch_id: branchId } })
      setWardOrders(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  useEffect(() => {
    if (tab === 'history') { void loadHistory() }
    if (tab === 'wardOrders') { void loadWardOrders() }
  }, [tab, loadHistory, loadWardOrders])

  // Ward Orders queue is nurse-initiated and can arrive any time, so poll it
  // like the active-patients list rather than requiring a manual refresh.
  useEffect(() => {
    if (tab !== 'wardOrders') return
    const id = setInterval(() => { void loadWardOrders() }, 8000)
    return () => clearInterval(id)
  }, [tab, loadWardOrders])

  // Ctrl/Cmd+Enter confirms & dispenses the staged cart from anywhere on the
  // Sale tab, so the keyboard-only add loop (search → Enter → qty → Enter)
  // can finish without reaching for the mouse.
  useEffect(() => {
    if (tab !== 'sale') return
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void confirmOrder()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [tab, confirmOrder])

  // Keep the arrow-key-highlighted medicine row scrolled into view — without
  // this the highlight moves past the bottom of the scrollable dropdown while
  // the visible rows stay put, so it looks like arrow keys stopped working.
  useEffect(() => {
    medicineRowRefs.current[medicineHighlight]?.scrollIntoView({ block: 'nearest' })
  }, [medicineHighlight])

  async function selectPatient(p: ActivePatient) {
    setPatient(p)
    setCart([])
    setBusy(true)
    try {
      const [invoiceRes, detailRes] = await Promise.all([
        api.get(`/counter/patient/${p.patient_id}/invoice`, { params: { branch_id: branchId } }),
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

  const filteredItems = items.filter((row) => {
    const q = medicineQuery.trim().toLowerCase()
    if (!q) return true
    const item = row.item || {}
    return (
      String(item.name || '').toLowerCase().includes(q)
      || String(item.name_mm || '').toLowerCase().includes(q)
      || String(item.sku || '').toLowerCase().includes(q)
      || String(item.barcode || '').toLowerCase().includes(q)
    )
  })
  const visibleItems = filteredItems.slice(0, 12)

  // Medicines already dispensed to the selected patient this visit. Pharmacy
  // shows unit_price/amount here (unlike most of the app being Cashier-facing
  // for money) since a walk-in customer sometimes pays directly at Pharmacy.
  // Refreshed by re-fetching the full invoice after each dispense.
  const currentOrderLines = (invoice?.lines || []).filter((l: any) => l.source === 'pharmacy')

  // "Current Order" table = staged cart items (not billed yet) shown on top,
  // followed by lines already dispensed/billed to this invoice this visit.
  const orderRows = [
    ...cart.map((c) => ({ id: `cart-${c.item_id}`, item_id: c.item_id, description: c.name, qty: c.qty, unit_price: c.unit_price, amount: c.unit_price * c.qty, status: 'pending' as const })),
    ...currentOrderLines.map((l: any) => ({ id: `line-${l.id}`, item_id: null, description: l.description, qty: l.qty, unit_price: l.unit_price, amount: l.amount, status: 'billed' as const })),
  ]

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

  // Collapses the patient bar back to full search — used by "Change patient"
  // once a patient is selected, since the bar itself no longer shows the queue.
  function changePatient() {
    setPatient(null)
    setInvoice(null)
    setPatientDetail(null)
    setCart([])
    setQuery('')
    setSearchResults([])
  }

  // "+ Add" only stages the item locally (qty 1, or +1 onto an already-staged
  // line) — nothing is billed/dispensed yet. Quantity itself is adjusted
  // afterwards in "Current Order", not here, so a wrong click there doesn't
  // mean going back to Add Medicine and removing the whole line.
  // Clearing the search and refocusing it afterwards lets a pharmacist keep
  // typing the next medicine name (or scanning a barcode) without touching
  // the mouse.
  function addToCart(r: any) {
    if (!patient) {
      toast.error('လူနာ ရွေးပါ')
      return
    }
    const itemId = Number(r.item.id)
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.item_id === itemId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [...prev, { item_id: itemId, name: r.item.name, unit: r.item.unit || 'ea', qty: 1, unit_price: Number(r.item.price) || 0 }]
    })
    setLastAddedItemId(itemId)
    setMedicineQuery('')
    setMedicineHighlight(0)
    medicineInputRef.current?.focus()
  }

  // Lets ArrowDown on the (now-cleared) search box jump straight to the qty
  // box of whatever was just added, so a pharmacist can tweak it without
  // reaching for the mouse — falls back to the first pending line if nothing
  // was added yet this visit.
  function focusCurrentOrderQty() {
    const targetId = lastAddedItemId != null && qtyInputRefs.current[lastAddedItemId] ? lastAddedItemId : cart[0]?.item_id
    if (targetId == null) return
    const el = qtyInputRefs.current[targetId]
    el?.focus()
    el?.select()
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

  async function confirmOrder() {
    if (!patient) return toast.error('လူနာ ရွေးပါ')
    if (!warehouseId) return toast.error('Warehouse ရွေးပါ')
    if (cart.length === 0) return
    setBusy(true)
    let failed = false
    for (const line of cart) {
      try {
        await api.post('/counter/pharmacy', {
          branch_id: branchId,
          patient_id: patient.patient_id,
          item_id: line.item_id,
          warehouse_id: Number(warehouseId),
          qty: line.qty,
        })
        // Remove only after it actually succeeds, so a mid-order failure leaves
        // just the not-yet-dispensed items in the cart for retry — not the
        // whole order (which would double-dispense the ones that already went through).
        setCart((prev) => prev.filter((c) => c.item_id !== line.item_id))
      } catch (e) {
        toast.error(`${line.name}: ${getApiError(e)}`)
        failed = true
        break
      }
    }
    if (!failed) toast.success('Order confirmed & dispensed')
    const fresh = await api.get(`/counter/patient/${patient.patient_id}/invoice`, { params: { branch_id: branchId } })
    setInvoice(fresh.data)
    await loadActive()
    await loadItems()
    setBusy(false)
  }

  // A walk-in customer buying medicine directly at Pharmacy without going
  // through Reception first — creates the patient + invoice server-side, then
  // selects them exactly like a Reception-registered patient so the rest of
  // the Sale tab (search, add, confirm & dispense) works unchanged.
  async function submitWalkIn() {
    setBusy(true)
    try {
      const { data } = await api.post('/counter/pharmacy/walk-in', null, {
        params: { branch_id: branchId, name: walkInForm.name.trim(), phone: walkInForm.phone.trim() },
      })
      toast.success(`Walk-in patient created — ${data.uhid}`)
      setWalkInOpen(false)
      setWalkInForm(emptyWalkInForm)
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
      const inv = await api.get(`/counter/patient/${data.patient_id}/invoice`, { params: { branch_id: branchId } })
      setInvoice(inv.data)
      await loadActive()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function dispenseWardOrder(orderItemId: number) {
    if (!warehouseId) return toast.error('Warehouse ရွေးပါ')
    setBusy(true)
    try {
      await api.post(`/ward-orders/items/${orderItemId}/dispense`, null, { params: { warehouse_id: Number(warehouseId) } })
      toast.success('Dispensed')
      await loadWardOrders()
      await loadItems()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Tabs
        tabs={[
          { id: 'sale', label: 'Sale' },
          { id: 'wardOrders', label: `Ward Orders (${wardOrders.length})` },
          { id: 'history', label: 'Order History' },
        ]}
        active={tab}
        onChange={(t) => setTab(t as any)}
      />

      {tab === 'sale' && (
        <div className="space-y-4">
          {/* Patient bar: full search when nothing selected; collapses to a slim
              summary once a patient is picked, so the rest of the tab (medicine
              search + current order) gets the room instead of competing with the
              queue list for space. */}
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
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-800">Patient Select</h3>
                  <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => setWalkInOpen(true)}>+ Walk-in Sale</button>
                </div>
                <div className="flex gap-2">
                  <input className="input" placeholder="Search name / ID / phone" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
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

                <input
                  className="input"
                  placeholder="Filter waiting patients..."
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                />
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

          {/* Add Medicine — now just a compact search + "+Add" list, since qty is
              adjusted afterwards in Current Order below, not here. */}
          <div className="card space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h3 className="font-semibold text-slate-800">Add Medicine</h3>
              <select className="input w-40" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {!patient && <Alert tone="warning">↑ လူနာကို <strong>ရွေးပါ</strong></Alert>}
            <input
              ref={medicineInputRef}
              className="input"
              placeholder="Search medicine name / SKU / barcode..."
              value={medicineQuery}
              onChange={(e) => { setMedicineQuery(e.target.value); setMedicineHighlight(0) }}
              onKeyDown={(e) => {
                // No dropdown open (search box empty, right after an Enter-add) —
                // ArrowDown jumps straight down to Current Order's qty box instead
                // of doing nothing.
                if (!medicineQuery.trim()) {
                  if (e.key === 'ArrowDown' && cart.length > 0) {
                    e.preventDefault()
                    focusCurrentOrderQty()
                  }
                  return
                }
                if (visibleItems.length === 0) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setMedicineHighlight((i) => Math.min(i + 1, visibleItems.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setMedicineHighlight((i) => Math.max(i - 1, 0))
                } else if (e.key === 'Enter') {
                  addToCart(visibleItems[Math.min(medicineHighlight, visibleItems.length - 1)])
                }
              }}
            />
            {medicineQuery.trim() && (
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {visibleItems.length === 0 && (
                  <div className="text-slate-500 text-sm py-4 text-center">No medicine match for &quot;{medicineQuery}&quot;</div>
                )}
                {visibleItems.map((r, i) => (
                  <div
                    key={r.item.id}
                    ref={(el) => { medicineRowRefs.current[i] = el }}
                    className={`flex items-center gap-2 px-3 py-2 ${i === medicineHighlight ? 'bg-[var(--brand-50)]' : ''}`}
                    onMouseEnter={() => setMedicineHighlight(i)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{r.item.name}</div>
                      <div className="text-xs text-slate-500">{r.item.unit || 'ea'} · Stock {r.on_hand} · {formatMoney(Number(r.item.price))}</div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      className={`btn btn-sm shrink-0 ${patient ? 'btn-primary' : 'btn-secondary opacity-50'}`}
                      onClick={() => addToCart(r)}
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Order — full width now that it no longer shares the row
              with Add Medicine, so it gets the most visual room. */}
          <div className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-800">Current Order{patient ? ` — ${patient.name}` : ''}</h3>
              {cart.length > 0 && (
                <button type="button" disabled={busy} className="btn btn-primary btn-sm" onClick={confirmOrder} title="Ctrl+Enter">
                  Confirm & Dispense ({cart.length}) <span className="opacity-70 font-normal">(Ctrl+Enter)</span>
                </button>
              )}
            </div>
            <DataTable
              rows={orderRows}
              keyField="id"
              columns={[
                { key: 'description', label: 'Medicine', render: (r) => String(r.description) },
                { key: 'qty', label: 'Qty', className: 'text-right', render: (r) => (
                  r.status === 'pending' ? (
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" className="btn btn-secondary btn-sm !px-2" onClick={() => updateCartQty(r.item_id, -1)} aria-label="Decrease quantity">−</button>
                      <input
                        ref={(el) => { qtyInputRefs.current[r.item_id] = el }}
                        className="input no-spinner !py-1 w-12 text-center shrink-0"
                        type="number"
                        min={1}
                        value={r.qty}
                        onChange={(e) => setCartQty(r.item_id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return
                          e.preventDefault()
                          medicineInputRef.current?.focus()
                        }}
                        aria-label="Quantity"
                      />
                      <button type="button" className="btn btn-secondary btn-sm !px-2" onClick={() => updateCartQty(r.item_id, 1)} aria-label="Increase quantity">+</button>
                    </div>
                  ) : String(r.qty)
                ) },
                { key: 'unit_price', label: 'Unit Price', className: 'text-right', render: (r) => formatMoney(Number(r.unit_price || 0)) },
                { key: 'amount', label: 'Amount', className: 'text-right', render: (r) => formatMoney(Number(r.amount || 0)) },
                { key: 'status', label: 'Status', render: (r) => (
                  <StatusBadge value={r.status === 'pending' ? 'PENDING' : 'DISPENSED'} />
                ) },
                { key: 'act', label: '', render: (r) => (
                  r.status === 'pending'
                    ? <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeFromCart(r.item_id)}>Remove</button>
                    : null
                ) },
              ]}
              emptyText={patient ? 'ဒီ visit မှာ ဆေး မထုတ်ရသေးပါ' : 'လူနာ ရွေးပြီး ဆေးထည့်ပါ'}
            />
          </div>
        </div>
      )}

      {tab === 'wardOrders' && (
        <div className="card space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h3 className="font-semibold text-slate-800">Ward Orders — Nurse-requested medicine, all wards</h3>
            <select className="input w-40" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <DataTable
            rows={wardOrders}
            keyField="order_item_id"
            columns={[
              { key: 'patient', label: 'Patient', render: (r) => `${r.patient_name} (${r.uhid})` },
              { key: 'medicine', label: 'Medicine', render: (r) => String(r.medicine_name) },
              { key: 'qty', label: 'Qty', className: 'text-right', render: (r) => String(r.qty) },
              { key: 'note', label: 'Note', render: (r) => <span className="text-slate-600">{r.note || '—'}</span> },
              { key: 'nurse', label: 'Ordered by', render: (r) => String(r.ordered_by_name || '—') },
              { key: 'date', label: 'Date', render: (r) => formatDate(String(r.created_at)) },
              { key: 'act', label: '', render: (r) => (
                <button type="button" disabled={busy} className="btn btn-primary btn-sm" onClick={() => dispenseWardOrder(r.order_item_id)}>Dispense</button>
              ) },
            ]}
            emptyText="No pending ward orders"
          />
        </div>
      )}

      {tab === 'history' && (
        <div className="card space-y-3">
          <input
            className="input"
            placeholder="Search name / ID / bill #"
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadHistory()}
          />
          <DataTable
            rows={history}
            columns={[
              { key: 'date', label: 'Date', render: (r) => formatDate(String(r.date)) },
              { key: 'patient', label: 'Patient', render: (r) => String(r.patient_name) },
              { key: 'uhid', label: 'ID', render: (r) => String(r.uhid) },
              { key: 'bill', label: 'Bill', render: (r) => String(r.invoice_number) },
              { key: 'item', label: 'Medicine', render: (r) => String(r.item_name) },
              { key: 'qty', label: 'Qty', render: (r) => String(r.qty) },
              { key: 'unit', label: 'Unit', render: (r) => String(r.unit) },
              { key: 'unit_price', label: 'Unit Price', className: 'text-right', render: (r) => formatMoney(Number(r.unit_price || 0)) },
              { key: 'amount', label: 'Amount', className: 'text-right', render: (r) => formatMoney(Number(r.amount || 0)) },
            ]}
            emptyText={historyQuery.trim() ? `No match for "${historyQuery}"` : 'No dispense history in last 90 days'}
          />
        </div>
      )}

      {walkInOpen && (
        <Modal title="Walk-in Sale" onClose={() => setWalkInOpen(false)}>
          <p className="text-xs text-slate-500">Reception မလိုပဲ Pharmacy ကနေ တိုက်ရိုက် ဆေးဝယ်မယ့် customer အတွက် — patient record အလွယ်ဖန်တီးပါမယ်</p>
          <input className="input" placeholder="Name (optional — defaults to Walk-in Customer)" value={walkInForm.name} onChange={(e) => setWalkInForm({ ...walkInForm, name: e.target.value })} />
          <input className="input" placeholder="Phone (optional)" value={walkInForm.phone} onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })} />
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
              <div><span className="text-slate-500">Age:</span> <strong>{patientDetail.age_years ?? '—'}</strong></div>
              <div><span className="text-slate-500">Gender:</span> <strong>{patientDetail.gender || '—'}</strong></div>
              <div><span className="text-slate-500">Phone:</span> <strong>{patientDetail.phone || '—'}</strong></div>
              {patientDetail.allergies && (
                <div className="col-span-2 sm:col-span-3"><span className="text-slate-500">Allergies:</span> <strong className="text-[var(--status-danger-fg)]">{patientDetail.allergies}</strong></div>
              )}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">Current Order — this visit</h3>
            <DataTable
              rows={currentOrderLines}
              keyField="id"
              columns={[
                { key: 'description', label: 'Medicine', render: (r) => String(r.description) },
                { key: 'qty', label: 'Qty', className: 'text-right', render: (r) => String(r.qty) },
                { key: 'amount', label: 'Amount', className: 'text-right', render: (r) => formatMoney(Number(r.amount || 0)) },
              ]}
              emptyText="ဒီ visit မှာ ဆေး မထုတ်ရသေးပါ"
            />
          </div>
          <button type="button" className="btn btn-secondary w-full" onClick={() => setDetailOpen(false)}>Close</button>
        </Modal>
      )}
    </div>
  )
}
