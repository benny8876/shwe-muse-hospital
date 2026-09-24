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

const STATUSES = ['ordered', 'collected', 'in_lab', 'result', 'billed']

export default function LabPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const { name } = usePatients()
  const [tab, setTab] = useState('orders')
  const [rows, setRows] = useState<any[]>([])
  const [form, setForm] = useState({ patient_id: '', tests: '' })
  const [resultText, setResultText] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await api.get('/services/lab', { params: { branch_id: branchId } })
    setRows(data)
  }

  useEffect(() => { void load() }, [branchId])

  async function createOrder() {
    if (!form.patient_id || !form.tests) return toast.error('Patient and tests required')
    setBusy(true)
    try {
      await api.post('/services/lab', { patient_id: Number(form.patient_id), branch_id: branchId, tests: form.tests })
      toast.success('Lab order created')
      setForm({ patient_id: '', tests: '' })
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function updateStatus(id: number, status: string) {
    setBusy(true)
    try {
      await api.patch(`/services/lab/${id}`, null, { params: { status, result: resultText[id] || '' } })
      toast.success(`Status → ${status}`)
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Laboratory" subtitle="Test orders, sample tracking and results" />
      <Tabs tabs={[{ id: 'orders', label: 'Orders' }, { id: 'new', label: 'New Order' }]} active={tab} onChange={setTab} />

      {tab === 'new' && (
        <div className="card max-w-lg space-y-3">
          <PatientSelect className="input" value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} />
          <input className="input" placeholder="Tests (e.g. CBC, RBS)" value={form.tests} onChange={(e) => setForm({ ...form, tests: e.target.value })} />
          <button type="button" disabled={busy} className="btn btn-primary" onClick={createOrder}>Create Order</button>
        </div>
      )}

      {tab === 'orders' && (
        <DataTable
          rows={rows}
          columns={[
            { key: 'sample', label: 'Sample', render: (r) => String(r.sample_id) },
            { key: 'patient', label: 'Patient', render: (r) => name(Number(r.patient_id)) },
            { key: 'tests', label: 'Tests', render: (r) => String(r.tests) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
            { key: 'date', label: 'Date', render: (r) => formatDate(String(r.created_at)) },
            { key: 'actions', label: 'Workflow', render: (r) => (
              <div className="flex flex-wrap gap-1">
                {STATUSES.map((s) => (
                  <button key={s} type="button" className="btn btn-secondary !py-1 !px-2 text-xs" onClick={() => updateStatus(Number(r.id), s)}>{s}</button>
                ))}
              </div>
            ) },
            { key: 'result', label: 'Result', render: (r) => (
              <input className="input !py-1" placeholder="Result" value={resultText[Number(r.id)] || ''} onChange={(e) => setResultText({ ...resultText, [Number(r.id)]: e.target.value })} />
            ) },
          ]}
        />
      )}
    </div>
  )
}
