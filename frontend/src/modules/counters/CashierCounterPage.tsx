import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import { usePatients } from '../../hooks/usePatients'
import Tabs from '../../components/Tabs'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import Alert from '../../components/Alert'
import ToggleGroup from '../../components/ToggleGroup'
import StatCard from '../../components/StatCard'
import { formatMoney, formatDate } from '../../lib/format'
import { announceCall } from '../../lib/voiceAnnounce'
import { DOCTOR_SPECIALTY_PRESETS, normalizeSpecialty } from '../../lib/doctorSpecialties'

export default function CashierCounterPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const { name, uhid, phone } = usePatients()
  const [tab, setTab] = useState('bills')
  const [openInvoices, setOpenInvoices] = useState<any[]>([])
  const [billsQuery, setBillsQuery] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [payMethod, setPayMethod] = useState('cash')
  const [splitAmount, setSplitAmount] = useState(0)
  const [discountInput, setDiscountInput] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundMethod, setRefundMethod] = useState('cash')
  const [refundReason, setRefundReason] = useState('')
  const [addItemQuery, setAddItemQuery] = useState('')
  const [addItemResults, setAddItemResults] = useState<any[]>([])
  const [addItemWarehouses, setAddItemWarehouses] = useState<any[]>([])
  const [addItemWarehouseId, setAddItemWarehouseId] = useState('')
  const [addItemQty, setAddItemQty] = useState('1')
  const [splits, setSplits] = useState<{ method: string; amount: number }[]>([])
  const [petty, setPetty] = useState<any>(null)
  const [expForm, setExpForm] = useState({ category: '', amount: '', notes: '' })
  const [expenseRows, setExpenseRows] = useState<any[]>([])
  const [expenseTotal, setExpenseTotal] = useState(0)
  const [expenseFrom, setExpenseFrom] = useState('')
  const [expenseTo, setExpenseTo] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('')
  const [historyRows, setHistoryRows] = useState<any[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyStatus, setHistoryStatus] = useState('all')
  const [historyDetail, setHistoryDetail] = useState<any>(null)
  const [activityRows, setActivityRows] = useState<any[]>([])
  const [historySub, setHistorySub] = useState<'bills' | 'activity'>('bills')
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'day' | 'month' | '3m' | 'year' | 'custom'>('day')
  const [analyticsSub, setAnalyticsSub] = useState<'overview' | 'breakdown' | 'expenses' | 'trend'>('overview')
  const [analytics, setAnalytics] = useState<any>(null)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [doctors, setDoctors] = useState<any[]>([])
  const [doctorForm, setDoctorForm] = useState({
    full_name: '',
    consultation_fee: '',
    specialty: 'General Medicine',
    specialtyCustom: '',
  })
  const [editDoctor, setEditDoctor] = useState<any>(null)
  const [serviceDept, setServiceDept] = useState<'lab' | 'xray' | 'usg'>('lab')
  const [serviceItems, setServiceItems] = useState<any[]>([])
  const [serviceForm, setServiceForm] = useState({ name: '', price: '' })
  const [editService, setEditService] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [depositAmount, setDepositAmount] = useState<number | ''>('')

  const PAY_METHODS = ['cash', 'kpay', 'wave'] as const
  const payMethodLabel = (m: string) => (m === 'wave' ? 'WAVE PAY' : m.toUpperCase())

  const splitTotal = splits.reduce((s, p) => s + p.amount, 0)
  const remainingDue = selected ? Math.max(Number(selected.balance) - splitTotal, 0) : 0

  const billsTerms = billsQuery.trim().toLowerCase().split(/[,\s]+/).filter(Boolean)
  const filteredBills = openInvoices.filter((r) => {
    if (billsTerms.length === 0) return true
    const patientId = Number(r.patient_id)
    const fields = [
      name(patientId),
      uhid(patientId),
      phone(patientId),
      String(r.number || ''),
    ].map((f) => f.toLowerCase())
    return billsTerms.every((term) => fields.some((f) => f.includes(term)))
  })

  async function loadBills() {
    const { data } = await api.get('/counter/open-invoices', { params: { branch_id: branchId } })
    setOpenInvoices(data)
  }

  async function loadPetty() {
    const { data } = await api.get('/accounts/petty-cash', { params: { branch_id: branchId } })
    setPetty(data)
  }

  async function loadExpenseHistory() {
    const params: any = { branch_id: branchId }
    if (expenseFrom) params.date_from = expenseFrom
    if (expenseTo) params.date_to = expenseTo
    if (expenseCategory.trim()) params.category = expenseCategory.trim()
    const { data } = await api.get('/accounts/expenses', { params })
    setExpenseRows(data.rows)
    setExpenseTotal(data.total)
  }

  async function exportExcel(url: string, params: Record<string, unknown>, filename: string) {
    setBusy(true)
    try {
      const res = await api.get(url, { params, responseType: 'blob' })
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function loadHistory() {
    const { data } = await api.get('/counter/bill-history', {
      params: { branch_id: branchId, q: historyQuery, status: historyStatus, days: 90 },
    })
    setHistoryRows(data)
  }

  async function loadActivity() {
    const { data } = await api.get('/counter/activity', { params: { limit: 150 } })
    setActivityRows(data)
  }

  async function loadAnalytics(period = analyticsPeriod) {
    if (period === 'custom' && (!customFrom || !customTo)) return
    setBusy(true)
    try {
      const params: any = { branch_id: branchId, period }
      if (period === 'custom') {
        params.date_from = customFrom
        params.date_to = customTo
      }
      const { data } = await api.get('/counter/analytics', { params })
      setAnalytics(data)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function loadDoctors() {
    const { data } = await api.get('/counter/doctors')
    setDoctors(data)
  }

  function resolveDoctorSpecialty(specialty: string, custom: string) {
    if (specialty === 'Other') return custom.trim() || 'Other'
    return normalizeSpecialty(specialty)
  }

  async function addDoctor() {
    if (!doctorForm.full_name.trim()) return toast.error('Doctor name required')
    if (doctorForm.specialty === 'Other' && !doctorForm.specialtyCustom.trim()) {
      return toast.error('Enter department name for Other')
    }
    setBusy(true)
    try {
      await api.post('/counter/doctors', {
        full_name: doctorForm.full_name.trim(),
        consultation_fee: Number(doctorForm.consultation_fee) || 0,
        specialty: resolveDoctorSpecialty(doctorForm.specialty, doctorForm.specialtyCustom),
      }, { params: { branch_id: branchId } })
      toast.success('Doctor added')
      setDoctorForm({ full_name: '', consultation_fee: '', specialty: 'General Medicine', specialtyCustom: '' })
      await loadDoctors()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function loadServiceItems(dept = serviceDept) {
    const { data } = await api.get('/counter/services', { params: { department: dept } })
    setServiceItems(data)
  }

  async function addServiceItem() {
    if (!serviceForm.name.trim()) return toast.error('Name required')
    setBusy(true)
    try {
      await api.post('/counter/services', {
        department: serviceDept,
        name: serviceForm.name.trim(),
        price: Number(serviceForm.price) || 0,
      })
      toast.success('Added')
      setServiceForm({ name: '', price: '' })
      await loadServiceItems()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveServiceEdit() {
    if (!editService) return
    setBusy(true)
    try {
      await api.patch(`/counter/services/${editService.id}`, {
        name: editService.name,
        price: Number(editService.price),
      })
      toast.success('Updated')
      setEditService(null)
      await loadServiceItems()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function toggleServiceActive(item: any) {
    setBusy(true)
    try {
      await api.patch(`/counter/services/${item.id}`, { is_active: !item.is_active })
      await loadServiceItems()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveDoctorEdit() {
    if (!editDoctor) return
    if (editDoctor.specialty === 'Other' && !editDoctor.specialtyCustom?.trim()) {
      return toast.error('Enter department name for Other')
    }
    setBusy(true)
    try {
      await api.patch(`/counter/doctors/${editDoctor.id}`, {
        full_name: editDoctor.full_name,
        consultation_fee: Number(editDoctor.consultation_fee),
        specialty: resolveDoctorSpecialty(editDoctor.specialty, editDoctor.specialtyCustom || ''),
      })
      toast.success('Doctor updated')
      setEditDoctor(null)
      await loadDoctors()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function openHistoryBill(row: any) {
    setBusy(true)
    try {
      const { data } = await api.get(`/invoices/${row.id}`)
      setHistoryDetail(data)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (tab === 'bills') {
      void loadBills()
      if (!addItemWarehouses.length) {
        api.get('/inventory/warehouses').then((r) => {
          setAddItemWarehouses(r.data)
          if (r.data[0]) setAddItemWarehouseId(String(r.data[0].id))
        }).catch((e) => toast.error(getApiError(e)))
      }
    }
    if (tab === 'expenses') { void loadPetty(); void loadExpenseHistory() }
    if (tab === 'history') {
      void loadHistory()
      void loadActivity()
    }
    if (tab === 'analytics') void loadAnalytics()
    if (tab === 'doctors') void loadDoctors()
    if (tab === 'services') void loadServiceItems()
  }, [tab, branchId])

  // Other counters (Pharmacy/Lab/X-ray/USG) poll their waiting-patient list every
  // 8s so a new order shows up without a manual refresh — Open Bills needs the
  // same, since a bill can grow (e.g. Pharmacy dispensing) while the cashier's
  // tab is already sitting open here.
  useEffect(() => {
    if (tab !== 'bills') return
    const id = setInterval(() => { void loadBills() }, 8000)
    return () => clearInterval(id)
  }, [tab, branchId])

  useEffect(() => {
    if (tab === 'services') void loadServiceItems(serviceDept)
  }, [serviceDept])

  async function editLinePrice(lineId: number, unitPrice: number) {
    if (!selected) return
    setBusy(true)
    try {
      await api.patch(`/invoices/${selected.id}/lines/${lineId}`, { unit_price: unitPrice })
      const { data } = await api.get(`/invoices/${selected.id}`)
      setSelected(data)
      setSplitAmount(Number(data.balance))
      toast.success('Price updated')
      await loadBills()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function openInvoice(inv: any) {
    setSplits([])
    setSplitAmount(0)
    setPayMethod('cash')
    setDepositAmount('')
    setDiscountInput('')
    setSelected({ ...inv, lines: inv.lines || [], payments: inv.payments || [] })
    setBusy(true)
    try {
      const { data } = await api.get(`/invoices/${inv.id}`)
      setSelected(data)
      setSplitAmount(Number(data.balance))
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function applyDiscount() {
    if (!selected) return
    const amt = Number(discountInput)
    if (Number.isNaN(amt) || amt < 0) return toast.error('Enter a valid discount amount')
    setBusy(true)
    try {
      const { data } = await api.post(`/invoices/${selected.id}/discount`, null, { params: { amount: amt } })
      setSelected(data)
      setSplitAmount(Number(data.balance))
      setDiscountInput('')
      toast.success('Discount applied')
      await loadBills()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  // Refund pays money back to the patient for a payment already collected
  // (wrong amount entered, cancelled service already paid for) — it's a
  // correction, not a new negative charge, so it shows up as its own
  // "REFUND" line in the payment history rather than editing the original.
  // Generalized over (invoice, onUpdated) so both the Open Bills panel and
  // the read-only History detail panel can reuse it — a paid-off bill drops
  // out of Open Bills into History, and refunding is exactly what you'd do
  // to a bill that's already fully paid.
  async function submitRefund(inv: any, onUpdated: (data: any) => void) {
    if (!inv) return
    const amt = Number(refundAmount)
    if (!amt || amt <= 0) return toast.error('Enter a valid refund amount')
    if (amt > Number(inv.paid) + 0.01) return toast.error(`Refund cannot exceed amount paid (${formatMoney(inv.paid)})`)
    setBusy(true)
    try {
      const { data } = await api.post(`/invoices/${inv.id}/refund`, { amount: amt, method: refundMethod, reason: refundReason })
      onUpdated(data.invoice)
      setRefundAmount('')
      setRefundReason('')
      toast.success('Refund recorded')
      await loadBills()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  // Void removes a wrongly-billed line entirely — for a line the patient
  // already paid for, void it and then record a separate Refund for the
  // money, rather than expecting one action to do both.
  async function voidLine(inv: any, lineId: number, onUpdated: (data: any) => void) {
    if (!inv) return
    if (!window.confirm('Void this line? This cannot be undone.')) return
    setBusy(true)
    try {
      const { data } = await api.delete(`/invoices/${inv.id}/lines/${lineId}`)
      onUpdated(data)
      toast.success('Line voided')
      await loadBills()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function searchAddItem() {
    if (!addItemQuery.trim()) return
    try {
      const { data } = await api.get('/catalog', { params: { q: addItemQuery } })
      setAddItemResults(data)
      if (!data.length) toast.error('No matching item')
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  // Stock-tracked (drug) items go through the same dispense path Pharmacy's
  // own Sale tab uses (needs a warehouse so stock actually decrements);
  // everything else is a plain invoice line — see the backend guard on
  // POST /invoices/{id}/lines that rejects is_stock items outright.
  async function addCatalogItem(inv: any, item: any, onUpdated: (data: any) => void) {
    if (!inv) return
    const qty = Number(addItemQty) || 1
    if (item.is_stock && !addItemWarehouseId) return toast.error('Select a warehouse first')
    setBusy(true)
    try {
      if (item.is_stock) {
        const { data } = await api.post(`/invoices/${inv.id}/lines/pharmacy`, {
          item_id: item.id,
          warehouse_id: Number(addItemWarehouseId),
          qty,
        })
        onUpdated(data)
      } else {
        await api.post(`/invoices/${inv.id}/lines`, {
          item_id: item.id,
          qty,
          unit_price: item.price,
          source: item.category || 'other',
          description: item.name,
        })
        const { data } = await api.get(`/invoices/${inv.id}`)
        onUpdated(data)
      }
      toast.success(`${item.name} added`)
      setAddItemQuery('')
      setAddItemResults([])
      setAddItemQty('1')
      await loadBills()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  function addSplit() {
    if (!selected) return
    const amt = splitAmount > 0 ? splitAmount : remainingDue
    if (amt <= 0) return toast.error('Enter payment amount')
    if (splitTotal + amt > Number(selected.balance) + 0.01) {
      return toast.error('Split total exceeds balance')
    }
    setSplits((prev) => [...prev, { method: payMethod, amount: amt }])
    setSplitAmount(Math.max(remainingDue - amt, 0))
  }

  function removeSplit(index: number) {
    setSplits((prev) => prev.filter((_, i) => i !== index))
  }

  function fillRemaining() {
    if (remainingDue > 0) setSplitAmount(remainingDue)
  }

  const isIpdBill = selected && String(selected.kind || '').toLowerCase() === 'ipd' && selected.admission_id
  const ipdAdvance = selected ? Math.max(Number(selected.paid) - Number(selected.total), 0) : 0

  async function submitIpdDeposit() {
    if (!selected || !isIpdBill) return
    const amt = Number(depositAmount)
    if (!amt || amt <= 0) return toast.error('Enter deposit amount')
    setBusy(true)
    try {
      const { data } = await api.post(`/invoices/${selected.id}/ipd-deposit`, { amount: amt, method: payMethod })
      toast.success(`IPD deposit recorded — paid ${formatMoney(data.paid)}`)
      setSelected(data)
      setDepositAmount('')
      setSplitAmount(Number(data.balance))
      await loadBills()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function confirmPayment() {
    if (!selected) return
    if (Number(selected.balance) <= 0.01) {
      toast.success('Bill already settled (fully discounted)')
      setSelected(null)
      setSplits([])
      await loadBills()
      return
    }
    const toPay = splits.length > 0 ? splits : [{ method: payMethod, amount: splitAmount || Number(selected.balance) }]
    if (!toPay.length || toPay.every((p) => p.amount <= 0)) {
      return toast.error('Add payment split')
    }
    setBusy(true)
    try {
      const { data } = await api.post(`/invoices/${selected.id}/pay-multi`, { payments: toPay })
      toast.success(data.status === 'paid' ? 'Payment complete' : 'Partial payment recorded')
      if (data.status === 'paid') {
        setSelected(null)
        setSplits([])
      } else {
        setSelected(data)
        setSplits([])
        setSplitAmount(Number(data.balance))
      }
      await loadBills()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function addExpense() {
    if (!expForm.category || !expForm.amount) return toast.error('Fill category and amount')
    setBusy(true)
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
      await Promise.all([loadPetty(), loadExpenseHistory()])
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Tabs tabs={[
        { id: 'bills', label: 'Open Bills' },
        { id: 'expenses', label: 'Expenses' },
        { id: 'doctors', label: 'Doctors' },
        { id: 'services', label: 'Test/Service Catalog' },
        { id: 'analytics', label: 'Analyze' },
        { id: 'history', label: 'History' },
      ]} active={tab} onChange={setTab} />

      {tab === 'bills' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold mb-3">Waiting for Payment</h3>
            <input
              className="input mb-3"
              placeholder="Search ID + name + phone (space-separated)..."
              value={billsQuery}
              onChange={(e) => setBillsQuery(e.target.value)}
            />
            <DataTable
              rows={filteredBills}
              onRowClick={(r) => void openInvoice(r)}
              isRowSelected={(r) => selected?.id === r.id}
              wrapperClassName="max-h-80"
              columns={[
              { key: 'uhid', label: 'ID', render: (r) => uhid(Number(r.patient_id)) || '—' },
              { key: 'kind', label: 'Type', render: (r) => <StatusBadge value={String(r.kind || 'opd').toUpperCase()} /> },
              { key: 'patient', label: 'Patient', render: (r) => name(Number(r.patient_id)) },
              { key: 'total', label: 'Total', render: (r) => formatMoney(Number(r.total)) },
              { key: 'balance', label: 'Due', render: (r) => {
                const bal = Number(r.balance)
                const isIpdStay = String(r.kind || '').toLowerCase() === 'ipd' && r.admission_id
                if (isIpdStay && bal <= 0.01) {
                  return <span className="text-green-700 text-xs font-medium">Advance · deposit OK</span>
                }
                return formatMoney(bal)
              } },
              { key: 'act', label: '', render: (r) => (
                <div className="flex gap-1">
                  <button
                    type="button"
                    title="Call patient over the counter speaker"
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => { e.stopPropagation(); announceCall(name(Number(r.patient_id)), 'the Cashier counter to settle payment') }}
                  >
                    🔊
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); void openInvoice(r) }}>View</button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); void openInvoice(r) }}>Pay</button>
                </div>
              ) },
            ]} emptyText={billsQuery.trim() ? `No match for "${billsQuery}"` : 'No open bills'} />
          </div>

          <div className="card space-y-3">
            {selected ? (
              <>
                <h3 className="font-semibold">{selected.number}</h3>
                <div className="max-h-80 overflow-auto border rounded-lg no-print">
                  <div className="grid grid-cols-[1fr_3rem_8rem_6.5rem_1.75rem] gap-3 items-center text-xs font-medium text-slate-500 bg-slate-50 px-3 py-2 sticky top-0">
                    <span>Item</span>
                    <span className="text-center">Qty</span>
                    <span className="text-right">Unit price</span>
                    <span className="text-right">Amount</span>
                    <span />
                  </div>
                  <div className="divide-y">
                    {(selected.lines || []).map((l: any) => (
                      <div key={l.id} className="grid grid-cols-[1fr_3rem_8rem_6.5rem_1.75rem] gap-3 items-center text-sm px-3 py-2.5">
                        <span className="truncate" title={l.description}>
                          {l.description}
                          {l.source === 'opd' && <span className="ml-1 text-xs text-[var(--brand-600)] whitespace-nowrap">(Doctor fee)</span>}
                        </span>
                        <span className="text-center text-slate-600">{Number(l.qty || 1)}</span>
                        <input
                          type="number"
                          className="input !py-1.5 text-right"
                          defaultValue={l.unit_price}
                          onBlur={(e) => {
                            const val = Number(e.target.value)
                            if (!Number.isNaN(val) && val !== l.unit_price) void editLinePrice(l.id, val)
                          }}
                        />
                        <span className="text-right font-medium">{formatMoney(l.amount)}</span>
                        <button
                          type="button"
                          title="Void this line"
                          disabled={busy}
                          className="text-slate-400 hover:text-red-600 cursor-pointer text-lg leading-none justify-self-center"
                          onClick={() => void voidLine(selected, l.id, (data) => { setSelected(data); setSplitAmount(Number(data.balance)) })}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2 no-print">
                  <div className="font-medium">Add Item</div>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder="Search medicine / test / service name..."
                      value={addItemQuery}
                      onChange={(e) => setAddItemQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchAddItem()}
                    />
                    <button type="button" disabled={busy} className="btn btn-secondary whitespace-nowrap" onClick={searchAddItem}>Search</button>
                  </div>
                  {addItemResults.length > 0 && (
                    <div className="border rounded-lg divide-y max-h-48 overflow-auto">
                      {addItemResults.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span className="truncate">
                            {item.name} <span className="text-slate-400">· {formatMoney(item.price)}{item.is_stock ? ' · stock' : ''}</span>
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            className="btn btn-primary btn-sm shrink-0"
                            onClick={() => void addCatalogItem(selected, item, (data) => { setSelected(data); setSplitAmount(Number(data.balance)) })}
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <select className="input" value={addItemWarehouseId} onChange={(e) => setAddItemWarehouseId(e.target.value)}>
                      {addItemWarehouses.map((w: any) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                    <input
                      className="input w-24"
                      type="number"
                      placeholder="Qty"
                      value={addItemQty}
                      onChange={(e) => setAddItemQty(e.target.value)}
                    />
                  </div>
                  <div className="text-xs text-slate-400">Warehouse only matters for medicine (stock) items — it's ignored for services/tests.</div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-lg bg-slate-50 p-2">Total<br /><strong>{formatMoney(selected.total)}</strong></div>
                  <div className="rounded-lg bg-slate-50 p-2">Paid<br /><strong>{formatMoney(selected.paid)}</strong></div>
                  <div className="rounded-lg bg-blue-50 p-2">Due<br /><strong className="text-[var(--brand-600)]">{formatMoney(selected.balance)}</strong></div>
                </div>

                {(selected.payments || []).length > 0 && (
                  <div className="text-sm border rounded-lg p-2 space-y-1">
                    <div className="font-medium text-slate-600">Previous payments</div>
                    {(selected.payments || []).map((p: any) => (
                      <div key={p.id} className={`flex justify-between ${p.method === 'refund' ? 'text-red-600' : ''}`}>
                        <span className="uppercase">{p.method === 'refund' ? 'REFUND' : p.method}</span>
                        <span>{p.method === 'refund' ? '−' : ''}{formatMoney(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {isIpdBill && (
                  <div className="border-t pt-3 space-y-2">
                    <Alert tone="info">
                      <strong>IPD deposit / advance</strong> — balance ထက်ပိုပြီး လက်ခံနိုင်ပါတယ် (အကြိမ်ကြိမ်)။
                      အောက်က Multi-Payment က လက်ရှိ <strong>due</strong> အတွက်သာ။
                    </Alert>
                    {ipdAdvance > 0.01 && (
                      <div className="text-sm text-slate-600">
                        Advance on account: <strong className="text-green-700">{formatMoney(ipdAdvance)}</strong>
                      </div>
                    )}
                    <div className="font-medium">Collect IPD deposit</div>
                    <ToggleGroup
                      options={PAY_METHODS.map((m) => ({ value: m, label: payMethodLabel(m) }))}
                      value={payMethod}
                      onChange={setPayMethod}
                    />
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        type="number"
                        placeholder="Deposit amount"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                      <button type="button" disabled={busy} className="btn btn-primary whitespace-nowrap" onClick={submitIpdDeposit}>
                        Add deposit
                      </button>
                    </div>
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  <div className="font-medium">Discount</div>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      type="number"
                      placeholder="Discount amount"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                    />
                    <button type="button" disabled={busy} className="btn btn-secondary whitespace-nowrap" onClick={applyDiscount}>Apply</button>
                  </div>
                  {Number(selected.discount) > 0 && (
                    <div className="text-sm text-slate-600">Current discount: <strong>{formatMoney(selected.discount)}</strong></div>
                  )}
                </div>

                {Number(selected.paid) > 0.01 && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="font-medium">Refund</div>
                    <ToggleGroup
                      options={PAY_METHODS.map((m) => ({ value: m, label: payMethodLabel(m) }))}
                      value={refundMethod}
                      onChange={setRefundMethod}
                    />
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        type="number"
                        placeholder={`Refund amount (max ${formatMoney(selected.paid)})`}
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                      />
                      <button type="button" disabled={busy} className="btn btn-secondary whitespace-nowrap" onClick={() => void submitRefund(selected, (data) => { setSelected(data); setSplitAmount(Number(data.balance)) })}>Refund</button>
                    </div>
                    <input
                      className="input"
                      placeholder="Reason (optional)"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                    />
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  <div className="font-medium">Multi-Payment</div>
                  <ToggleGroup
                    options={PAY_METHODS.map((m) => ({ value: m, label: payMethodLabel(m) }))}
                    value={payMethod}
                    onChange={setPayMethod}
                  />
                  <div className="flex gap-2">
                    <input className="input flex-1" type="number" placeholder="Amount" value={splitAmount || ''} onChange={(e) => setSplitAmount(Number(e.target.value))} />
                    <button type="button" className="btn btn-secondary whitespace-nowrap" onClick={fillRemaining}>Fill due</button>
                    <button type="button" className="btn btn-secondary whitespace-nowrap" onClick={addSplit}>Add</button>
                  </div>
                </div>

                {splits.length > 0 && (
                  <div className="border rounded-lg p-2 space-y-1 text-sm">
                    <div className="font-medium mb-1">Payment splits</div>
                    {splits.map((s, i) => (
                      <div key={`${s.method}-${i}`} className="flex justify-between items-center border-b py-1">
                        <span>{payMethodLabel(s.method)}</span>
                        <span className="flex items-center gap-2">
                          {formatMoney(s.amount)}
                          <button type="button" className="text-red-600 text-xs" onClick={() => removeSplit(i)}>Remove</button>
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold pt-1">
                      <span>Split total</span>
                      <span>{formatMoney(splitTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Remaining after pay</span>
                      <span>{formatMoney(remainingDue)}</span>
                    </div>
                  </div>
                )}

                <button type="button" disabled={busy} className="btn btn-primary w-full text-lg" onClick={confirmPayment}>
                  {splits.length > 0 ? `Pay ${formatMoney(splitTotal)}` : 'Pay Full Amount'}
                </button>
                <button type="button" className="btn btn-secondary w-full" onClick={() => window.print()}>Print Receipt</button>
              </>
            ) : (
              <p className="text-slate-500">Bill row နှိပ်ပါ သို့မဟုတ် View — detail ကြည့်ပါ · Pay — ငွေရှင်းပါ</p>
            )}
          </div>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card space-y-3">
              <h3 className="font-semibold">Record Expense</h3>
              {petty && <div className="text-sm">Petty cash balance: <strong>{formatMoney(petty.balance)}</strong></div>}
              <input className="input" placeholder="Category (e.g. utilities)" value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} />
              <input className="input" type="number" placeholder="Amount" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
              <input className="input" placeholder="Notes" value={expForm.notes} onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })} />
              <button type="button" disabled={busy} className="btn btn-primary" onClick={addExpense}>Save Expense</button>
            </div>

            <div className="card space-y-3">
              <h3 className="font-semibold">Filter History</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500">From</label>
                  <input type="date" className="input" value={expenseFrom} onChange={(e) => setExpenseFrom(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-500">To</label>
                  <input type="date" className="input" value={expenseTo} onChange={(e) => setExpenseTo(e.target.value)} />
                </div>
              </div>
              <input className="input" placeholder="Category filter (optional)" value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} />
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary flex-1" onClick={loadExpenseHistory}>Apply Filter</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { setExpenseFrom(''); setExpenseTo(''); setExpenseCategory(''); void loadExpenseHistory() }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <h3 className="font-semibold text-[var(--brand-600)]">Expense History</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{expenseRows.length} record{expenseRows.length === 1 ? '' : 's'}</span>
                <button
                  type="button"
                  disabled={busy}
                  className="btn btn-secondary btn-sm"
                  onClick={() => exportExcel('/accounts/expenses/export', { branch_id: branchId, date_from: expenseFrom, date_to: expenseTo, category: expenseCategory }, 'expense-history.xlsx')}
                >
                  Export Excel
                </button>
              </div>
            </div>
            <DataTable
              rows={expenseRows}
              columns={[
                { key: 'date', label: 'Date', render: (r: any) => formatDate(String(r.expense_date)) },
                { key: 'category', label: 'Category', render: (r: any) => <span className="font-medium">{String(r.category)}</span> },
                { key: 'paid_from', label: 'Paid From', render: (r: any) => <StatusBadge value={String(r.paid_from).toUpperCase()} /> },
                { key: 'notes', label: 'Notes', render: (r: any) => <span className="text-slate-600">{r.notes || '—'}</span> },
                { key: 'amount', label: 'Amount', className: 'text-right', render: (r: any) => <span className="font-semibold text-red-600">{formatMoney(Number(r.amount))}</span> },
              ]}
              emptyText="No expenses recorded for this range"
              footer={(
                <tr className="bg-slate-50 font-semibold border-t-2">
                  <td className="px-3 py-2" colSpan={4}>Total ({expenseRows.length} record{expenseRows.length === 1 ? '' : 's'})</td>
                  <td className="px-3 py-2 text-right text-red-700">{formatMoney(expenseTotal)}</td>
                </tr>
              )}
            />
          </div>
        </div>
      )}

      {tab === 'doctors' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card space-y-3 max-w-md">
            <h3 className="font-semibold">Add Doctor</h3>
            <p className="text-xs text-slate-500">Reception counter မှာ ဆရာဝန် ရွေးချယ်နိုင်ပါမယ်</p>
            <input
              className="input"
              placeholder="Doctor name * (e.g. Dr. Aung Kyaw)"
              value={doctorForm.full_name}
              onChange={(e) => setDoctorForm({ ...doctorForm, full_name: e.target.value })}
            />
            <input
              className="input"
              type="number"
              placeholder="Consultation fee (MMK) *"
              value={doctorForm.consultation_fee}
              onChange={(e) => setDoctorForm({ ...doctorForm, consultation_fee: e.target.value })}
            />
            <select
              className="input"
              value={doctorForm.specialty}
              onChange={(e) => setDoctorForm({ ...doctorForm, specialty: e.target.value })}
            >
              {DOCTOR_SPECIALTY_PRESETS.map((sp) => (
                <option key={sp} value={sp}>{sp}</option>
              ))}
            </select>
            {doctorForm.specialty === 'Other' && (
              <input
                className="input"
                placeholder="Department name (e.g. Cardiology)"
                value={doctorForm.specialtyCustom}
                onChange={(e) => setDoctorForm({ ...doctorForm, specialtyCustom: e.target.value })}
              />
            )}
            <p className="text-xs text-slate-500">Reception မှာ Clinic/Department ရွေးပြီး ဆရာဝန် ရွေးမယ်</p>
            <button type="button" disabled={busy} className="btn btn-primary" onClick={addDoctor}>Save Doctor</button>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3">Doctor List & Fees</h3>
            <DataTable
              rows={doctors.map((d) => ({
                id: d.id,
                name: d.full_name,
                fee: d.consultation_fee,
                specialty: d.specialty,
              }))}
              columns={[
                { key: 'name', label: 'Doctor', render: (r) => String(r.name) },
                { key: 'fee', label: 'Consultation Fee', render: (r) => formatMoney(Number(r.fee)) },
                { key: 'specialty', label: 'Clinic / Dept', render: (r) => String(r.specialty || '—') },
                { key: 'act', label: '', render: (r) => (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const sp = String(r.specialty || 'General Medicine')
                      const preset = DOCTOR_SPECIALTY_PRESETS.includes(sp as typeof DOCTOR_SPECIALTY_PRESETS[number])
                      setEditDoctor({
                        id: r.id,
                        full_name: r.name,
                        consultation_fee: r.fee,
                        specialty: preset ? sp : 'Other',
                        specialtyCustom: preset ? '' : sp,
                      })
                    }}
                  >
                    Edit
                  </button>
                ) },
              ]}
              emptyText="No doctors yet"
            />
          </div>

          {editDoctor && (
            <Modal title="Edit Doctor" onClose={() => setEditDoctor(null)}>
              <input
                className="input"
                value={editDoctor.full_name}
                onChange={(e) => setEditDoctor({ ...editDoctor, full_name: e.target.value })}
              />
              <input
                className="input"
                type="number"
                placeholder="Consultation fee"
                value={editDoctor.consultation_fee}
                onChange={(e) => setEditDoctor({ ...editDoctor, consultation_fee: e.target.value })}
              />
              <select
                className="input"
                value={editDoctor.specialty || 'General Medicine'}
                onChange={(e) => setEditDoctor({ ...editDoctor, specialty: e.target.value })}
              >
                {DOCTOR_SPECIALTY_PRESETS.map((sp) => (
                  <option key={sp} value={sp}>{sp}</option>
                ))}
              </select>
              {editDoctor.specialty === 'Other' && (
                <input
                  className="input"
                  placeholder="Department name"
                  value={editDoctor.specialtyCustom || ''}
                  onChange={(e) => setEditDoctor({ ...editDoctor, specialtyCustom: e.target.value })}
                />
              )}
              <div className="flex gap-2">
                <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={saveDoctorEdit}>Save</button>
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditDoctor(null)}>Cancel</button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {tab === 'services' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              ['lab', 'Lab Tests'],
              ['xray', 'X-Ray'],
              ['usg', 'USG'],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" className={`btn ${serviceDept === id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setServiceDept(id)}>{label}</button>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card space-y-3 max-w-md">
              <h3 className="font-semibold">Add {serviceDept === 'lab' ? 'Lab Test' : serviceDept === 'xray' ? 'X-Ray Service' : 'USG Service'}</h3>
              <p className="text-xs text-slate-500">ဒီနေရာမှာ ထည့်ထားတဲ့ item တွေကိုပဲ Lab/X-Ray/USG counter တွေမှာ order လုပ်လို့ရမှာပါ</p>
              <input className="input" placeholder="Name *" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} />
              <input className="input" type="number" placeholder="Price (MMK)" value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })} />
              <button type="button" disabled={busy} className="btn btn-primary" onClick={addServiceItem}>Save</button>
            </div>

            <div className="card">
              <h3 className="font-semibold mb-3">{serviceDept === 'lab' ? 'Lab Tests' : serviceDept === 'xray' ? 'X-Ray Services' : 'USG Services'}</h3>
              <DataTable
                rows={serviceItems.map((s) => ({ id: s.id, name: s.name, price: s.price, is_active: s.is_active }))}
                columns={[
                  { key: 'name', label: 'Name', render: (r) => (
                    <span className={r.is_active ? '' : 'text-slate-400 line-through'}>{String(r.name)}</span>
                  ) },
                  { key: 'price', label: 'Price', render: (r) => formatMoney(Number(r.price)) },
                  { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.is_active ? 'ACTIVE' : 'HIDDEN'} /> },
                  { key: 'act', label: '', render: (r) => (
                    <div className="flex gap-1">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditService({ id: r.id, name: r.name, price: r.price })}>Edit</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleServiceActive(r)}>{r.is_active ? 'Hide' : 'Show'}</button>
                    </div>
                  ) },
                ]}
                emptyText="No items yet"
              />
            </div>
          </div>

          {editService && (
            <Modal title="Edit Item" onClose={() => setEditService(null)}>
              <input className="input" value={editService.name} onChange={(e) => setEditService({ ...editService, name: e.target.value })} />
              <input className="input" type="number" placeholder="Price" value={editService.price} onChange={(e) => setEditService({ ...editService, price: e.target.value })} />
              <div className="flex gap-2">
                <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={saveServiceEdit}>Save</button>
                <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditService(null)}>Cancel</button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              ['day', 'Today'],
              ['month', '1 Month'],
              ['3m', '3 Months'],
              ['year', '1 Year'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                className={`btn ${analyticsPeriod === id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setAnalyticsPeriod(id)
                  void loadAnalytics(id)
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              className={`btn ${analyticsPeriod === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAnalyticsPeriod('custom')}
            >
              Custom Range
            </button>
            <button
              type="button"
              disabled={busy || (analyticsPeriod === 'custom' && (!customFrom || !customTo))}
              className="btn btn-secondary ml-auto"
              onClick={() => exportExcel(
                '/counter/analytics/export',
                analyticsPeriod === 'custom'
                  ? { branch_id: branchId, date_from: customFrom, date_to: customTo }
                  : { branch_id: branchId, period: analyticsPeriod },
                'analytics-report.xlsx',
              )}
            >
              Export Excel
            </button>
          </div>

          {analyticsPeriod === 'custom' && (
            <div className="card flex flex-wrap items-end gap-2">
              <div>
                <label className="text-sm text-slate-600">From</label>
                <input type="date" className="input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-slate-600">To</label>
                <input type="date" className="input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
              <button type="button" disabled={busy || !customFrom || !customTo} className="btn btn-primary" onClick={() => loadAnalytics('custom')}>
                Apply
              </button>
            </div>
          )}

          {!analytics ? (
            <div className="card text-slate-500 text-sm">Loading analytics…</div>
          ) : (
            <>
              <div className="text-sm text-slate-600">
                {analytics.period_label} · {formatDate(analytics.from_date)} — {formatDate(analytics.to_date)}
              </div>

              <Tabs
                tabs={[
                  { id: 'overview', label: 'Overview' },
                  { id: 'breakdown', label: 'Breakdown' },
                  { id: 'expenses', label: `Expenses (${(analytics.expense_details || []).length})` },
                  { id: 'trend', label: 'Trend' },
                ]}
                active={analyticsSub}
                onChange={(t) => setAnalyticsSub(t as any)}
              />

              {analyticsSub === 'overview' && (
              <div className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Cash In (ငွေဝင်)"
                  value={formatMoney(Number(analytics.total_collected))}
                  tone="success"
                  hint={
                    <>
                      <div>Today&apos;s bills · {formatMoney(Number(analytics.collected_today_bills ?? 0))}</div>
                      <div>Older bills · {formatMoney(Number(analytics.collected_older_bills ?? 0))}</div>
                    </>
                  }
                />
                <StatCard label="Today's Billing (ဒီနေ့တင်မှု)" value={formatMoney(Number(analytics.total_billed))} />
                <StatCard label="Expenses" value={formatMoney(Number(analytics.total_expenses))} tone="danger" />
                <StatCard label="Net" value={formatMoney(Number(analytics.net))} tone={analytics.net >= 0 ? 'success' : 'danger'} />
              </div>

              {Number(analytics.outstanding) > 0 ? (
                <Alert tone="warning">
                  Unpaid today&apos;s bills: <strong>{formatMoney(Number(analytics.outstanding))}</strong>
                </Alert>
              ) : (
                <div className="text-sm rounded-lg px-4 py-2 border border-slate-200 bg-slate-50 text-slate-600">
                  Unpaid today&apos;s bills: <strong>{formatMoney(Number(analytics.outstanding))}</strong>
                </div>
              )}

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="card text-sm">
                  <div className="text-slate-500">Total Bills</div>
                  <div className="text-xl font-bold">{analytics.total_bills}</div>
                </div>
                <div className="card text-sm">
                  <div className="text-slate-500">Paid Bills</div>
                  <div className="text-xl font-bold text-green-700">{analytics.paid_bills}</div>
                </div>
                <div className="card text-sm">
                  <div className="text-slate-500">Avg per Paid Bill</div>
                  <div className="text-xl font-bold">{formatMoney(Number(analytics.avg_bill))}</div>
                </div>
              </div>
              </div>
              )}

              {analyticsSub === 'breakdown' && (
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="card space-y-3">
                  <h3 className="font-semibold">Payment Methods</h3>
                  {(analytics.payment_methods || []).length === 0 && <p className="text-sm text-slate-500">No payments</p>}
                  {(analytics.payment_methods || []).map((p: any) => (
                    <div key={p.method} className="flex justify-between text-sm border-b py-2">
                      <span className="font-medium">{p.method}</span>
                      <span>{formatMoney(Number(p.amount))}</span>
                    </div>
                  ))}
                </div>

                <div className="card space-y-3">
                  <h3 className="font-semibold">By Department</h3>
                  {(analytics.by_source || []).length === 0 && <p className="text-sm text-slate-500">No bill items</p>}
                  {(analytics.by_source || []).map((s: any) => (
                    <div key={s.source} className="flex justify-between text-sm border-b py-2">
                      <span>{s.source}</span>
                      <span>{formatMoney(Number(s.amount))}</span>
                    </div>
                  ))}
                </div>

                <div className="card space-y-3">
                  <h3 className="font-semibold">Doctor Income</h3>
                  {(analytics.by_doctor || []).length === 0 && <p className="text-sm text-slate-500">No doctor fees in this period</p>}
                  {(analytics.by_doctor || []).map((d: any) => (
                    <div key={d.doctor_id || d.doctor} className="flex justify-between text-sm border-b py-2 gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{d.doctor}</div>
                        <div className="text-xs text-slate-500">{d.bills} bill{d.bills === 1 ? '' : 's'} · billed {formatMoney(Number(d.billed))}</div>
                      </div>
                      <span className="shrink-0 font-medium text-[var(--brand-600)]">{formatMoney(Number(d.fee_income))}</span>
                    </div>
                  ))}
                </div>

                <div className="card space-y-3">
                  <h3 className="font-semibold">Pharmacy Profit</h3>
                  {!analytics.pharmacy_profit || Number(analytics.pharmacy_profit.revenue) <= 0 ? (
                    <p className="text-sm text-slate-500">No pharmacy sales in this period</p>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm border-b py-2">
                        <span>Revenue (sell)</span>
                        <span>{formatMoney(Number(analytics.pharmacy_profit.revenue))}</span>
                      </div>
                      <div className="flex justify-between text-sm border-b py-2">
                        <span>Cost (buy)</span>
                        <span className="text-red-600">{formatMoney(Number(analytics.pharmacy_profit.cost))}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold pt-1">
                        <span>Profit</span>
                        <span className={Number(analytics.pharmacy_profit.profit) >= 0 ? 'text-green-700' : 'text-red-600'}>
                          {formatMoney(Number(analytics.pharmacy_profit.profit))}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Margin {Number(analytics.pharmacy_profit.margin_pct)}%
                      </div>
                    </>
                  )}
                </div>
              </div>
              )}

              {analyticsSub === 'expenses' && (
              <div className="card space-y-3">
                <h3 className="font-semibold">Expenses</h3>
                {(analytics.expense_details || []).length === 0 && (
                  <p className="text-sm text-slate-500">No expenses in this period</p>
                )}
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {(analytics.expense_details || []).map((e: any) => (
                    <div key={e.id} className="flex justify-between text-sm border-b py-2 gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{e.category}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {formatDate(String(e.created_at))}
                          {e.notes ? ` · ${e.notes}` : ''}
                          {e.paid_from ? ` · ${String(e.paid_from).toUpperCase()}` : ''}
                        </div>
                      </div>
                      <span className="shrink-0 text-red-600">{formatMoney(Number(e.amount))}</span>
                    </div>
                  ))}
                </div>
                {(analytics.expense_details || []).length > 0 && (
                  <div className="flex justify-between text-sm font-semibold pt-1 border-t">
                    <span>Total Expenses</span>
                    <span className="text-red-600">{formatMoney(Number(analytics.total_expenses))}</span>
                  </div>
                )}
              </div>
              )}

              {analyticsSub === 'trend' && (
              <div className="card space-y-3">
                <h3 className="font-semibold">
                  {analyticsPeriod === 'day' ? 'Hourly Collection' : 'Daily Collection'}
                </h3>
                {(analytics.trend || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No collection data for this period</p>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const max = Math.max(...(analytics.trend || []).map((t: any) => Number(t.amount)), 1)
                      return (analytics.trend || []).map((t: any) => (
                        <div key={t.label} className="flex items-center gap-3 text-sm">
                          <div className="w-24 shrink-0 text-slate-600 truncate">{t.label}</div>
                          <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                            <div
                              className="h-full bg-[var(--brand-600)] rounded"
                              style={{ width: `${Math.max((Number(t.amount) / max) * 100, Number(t.amount) > 0 ? 4 : 0)}%` }}
                            />
                          </div>
                          <div className="w-28 text-right shrink-0">{formatMoney(Number(t.amount))}</div>
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`btn ${historySub === 'bills' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setHistorySub('bills')}>Bill History</button>
            <button type="button" className={`btn ${historySub === 'activity' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setHistorySub('activity')}>Activity Log</button>
          </div>

          {historySub === 'bills' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="card space-y-3">
                <div className="flex flex-wrap gap-2">
                  <input className="input flex-1 min-w-[180px]" placeholder="Search name / ID / bill #" value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadHistory()} />
                  <select className="input w-32" value={historyStatus} onChange={(e) => setHistoryStatus(e.target.value)}>
                    <option value="all">All</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="open">Open</option>
                  </select>
                  <button type="button" className="btn btn-primary" onClick={loadHistory}>Search</button>
                  <button
                    type="button"
                    disabled={busy}
                    className="btn btn-secondary whitespace-nowrap"
                    onClick={() => exportExcel('/counter/bill-history/export', { branch_id: branchId, q: historyQuery, status: historyStatus, days: 90 }, 'bill-history.xlsx')}
                  >
                    Export Excel
                  </button>
                </div>
                <DataTable rows={historyRows} columns={[
                  { key: 'number', label: 'Bill', render: (r) => String(r.number) },
                  { key: 'patient', label: 'Patient', render: (r) => String(r.patient_name) },
                  { key: 'total', label: 'Total', render: (r) => formatMoney(Number(r.total)) },
                  { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
                  { key: 'pay', label: 'Paid via', render: (r) => String(r.payment_methods) },
                  { key: 'date', label: 'Date', render: (r) => formatDate(String(r.created_at)) },
                  { key: 'act', label: '', render: (r) => (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openHistoryBill(r)}>View</button>
                  ) },
                ]} emptyText="No bills found" />
              </div>

              <div className="card space-y-3">
                {!historyDetail ? (
                  <p className="text-slate-500 text-sm">Bill ရွေးပြီး View နှိပ်ပါ — lines နဲ့ payments ပြမယ်</p>
                ) : (
                  <>
                    <h3 className="font-semibold">{historyDetail.number}</h3>
                    <div className="text-sm text-slate-600">{formatDate(historyDetail.created_at)} · <StatusBadge value={historyDetail.status} /></div>
                    <div className="max-h-56 overflow-auto border rounded-lg text-sm no-print">
                      <div className="font-medium text-slate-500 bg-slate-50 px-3 py-2 sticky top-0">Bill items</div>
                      <div className="divide-y">
                        {(historyDetail.lines || []).map((l: any) => (
                          <div key={l.id} className="grid grid-cols-[1fr_3rem_6.5rem_1.75rem] gap-3 items-center px-3 py-2">
                            <span className="truncate" title={l.description}>{l.description}</span>
                            <span className="text-center text-slate-600">{Number(l.qty || 1)}</span>
                            <span className="text-right font-medium">{formatMoney(l.amount)}</span>
                            <button
                              type="button"
                              title="Void this line"
                              disabled={busy}
                              className="text-slate-400 hover:text-red-600 cursor-pointer text-lg leading-none justify-self-center"
                              onClick={() => void voidLine(historyDetail, l.id, setHistoryDetail)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1 border rounded-lg p-2 text-sm">
                      <div className="font-medium text-slate-500">Payments</div>
                      {(historyDetail.payments || []).length === 0 && <div className="text-slate-400">No payments yet</div>}
                      {(historyDetail.payments || []).map((p: any) => (
                        <div key={p.id} className={`flex justify-between border-b py-1 ${p.method === 'refund' ? 'text-red-600' : ''}`}>
                          <span className="uppercase">{p.method === 'refund' ? 'REFUND' : p.method}</span>
                          <span>{p.method === 'refund' ? '−' : ''}{formatMoney(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span>{formatMoney(historyDetail.total)}</span>
                    </div>
                    {Number(historyDetail.paid) > 0.01 && (
                      <div className="border-t pt-3 space-y-2 no-print">
                        <div className="font-medium">Refund</div>
                        <ToggleGroup
                          options={PAY_METHODS.map((m) => ({ value: m, label: payMethodLabel(m) }))}
                          value={refundMethod}
                          onChange={setRefundMethod}
                        />
                        <div className="flex gap-2">
                          <input
                            className="input flex-1"
                            type="number"
                            placeholder={`Refund amount (max ${formatMoney(historyDetail.paid)})`}
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                          />
                          <button type="button" disabled={busy} className="btn btn-secondary whitespace-nowrap" onClick={() => void submitRefund(historyDetail, setHistoryDetail)}>Refund</button>
                        </div>
                        <input
                          className="input"
                          placeholder="Reason (optional)"
                          value={refundReason}
                          onChange={(e) => setRefundReason(e.target.value)}
                        />
                      </div>
                    )}
                    <button type="button" className="btn btn-secondary w-full no-print" onClick={() => window.print()}>Print Receipt</button>
                  </>
                )}
              </div>
            </div>
          )}

          {historySub === 'activity' && (
            <div className="card">
              <DataTable rows={activityRows} columns={[
                { key: 'when', label: 'Time', render: (r) => formatDate(String(r.created_at)) },
                { key: 'action', label: 'Action', render: (r) => String(r.action) },
                { key: 'user', label: 'User', render: (r) => String(r.user_name) },
                { key: 'detail', label: 'Detail', render: (r) => String(r.detail || r.entity) },
              ]} emptyText="No activity yet" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
