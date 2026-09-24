import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import { usePatients } from '../../hooks/usePatients'
import PageHeader from '../../components/PageHeader'
import Tabs from '../../components/Tabs'
import PatientSelect from '../../components/PatientSelect'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { formatMoney } from '../../lib/format'

type Bed = { id: number; code: string; status: string; ward_id: number; daily_rate: number }
type Ward = { id: number; name: string; category: string }
type Admission = { id: number; patient_id: number; bed_id: number; status: string; deposit: number; billing_mode: string }

export default function IpdPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const { name } = usePatients()
  const [tab, setTab] = useState('beds')
  const [wards, setWards] = useState<Ward[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [selected, setSelected] = useState<Admission | null>(null)
  const [bill, setBill] = useState<any>(null)
  const [vitals, setVitals] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [admitForm, setAdmitForm] = useState({ patient_id: '', bed_id: '', deposit: '0', billing_mode: 'daily' })
  const [vitalForm, setVitalForm] = useState({ bp: '', pulse: '', temp: '', spo2: '', weight: '' })
  const [noteText, setNoteText] = useState('')
  const [dischargeSummary, setDischargeSummary] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [w, b, a] = await Promise.all([
      api.get('/ipd/wards', { params: { branch_id: branchId } }),
      api.get('/ipd/beds'),
      api.get('/ipd/admissions', { params: { branch_id: branchId, status: 'admitted' } }),
    ])
    setWards(w.data)
    setBeds(b.data)
    setAdmissions(a.data)
  }

  async function loadDetail(adm: Admission) {
    setSelected(adm)
    const [billRes, v, n] = await Promise.all([
      api.get(`/ipd/admissions/${adm.id}/bill`),
      api.get(`/ipd/admissions/${adm.id}/vitals`),
      api.get(`/ipd/admissions/${adm.id}/notes`),
    ])
    setBill(billRes.data)
    setVitals(v.data)
    setNotes(n.data)
  }

  useEffect(() => { void load() }, [branchId])

  async function admit() {
    if (!admitForm.patient_id || !admitForm.bed_id) return toast.error('Patient and bed required')
    setBusy(true)
    try {
      await api.post('/ipd/admit', {
        patient_id: Number(admitForm.patient_id),
        branch_id: branchId,
        bed_id: Number(admitForm.bed_id),
        deposit: Number(admitForm.deposit),
        billing_mode: admitForm.billing_mode,
      })
      toast.success('Patient admitted')
      setAdmitForm({ patient_id: '', bed_id: '', deposit: '0', billing_mode: 'daily' })
      await load()
      setTab('admissions')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function dailyCharge() {
    if (!selected) return
    setBusy(true)
    try {
      await api.post(`/ipd/admissions/${selected.id}/daily-charge`)
      toast.success('Daily charge added')
      await loadDetail(selected)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveVitals() {
    if (!selected) return
    setBusy(true)
    try {
      await api.post(`/ipd/admissions/${selected.id}/vitals`, vitalForm)
      toast.success('Vitals saved')
      setVitalForm({ bp: '', pulse: '', temp: '', spo2: '', weight: '' })
      await loadDetail(selected)
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
      toast.success('Note saved')
      setNoteText('')
      await loadDetail(selected)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function discharge() {
    if (!selected) return
    setBusy(true)
    try {
      await api.post(`/ipd/admissions/${selected.id}/discharge`, { summary: dischargeSummary })
      toast.success('Patient discharged')
      setSelected(null)
      setBill(null)
      await load()
      setTab('admissions')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  const availableBeds = beds.filter((b) => b.status === 'available')

  return (
    <div>
      <PageHeader title="IPD / Ward Management" subtitle="Admit, monitor, bill and discharge inpatients" />
      <Tabs tabs={[{ id: 'beds', label: 'Bed Map' }, { id: 'admit', label: 'Admit' }, { id: 'admissions', label: 'Active' }, { id: 'detail', label: 'Care' }]} active={tab} onChange={setTab} />

      {tab === 'beds' && (
        <div className="grid md:grid-cols-3 gap-4">
          {wards.map((w) => (
            <div key={w.id} className="card">
              <h3 className="font-semibold mb-2">{w.name}</h3>
              <div className="grid grid-cols-3 gap-2">
                {beds.filter((b) => b.ward_id === w.id).map((b) => (
                  <div key={b.id} className={`rounded-lg p-2 text-center text-sm border ${b.status === 'available' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="font-bold">{b.code}</div>
                    <StatusBadge value={b.status} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'admit' && (
        <div className="card max-w-xl space-y-3">
          <PatientSelect className="input" value={admitForm.patient_id} onChange={(v) => setAdmitForm({ ...admitForm, patient_id: v })} />
          <select className="input" value={admitForm.bed_id} onChange={(e) => setAdmitForm({ ...admitForm, bed_id: e.target.value })}>
            <option value="">Select bed...</option>
            {availableBeds.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
          </select>
          <input className="input" placeholder="Deposit" value={admitForm.deposit} onChange={(e) => setAdmitForm({ ...admitForm, deposit: e.target.value })} />
          <select className="input" value={admitForm.billing_mode} onChange={(e) => setAdmitForm({ ...admitForm, billing_mode: e.target.value })}>
            <option value="daily">Daily</option><option value="hourly">Hourly</option><option value="package">Package</option>
          </select>
          <button type="button" disabled={busy} className="btn btn-primary" onClick={admit}>Admit Patient</button>
        </div>
      )}

      {tab === 'admissions' && (
        <DataTable
          rows={admissions as unknown as Record<string, unknown>[]}
          columns={[
            { key: 'id', label: '#', render: (r) => String(r.id) },
            { key: 'patient', label: 'Patient', render: (r) => name(Number(r.patient_id)) },
            { key: 'bed', label: 'Bed', render: (r) => String(r.bed_id) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
            { key: 'action', label: '', render: (r) => (
              <button type="button" className="btn btn-secondary !py-1" onClick={() => { void loadDetail(r as unknown as Admission); setTab('detail') }}>Open</button>
            ) },
          ]}
        />
      )}

      {tab === 'detail' && (
        selected ? (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card space-y-3">
              <h3 className="font-semibold">{name(selected.patient_id)}</h3>
              <button type="button" disabled={busy} className="btn btn-primary !py-2" onClick={dailyCharge}>Daily Charge</button>
              <button type="button" disabled={busy} className="btn btn-secondary !py-2" onClick={discharge}>Discharge</button>
              <textarea className="input" rows={2} placeholder="Discharge summary" value={dischargeSummary} onChange={(e) => setDischargeSummary(e.target.value)} />
              {bill && <div className="text-sm">Bill {bill.number}: {formatMoney(bill.balance)} balance</div>}
            </div>
            <div className="space-y-4">
              <div className="card space-y-2">
                <h4 className="font-semibold">Vitals</h4>
                <div className="grid grid-cols-2 gap-2">
                  {(['bp', 'pulse', 'temp', 'spo2', 'weight'] as const).map((k) => (
                    <input key={k} className="input" placeholder={k} value={vitalForm[k]} onChange={(e) => setVitalForm({ ...vitalForm, [k]: e.target.value })} />
                  ))}
                </div>
                <button type="button" className="btn btn-primary" onClick={saveVitals}>Save</button>
                {vitals.length > 0 && (
                  <div className="text-xs space-y-1 max-h-32 overflow-auto">
                    {vitals.map((v) => (
                      <div key={v.id} className="border-b py-1">{v.bp || '—'} · {v.pulse || '—'} · {v.temp || '—'}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="card space-y-2">
                <h4 className="font-semibold">Notes</h4>
                <textarea className="input" rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <button type="button" className="btn btn-primary" onClick={saveNote}>Save</button>
                {notes.length > 0 && (
                  <div className="text-xs space-y-1 max-h-32 overflow-auto">
                    {notes.map((n) => (
                      <div key={n.id} className="border-b py-1">{n.note}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : <div className="card text-slate-500">Select admission from Active tab</div>
      )}
    </div>
  )
}
