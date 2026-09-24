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

export default function RadiologyPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const { name } = usePatients()
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState({ patient_id: '', modality: 'xray' })

  async function load() {
    const { data } = await api.get('/services/radiology', { params: { branch_id: branchId } })
    setRows(data)
  }

  useEffect(() => { void load() }, [branchId])

  async function create() {
    if (!form.patient_id) return toast.error('Select patient')
    try {
      await api.post('/services/radiology', { patient_id: Number(form.patient_id), branch_id: branchId, modality: form.modality })
      toast.success('Radiology order created')
      setForm({ patient_id: '', modality: 'xray' })
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  return (
    <div>
      <PageHeader title="Radiology" subtitle="X-Ray, CT, Ultrasound orders and billing" />
      <div className="card max-w-lg grid md:grid-cols-3 gap-2 mb-4">
        <PatientSelect className="input" value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} />
        <select className="input" value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })}>
          <option value="xray">X-Ray</option><option value="ct">CT</option><option value="ultrasound">Ultrasound</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={create}>Order</button>
      </div>
      <DataTable rows={rows} columns={[
        { key: 'id', label: '#', render: (r) => String(r.id) },
        { key: 'patient', label: 'Patient', render: (r) => name(Number(r.patient_id)) },
        { key: 'modality', label: 'Modality', render: (r) => String(r.modality) },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
        { key: 'date', label: 'Date', render: (r) => formatDate(String(r.created_at)) },
      ]} />
    </div>
  )
}
