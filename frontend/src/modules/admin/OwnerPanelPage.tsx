import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import ToggleGroup from '../../components/ToggleGroup'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import { formatMoney, formatDate } from '../../lib/format'

type Branch = { id: number; code: string; name: string; name_mm: string; is_main: boolean }

const emptyBranchForm = { code: '', name: '', name_mm: '', address: '', phone: '' }

// Owner-level view across branches — income/outcome reuses the same
// per-branch analytics endpoint Cashier's own "Analyze" tab calls
// (/counter/analytics), and stock reuses /inventory/items with the new
// branch_id filter (sums on_hand across every warehouse that branch owns)
// instead of building parallel reporting logic.
export default function OwnerPanelPage() {
  const toast = useToast()
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState<number | null>(null)
  const [sub, setSub] = useState<'income' | 'stock'>('income')
  const [period, setPeriod] = useState<'day' | 'month' | '3m' | 'year'>('month')
  const [analytics, setAnalytics] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [stockQuery, setStockQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [addBranchOpen, setAddBranchOpen] = useState(false)
  const [branchForm, setBranchForm] = useState(emptyBranchForm)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  async function loadBranches() {
    try {
      const { data } = await api.get('/branches')
      setBranches(data)
      return data
    } catch (e) {
      toast.error(getApiError(e))
      return []
    }
  }

  useEffect(() => {
    loadBranches().then((data) => { if (data[0]) setBranchId((prev) => prev ?? data[0].id) })
  }, [])

  async function addBranch() {
    if (!branchForm.code.trim() || !branchForm.name.trim()) return toast.error('Branch code နဲ့ name လိုအပ်ပါတယ်')
    setBusy(true)
    try {
      const { data: created } = await api.post('/admin/branches', {
        code: branchForm.code.trim(),
        name: branchForm.name.trim(),
        name_mm: branchForm.name_mm.trim(),
        address: branchForm.address.trim(),
        phone: branchForm.phone.trim(),
      })
      toast.success(`${created.name} added`)
      setBranchForm(emptyBranchForm)
      setAddBranchOpen(false)
      await loadBranches()
      setBranchId(created.id)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function loadAnalytics() {
    setBusy(true)
    try {
      const { data } = await api.get('/counter/analytics', { params: { branch_id: branchId, period } })
      setAnalytics(data)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function loadItems() {
    setBusy(true)
    try {
      const { data } = await api.get('/inventory/items', { params: { branch_id: branchId } })
      setItems(data)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!branchId) return
    if (sub === 'income') void loadAnalytics()
    if (sub === 'stock') void loadItems()
  }, [branchId, sub, period])

  async function renameBranch() {
    if (!branchId || !renameValue.trim()) return
    setBusy(true)
    try {
      await api.patch(`/admin/branches/${branchId}`, { name: renameValue.trim() })
      toast.success('Branch renamed')
      setRenameOpen(false)
      await loadBranches()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  const filteredItems = items.filter((row) => {
    const q = stockQuery.trim().toLowerCase()
    if (!q) return true
    const item = row.item || {}
    return String(item.name || '').toLowerCase().includes(q) || String(item.sku || '').toLowerCase().includes(q)
  })
  const lowStockCount = items.filter((row) => row.is_low).length

  return (
    <div className="space-y-4">
      <PageHeader title="Owner Panel" subtitle="Income, expenses and stock — split by branch" />

      <div className="card flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-slate-600">Branch:</span>
        <ToggleGroup
          className="flex-wrap"
          options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
          value={String(branchId ?? '')}
          onChange={(v) => setBranchId(Number(v))}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm shrink-0 ml-auto"
          disabled={!branchId}
          onClick={() => { setRenameValue(branches.find((b) => b.id === branchId)?.name || ''); setRenameOpen(true) }}
        >
          Rename
        </button>
        <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => setAddBranchOpen(true)}>+ Add Branch</button>
      </div>

      {renameOpen && (
        <Modal title="Rename Branch" onClose={() => setRenameOpen(false)}>
          <div className="space-y-3">
            <input className="input" placeholder="Branch name" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
            <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={renameBranch}>Save</button>
          </div>
        </Modal>
      )}

      {addBranchOpen && (
        <Modal title="Add Branch" onClose={() => setAddBranchOpen(false)}>
          <div className="space-y-3">
            <input className="input" placeholder="Branch code (e.g. BR2)" value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })} />
            <input className="input" placeholder="Name (English)" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
            <input className="input" placeholder="Name (Myanmar)" value={branchForm.name_mm} onChange={(e) => setBranchForm({ ...branchForm, name_mm: e.target.value })} />
            <input className="input" placeholder="Address" value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} />
            <input className="input" placeholder="Phone" value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} />
            <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={addBranch}>Save Branch</button>
          </div>
        </Modal>
      )}

      <ToggleGroup
        options={[
          { value: 'income', label: 'Income / Outcome' },
          { value: 'stock', label: 'Stock' },
        ]}
        value={sub}
        onChange={(v) => setSub(v as any)}
      />

      {sub === 'income' && (
        <div className="space-y-4">
          <ToggleGroup
            options={[
              { value: 'day', label: 'Today' },
              { value: 'month', label: 'This Month' },
              { value: '3m', label: '3 Months' },
              { value: 'year', label: 'This Year' },
            ]}
            value={period}
            onChange={(v) => setPeriod(v as any)}
          />

          {!analytics && <div className="card text-slate-500 text-sm">{busy ? 'Loading...' : 'No data'}</div>}

          {analytics && (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Income (Collected)" value={formatMoney(analytics.total_collected)} tone="success" />
                <StatCard label="Outcome (Expenses)" value={formatMoney(analytics.total_expenses)} tone="danger" />
                <StatCard
                  label="Net"
                  value={formatMoney(analytics.net)}
                  tone={analytics.net >= 0 ? 'success' : 'danger'}
                />
                <StatCard label="Outstanding (Unpaid)" value={formatMoney(analytics.outstanding)} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="card">
                  <h3 className="font-semibold mb-3">Income by Source</h3>
                  {(analytics.by_source || []).length === 0 && <p className="text-sm text-slate-500">No data</p>}
                  {(analytics.by_source || []).map((s: any) => (
                    <div key={s.source} className="flex justify-between border-b py-2 text-sm">
                      <span>{s.source}</span>
                      <span className="font-medium text-green-700">{formatMoney(s.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <h3 className="font-semibold mb-3">Expenses by Category</h3>
                  {(analytics.by_expense_category || []).length === 0 && <p className="text-sm text-slate-500">No data</p>}
                  {(analytics.by_expense_category || []).map((c: any) => (
                    <div key={c.category} className="flex justify-between border-b py-2 text-sm">
                      <span>{c.category} <span className="text-slate-400">×{c.count}</span></span>
                      <span className="font-medium text-red-600">{formatMoney(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold mb-3">Recent Expenses</h3>
                <DataTable
                  rows={analytics.expense_details || []}
                  columns={[
                    { key: 'date', label: 'Date', render: (r: any) => formatDate(String(r.created_at)) },
                    { key: 'category', label: 'Category', render: (r: any) => String(r.category) },
                    { key: 'name', label: 'Name', render: (r: any) => r.name || '—' },
                    { key: 'paid_by', label: 'Paid By', render: (r: any) => r.paid_by || '—' },
                    { key: 'amount', label: 'Amount', className: 'text-right', render: (r: any) => <span className="font-semibold text-red-600">{formatMoney(Number(r.amount))}</span> },
                  ]}
                  emptyText="No expenses in this period"
                />
              </div>
            </>
          )}
        </div>
      )}

      {sub === 'stock' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input className="input max-w-sm" placeholder="Search medicine / SKU..." value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} />
            <span className="text-sm text-slate-500">{items.length} item{items.length === 1 ? '' : 's'} · <span className="text-red-600 font-medium">{lowStockCount} low</span></span>
          </div>
          <DataTable
            rows={filteredItems}
            keyField={(r: any) => r.item.id}
            columns={[
              { key: 'name', label: 'Medicine', render: (r: any) => <span className="font-medium">{r.item.name}</span> },
              { key: 'sku', label: 'SKU', render: (r: any) => r.item.sku || '—' },
              { key: 'on_hand', label: 'Stock Left', className: 'text-right', render: (r: any) => (
                <span className={r.is_low ? 'text-red-600 font-semibold' : 'font-semibold'}>{r.on_hand}</span>
              ) },
              { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.is_low ? 'LOW' : 'OK'} /> },
              { key: 'expiry', label: 'Nearest Expiry', render: (r: any) => r.nearest_expiry ? formatDate(r.nearest_expiry) : '—' },
            ]}
            emptyText={busy ? 'Loading...' : 'No medicine found'}
          />
        </div>
      )}
    </div>
  )
}
