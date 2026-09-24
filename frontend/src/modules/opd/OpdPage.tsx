import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import { usePatients } from '../../hooks/usePatients'
import PageHeader from '../../components/PageHeader'
import PatientSelect from '../../components/PatientSelect'
import DataTable from '../../components/DataTable'
import { formatDate } from '../../lib/format'

export default function OpdPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const { name } = usePatients()
  const [visits, setVisits] = useState<any[]>([])
  const [form, setForm] = useState({ patient_id: '', diagnosis: '', prescription: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await api.get('/visits')
    setVisits(data)
  }

  useEffect(() => { void load() }, [])

  async function saveVisit() {
    if (!form.patient_id) return toast.error('Select patient')
    setBusy(true)
    try {
      await api.post('/visits', {
        patient_id: Number(form.patient_id),
        branch_id: branchId,
        diagnosis: form.diagnosis,
        prescription: form.prescription,
      })
      toast.success('Visit saved')
      setForm({ patient_id: '', diagnosis: '', prescription: '' })
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="OPD Clinic / EMR" subtitle="Consultation, diagnosis and prescription records" />
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-1 space-y-3">
          <h3 className="font-semibold">New Visit</h3>
          <PatientSelect className="input" value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} />
          <textarea className="input" rows={3} placeholder="Diagnosis" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
          <textarea className="input" rows={3} placeholder="Prescription" value={form.prescription} onChange={(e) => setForm({ ...form, prescription: e.target.value })} />
          <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={saveVisit}>Save Visit</button>
        </div>
        <div className="lg:col-span-2">
          <DataTable rows={visits} columns={[
            { key: 'id', label: '#', render: (r) => String(r.id) },
            { key: 'patient', label: 'Patient', render: (r) => name(Number(r.patient_id)) },
            { key: 'diagnosis', label: 'Diagnosis', render: (r) => String(r.diagnosis || '—') },
            { key: 'prescription', label: 'Rx', render: (r) => String(r.prescription || '—') },
            { key: 'date', label: 'Date', render: (r) => formatDate(String(r.created_at)) },
          ]} />
        </div>
      </div>
    </div>
  )
}
