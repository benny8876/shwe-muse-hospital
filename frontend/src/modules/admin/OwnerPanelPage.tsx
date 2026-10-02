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
import { downloadFile } from '../../lib/exportFile'

type Branch = { id: number; code: string; name: string; name_mm: string; is_main: boolean }

// Small line-icon chips for the stat cards (app-dashboard style) — kept local
// to this page since they're finance-specific, unlike the clinical two-tone
// icon set in components/icons/CounterIcons.tsx. Every icon takes an optional
// stroke `color` so the same shape can sit in a green/red/blue-tinted chip.
type IconProps = { color?: string }
function IconArrowUp({ color = 'var(--brand-600)' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}
function IconArrowDown({ color = 'var(--brand-600)' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  )
}
function IconScale({ color = 'var(--brand-600)' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16M7 20V11M12 20V5M17 20v8" />
    </svg>
  )
}
function IconClockIcon({ color = 'var(--brand-600)' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  )
}
function IconBox({ color = 'var(--brand-600)' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8l-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  )
}
function IconReceipt({ color = 'var(--brand-600)' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h12v19l-3-2-3 2-3-2-3 2V2Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  )
}
function IconPill({ color = 'var(--brand-600)' }: IconProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
      <path d="M9.5 9.5l5 5" />
    </svg>
  )
}

// A row with a small circular icon chip on the left and a value on the right
// — the list-row counterpart to StatCard's tile, used for Income by Source /
// Expenses by Category so every section of this page shares the same visual
// language instead of only the top 4 stat tiles looking "app-like".
function IconRow({ icon, color, label, sub, value, valueClassName = '' }: {
  icon: React.ReactNode
  color: string
  label: React.ReactNode
  sub?: React.ReactNode
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${color}1a` }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{label}</div>
        {sub && <div className="text-xs text-slate-400 truncate">{sub}</div>}
      </div>
      <div className={`text-sm font-semibold shrink-0 ${valueClassName}`}>{value}</div>
    </div>
  )
}

// Owner-level view across branches — income/outcome reuses the same
// per-branch analytics endpoint Cashier's own "Analyze" tab calls
// (/counter/analytics), and stock reuses /inventory/items with the new
// branch_id filter (sums on_hand across every warehouse that branch owns)
// instead of building parallel reporting logic.
// 'all' = combined-across-branches view; a number is a single branch's id.
type BranchSelection = number | 'all'

const emptyAssetForm = { name: '', category: '', cost: '', purchased_on: '', notes: '' }

export default function OwnerPanelPage() {
  const toast = useToast()
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState<BranchSelection | null>(null)
  const [sub, setSub] = useState<'income' | 'stock'>('income')
  const [period, setPeriod] = useState<'day' | 'month' | '3m' | 'year'>('month')
  const [analytics, setAnalytics] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [stockQuery, setStockQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [assets, setAssets] = useState<any[]>([])
  const [assetForm, setAssetForm] = useState(emptyAssetForm)
  const [assetModalOpen, setAssetModalOpen] = useState(false)

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

  async function loadAnalytics() {
    setBusy(true)
    try {
      // branch_id omitted entirely (not even "undefined" as a string) = the backend's
      // combined "All Branches" path — axios drops params that are literally undefined.
      const { data } = await api.get('/counter/analytics', { params: { branch_id: branchId === 'all' ? undefined : branchId, period } })
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
      const { data } = await api.get('/inventory/items', { params: { branch_id: branchId === 'all' ? undefined : branchId } })
      setItems(data)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  // Capital assets are owned by one branch each (a new one must be attached to a
  // specific branch), but the "All Branches" view still shows their combined total —
  // fetched by looping branches rather than adding a server-side "all" mode for what's
  // normally a short, infrequently-added list.
  async function loadAssets() {
    try {
      if (branchId === 'all') {
        const results = await Promise.all(branches.map((b) => api.get('/admin/capital-assets', { params: { branch_id: b.id } })))
        setAssets(results.flatMap((r) => r.data))
      } else if (branchId) {
        const { data } = await api.get('/admin/capital-assets', { params: { branch_id: branchId } })
        setAssets(data)
      }
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  async function addAsset() {
    if (!assetForm.name.trim() || !assetForm.cost) return toast.error('Asset name နဲ့ cost လိုအပ်ပါတယ်')
    if (typeof branchId !== 'number') return toast.error('Branch တစ်ခုချင်းစီ ရွေးမှ asset ထည့်လို့ရပါတယ်')
    setBusy(true)
    try {
      await api.post('/admin/capital-assets', {
        branch_id: branchId,
        name: assetForm.name.trim(),
        category: assetForm.category.trim(),
        cost: Number(assetForm.cost),
        purchased_on: assetForm.purchased_on || undefined,
        notes: assetForm.notes.trim(),
      })
      toast.success('Capital asset added')
      setAssetForm(emptyAssetForm)
      setAssetModalOpen(false)
      await loadAssets()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function removeAsset(id: number) {
    try {
      await api.delete(`/admin/capital-assets/${id}`)
      toast.success('Removed')
      await loadAssets()
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  useEffect(() => {
    if (!branchId || branches.length === 0) return
    if (sub === 'income') { void loadAnalytics(); void loadAssets() }
    if (sub === 'stock') void loadItems()
  }, [branchId, sub, period, branches])

  async function renameBranch() {
    if (typeof branchId !== 'number' || !renameValue.trim()) return
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
  const totalCapex = assets.reduce((sum, a) => sum + Number(a.cost || 0), 0)

  return (
    <div className="space-y-4">
      <PageHeader title="Owner Panel" subtitle="Income, expenses and stock — split by branch" />

      <div className="card rounded-2xl flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-slate-600">Branch:</span>
        <ToggleGroup
          className="flex-wrap"
          options={[{ value: 'all', label: 'All Branches' }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]}
          value={String(branchId ?? '')}
          onChange={(v) => setBranchId(v === 'all' ? 'all' : Number(v))}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm shrink-0 ml-auto"
          disabled={typeof branchId !== 'number'}
          onClick={() => { setRenameValue(branches.find((b) => b.id === branchId)?.name || ''); setRenameOpen(true) }}
        >
          Rename
        </button>
      </div>

      {renameOpen && (
        <Modal title="Rename Branch" onClose={() => setRenameOpen(false)}>
          <div className="space-y-3">
            <input className="input" placeholder="Branch name" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
            <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={renameBranch}>Save</button>
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
            variant="pill"
            options={[
              { value: 'day', label: 'Today' },
              { value: 'month', label: 'This Month' },
              { value: '3m', label: '3 Months' },
              { value: 'year', label: 'This Year' },
            ]}
            value={period}
            onChange={(v) => setPeriod(v as any)}
          />

          {!analytics && <div className="card rounded-2xl text-slate-500 text-sm">{busy ? 'Loading...' : 'No data'}</div>}

          {analytics && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="Income (Collected)" value={formatMoney(analytics.total_collected)} tone="success" icon={<IconArrowUp />} />
                <StatCard label="Outcome (Expenses)" value={formatMoney(analytics.total_expenses)} tone="danger" icon={<IconArrowDown />} />
                <StatCard
                  label="Net"
                  value={formatMoney(analytics.net)}
                  tone={analytics.net >= 0 ? 'success' : 'danger'}
                  icon={<IconScale />}
                  highlight
                />
                <StatCard label="Outstanding (Unpaid)" value={formatMoney(analytics.outstanding)} icon={<IconClockIcon />} />
              </div>

              <div className="card rounded-2xl space-y-3">
                <h3 className="font-semibold">{period === 'day' ? 'Hourly Collection' : 'Daily Collection'}</h3>
                {(analytics.trend || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No collection data for this period</p>
                ) : (
                  (() => {
                    const trend = analytics.trend || []
                    const max = Math.max(...trend.map((t: any) => Number(t.amount)), 1)
                    const dense = trend.length > 14
                    return (
                      <div className="overflow-x-auto">
                        <div
                          className="flex items-end gap-2 h-56 pt-6 pb-8 px-1 relative"
                          style={{ minWidth: dense ? `${trend.length * 28}px` : '100%' }}
                        >
                          {trend.map((t: any) => {
                            const amount = Number(t.amount)
                            const pct = Math.max((amount / max) * 100, amount > 0 ? 3 : 0)
                            return (
                              <div key={t.label} className="group relative flex flex-col items-center justify-end h-full flex-1 min-w-[18px]">
                                <div className="pointer-events-none absolute -top-1 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium text-slate-700 whitespace-nowrap bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-sm z-10">
                                  {formatMoney(amount)}
                                </div>
                                <div
                                  className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-[var(--brand-600)] to-[var(--brand-200)] group-hover:from-[var(--brand-700)] group-hover:to-[var(--brand-500)] transition-colors"
                                  style={{ height: `${pct}%` }}
                                />
                                <div
                                  className="mt-2 text-[10px] text-slate-500 whitespace-nowrap"
                                  style={dense ? { writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '3.5rem' } : undefined}
                                >
                                  {t.label}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <StatCard label="Capital Assets (Equipment)" value={formatMoney(totalCapex)} tone="danger" icon={<IconBox />} />
                <StatCard
                  label="Net after equipment"
                  value={formatMoney(analytics.net - totalCapex)}
                  tone={analytics.net - totalCapex >= 0 ? 'success' : 'danger'}
                  icon={<IconScale />}
                />
              </div>

              <div className="card rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold">Capital Assets</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Lab/X-ray machines, other big one-time equipment</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm whitespace-nowrap shrink-0"
                    disabled={typeof branchId !== 'number'}
                    onClick={() => setAssetModalOpen(true)}
                  >
                    + Add
                  </button>
                </div>
                {branchId === 'all' && <p className="text-xs text-slate-500">Select a specific branch to add a new asset — showing the combined total here.</p>}

                {/* Mobile: a stacked card list reads far better than a cramped,
                    horizontally-scrolled table on a phone. Desktop keeps the table. */}
                <div className="sm:hidden space-y-2">
                  {assets.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No capital assets recorded yet</p>
                  ) : (
                    assets.map((r: any) => (
                      <div key={r.id} className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--status-danger-bg)' }}>
                          <IconBox color="var(--status-danger-fg)" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{r.name}</div>
                          <div className="text-xs text-slate-500 truncate">{r.category || '—'} · {formatDate(r.purchased_on)}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-red-600">{formatMoney(r.cost)}</div>
                          <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => void removeAsset(r.id)}>Remove</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="hidden sm:block">
                  <DataTable
                    wrapperClassName="rounded-2xl"
                    rows={assets}
                    columns={[
                      { key: 'name', label: 'Name', render: (r: any) => <span className="font-medium">{r.name}</span> },
                      { key: 'category', label: 'Category', render: (r: any) => r.category || '—' },
                      { key: 'date', label: 'Purchased', render: (r: any) => formatDate(r.purchased_on) },
                      { key: 'cost', label: 'Cost', className: 'text-right', render: (r: any) => <span className="font-semibold text-red-600">{formatMoney(r.cost)}</span> },
                      { key: 'act', label: '', render: (r: any) => (
                        <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => void removeAsset(r.id)}>Remove</button>
                      ) },
                    ]}
                    emptyText="No capital assets recorded yet"
                  />
                </div>
              </div>

              {assetModalOpen && (
                <Modal title="Add Capital Asset" onClose={() => setAssetModalOpen(false)}>
                  <div className="space-y-3">
                    <input className="input" placeholder="Name (e.g. X-ray Machine)" value={assetForm.name} onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })} />
                    <input className="input" placeholder="Category (e.g. Lab Equipment)" value={assetForm.category} onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })} />
                    <input className="input" type="number" placeholder="Cost (MMK)" value={assetForm.cost} onChange={(e) => setAssetForm({ ...assetForm, cost: e.target.value })} />
                    <input className="input" type="date" value={assetForm.purchased_on} onChange={(e) => setAssetForm({ ...assetForm, purchased_on: e.target.value })} />
                    <input className="input" placeholder="Notes (optional)" value={assetForm.notes} onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })} />
                    <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={addAsset}>Save Asset</button>
                  </div>
                </Modal>
              )}

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="card rounded-2xl">
                  <h3 className="font-semibold mb-1">Income by Source</h3>
                  {(analytics.by_source || []).length === 0 && <p className="text-sm text-slate-500 py-2">No data</p>}
                  {(analytics.by_source || []).map((s: any) => (
                    <IconRow
                      key={s.source}
                      icon={<IconArrowUp color="var(--status-success-fg)" />}
                      color="var(--status-success-fg)"
                      label={s.source}
                      value={formatMoney(s.amount)}
                      valueClassName="text-[var(--status-success-fg)]"
                    />
                  ))}
                </div>
                <div className="card rounded-2xl">
                  <h3 className="font-semibold mb-1">Expenses by Category</h3>
                  {(analytics.by_expense_category || []).length === 0 && <p className="text-sm text-slate-500 py-2">No data</p>}
                  {(analytics.by_expense_category || []).map((c: any) => (
                    <IconRow
                      key={c.category}
                      icon={<IconArrowDown color="var(--status-danger-fg)" />}
                      color="var(--status-danger-fg)"
                      label={c.category}
                      sub={`×${c.count}`}
                      value={formatMoney(c.amount)}
                      valueClassName="text-[var(--status-danger-fg)]"
                    />
                  ))}
                </div>
              </div>

              <div className="card rounded-2xl">
                <h3 className="font-semibold mb-3">Recent Expenses</h3>

                <div className="sm:hidden space-y-2">
                  {(analytics.expense_details || []).length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No expenses in this period</p>
                  ) : (
                    (analytics.expense_details || []).map((r: any) => (
                      <div key={r.id} className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--status-danger-bg)' }}>
                          <IconReceipt color="var(--status-danger-fg)" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{r.category}</div>
                          <div className="text-xs text-slate-500 truncate">
                            {formatDate(String(r.created_at))}
                            {r.name ? ` · ${r.name}` : ''}
                            {r.paid_by ? ` · ${r.paid_by}` : ''}
                          </div>
                        </div>
                        <div className="font-semibold text-red-600 shrink-0">{formatMoney(Number(r.amount))}</div>
                      </div>
                    ))
                  )}
                </div>
                <div className="hidden sm:block">
                  <DataTable
                    wrapperClassName="rounded-2xl"
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
              </div>
            </>
          )}
        </div>
      )}

      {sub === 'stock' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input className="input max-w-sm" placeholder="Search medicine / SKU..." value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} />
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{items.length} item{items.length === 1 ? '' : 's'} · <span className="text-red-600 font-medium">{lowStockCount} low</span></span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await downloadFile('/inventory/items/export/pdf', { branch_id: branchId === 'all' ? undefined : branchId }, 'stock-levels.pdf')
                  } catch (e) {
                    toast.error(getApiError(e))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Export PDF
              </button>
            </div>
          </div>
          <div className="sm:hidden space-y-2">
            {filteredItems.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">{busy ? 'Loading...' : 'No medicine found'}</p>
            ) : (
              filteredItems.map((r: any) => (
                <div key={r.item.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: r.is_low ? 'var(--status-danger-bg)' : 'var(--status-success-bg)' }}
                    >
                      <IconPill color={r.is_low ? 'var(--status-danger-fg)' : 'var(--status-success-fg)'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{r.item.name}</div>
                      <div className="text-xs text-slate-500">{r.item.sku || '—'}</div>
                    </div>
                    <StatusBadge value={r.is_low ? 'LOW' : 'OK'} />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-sm">
                    <span className={r.is_low ? 'text-red-600 font-semibold' : 'font-semibold'}>{r.on_hand} in stock</span>
                    <span className="text-xs text-slate-400">{r.nearest_expiry ? formatDate(r.nearest_expiry) : '—'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden sm:block">
            <DataTable
              wrapperClassName="rounded-2xl"
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
        </div>
      )}
    </div>
  )
}
