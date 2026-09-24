import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import { usePatients } from '../../hooks/usePatients'
import PageHeader from '../../components/PageHeader'
import PatientSelect from '../../components/PatientSelect'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { formatDate } from '../../lib/format'

export default function EmergencyPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const { name } = usePatients()
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState({ patient_id: '', service_type: 'ambulance' })

  async function load() {
    const { data } = await api.get('/services/extra', { params: { branch_id: branchId } })
    setRows(data)
  }

  useEffect(() => { void load() }, [branchId])

  async function create() {
    if (!form.patient_id) return toast.error('Select patient')
    try {
      await api.post('/services/extra', { patient_id: Number(form.patient_id), branch_id: branchId, service_type: form.service_type })
      toast.success('Service order created')
      setForm({ patient_id: '', service_type: 'ambulance' })
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  return (
    <div>
      <PageHeader title="Emergency / Ambulance" subtitle="ER, ambulance, dialysis and rehab services" />
      <div className="card max-w-lg grid md:grid-cols-3 gap-2 mb-4">
        <PatientSelect className="input" value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} />
        <select className="input" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })}>
          <option value="ambulance">Ambulance</option>
          <option value="emergency">Emergency</option>
          <option value="dialysis">Dialysis</option>
          <option value="physio">Physiotherapy</option>
          <option value="rehab">Rehab</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={create}>Create Order</button>
      </div>
      <DataTable rows={rows} columns={[
        { key: 'id', label: '#', render: (r) => String(r.id) },
        { key: 'patient', label: 'Patient', render: (r) => name(Number(r.patient_id)) },
        { key: 'service_type', label: 'Service', render: (r) => String(r.service_type) },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
        { key: 'date', label: 'Date', render: (r) => formatDate(String(r.created_at)) },
      ]} />
    </div>
  )
}
