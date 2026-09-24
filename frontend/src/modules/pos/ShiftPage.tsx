import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { formatMoney } from '../../lib/format'

export default function ShiftPage() {
  const { session } = useAuth()
  const toast = useToast()
  const branchId = session?.branch_id || 1
  const [shift, setShift] = useState<any>(null)
  const [z, setZ] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/shifts/current').then((r) => setShift(r.data)).catch(() => {})
  }, [])

  async function openShift() {
    setBusy(true)
    try {
      const { data } = await api.post('/shifts/open', null, { params: { branch_id: branchId, opening_float: 0 } })
      setShift(data)
      toast.success('Shift opened')
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function closeShift() {
    if (!shift) return
    setBusy(true)
    try {
      await api.post(`/shifts/${shift.id}/close`, null, { params: { closing_cash: 0 } })
      const { data } = await api.get(`/shifts/${shift.id}/z-report`)
      setZ(data)
      setShift(null)
      toast.success('Shift closed')
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 max-w-xl">
      <div className="card space-y-4">
        <h1 className="text-xl font-bold text-[#005293]">Cashier Shift</h1>
        {shift ? (
          <>
            <div className="rounded-lg bg-blue-50 px-4 py-3">
              <div className="text-sm text-slate-600">Current shift</div>
              <div className="text-lg font-semibold">Shift #{shift.id}</div>
              <div className="text-sm">Opening float: {formatMoney(shift.opening_float)}</div>
            </div>
            <button type="button" disabled={busy} className="btn btn-primary" onClick={closeShift}>
              {busy ? 'Closing...' : 'Close Shift & Z-Report'}
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} className="btn btn-primary" onClick={openShift}>
            {busy ? 'Opening...' : 'Open Shift'}
          </button>
        )}
        {z && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
            <h2 className="font-semibold">Z-Report</h2>
            <div className="flex justify-between"><span>Shift</span><span>#{z.shift_id}</span></div>
            <div className="flex justify-between"><span>Invoices</span><span>{z.invoice_count}</span></div>
            <div className="flex justify-between"><span>Total billed</span><span>{formatMoney(z.total)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total paid</span><span>{formatMoney(z.paid)}</span></div>
          </div>
        )}
      </div>
    </div>
  )
}
