import { useCallback, useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import StatusBadge from '../../components/StatusBadge'
import DataTable from '../../components/DataTable'
import { formatDate } from '../../lib/format'

type Admission = {
  id: number
  patient_id: number
  bed_id: number | null
  status: string
  admitted_at: string
  diagnosis: string
}

export default function NurseCounterPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [patients, setPatients] = useState<Record<number, any>>({})
  const [beds, setBeds] = useState<Record<number, any>>({})
  const [listQuery, setListQuery] = useState('')
  const [selected, setSelected] = useState<Admission | null>(null)
  const [notes, setNotes] = useState<any[]>([])
  const [noteText, setNoteText] = useState('')
  const [busy, setBusy] = useState(false)

  // --- Order Medicine (sends a ward order to Pharmacy's queue) ---
  const [medItems, setMedItems] = useState<any[]>([])
  const [medQuery, setMedQuery] = useState('')
  const [orderCart, setOrderCart] = useState<{ item_id: number; name: string; unit: string; qty: number }[]>([])
  const [orderNote, setOrderNote] = useState('')
  const [patientOrders, setPatientOrders] = useState<any[]>([])

  const loadAdmissions = useCallback(async () => {
    try {
      const { data } = await api.get('/ipd/admissions', { params: { branch_id: branchId, status: 'admitted' } })
      setAdmissions(data)
      const ids = [...new Set(data.map((a: Admission) => a.patient_id))]
      const results = await Promise.all(ids.map((id) => api.get(`/patients/${id}`).catch(() => null)))
      const map: Record<number, any> = {}
      results.forEach((r, i) => { if (r) map[ids[i] as number] = r.data })
      setPatients(map)
      const bedRes = await api.get('/ipd/beds').catch(() => null)
      const bmap: Record<number, any> = {}
      if (bedRes) (bedRes.data as any[]).forEach((b) => { bmap[b.id] = b })
      setBeds(bmap)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  useEffect(() => { void loadAdmissions() }, [loadAdmissions])

  useEffect(() => {
    api.get('/inventory/items').then((r) => setMedItems(r.data)).catch((e) => toast.error(getApiError(e)))
  }, [toast])

  const loadPatientOrders = useCallback(async (patientId: number) => {
    try {
      const { data } = await api.get(`/ward-orders/patient/${patientId}`, { params: { branch_id: branchId } })
      setPatientOrders(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  async function selectAdmission(a: Admission) {
    setSelected(a)
    setNoteText('')
    setOrderCart([])
    setOrderNote('')
    setMedQuery('')
    try {
      const { data } = await api.get(`/ipd/admissions/${a.id}/notes`)
      setNotes(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
    void loadPatientOrders(a.patient_id)
  }

  const filteredAdmissions = admissions.filter((a) => {
    const q = listQuery.trim().toLowerCase()
    if (!q) return true
    const p = patients[a.patient_id]
    const bed = a.bed_id ? beds[a.bed_id] : null
    return (
      (p?.name || '').toLowerCase().includes(q)
      || (p?.uhid || '').toLowerCase().includes(q)
      || (bed?.code || '').toLowerCase().includes(q)
    )
  })

  const filteredMedItems = medItems.filter((row) => {
    const q = medQuery.trim().toLowerCase()
    if (!q) return false
    const item = row.item || {}
    return String(item.name || '').toLowerCase().includes(q) || String(item.sku || '').toLowerCase().includes(q)
  }).slice(0, 8)

  function addToOrderCart(row: any) {
    const itemId = Number(row.item.id)
    setOrderCart((prev) => {
      const idx = prev.findIndex((c) => c.item_id === itemId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [...prev, { item_id: itemId, name: row.item.name, unit: row.item.unit || 'ea', qty: 1 }]
    })
    setMedQuery('')
  }

  function removeFromOrderCart(itemId: number) {
    setOrderCart((prev) => prev.filter((c) => c.item_id !== itemId))
  }

  function updateOrderCartQty(itemId: number, delta: number) {
    setOrderCart((prev) => prev.map((c) => (c.item_id === itemId ? { ...c, qty: Math.max(1, c.qty + delta) } : c)))
  }

  function setOrderCartQty(itemId: number, value: string) {
    const qty = Math.max(1, Number(value) || 1)
    setOrderCart((prev) => prev.map((c) => (c.item_id === itemId ? { ...c, qty } : c)))
  }

  // "Current Order" table = staged cart (not sent yet) on top, followed by
  // everything already ordered for this patient — same layout as Pharmacy's
  // Sale tab (pending cart rows + billed rows in one table).
  const orderRows = [
    ...orderCart.map((c) => ({ id: `cart-${c.item_id}`, item_id: c.item_id as number | null, description: c.name, qty: c.qty, status: 'pending' })),
    ...patientOrders.flatMap((o) => o.items.map((i: any) => ({ id: `hist-${i.order_item_id}`, item_id: null, description: i.medicine_name, qty: i.qty, status: i.status }))),
  ]

  async function sendOrder() {
    if (!selected) return
    if (orderCart.length === 0) return toast.error('ဆေး ရွေးပါ')
    setBusy(true)
    try {
      await api.post('/ward-orders', {
        patient_id: selected.patient_id,
        branch_id: branchId,
        admission_id: selected.id,
        note: orderNote,
        items: orderCart.map((c) => ({ item_id: c.item_id, qty: c.qty })),
      })
      toast.success('Pharmacy ကို order ပို့ပြီးပါပြီ')
      setOrderCart([])
      setOrderNote('')
      void loadPatientOrders(selected.patient_id)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveNote() {
    if (!selected || !noteText.trim()) return
    setBusy(true)
    try {
      await api.post(`/ipd/admissions/${selected.id}/notes`, { note: noteText })
      toast.success('Note added')
      const { data } = await api.get(`/ipd/admissions/${selected.id}/notes`)
      setNotes(data)
      setNoteText('')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        {selected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="shrink-0 w-9 h-9 rounded-full bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center font-semibold text-sm">
                {(patients[selected.patient_id]?.name || '?').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 truncate">
                  {patients[selected.patient_id]?.name || `Patient #${selected.patient_id}`}
                  <span className="text-slate-500 font-normal"> · {patients[selected.patient_id]?.uhid}</span>
                </div>
                <div className="text-xs text-slate-500">
                  Bed {(selected.bed_id ? beds[selected.bed_id]?.code : null) || '—'} · Admitted {formatDate(selected.admitted_at)}
                </div>
              </div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => setSelected(null)}>Change patient</button>
          </div>
        ) : (
          <>
            <h3 className="font-semibold text-slate-800">Admitted Patients</h3>
            <input
              className="input"
              placeholder="Filter admitted patients... (name / ID / bed)"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {admissions.length === 0 && <div className="text-slate-500 text-sm py-2">No IPD patients admitted</div>}
              {admissions.length > 0 && filteredAdmissions.length === 0 && (
                <div className="text-slate-500 text-sm py-2">No match for &quot;{listQuery}&quot;</div>
              )}
              {filteredAdmissions.map((a) => {
                const p = patients[a.patient_id]
                const bed = a.bed_id ? beds[a.bed_id] : null
                return (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => selectAdmission(a)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-sm cursor-pointer transition-colors hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)]"
                  >
                    {p?.name || `Patient #${a.patient_id}`} <span className="opacity-70">· {p?.uhid} · Bed {bed?.code || '—'}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {!selected ? (
        <div className="card text-slate-500">Admission list ကနေ လူနာ ရွေးပါ</div>
      ) : (
        <>
              <div className="card space-y-3">
                <h3 className="font-semibold">Order Medicine — sends to Pharmacy</h3>
                <input
                  className="input"
                  placeholder="Search medicine name / SKU..."
                  value={medQuery}
                  onChange={(e) => setMedQuery(e.target.value)}
                />
                {medQuery.trim() && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {filteredMedItems.length === 0 && (
                      <div className="text-slate-500 text-sm py-3 text-center">No medicine match for &quot;{medQuery}&quot;</div>
                    )}
                    {filteredMedItems.map((r) => (
                      <div key={r.item.id} className="flex items-center gap-2 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">{r.item.name}</div>
                          <div className="text-xs text-slate-500">{r.item.unit || 'ea'}</div>
                        </div>
                        <button type="button" className="btn btn-primary btn-sm shrink-0" onClick={() => addToOrderCart(r)}>+ Add</button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  className="input min-h-16"
                  placeholder="Note for pharmacist (optional)"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                />
                <button type="button" disabled={busy || orderCart.length === 0} className="btn btn-primary w-full" onClick={sendOrder}>
                  Send Order to Pharmacy {orderCart.length > 0 ? `(${orderCart.length})` : ''}
                </button>
              </div>

              <div className="card space-y-3">
                <h3 className="font-semibold text-slate-800">Current Order — {patients[selected.patient_id]?.name || 'Patient'}</h3>
                <DataTable
                  rows={orderRows}
                  keyField="id"
                  columns={[
                    { key: 'description', label: 'Medicine', render: (r) => String(r.description) },
                    { key: 'qty', label: 'Qty', className: 'text-right', render: (r) => (
                      r.status === 'pending' && r.item_id != null ? (
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" className="btn btn-secondary btn-sm !px-2" onClick={() => updateOrderCartQty(r.item_id as number, -1)} aria-label="Decrease quantity">−</button>
                          <input
                            className="input no-spinner !py-1 w-12 text-center shrink-0"
                            type="number"
                            min={1}
                            value={r.qty}
                            onChange={(e) => setOrderCartQty(r.item_id as number, e.target.value)}
                            aria-label="Quantity"
                          />
                          <button type="button" className="btn btn-secondary btn-sm !px-2" onClick={() => updateOrderCartQty(r.item_id as number, 1)} aria-label="Increase quantity">+</button>
                        </div>
                      ) : String(r.qty)
                    ) },
                    { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
                    { key: 'act', label: '', render: (r) => (
                      r.status === 'pending' && r.item_id != null
                        ? <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => removeFromOrderCart(r.item_id as number)}>Remove</button>
                        : null
                    ) },
                  ]}
                  emptyText="ဆေး order မထားရသေးပါ"
                />
              </div>

              <div className="card space-y-3">
                <h3 className="font-semibold">Nursing Notes</h3>
                <textarea className="input min-h-20" placeholder="Add note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <button type="button" disabled={busy} className="btn btn-secondary" onClick={saveNote}>Add Note</button>
                <div className="max-h-40 overflow-auto space-y-2 text-sm border-t pt-2">
                  {notes.map((n) => (
                    <div key={n.id} className="border-b pb-1">
                      <div>{n.note}</div>
                      <div className="text-xs text-slate-400">{formatDate(n.created_at)}</div>
                    </div>
                  ))}
                  {notes.length === 0 && <div className="text-slate-400">No notes yet</div>}
                </div>
              </div>
        </>
      )}
    </div>
  )
}
