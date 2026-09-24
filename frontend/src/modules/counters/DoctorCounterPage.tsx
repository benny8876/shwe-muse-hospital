import { useCallback, useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useAuth } from '../../lib/auth'
import { useBranchId } from '../../hooks/useBranchId'
import PageHeader from '../../components/PageHeader'
import Tabs from '../../components/Tabs'

type QueuePatient = {
  patient_id: number
  name: string
  uhid: string
  age_years: number | null
  gender: string
  invoice_id: number
  invoice_number: string
  examined: boolean
}

type RxRow = { catalog_item_id: number | null; free_text_name: string; qty: number; dosage_instructions: string }

export default function DoctorCounterPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const { session } = useAuth()
  const doctorId = session?.user_id
  const [tab, setTab] = useState<'queue' | 'history'>('queue')
  const [queue, setQueue] = useState<QueuePatient[]>([])
  const [patient, setPatient] = useState<QueuePatient | null>(null)
  const [drugQuery, setDrugQuery] = useState('')
  const [drugResults, setDrugResults] = useState<any[]>([])
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [rxItems, setRxItems] = useState<RxRow[]>([])
  const [busy, setBusy] = useState(false)
  const [visits, setVisits] = useState<any[]>([])

  const loadQueue = useCallback(async () => {
    if (!doctorId) return
    try {
      const { data } = await api.get('/counter/doctor/queue', { params: { branch_id: branchId, doctor_id: doctorId } })
      setQueue(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, doctorId, toast])

  useEffect(() => {
    void loadQueue()
    const id = setInterval(() => { void loadQueue() }, 8000)
    return () => clearInterval(id)
  }, [loadQueue])

  useEffect(() => {
    if (tab === 'history') {
      api.get('/visits', { params: { doctor_id: doctorId } }).then((r) => setVisits(r.data)).catch(() => {})
    }
  }, [tab, doctorId])

  useEffect(() => {
    const q = drugQuery.trim()
    if (!q) { setDrugResults([]); return }
    const t = setTimeout(() => {
      api.get('/catalog', { params: { q } }).then((r) => setDrugResults(r.data.filter((i: any) => i.is_stock))).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [drugQuery])

  function selectPatient(p: QueuePatient) {
    setPatient(p)
    setChiefComplaint('')
    setDiagnosis('')
    setNotes('')
    setFollowUp('')
    setRxItems([])
  }

  function addRxDrug(item: any) {
    setRxItems((prev) => [...prev, { catalog_item_id: item.id, free_text_name: item.name, qty: 1, dosage_instructions: '' }])
    setDrugQuery('')
    setDrugResults([])
  }

  function addRxFreeText() {
    setRxItems((prev) => [...prev, { catalog_item_id: null, free_text_name: '', qty: 1, dosage_instructions: '' }])
  }

  function updateRx(i: number, patch: Partial<RxRow>) {
    setRxItems((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function removeRx(i: number) {
    setRxItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function submitExam() {
    if (!patient || !doctorId) return
    setBusy(true)
    try {
      await api.post('/counter/doctor/examine', {
        branch_id: branchId,
        patient_id: patient.patient_id,
        doctor_id: doctorId,
        chief_complaint: chiefComplaint,
        diagnosis,
        notes,
        follow_up_at: followUp ? new Date(followUp).toISOString() : null,
        rx_items: rxItems.filter((r) => r.catalog_item_id || r.free_text_name.trim()),
      })
      toast.success('Examination saved — prescription sent to Pharmacy')
      setPatient(null)
      await loadQueue()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Counter 2 — Doctor" subtitle="Examine patient, write diagnosis + prescription (auto-sent to Pharmacy)" />
      <Tabs tabs={[{ id: 'queue', label: `Waiting (${queue.filter((q) => !q.examined).length})` }, { id: 'history', label: 'My Visit History' }]} active={tab} onChange={(t) => setTab(t as any)} />

      {tab === 'queue' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#005293]">Waiting Patients</h3>
              <button type="button" className="text-xs text-[#005293] hover:underline" onClick={() => void loadQueue()}>Refresh</button>
            </div>
            <div className="max-h-[32rem] overflow-auto space-y-2">
              {queue.length === 0 && <div className="text-slate-500 text-sm py-4 text-center border rounded-lg">No patients registered to you yet</div>}
              {queue.map((p) => (
                <button
                  type="button"
                  key={p.invoice_id}
                  className={`w-full text-left border-2 rounded-lg p-3 cursor-pointer ${patient?.invoice_id === p.invoice_id ? 'border-[#005293] bg-blue-50' : 'border-slate-200 hover:border-[#005293]/50'} ${p.examined ? 'opacity-60' : ''}`}
                  onClick={() => selectPatient(p)}
                >
                  <div className="font-semibold">{p.name} {p.examined && <span className="text-xs text-green-600">✓ examined</span>}</div>
                  <div className="text-xs text-slate-600">{p.uhid} · {p.age_years ? `${p.age_years}y` : ''} {p.gender} · {p.invoice_number}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 card space-y-3">
            {!patient ? (
              <p className="text-slate-500">Waiting list ကနေ လူနာ ရွေးပါ</p>
            ) : (
              <>
                <h3 className="font-semibold text-lg">{patient.name} — {patient.uhid}</h3>
                <input className="input" placeholder="Chief complaint" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
                <textarea className="input min-h-20" placeholder="Diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
                <textarea className="input min-h-20" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div>
                  <label className="text-sm text-slate-600">Follow-up date (optional)</label>
                  <input type="datetime-local" className="input" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="font-medium text-[#005293]">Prescription (→ Pharmacy)</div>
                  <div className="relative">
                    <input className="input" placeholder="Search drug/injection to add..." value={drugQuery} onChange={(e) => setDrugQuery(e.target.value)} />
                    {drugResults.length > 0 && (
                      <div className="absolute z-10 bg-white border rounded-lg shadow-lg mt-1 w-full max-h-48 overflow-auto">
                        {drugResults.map((d) => (
                          <button type="button" key={d.id} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm" onClick={() => addRxDrug(d)}>
                            {d.name} <span className="text-slate-400">({d.sku})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" className="btn btn-secondary text-sm" onClick={addRxFreeText}>+ Add free-text item</button>

                  {rxItems.map((r, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center border rounded-lg p-2">
                      {r.catalog_item_id ? (
                        <div className="col-span-4 text-sm font-medium">{r.free_text_name}</div>
                      ) : (
                        <input
                          className="input col-span-4"
                          placeholder="Drug / injection name"
                          value={r.free_text_name}
                          onChange={(e) => updateRx(i, { free_text_name: e.target.value })}
                        />
                      )}
                      <input
                        type="number"
                        className="input col-span-2"
                        placeholder="Qty"
                        value={r.qty}
                        onChange={(e) => updateRx(i, { qty: Number(e.target.value) || 1 })}
                      />
                      <input
                        className="input col-span-5"
                        placeholder="Dosage e.g. 1x3 for 5 days"
                        value={r.dosage_instructions}
                        onChange={(e) => updateRx(i, { dosage_instructions: e.target.value })}
                      />
                      <button type="button" className="col-span-1 text-red-600 text-sm" onClick={() => removeRx(i)}>✕</button>
                    </div>
                  ))}
                  {rxItems.length === 0 && <p className="text-xs text-slate-400">No prescription items added</p>}
                </div>

                <button type="button" disabled={busy} className="btn btn-primary w-full text-lg" onClick={submitExam}>
                  Save Examination & Send to Pharmacy
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="card space-y-2">
          {visits.length === 0 && <div className="text-slate-500 text-sm py-4 text-center">No visits yet</div>}
          {visits.map((v) => (
            <div key={v.id} className="border-b pb-2 mb-2 text-sm">
              <div className="font-medium">{v.diagnosis || '—'}</div>
              <div className="text-slate-500">{v.chief_complaint}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
