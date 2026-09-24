import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import Tabs from '../../components/Tabs'
import StatusBadge from '../../components/StatusBadge'
import { formatDate, formatMoney } from '../../lib/format'

export default function PortalPage() {
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [patientId, setPatientId] = useState<number | null>(null)
  const [tab, setTab] = useState('bills')
  const [bills, setBills] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [busy, setBusy] = useState(false)

  async function requestOtp() {
    if (!phone.trim()) return toast.error('Enter phone number')
    setBusy(true)
    try {
      const { data } = await api.post('/portal/otp', null, { params: { phone } })
      if (data.ok) toast.success('OTP sent (demo: 123456)')
      else toast.error(data.detail || 'Patient not found')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function verify() {
    setBusy(true)
    try {
      const { data } = await api.post('/portal/verify', null, { params: { phone, code } })
      if (data.ok && data.patient_id) {
        setPatientId(data.patient_id)
        toast.success('Logged in')
        await loadAll(data.patient_id)
      } else {
        toast.error('Invalid OTP')
      }
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function loadAll(pid: number) {
    const params = { phone }
    const [b, h, a] = await Promise.all([
      api.get(`/portal/${pid}/bills`, { params }),
      api.get(`/portal/${pid}/history`, { params }),
      api.get(`/portal/${pid}/appointments`, { params }),
    ])
    setBills(b.data)
    setHistory(h.data)
    setAppointments(a.data)
  }

  useEffect(() => {
    if (patientId) void loadAll(patientId)
  }, [tab, patientId])

  if (!patientId) {
    return (
      <div className="card max-w-md mx-auto space-y-3">
        <h1 className="text-xl font-bold text-[#005293]">Patient Portal</h1>
        <p className="text-sm text-slate-600">Login with your registered phone number</p>
        <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button type="button" disabled={busy} className="btn btn-primary" onClick={requestOtp}>Send OTP</button>
        <input className="input" placeholder="OTP code" value={code} onChange={(e) => setCode(e.target.value)} />
        <button type="button" disabled={busy} className="btn btn-primary" onClick={verify}>Verify & Login</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#005293]">My Health Portal</h1>
        <button type="button" className="btn btn-secondary !py-1" onClick={() => { setPatientId(null); setPhone(''); setCode('') }}>Logout</button>
      </div>
      <Tabs tabs={[
        { id: 'bills', label: 'Bills' },
        { id: 'history', label: 'Visit History' },
        { id: 'appointments', label: 'Appointments' },
      ]} active={tab} onChange={setTab} />

      {tab === 'bills' && (
        <div className="card divide-y">
          {bills.length === 0 && <div className="text-slate-500 py-4">No bills found</div>}
          {bills.map((b) => (
            <div key={b.id} className="py-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{b.number}</div>
                <div className="text-sm text-slate-500">{formatDate(b.created_at)}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatMoney(b.total)}</div>
                <StatusBadge value={b.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="card divide-y">
          {history.length === 0 && <div className="text-slate-500 py-4">No visit records</div>}
          {history.map((v) => (
            <div key={v.id} className="py-3">
              <div className="font-medium">{formatDate(v.created_at)}</div>
              <div className="text-sm">Dx: {v.diagnosis || '—'}</div>
              <div className="text-sm text-slate-600">Rx: {v.prescription || '—'}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'appointments' && (
        <div className="card divide-y">
          {appointments.length === 0 && <div className="text-slate-500 py-4">No appointments</div>}
          {appointments.map((a) => (
            <div key={a.id} className="py-3 flex justify-between">
              <div>{formatDate(a.scheduled_at)}</div>
              <StatusBadge value={a.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
