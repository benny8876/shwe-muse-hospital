import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import PageHeader from '../../components/PageHeader'
import Tabs from '../../components/Tabs'
import PatientSelect from '../../components/PatientSelect'
import DataTable from '../../components/DataTable'
export default function PharmacyPage() {
  const toast = useToast()
  const [tab, setTab] = useState('dispense')
  const [items, setItems] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [narcotics, setNarcotics] = useState<any[]>([])
  const [form, setForm] = useState({ item_id: '', warehouse_id: '', qty: '1', patient_id: '' })
  const [busy, setBusy] = useState(false)

  async function load() {
    const [i, w, n] = await Promise.all([
      api.get('/inventory/items'),
      api.get('/inventory/warehouses'),
      api.get('/inventory/narcotics'),
    ])
    setItems(i.data)
    setWarehouses(w.data)
    setNarcotics(n.data)
    if (w.data[0]) setForm((f) => ({ ...f, warehouse_id: String(w.data[0].id) }))
  }

  useEffect(() => { void load() }, [])

  async function dispense() {
    if (!form.item_id || !form.warehouse_id) return toast.error('Select item and warehouse')
    setBusy(true)
    try {
      await api.post('/inventory/dispense', {
        item_id: Number(form.item_id),
        warehouse_id: Number(form.warehouse_id),
        qty: Number(form.qty),
        patient_id: form.patient_id ? Number(form.patient_id) : null,
        ref: 'pharmacy-dispense',
      })
      toast.success('Dispensed successfully')
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Pharmacy" subtitle="Dispense medicines and track controlled drugs" />
      <Tabs tabs={[{ id: 'dispense', label: 'Dispense' }, { id: 'stock', label: 'Stock' }, { id: 'narcotics', label: 'Narcotics' }]} active={tab} onChange={setTab} />

      {tab === 'dispense' && (
        <div className="card max-w-lg space-y-3">
          <select className="input" value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })}>
            <option value="">Select medicine...</option>
            {items.map((r) => <option key={r.item.id} value={r.item.id}>{r.item.name} (on hand: {r.on_hand})</option>)}
          </select>
          <select className="input" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <PatientSelect className="input" value={form.patient_id} onChange={(v) => setForm({ ...form, patient_id: v })} />
          <input className="input" type="number" placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          <button type="button" disabled={busy} className="btn btn-primary" onClick={dispense}>Dispense</button>
        </div>
      )}

      {tab === 'stock' && (
        <DataTable rows={items.map((r) => ({ id: r.item.id, sku: r.item.sku, name: r.item.name, on_hand: r.on_hand, min: r.item.min_stock }))} columns={[
          { key: 'sku', label: 'SKU', render: (r) => String(r.sku) },
          { key: 'name', label: 'Name', render: (r) => String(r.name) },
          { key: 'on_hand', label: 'On Hand', render: (r) => String(r.on_hand) },
          { key: 'min', label: 'Min', render: (r) => String(r.min) },
        ]} />
      )}

      {tab === 'narcotics' && (
        <DataTable rows={narcotics} columns={[
          { key: 'item_id', label: 'Item', render: (r) => String(r.item_id) },
          { key: 'qty', label: 'Qty', render: (r) => String(r.qty) },
          { key: 'direction', label: 'Dir', render: (r) => String(r.direction) },
          { key: 'patient_id', label: 'Patient', render: (r) => String(r.patient_id || '—') },
        ]} />
      )}
    </div>
  )
}
