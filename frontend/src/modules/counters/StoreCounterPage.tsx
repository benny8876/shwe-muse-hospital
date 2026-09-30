import { useCallback, useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import Tabs from '../../components/Tabs'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Alert from '../../components/Alert'
import Modal from '../../components/Modal'
import ToggleGroup from '../../components/ToggleGroup'
import { formatMoney } from '../../lib/format'
import LabReagentTestPicker, { type LabTestLink, type LabTestOption } from '../../components/LabReagentTestPicker'

type StoreTab = 'stock' | 'alerts' | 'receive' | 'suppliers' | 'wastage'
type StockDept = 'pharmacy' | 'lab' | 'xray' | 'usg'

const STOCK_DEPTS: { value: StockDept; label: string }[] = [
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'lab', label: 'Lab' },
  { value: 'xray', label: 'X-ray' },
  { value: 'usg', label: 'USG' },
]

const emptyReceiveForm = { item_id: '', qty: '', unit_cost: '', batch_no: '', expiry_date: '' }
const emptyWastageForm = { batch_id: '', qty: '', reason: 'damaged' }
const emptySupplierForm = { name: '', phone: '' }
const emptyMedForm = { name: '', sku: '', price: '', cost: '', min_stock: '10' }
const emptyAlerts = { low_stock: [] as any[], near_expiry: [] as any[], expired: [] as any[] }

export default function StoreCounterPage() {
  const toast = useToast()
  const [tab, setTab] = useState<StoreTab>('stock')
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
  const [alerts, setAlerts] = useState(emptyAlerts)
  const [dept, setDept] = useState<StockDept>('pharmacy')
  const [labBillableTests, setLabBillableTests] = useState<LabTestOption[]>([])
  const [labTestLinks, setLabTestLinks] = useState<LabTestLink[]>([])
  const [editLabTestLinks, setEditLabTestLinks] = useState<LabTestLink[]>([])

  const loadItems = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { department: dept }
      if (warehouseId) params.warehouse_id = Number(warehouseId)
      const { data } = await api.get('/inventory/items', { params })
      setItems(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [toast, warehouseId, dept])

  const loadAlerts = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { department: dept }
      if (warehouseId) params.warehouse_id = Number(warehouseId)
      const { data } = await api.get('/inventory/alerts', { params })
      setAlerts(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [toast, warehouseId, dept])

  const loadBatches = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { department: dept }
      if (warehouseId) params.warehouse_id = Number(warehouseId)
      const { data } = await api.get('/inventory/batches', { params })
      setBatches(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [toast, warehouseId, dept])

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

  const loadLabBillableTests = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory/lab-tests')
      setLabBillableTests(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [toast])

  useEffect(() => {
    if (dept === 'lab') void loadLabBillableTests()
  }, [dept, loadLabBillableTests])

  useEffect(() => {
    api.get('/inventory/warehouses').then((r) => {
      setWarehouses(r.data)
      if (r.data[0]) setWarehouseId(String(r.data[0].id))
    }).catch((e) => toast.error(getApiError(e)))
  }, [toast])

  useEffect(() => {
    if (!warehouseId) return
    void loadItems()
    void loadAlerts()
  }, [warehouseId, loadItems, loadAlerts])

  // Pull-only alert refresh — badge count stays current without push notifications.
  useEffect(() => {
    if (!warehouseId) return
    const id = setInterval(() => { void loadAlerts() }, 30000)
    return () => clearInterval(id)
  }, [warehouseId, loadAlerts])

  useEffect(() => {
    if (tab === 'alerts') void loadAlerts()
    if (tab === 'receive') void loadBatches()
    if (tab === 'suppliers') void loadSuppliers()
    if (tab === 'wastage') { void loadBatches(); void loadWastage() }
  }, [tab, loadAlerts, loadBatches, loadSuppliers, loadWastage])

  const alertCount =
    (alerts.low_stock?.length || 0) +
    (alerts.near_expiry?.length || 0) +
    (alerts.expired?.length || 0)

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
      await loadAlerts()
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
        department: dept,
        lab_tests: dept === 'lab' ? labTestLinks : [],
      })
      toast.success('Item added')
      setMedForm(emptyMedForm)
      setLabTestLinks([])
      setAddOpen(false)
      await loadItems()
      await loadAlerts()
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
      const patch: Record<string, unknown> = {
        name: editItem.name,
        cost: Number(editItem.cost),
        min_stock: Number(editItem.min_stock),
      }
      if (dept !== 'lab') patch.price = Number(editItem.price) || 0
      if (dept === 'lab') patch.lab_tests = editLabTestLinks
      await api.patch(`/inventory/medicines/${editItem.id}`, patch)
      toast.success('Updated')
      setEditItem(null)
      await loadItems()
      await loadAlerts()
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
      await loadAlerts()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  const deptLabel = STOCK_DEPTS.find((d) => d.value === dept)?.label || dept

  return (
    <div>
      <ToggleGroup
        className="mb-4"
        options={STOCK_DEPTS}
        value={dept}
        onChange={(v) => {
          setDept(v as StockDept)
          setReceiveForm(emptyReceiveForm)
          setStockQuery('')
        }}
      />
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className="input max-w-xs" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {alertCount > 0 && (
          <span className="text-sm text-red-600 font-medium">{alertCount} alert{alertCount === 1 ? '' : 's'}</span>
        )}
      </div>

      <Tabs
        tabs={[
          { id: 'stock', label: `Stock (${items.length})` },
          { id: 'alerts', label: alertCount > 0 ? `Alerts (${alertCount})` : 'Alerts' },
          { id: 'receive', label: 'Stock In' },
          { id: 'suppliers', label: `Suppliers (${suppliers.length})` },
          { id: 'wastage', label: 'Stock Out' },
        ]}
        active={tab}
        onChange={(t) => setTab(t as StoreTab)}
      />

      {tab === 'stock' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setLabTestLinks([])
                setAddOpen(true)
              }}
            >
              + New {deptLabel} Item
            </button>
          </div>
          <input className="input" placeholder="Search item / SKU" value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} />
          <DataTable
            rows={stockRows}
            columns={[
              { key: 'name', label: 'Item', render: (r) => r.item.name },
              { key: 'sku', label: 'SKU', render: (r) => r.item.sku },
              { key: 'cost', label: 'Buy Price', render: (r) => formatMoney(Number(r.item.cost)) },
              ...(dept !== 'lab' ? [{
                key: 'price',
                label: 'Sell Price',
                render: (r: any) => {
                  const p = Number(r.item.price)
                  return p > 0 ? formatMoney(p) : <span className="text-slate-400">—</span>
                },
              }] : []),
              { key: 'on_hand', label: 'On Hand', render: (r) => <span className={r.is_low ? 'text-red-600 font-semibold' : ''}>{r.on_hand}</span> },
              ...(dept === 'lab' ? [{
                key: 'tests',
                label: 'Used for tests',
                render: (r: any) => {
                  const links = r.lab_tests || []
                  if (!links.length) return <span className="text-slate-400">—</span>
                  const text = links.map((l: any) => l.test_name).join(', ')
                  return <span className="text-xs text-slate-600 line-clamp-2" title={text}>{text}</span>
                },
              }] : []),
              { key: 'expiry', label: 'Nearest Expiry', render: (r) => r.nearest_expiry || '—' },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.is_low ? 'LOW STOCK' : 'OK'} /> },
              { key: 'act', label: '', render: (r) => (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditItem({ id: r.item.id, name: r.item.name, price: r.item.price, cost: r.item.cost, min_stock: r.item.min_stock })
                    setEditLabTestLinks((r.lab_tests || []).map((l: any) => ({ test_item_id: l.test_item_id, qty: l.qty })))
                  }}
                >
                  Edit
                </button>
              ) },
            ]}
            emptyText={`No ${deptLabel} stock items`}
          />
        </div>
      )}

      {tab === 'alerts' && (
        <div className="space-y-4">
          <Alert tone="info">
            {deptLabel} — low stock, near-expiry (30 days), and expired batches for the selected warehouse. Refreshes every 30 seconds.
          </Alert>

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="card">
              <h3 className="font-semibold text-slate-800 mb-2">Low Stock ({alerts.low_stock?.length || 0})</h3>
              <DataTable
                rows={alerts.low_stock || []}
                wrapperClassName="max-h-96"
                columns={[
                  { key: 'name', label: 'Item', render: (r) => String(r.name) },
                  { key: 'qty', label: 'On Hand', render: (r) => <span className="text-red-600 font-semibold">{r.qty}</span> },
                  { key: 'min', label: 'Min', render: (r) => String(r.min) },
                ]}
                emptyText="No low stock alerts"
              />
            </div>

            <div className="card">
              <h3 className="font-semibold text-slate-800 mb-2">Near Expiry ({alerts.near_expiry?.length || 0})</h3>
              <DataTable
                rows={alerts.near_expiry || []}
                wrapperClassName="max-h-96"
                columns={[
                  { key: 'item', label: 'Item', render: (r) => String(r.item) },
                  { key: 'batch_no', label: 'Batch', render: (r) => String(r.batch_no) },
                  { key: 'expiry', label: 'Expiry', render: (r) => String(r.expiry) },
                  { key: 'qty', label: 'Qty', render: (r) => String(r.qty) },
                ]}
                emptyText="No near-expiry batches"
              />
            </div>

            <div className="card">
              <h3 className="font-semibold text-slate-800 mb-2">Expired ({alerts.expired?.length || 0})</h3>
              <DataTable
                rows={alerts.expired || []}
                wrapperClassName="max-h-96"
                columns={[
                  { key: 'item', label: 'Item', render: (r) => String(r.item) },
                  { key: 'batch_no', label: 'Batch', render: (r) => String(r.batch_no) },
                  { key: 'expiry', label: 'Expiry', render: (r) => <span className="text-red-600 font-semibold">{r.expiry}</span> },
                  { key: 'qty', label: 'Qty', render: (r) => String(r.qty) },
                ]}
                emptyText="No expired batches"
              />
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <Modal title={`Add ${deptLabel} item`} onClose={() => setAddOpen(false)}>
          <input className="input" placeholder="Item name *" value={medForm.name} onChange={(e) => setMedForm({ ...medForm, name: e.target.value })} />
          <input className="input" placeholder="SKU (auto if empty)" value={medForm.sku} onChange={(e) => setMedForm({ ...medForm, sku: e.target.value })} />
          <div className={dept === 'lab' ? '' : 'grid grid-cols-2 gap-2'}>
            <input className="input" type="number" placeholder="Buy price" value={medForm.cost} onChange={(e) => setMedForm({ ...medForm, cost: e.target.value })} />
            {dept !== 'lab' && (
              <input className="input" type="number" placeholder="Sell price (optional)" value={medForm.price} onChange={(e) => setMedForm({ ...medForm, price: e.target.value })} />
            )}
          </div>
          <input className="input" type="number" placeholder="Low stock alert qty" value={medForm.min_stock} onChange={(e) => setMedForm({ ...medForm, min_stock: e.target.value })} />
          {dept === 'lab' && (
            <LabReagentTestPicker tests={labBillableTests} value={labTestLinks} onChange={setLabTestLinks} disabled={busy} />
          )}
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={addMedicine}>Save</button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setAddOpen(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {editItem && (
        <Modal title={`Edit — ${editItem.name}`} onClose={() => setEditItem(null)}>
          <input className="input" value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} />
          <div className={dept === 'lab' ? '' : 'grid grid-cols-2 gap-2'}>
            <input className="input" type="number" placeholder="Buy price" value={editItem.cost} onChange={(e) => setEditItem({ ...editItem, cost: e.target.value })} />
            {dept !== 'lab' && (
              <input className="input" type="number" placeholder="Sell price (optional)" value={editItem.price} onChange={(e) => setEditItem({ ...editItem, price: e.target.value })} />
            )}
          </div>
          <input className="input" type="number" placeholder="Low stock alert" value={editItem.min_stock} onChange={(e) => setEditItem({ ...editItem, min_stock: e.target.value })} />
          {dept === 'lab' && (
            <LabReagentTestPicker tests={labBillableTests} value={editLabTestLinks} onChange={setEditLabTestLinks} disabled={busy} />
          )}
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
