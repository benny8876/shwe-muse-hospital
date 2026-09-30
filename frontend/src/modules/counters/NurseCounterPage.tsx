import { useCallback, useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import Tabs from '../../components/Tabs'
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

type ActivePatient = {
  patient_id: number
  name: string
  uhid: string
  phone?: string
  invoice_id: number
  invoice_number: string
  invoice_kind?: string
}

type OrderCartLine = { item_id: number; name: string; unit: string; qty: number }

export default function NurseCounterPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const [stationTab, setStationTab] = useState<'ipd' | 'opd'>('ipd')

  // --- IPD ---
  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [patients, setPatients] = useState<Record<number, any>>({})
  const [beds, setBeds] = useState<Record<number, any>>({})
  const [ipdListQuery, setIpdListQuery] = useState('')
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null)
  const [notes, setNotes] = useState<any[]>([])
  const [vitals, setVitals] = useState<any[]>([])
  const [noteText, setNoteText] = useState('')
  const [vitalForm, setVitalForm] = useState({ bp: '', pulse: '', temp: '', spo2: '', weight: '' })

  // --- OPD ---
  const [activePatients, setActivePatients] = useState<ActivePatient[]>([])
  const [opdListQuery, setOpdListQuery] = useState('')
  const [opdQuery, setOpdQuery] = useState('')
  const [opdSearchResults, setOpdSearchResults] = useState<any[]>([])
  const [selectedOpd, setSelectedOpd] = useState<ActivePatient | null>(null)

  // --- Shared medicine order ---
  const [medItems, setMedItems] = useState<any[]>([])
  const [medQuery, setMedQuery] = useState('')
  const [orderCart, setOrderCart] = useState<OrderCartLine[]>([])
  const [orderNote, setOrderNote] = useState('')
  const [patientOrders, setPatientOrders] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  const selectedPatientId = stationTab === 'ipd' ? selectedAdmission?.patient_id : selectedOpd?.patient_id

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

  const loadActive = useCallback(async () => {
    try {
      const { data } = await api.get('/counter/active-patients', { params: { branch_id: branchId } })
      setActivePatients(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  useEffect(() => { void loadAdmissions(); void loadActive() }, [loadAdmissions, loadActive])

  useEffect(() => {
    api.get('/inventory/items', { params: { department: 'pharmacy' } }).then((r) => setMedItems(r.data)).catch((e) => toast.error(getApiError(e)))
  }, [toast])

  const loadPatientOrders = useCallback(async (patientId: number) => {
    try {
      const { data } = await api.get(`/ward-orders/patient/${patientId}`, { params: { branch_id: branchId } })
      setPatientOrders(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  function clearOrderState() {
    setOrderCart([])
    setOrderNote('')
    setMedQuery('')
    setPatientOrders([])
  }

  function switchStationTab(tab: 'ipd' | 'opd') {
    setStationTab(tab)
    setSelectedAdmission(null)
    setSelectedOpd(null)
    setNoteText('')
    setNotes([])
    setVitals([])
    setVitalForm({ bp: '', pulse: '', temp: '', spo2: '', weight: '' })
    clearOrderState()
  }

  async function selectAdmission(a: Admission) {
    setSelectedAdmission(a)
    setNoteText('')
    setNotes([])
    setVitals([])
    clearOrderState()
    try {
      const [notesRes, vitalsRes] = await Promise.all([
        api.get(`/ipd/admissions/${a.id}/notes`),
        api.get(`/ipd/admissions/${a.id}/vitals`),
      ])
      setNotes(notesRes.data)
      setVitals(vitalsRes.data)
    } catch (e) {
      toast.error(getApiError(e))
    }
    void loadPatientOrders(a.patient_id)
  }

  async function selectOpdPatient(p: ActivePatient) {
    setSelectedOpd(p)
    clearOrderState()
    void loadPatientOrders(p.patient_id)
  }

  async function searchOpdPatient() {
    if (!opdQuery.trim()) return
    setBusy(true)
    try {
      const { data } = await api.get('/patients', { params: { q: opdQuery } })
      setOpdSearchResults(data)
      if (!data.length) toast.error('Patient not found')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function selectOpdFromSearch(p: any) {
    const match = activePatients.find((a) => a.patient_id === p.id)
    if (match) {
      await selectOpdPatient(match)
      return
    }
    setBusy(true)
    try {
      const { data } = await api.get(`/counter/patient/${p.id}/invoice`, { params: { branch_id: branchId } })
      if (!data) {
        toast.error('No open bill — send to Reception first')
        return
      }
      await selectOpdPatient({
        patient_id: p.id,
        name: p.name,
        uhid: p.uhid,
        phone: p.phone,
        invoice_id: data.id,
        invoice_number: data.number,
        invoice_kind: data.kind,
      })
      setOpdQuery('')
      setOpdSearchResults([])
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  const filteredAdmissions = admissions.filter((a) => {
    const q = ipdListQuery.trim().toLowerCase()
    if (!q) return true
    const p = patients[a.patient_id]
    const bed = a.bed_id ? beds[a.bed_id] : null
    return (
      (p?.name || '').toLowerCase().includes(q)
      || (p?.uhid || '').toLowerCase().includes(q)
      || (bed?.code || '').toLowerCase().includes(q)
    )
  })

  const opdWaitingPatients = activePatients.filter((p) => (p.invoice_kind || 'opd').toLowerCase() !== 'ipd')

  const filteredOpdPatients = opdWaitingPatients.filter((p) => {
    const q = opdListQuery.trim().toLowerCase()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q)
      || p.uhid.toLowerCase().includes(q)
      || p.invoice_number.toLowerCase().includes(q)
      || (p.phone || '').toLowerCase().includes(q)
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

  const orderRows = [
    ...orderCart.map((c) => ({ id: `cart-${c.item_id}`, item_id: c.item_id as number | null, description: c.name, qty: c.qty, status: 'pending' })),
    ...patientOrders.flatMap((o) => o.items.map((i: any) => ({ id: `hist-${i.order_item_id}`, item_id: null, description: i.medicine_name, qty: i.qty, status: i.status }))),
  ]

  async function sendOrder() {
    if (!selectedPatientId) return
    if (orderCart.length === 0) return toast.error('ဆေး ရွေးပါ')
    setBusy(true)
    try {
      await api.post('/ward-orders', {
        patient_id: selectedPatientId,
        branch_id: branchId,
        admission_id: stationTab === 'ipd' ? selectedAdmission?.id : null,
        invoice_id: stationTab === 'opd' ? selectedOpd?.invoice_id : undefined,
        note: orderNote,
        items: orderCart.map((c) => ({ item_id: c.item_id, qty: c.qty })),
      })
      toast.success('Pharmacy ကို order ပို့ပြီးပါပြီ')
      setOrderCart([])
      setOrderNote('')
      void loadPatientOrders(selectedPatientId)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveNote() {
    if (!selectedAdmission || !noteText.trim()) return
    setBusy(true)
    try {
      await api.post(`/ipd/admissions/${selectedAdmission.id}/notes`, { note: noteText })
      toast.success('Note added')
      const { data } = await api.get(`/ipd/admissions/${selectedAdmission.id}/notes`)
      setNotes(data)
      setNoteText('')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveVitals() {
    if (!selectedAdmission) return
    const hasAny = Object.values(vitalForm).some((v) => String(v).trim())
    if (!hasAny) return toast.error('Vitals တစ်ခုခု ထည့်ပါ')
    setBusy(true)
    try {
      await api.post(`/ipd/admissions/${selectedAdmission.id}/vitals`, vitalForm)
      toast.success('Vitals recorded')
      const { data } = await api.get(`/ipd/admissions/${selectedAdmission.id}/vitals`)
      setVitals(data)
      setVitalForm({ bp: '', pulse: '', temp: '', spo2: '', weight: '' })
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function postRoomCharge() {
    if (!selectedAdmission) return
    setBusy(true)
    try {
      const { data } = await api.post(`/ipd/admissions/${selectedAdmission.id}/daily-charge`)
      toast.success(`Room charge posted — balance ${data.balance}`)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  const selectedPatientName = stationTab === 'ipd'
    ? (selectedAdmission ? patients[selectedAdmission.patient_id]?.name : null)
    : selectedOpd?.name

  const orderMedicinePanel = selectedPatientId ? (
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
        <h3 className="font-semibold text-slate-800">Current Order — {selectedPatientName || 'Patient'}</h3>
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
    </>
  ) : null

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[{ id: 'ipd', label: 'IPD' }, { id: 'opd', label: 'OPD' }]}
        active={stationTab}
        onChange={(t) => switchStationTab(t as 'ipd' | 'opd')}
      />

      {stationTab === 'ipd' && (
        <>
          <div className="card space-y-3">
            {selectedAdmission ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center font-semibold text-sm">
                    {(patients[selectedAdmission.patient_id]?.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                      {patients[selectedAdmission.patient_id]?.name || `Patient #${selectedAdmission.patient_id}`}
                      <span className="text-slate-500 font-normal"> · {patients[selectedAdmission.patient_id]?.uhid}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Bed {(selectedAdmission.bed_id ? beds[selectedAdmission.bed_id]?.code : null) || '—'} · Admitted {formatDate(selectedAdmission.admitted_at)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" disabled={busy} className="btn btn-secondary btn-sm" onClick={postRoomCharge}>Post room charge</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSelectedAdmission(null); clearOrderState() }}>Change patient</button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-slate-800">Admitted Patients</h3>
                <input
                  className="input"
                  placeholder="Filter admitted patients... (name / ID / bed)"
                  value={ipdListQuery}
                  onChange={(e) => setIpdListQuery(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {admissions.length === 0 && <div className="text-slate-500 text-sm py-2">No IPD patients admitted</div>}
                  {admissions.length > 0 && filteredAdmissions.length === 0 && (
                    <div className="text-slate-500 text-sm py-2">No match for &quot;{ipdListQuery}&quot;</div>
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

          {!selectedAdmission ? (
            <div className="card text-slate-500">Admission list ကနေ လူနာ ရွေးပါ</div>
          ) : (
            <>
              {orderMedicinePanel}
              <div className="card space-y-4">
                <h3 className="font-semibold">Vitals & Nursing Notes</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input className="input" placeholder="BP" value={vitalForm.bp} onChange={(e) => setVitalForm({ ...vitalForm, bp: e.target.value })} />
                  <input className="input" placeholder="Pulse" value={vitalForm.pulse} onChange={(e) => setVitalForm({ ...vitalForm, pulse: e.target.value })} />
                  <input className="input" placeholder="Temp °C" value={vitalForm.temp} onChange={(e) => setVitalForm({ ...vitalForm, temp: e.target.value })} />
                  <input className="input" placeholder="SpO₂ %" value={vitalForm.spo2} onChange={(e) => setVitalForm({ ...vitalForm, spo2: e.target.value })} />
                  <input className="input" placeholder="Weight kg" value={vitalForm.weight} onChange={(e) => setVitalForm({ ...vitalForm, weight: e.target.value })} />
                </div>
                <button type="button" disabled={busy} className="btn btn-primary btn-sm w-fit" onClick={saveVitals}>Save vitals</button>
                <div className="max-h-32 overflow-auto space-y-2 text-sm border-t border-slate-100 pt-2">
                  {vitals.map((v) => (
                    <div key={v.id} className="text-xs text-slate-600 border-b border-slate-50 pb-1">
                      <span className="font-medium text-slate-800">{formatDate(v.recorded_at)}</span>
                      {' · '}
                      BP {v.bp || '—'} · Pulse {v.pulse || '—'} · Temp {v.temp || '—'} · SpO₂ {v.spo2 || '—'} · Wt {v.weight || '—'}
                    </div>
                  ))}
                  {vitals.length === 0 && <div className="text-slate-400 text-sm">No vitals yet</div>}
                </div>
                <textarea className="input min-h-20" placeholder="Nursing note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <button type="button" disabled={busy} className="btn btn-secondary btn-sm w-fit" onClick={saveNote}>Add note</button>
                <div className="max-h-40 overflow-auto space-y-2 text-sm border-t border-slate-100 pt-2">
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
        </>
      )}

      {stationTab === 'opd' && (
        <>
          <div className="card space-y-3">
            {selectedOpd ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 w-9 h-9 rounded-full bg-[var(--brand-50)] text-[var(--brand-700)] flex items-center justify-center font-semibold text-sm">
                    {selectedOpd.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                      {selectedOpd.name} <span className="text-slate-500 font-normal">· {selectedOpd.uhid}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      Bill {selectedOpd.invoice_number}
                      <StatusBadge value={(selectedOpd.invoice_kind || 'opd').toUpperCase()} />
                    </div>
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => { setSelectedOpd(null); clearOrderState() }}>Change patient</button>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-slate-800">Patient Select</h3>
                <div className="flex gap-2">
                  <input className="input" placeholder="Search name / ID / father / phone" value={opdQuery} onChange={(e) => setOpdQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchOpdPatient()} />
                  <button type="button" disabled={busy} className="btn btn-secondary btn-sm shrink-0" onClick={searchOpdPatient}>Go</button>
                </div>
                {opdSearchResults.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                    {opdSearchResults.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        className="rounded-full border border-slate-300 px-3 py-1.5 text-sm hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)] cursor-pointer"
                        onClick={() => selectOpdFromSearch(p)}
                      >
                        {p.name} · {p.uhid}
                      </button>
                    ))}
                  </div>
                )}
                <input className="input" placeholder="Filter waiting patients..." value={opdListQuery} onChange={(e) => setOpdListQuery(e.target.value)} />
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {opdWaitingPatients.length === 0 && <div className="text-slate-500 text-sm py-2">No open OPD bills yet — register at Reception first</div>}
                  {opdWaitingPatients.length > 0 && filteredOpdPatients.length === 0 && (
                    <div className="text-slate-500 text-sm py-2">No match for &quot;{opdListQuery}&quot;</div>
                  )}
                  {filteredOpdPatients.map((p) => (
                    <button
                      type="button"
                      key={p.invoice_id}
                      onClick={() => selectOpdPatient(p)}
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-sm cursor-pointer transition-colors hover:border-[var(--brand-600)] hover:bg-[var(--brand-50)]"
                    >
                      {p.name} <span className="opacity-70">· {p.uhid}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {!selectedOpd ? (
            <div className="card text-slate-500">Waiting patient list ကနေ လူနာ ရွေးပါ</div>
          ) : orderMedicinePanel}
        </>
      )}
    </div>
  )
}
