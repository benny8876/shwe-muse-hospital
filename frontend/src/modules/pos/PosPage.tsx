import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'

export default function PosPage() {
  const { session } = useAuth()
  const toast = useToast()
  const branchId = session?.branch_id || 1
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState<any[]>([])
  const [catalog, setCatalog] = useState<any[]>([])
  const [patient, setPatient] = useState<any | null>(null)
  const [invoice, setInvoice] = useState<any | null>(null)
  const [payMethod, setPayMethod] = useState('cash')
  const [payAmount, setPayAmount] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get('/catalog').then((r) => setCatalog(r.data)).catch(() => toast.error('Could not load catalog'))
  }, [])

  async function searchPatients() {
    setBusy(true)
    try {
      const { data } = await api.get('/patients', { params: { q: query } })
      setPatients(data)
      if (!data.length) toast.error('No patients found')
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function startBill(p: any) {
    setBusy(true)
    try {
      setPatient(p)
      const { data } = await api.post('/invoices', { patient_id: p.id, branch_id: branchId, kind: 'opd' })
      setInvoice(data)
      toast.success(`Bill started: ${data.number}`)
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function addItem(item: any) {
    if (!invoice) {
      toast.error('Select a patient first')
      return
    }
    setBusy(true)
    try {
      await api.post(`/invoices/${invoice.id}/lines`, {
        item_id: item.id,
        qty: 1,
        source: item.category === 'consultation' ? 'opd' : item.category,
      })
      const inv = await api.get(`/invoices/${invoice.id}`)
      setInvoice(inv.data)
      toast.success(`${item.name} added`)
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function pay() {
    if (!invoice) return
    setBusy(true)
    try {
      await api.post(`/invoices/${invoice.id}/pay`, { method: payMethod, amount: payAmount || invoice.balance })
      const inv = await api.get(`/invoices/${invoice.id}`)
      setInvoice(inv.data)
      toast.success('Payment recorded')
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-12 gap-4 p-4 min-h-[calc(100vh-64px)]">
      <section className="lg:col-span-3 card space-y-3">
        <h2 className="font-bold text-lg">Patient / Queue</h2>
        <div className="flex gap-2">
          <input className="input" placeholder="Name / Phone / UHID" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchPatients()} />
          <button type="button" disabled={busy} className="btn btn-primary" onClick={searchPatients}>Search</button>
        </div>
        <div className="max-h-80 overflow-auto space-y-2">
          {patients.map((p) => (
            <button type="button" key={p.id} disabled={busy} className={`w-full text-left rounded-lg border p-3 cursor-pointer ${patient?.id === p.id ? 'border-[#005293] bg-blue-50' : ''}`} onClick={() => startBill(p)}>
              <div className="font-semibold">{p.name}</div>
              <div className="text-sm text-slate-600">{p.uhid} · {p.phone}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="lg:col-span-5 card">
        <h2 className="font-bold text-lg mb-3">Items / Barcode</h2>
        <div className="grid sm:grid-cols-2 gap-2 max-h-[70vh] overflow-auto">
          {catalog.map((item) => (
            <button type="button" key={item.id} disabled={busy} className="rounded-xl border p-4 text-left hover:border-[#005293] min-h-[72px] cursor-pointer" onClick={() => addItem(item)}>
              <div className="font-semibold">{item.name}</div>
              <div className="text-sm text-slate-600">{item.sku} · {item.price.toLocaleString()} MMK</div>
            </button>
          ))}
        </div>
      </section>

      <section className="lg:col-span-4 card space-y-3">
        <h2 className="font-bold text-lg">Payment</h2>
        {invoice ? (
          <>
            <div className="text-sm">Invoice: {invoice.number}</div>
            <div className="space-y-1 max-h-48 overflow-auto">
              {(invoice.lines || []).map((l: any) => (
                <div key={l.id} className="flex justify-between text-sm border-b py-1">
                  <span>{l.description}</span>
                  <span>{l.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="text-xl font-bold">Total: {invoice.total.toLocaleString()} MMK</div>
            <div className="text-lg">Balance: {invoice.balance.toLocaleString()} MMK</div>
            <div className="grid grid-cols-3 gap-2">
              {['cash', 'kpay', 'wave', 'kbzpay', 'card'].map((m) => (
                <button type="button" key={m} disabled={busy} className={`btn ${payMethod === m ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPayMethod(m)}>{m.toUpperCase()}</button>
              ))}
            </div>
            <input className="input" type="number" placeholder="Amount" value={payAmount || ''} onChange={(e) => setPayAmount(Number(e.target.value))} />
            <button type="button" disabled={busy} className="btn btn-primary w-full text-lg" onClick={pay}>Pay & Print Receipt</button>
            <button type="button" className="btn btn-secondary w-full" onClick={() => window.print()}>Print</button>
          </>
        ) : (
          <p className="text-slate-500">Select a patient to start billing.</p>
        )}
      </section>
    </div>
  )
}
