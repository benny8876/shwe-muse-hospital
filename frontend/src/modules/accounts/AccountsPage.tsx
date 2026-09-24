import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import PageHeader from '../../components/PageHeader'
import Tabs from '../../components/Tabs'
import DataTable from '../../components/DataTable'
import { formatMoney, formatDate } from '../../lib/format'

export default function AccountsPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const [tab, setTab] = useState('ledger')
  const [ledger, setLedger] = useState<any[]>([])
  const [cashBook, setCashBook] = useState<any[]>([])
  const [ar, setAr] = useState<any[]>([])
  const [pl, setPl] = useState<any>(null)
  const [petty, setPetty] = useState<any>(null)
  const [expForm, setExpForm] = useState({ category: '', amount: '', notes: '' })

  async function load() {
    const [l, c, a, p, pt] = await Promise.all([
      api.get('/accounts/ledger'),
      api.get('/accounts/cash-book'),
      api.get('/accounts/ar'),
      api.get('/accounts/reports/pl'),
      api.get('/accounts/petty-cash', { params: { branch_id: branchId } }),
    ])
    setLedger(l.data)
    setCashBook(c.data)
    setAr(a.data)
    setPl(p.data)
    setPetty(pt.data)
  }

  useEffect(() => { void load() }, [branchId])

  async function addExpense() {
    try {
      await api.post('/accounts/expenses', {
        branch_id: branchId,
        category: expForm.category,
        amount: Number(expForm.amount),
        paid_from: 'petty',
        notes: expForm.notes,
      })
      toast.success('Expense recorded')
      setExpForm({ category: '', amount: '', notes: '' })
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  function exportExcel() {
    window.open('/api/v1/accounts/export/excel', '_blank')
  }

  return (
    <div>
      <PageHeader title="Accounts" subtitle="Ledger, cash book, receivables and reports" />
      <Tabs tabs={[
        { id: 'ledger', label: 'Ledger' },
        { id: 'cash', label: 'Cash Book' },
        { id: 'ar', label: 'Receivables' },
        { id: 'expense', label: 'Expenses' },
        { id: 'pl', label: 'P&L' },
      ]} active={tab} onChange={setTab} />

      {tab === 'ledger' && (
        <>
          <button type="button" className="btn btn-secondary mb-3" onClick={exportExcel}>Export Excel</button>
          <DataTable rows={ledger} columns={[
            { key: 'code', label: 'Code', render: (r) => String(r.code) },
            { key: 'name', label: 'Account', render: (r) => String(r.name) },
            { key: 'kind', label: 'Type', render: (r) => String(r.kind) },
            { key: 'balance', label: 'Balance', render: (r) => formatMoney(Number(r.balance)) },
          ]} />
        </>
      )}

      {tab === 'cash' && (
        <DataTable rows={cashBook} columns={[
          { key: 'id', label: '#', render: (r) => String(r.id) },
          { key: 'method', label: 'Method', render: (r) => String(r.method) },
          { key: 'amount', label: 'Amount', render: (r) => formatMoney(Number(r.amount)) },
          { key: 'date', label: 'Date', render: (r) => formatDate(String(r.created_at)) },
        ]} />
      )}

      {tab === 'ar' && (
        <DataTable rows={ar} columns={[
          { key: 'number', label: 'Invoice', render: (r) => String(r.number) },
          { key: 'total', label: 'Total', render: (r) => formatMoney(Number(r.total)) },
          { key: 'balance', label: 'Balance', render: (r) => formatMoney(Number(r.balance)) },
          { key: 'status', label: 'Status', render: (r) => String(r.status) },
        ]} />
      )}

      {tab === 'expense' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card space-y-2">
            <div className="text-sm">Petty cash: {formatMoney(petty?.balance || 0)}</div>
            <input className="input" placeholder="Category" value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} />
            <input className="input" placeholder="Amount" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
            <input className="input" placeholder="Notes" value={expForm.notes} onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })} />
            <button type="button" className="btn btn-primary" onClick={addExpense}>Record Expense</button>
          </div>
        </div>
      )}

      {tab === 'pl' && pl && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="card"><div className="text-sm">Revenue</div><div className="text-2xl font-bold">{formatMoney(pl.revenue)}</div></div>
          <div className="card"><div className="text-sm">Expense</div><div className="text-2xl font-bold">{formatMoney(pl.expense)}</div></div>
          <div className="card"><div className="text-sm">Profit</div><div className="text-2xl font-bold text-green-700">{formatMoney(pl.profit)}</div></div>
        </div>
      )}
    </div>
  )
}
