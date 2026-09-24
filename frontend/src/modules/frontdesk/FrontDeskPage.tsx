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
import { formatDate } from '../../lib/format'

export default function FrontDeskPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const { patients } = usePatients()
  const [tab, setTab] = useState('register')
  const [queue, setQueue] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [doctors, setDoctors] = useState<any[]>([])
  const [apptForm, setApptForm] = useState({ patient_id: '', doctor_id: '', scheduled_at: '' })
  const [form, setForm] = useState({ name: '', phone: '', gender: 'F' })
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadQueue() {
    const { data } = await api.get('/queue', { params: { branch_id: branchId, department: 'OPD' } })
    setQueue(data)
  }

  useEffect(() => { void loadQueue() }, [branchId])

  useEffect(() => {
    api.get('/doctors').then((r) => setDoctors(r.data)).catch(() => {})
  }, [])

  async function loadAppointments() {
    const { data } = await api.get('/appointments', { params: { branch_id: branchId } })
    setAppointments(data)
  }

  useEffect(() => {
    if (tab === 'appointments') void loadAppointments()
  }, [tab, branchId])

  async function bookAppointment() {
    if (!apptForm.patient_id || !apptForm.doctor_id || !apptForm.scheduled_at) return toast.error('Fill all fields')
    setBusy(true)
    try {
      await api.post('/appointments', null, {
        params: {
          patient_id: Number(apptForm.patient_id),
          doctor_id: Number(apptForm.doctor_id),
          branch_id: branchId,
          scheduled_at: new Date(apptForm.scheduled_at).toISOString(),
        },
      })
      toast.success('Appointment booked')
      setApptForm({ patient_id: '', doctor_id: '', scheduled_at: '' })
      await loadAppointments()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function register() {
    if (!form.name.trim()) return toast.error('Name required')
    setBusy(true)
    try {
      await api.post('/patients', form)
      toast.success('Patient registered')
      setForm({ name: '', phone: '', gender: 'F' })
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function takeToken(patientId?: number) {
    setBusy(true)
    try {
      await api.post('/queue', { branch_id: branchId, department: 'OPD', patient_id: patientId ?? null })
      toast.success('Token issued')
      await loadQueue()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function callToken(id: number) {
    try {
      await api.patch(`/queue/${id}/call`)
      toast.success('Token called')
      await loadQueue()
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  const filtered = patients.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.uhid.includes(search))

  return (
    <div>
      <PageHeader title="Front Desk" subtitle="Register patients, issue queue tokens, manage flow" />
      <Tabs tabs={[
        { id: 'register', label: 'Register' },
        { id: 'queue', label: 'Queue' },
        { id: 'appointments', label: 'Appointments' },
        { id: 'patients', label: 'Patients' },
      ]} active={tab} onChange={setTab} />

      {tab === 'register' && (
        <div className="card max-w-md space-y-3">
          <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="F">Female</option><option value="M">Male</option>
          </select>
          <button type="button" disabled={busy} className="btn btn-primary" onClick={register}>Register (UHID)</button>
        </div>
      )}

      {tab === 'queue' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <button type="button" className="btn btn-primary" onClick={() => takeToken()}>Walk-in Token</button>
            {queue.map((t) => (
              <div key={t.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="text-2xl font-bold">{t.number}</div>
                  <StatusBadge value={t.status} />
                </div>
                {t.status === 'waiting' && (
                  <button type="button" className="btn btn-secondary !py-1" onClick={() => callToken(t.id)}>Call</button>
                )}
              </div>
            ))}
          </div>
          <div className="card text-sm text-slate-600">
            Open <strong>/kiosk</strong> on waiting room TV to display queue numbers.
          </div>
        </div>
      )}

      {tab === 'appointments' && (
        <div className="space-y-4">
          <div className="card max-w-2xl grid md:grid-cols-4 gap-2">
            <PatientSelect className="input" value={apptForm.patient_id} onChange={(v) => setApptForm({ ...apptForm, patient_id: v })} />
            <select className="input" value={apptForm.doctor_id} onChange={(e) => setApptForm({ ...apptForm, doctor_id: e.target.value })}>
              <option value="">Doctor...</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
            </select>
            <input className="input" type="datetime-local" value={apptForm.scheduled_at} onChange={(e) => setApptForm({ ...apptForm, scheduled_at: e.target.value })} />
            <button type="button" disabled={busy} className="btn btn-primary" onClick={bookAppointment}>Book</button>
          </div>
          <DataTable rows={appointments} columns={[
            { key: 'id', label: '#', render: (r) => String(r.id) },
            { key: 'patient_id', label: 'Patient', render: (r) => String(r.patient_id) },
            { key: 'doctor_id', label: 'Doctor', render: (r) => String(r.doctor_id) },
            { key: 'when', label: 'Scheduled', render: (r) => formatDate(String(r.scheduled_at)) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
          ]} />
        </div>
      )}

      {tab === 'patients' && (
        <div className="space-y-3">
          <input className="input max-w-md" placeholder="Search name / UHID" value={search} onChange={(e) => setSearch(e.target.value)} />
          <DataTable rows={filtered as unknown as Record<string, unknown>[]} columns={[
            { key: 'uhid', label: 'UHID', render: (r) => String(r.uhid) },
            { key: 'name', label: 'Name', render: (r) => String(r.name) },
            { key: 'phone', label: 'Phone', render: (r) => String(r.phone || '—') },
            { key: 'act', label: '', render: (r) => (
              <button type="button" className="btn btn-secondary !py-1" onClick={() => takeToken(Number(r.id))}>Token</button>
            ) },
          ]} />
        </div>
      )}
    </div>
  )
}
