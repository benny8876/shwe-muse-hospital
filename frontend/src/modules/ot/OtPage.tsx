import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import { usePatients } from '../../hooks/usePatients'
import PageHeader from '../../components/PageHeader'
import PatientSelect from '../../components/PatientSelect'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { formatDate, formatMoney } from '../../lib/format'

export default function OtPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const { name } = usePatients()
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState({ patient_id: '', procedure: '', scheduled_at: '' })

  async function load() {
    const { data } = await api.get('/services/ot', { params: { branch_id: branchId } })
    setRows(data)
  }

  useEffect(() => { void load() }, [branchId])

  async function schedule() {
    if (!form.patient_id || !form.procedure || !form.scheduled_at) return toast.error('Fill all fields')
    try {
      await api.post('/services/ot', {
        patient_id: Number(form.patient_id),
        branch_id: branchId,
        procedure: form.procedure,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
      })
      toast.success('Surgery scheduled')
      setForm({ patient_id: '', procedure: '', scheduled_at: '' })
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  return (
    <div>
      <PageHeader title="Operation Theater" subtitle="Surgery scheduling and team billing" />
      <div className="card max-w-2xl grid md:grid-cols-4 gap-2 mb-4">
        <PatientSelect className="input" value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} />
        <input className="input" placeholder="Procedure" value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })} />
        <input className="input" type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
        <button type="button" className="btn btn-primary" onClick={schedule}>Schedule</button>
      </div>
      <DataTable rows={rows} columns={[
        { key: 'id', label: '#', render: (r) => String(r.id) },
        { key: 'patient', label: 'Patient', render: (r) => name(Number(r.patient_id)) },
        { key: 'procedure', label: 'Procedure', render: (r) => String(r.procedure) },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
        { key: 'when', label: 'Scheduled', render: (r) => formatDate(String(r.scheduled_at)) },
        { key: 'fee', label: 'Surgeon Fee', render: (r) => formatMoney(Number(r.surgeon_fee)) },
      ]} />
    </div>
  )
}
