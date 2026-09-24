import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import PageHeader from '../../components/PageHeader'
import Tabs from '../../components/Tabs'
import DataTable from '../../components/DataTable'

export default function InventoryPage() {
  const toast = useToast()
  const [tab, setTab] = useState('alerts')
  const [alerts, setAlerts] = useState<any>({ low_stock: [], near_expiry: [], expired: [] })
  const [batches, setBatches] = useState<any[]>([])
  const [wastage, setWastage] = useState<any[]>([])
  const [wForm, setWForm] = useState({ batch_id: '', qty: '1', reason: 'expired' })
  const [busy, setBusy] = useState(false)

  async function load() {
    const [a, b, w] = await Promise.all([
      api.get('/inventory/alerts'),
      api.get('/inventory/batches'),
      api.get('/inventory/wastage', { params: { status: 'pending' } }),
    ])
    setAlerts(a.data)
    setBatches(b.data)
    setWastage(w.data)
  }

  useEffect(() => { void load() }, [])

  async function requestWastage() {
    setBusy(true)
    try {
      await api.post('/inventory/wastage', { batch_id: Number(wForm.batch_id), qty: Number(wForm.qty), reason: wForm.reason })
      toast.success('Wastage requested')
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function approve(id: number) {
    setBusy(true)
    try {
      await api.post(`/inventory/wastage/${id}/approve`)
      toast.success('Wastage approved')
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Inventory & Stock" subtitle="Alerts, batches, wastage approval" />
      <Tabs tabs={[{ id: 'alerts', label: 'Alerts' }, { id: 'batches', label: 'Batches' }, { id: 'wastage', label: 'Wastage' }]} active={tab} onChange={setTab} />

      {tab === 'alerts' && (
        <div className="space-y-4">
          <DataTable rows={alerts.low_stock || []} columns={[
            { key: 'name', label: 'Item', render: (r) => String(r.name) },
            { key: 'qty', label: 'On Hand', render: (r) => String(r.qty) },
            { key: 'min', label: 'Min', render: (r) => String(r.min) },
          ]} emptyText="No low stock alerts" />
          <DataTable rows={alerts.near_expiry || []} columns={[
            { key: 'item', label: 'Item', render: (r) => String(r.item) },
            { key: 'batch_no', label: 'Batch', render: (r) => String(r.batch_no) },
            { key: 'expiry', label: 'Expiry', render: (r) => String(r.expiry) },
          ]} emptyText="No near-expiry batches" />
        </div>
      )}

      {tab === 'batches' && (
        <DataTable rows={batches} columns={[
          { key: 'item_name', label: 'Item', render: (r) => String(r.item_name) },
          { key: 'batch_no', label: 'Batch', render: (r) => String(r.batch_no) },
          { key: 'qty', label: 'Qty', render: (r) => String(r.qty) },
          { key: 'expiry', label: 'Expiry', render: (r) => String(r.expiry_date) },
        ]} />
      )}

      {tab === 'wastage' && (
        <div className="space-y-4">
          <div className="card max-w-lg grid md:grid-cols-3 gap-2">
            <select className="input" value={wForm.batch_id} onChange={(e) => setWForm({ ...wForm, batch_id: e.target.value })}>
              <option value="">Batch...</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.item_name} {b.batch_no}</option>)}
            </select>
            <input className="input" placeholder="Qty" value={wForm.qty} onChange={(e) => setWForm({ ...wForm, qty: e.target.value })} />
            <button type="button" disabled={busy} className="btn btn-primary" onClick={requestWastage}>Request</button>
          </div>
          <DataTable rows={wastage} columns={[
            { key: 'id', label: '#', render: (r) => String(r.id) },
            { key: 'batch_id', label: 'Batch', render: (r) => String(r.batch_id) },
            { key: 'qty', label: 'Qty', render: (r) => String(r.qty) },
            { key: 'reason', label: 'Reason', render: (r) => String(r.reason) },
            { key: 'act', label: '', render: (r) => (
              <button type="button" className="btn btn-secondary !py-1" onClick={() => approve(Number(r.id))}>Approve</button>
            ) },
          ]} />
        </div>
      )}
    </div>
  )
}
