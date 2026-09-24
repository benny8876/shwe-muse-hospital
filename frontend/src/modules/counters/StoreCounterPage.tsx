import { useCallback, useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import Tabs from '../../components/Tabs'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import { formatMoney } from '../../lib/format'

const emptyReceiveForm = { item_id: '', qty: '', unit_cost: '', batch_no: '', expiry_date: '' }
const emptyWastageForm = { batch_id: '', qty: '', reason: 'damaged' }
const emptySupplierForm = { name: '', phone: '' }
const emptyMedForm = { name: '', sku: '', price: '', cost: '', min_stock: '10' }

export default function StoreCounterPage() {
  const toast = useToast()
  const [tab, setTab] = useState<'stock' | 'receive' | 'suppliers' | 'wastage'>('stock')
  const [items, setItems] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [warehouseId, setWarehouseId] = useState('')
  const [stockQuery, setStockQuery] = useState('')
  const [receiveForm, setReceiveForm] = useState(emptyReceiveForm)
  const [batches, setBatches] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm)
  const [wastage, setWastage] = useState<any[]>([])
  const [wastageForm, setWastageForm] = useState(emptyWastageForm)
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [medForm, setMedForm] = useState(emptyMedForm)
  const [editItem, setEditItem] = useState<any>(null)

  const loadItems = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory/items')
      setItems(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [toast])

  const loadBatches = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory/batches')
      setBatches(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [toast])

  const loadSuppliers = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory/suppliers')
      setSuppliers(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [toast])

  const loadWastage = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory/wastage')
      setWastage(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [toast])

  useEffect(() => {
    void loadItems()
    api.get('/inventory/warehouses').then((r) => {
      setWarehouses(r.data)
      if (r.data[0]) setWarehouseId(String(r.data[0].id))
    }).catch((e) => toast.error(getApiError(e)))
  }, [loadItems, toast])

  useEffect(() => {
    if (tab === 'receive') void loadBatches()
    if (tab === 'suppliers') void loadSuppliers()
    if (tab === 'wastage') { void loadBatches(); void loadWastage() }
  }, [tab, loadBatches, loadSuppliers, loadWastage])

  const stockRows = items.filter((row) => {
    const q = stockQuery.trim().toLowerCase()
    if (!q) return true
    return String(row.item.name).toLowerCase().includes(q) || String(row.item.sku).toLowerCase().includes(q)
  })

  async function submitReceive() {
    if (!receiveForm.item_id || !receiveForm.qty || !warehouseId) return toast.error('Item, warehouse, qty ထည့်ပါ')
    setBusy(true)
    try {
      await api.post('/inventory/receive', {
        item_id: Number(receiveForm.item_id),
        warehouse_id: Number(warehouseId),
        qty: Number(receiveForm.qty),
        unit_cost: Number(receiveForm.unit_cost) || 0,
        batch_no: receiveForm.batch_no,
        expiry_date: receiveForm.expiry_date || null,
      })
      toast.success('Stock received')
      setReceiveForm(emptyReceiveForm)
      await loadItems()
      await loadBatches()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function addSupplier() {
    if (!supplierForm.name.trim()) return toast.error('Supplier name required')
    setBusy(true)
    try {
      await api.post('/inventory/suppliers', supplierForm)
      toast.success('Supplier added')
      setSupplierForm(emptySupplierForm)
      await loadSuppliers()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function addMedicine() {
    if (!medForm.name.trim()) return toast.error('Item name required')
    setBusy(true)
    try {
      await api.post('/inventory/medicines', {
        name: medForm.name.trim(),
        sku: medForm.sku.trim(),
        price: Number(medForm.price) || 0,
        cost: Number(medForm.cost) || 0,
        min_stock: Number(medForm.min_stock) || 10,
      })
      toast.success('Item added')
      setMedForm(emptyMedForm)
      setAddOpen(false)
      await loadItems()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveItemEdit() {
    if (!editItem) return
    setBusy(true)
    try {
      await api.patch(`/inventory/medicines/${editItem.id}`, {
        name: editItem.name,
        price: Number(editItem.price),
        cost: Number(editItem.cost),
        min_stock: Number(editItem.min_stock),
      })
      toast.success('Updated')
      setEditItem(null)
      await loadItems()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function submitWastage() {
    if (!wastageForm.batch_id || !wastageForm.qty) return toast.error('Batch & qty ထည့်ပါ')
    setBusy(true)
    try {
      await api.post('/inventory/wastage', {
        batch_id: Number(wastageForm.batch_id),
        qty: Number(wastageForm.qty),
        reason: wastageForm.reason,
      })
      toast.success('Wastage submitted')
      setWastageForm(emptyWastageForm)
      await loadWastage()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Tabs
        tabs={[
          { id: 'stock', label: `Stock (${items.length})` },
          { id: 'receive', label: 'Stock In' },
          { id: 'suppliers', label: `Suppliers (${suppliers.length})` },
          { id: 'wastage', label: 'Stock Out' },
        ]}
        active={tab}
        onChange={(t) => setTab(t as typeof tab)}
      />

      {tab === 'stock' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select className="input max-w-xs" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>+ New Item</button>
          </div>
          <input className="input" placeholder="Search item / SKU" value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} />
          <DataTable
            rows={stockRows}
            columns={[
              { key: 'name', label: 'Item', render: (r) => r.item.name },
              { key: 'sku', label: 'SKU', render: (r) => r.item.sku },
              { key: 'cost', label: 'Buy Price', render: (r) => formatMoney(Number(r.item.cost)) },
              { key: 'price', label: 'Sell Price', render: (r) => formatMoney(Number(r.item.price)) },
              { key: 'on_hand', label: 'On Hand', render: (r) => <span className={r.is_low ? 'text-red-600 font-semibold' : ''}>{r.on_hand}</span> },
              { key: 'expiry', label: 'Nearest Expiry', render: (r) => r.nearest_expiry || '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.is_low ? 'LOW STOCK' : 'OK'} /> },
              { key: 'act', label: '', render: (r) => (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditItem({ id: r.item.id, name: r.item.name, price: r.item.price, cost: r.item.cost, min_stock: r.item.min_stock })}>Edit</button>
              ) },
            ]}
            emptyText="No stock items"
          />
        </div>
      )}

      {addOpen && (
        <Modal title="Add New Item" onClose={() => setAddOpen(false)}>
          <input className="input" placeholder="Item name *" value={medForm.name} onChange={(e) => setMedForm({ ...medForm, name: e.target.value })} />
          <input className="input" placeholder="SKU (auto if empty)" value={medForm.sku} onChange={(e) => setMedForm({ ...medForm, sku: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="number" placeholder="Buy price" value={medForm.cost} onChange={(e) => setMedForm({ ...medForm, cost: e.target.value })} />
            <input className="input" type="number" placeholder="Sell price" value={medForm.price} onChange={(e) => setMedForm({ ...medForm, price: e.target.value })} />
          </div>
          <input className="input" type="number" placeholder="Low stock alert qty" value={medForm.min_stock} onChange={(e) => setMedForm({ ...medForm, min_stock: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={addMedicine}>Save</button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setAddOpen(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title={`Edit — ${editItem.name}`} onClose={() => setEditItem(null)}>
          <input className="input" value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="number" placeholder="Buy price" value={editItem.cost} onChange={(e) => setEditItem({ ...editItem, cost: e.target.value })} />
            <input className="input" type="number" placeholder="Sell price" value={editItem.price} onChange={(e) => setEditItem({ ...editItem, price: e.target.value })} />
          </div>
          <input className="input" type="number" placeholder="Low stock alert" value={editItem.min_stock} onChange={(e) => setEditItem({ ...editItem, min_stock: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={saveItemEdit}>Save</button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditItem(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {tab === 'receive' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-800">Stock In</h3>
            <select className="input" value={receiveForm.item_id} onChange={(e) => setReceiveForm({ ...receiveForm, item_id: e.target.value })}>
              <option value="">Select item...</option>
              {items.map((row) => <option key={row.item.id} value={row.item.id}>{row.item.name}</option>)}
            </select>
            <select className="input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="number" placeholder="Qty" value={receiveForm.qty} onChange={(e) => setReceiveForm({ ...receiveForm, qty: e.target.value })} />
              <input className="input" type="number" placeholder="Unit cost" value={receiveForm.unit_cost} onChange={(e) => setReceiveForm({ ...receiveForm, unit_cost: e.target.value })} />
              <input className="input" placeholder="Batch no." value={receiveForm.batch_no} onChange={(e) => setReceiveForm({ ...receiveForm, batch_no: e.target.value })} />
              <input className="input" type="date" value={receiveForm.expiry_date} onChange={(e) => setReceiveForm({ ...receiveForm, expiry_date: e.target.value })} />
            </div>
            <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={submitReceive}>Receive Stock</button>
          </div>
          <div className="card">
            <DataTable
              rows={batches}
              columns={[
                { key: 'item', label: 'Item', render: (r) => String(r.item_name) },
                { key: 'batch', label: 'Batch', render: (r) => String(r.batch_no) },
                { key: 'qty', label: 'Qty', render: (r) => String(r.qty) },
                { key: 'expiry', label: 'Expiry', render: (r) => String(r.expiry_date || '—') },
              ]}
              emptyText="No batches yet"
            />
          </div>
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <input className="input" placeholder="Supplier name" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
            <input className="input" placeholder="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
            <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={addSupplier}>Add Supplier</button>
          </div>
          <div className="card">
            <DataTable rows={suppliers} columns={[
              { key: 'name', label: 'Name', render: (r) => String(r.name) },
              { key: 'phone', label: 'Phone', render: (r) => String(r.phone || '—') },
            ]} emptyText="No suppliers" />
          </div>
        </div>
      )}

      {tab === 'wastage' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <select className="input" value={wastageForm.batch_id} onChange={(e) => setWastageForm({ ...wastageForm, batch_id: e.target.value })}>
              <option value="">Select batch...</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.item_name} — {b.batch_no || 'no batch#'} (qty {b.qty})</option>)}
            </select>
            <input className="input" type="number" placeholder="Qty" value={wastageForm.qty} onChange={(e) => setWastageForm({ ...wastageForm, qty: e.target.value })} />
            <select className="input" value={wastageForm.reason} onChange={(e) => setWastageForm({ ...wastageForm, reason: e.target.value })}>
              <option value="expired">Expired</option>
              <option value="damaged">Damaged</option>
              <option value="other">Other</option>
            </select>
            <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={submitWastage}>Submit Wastage</button>
          </div>
          <div className="card">
            <DataTable rows={wastage} columns={[
              { key: 'batch', label: 'Batch', render: (r) => `#${r.batch_id}` },
              { key: 'qty', label: 'Qty', render: (r) => String(r.qty) },
              { key: 'reason', label: 'Reason', render: (r) => String(r.reason) },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
            ]} emptyText="No wastage requests" />
          </div>
        </div>
      )}
    </div>
  )
}
