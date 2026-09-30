import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import Tabs from '../../components/Tabs'
import PatientSelect from '../../components/PatientSelect'
import { usePatients } from '../../hooks/usePatients'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ToggleGroup from '../../components/ToggleGroup'
import RegistrationLabel from '../../components/RegistrationLabel'
import Modal from '../../components/Modal'
import Alert from '../../components/Alert'
import { formatAge, formatDate, formatMoney } from '../../lib/format'
import {
  doctorOptionLabel,
  doctorsInSpecialty,
  specialtyOptionsForDoctors,
} from '../../lib/doctorSpecialties'

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`.trim()}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

type Doctor = { id: number; full_name: string; consultation_fee: number; specialty?: string }
type Ward = { id: number; name: string; category: string }
type Bed = { id: number; code: string; status: string; daily_rate: number; hourly_rate: number; package_rate: number }

export default function ReceptionCounterPage() {
  const branchId = useBranchId()
  const { name: patientName, uhid: patientUhid } = usePatients()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [wards, setWards] = useState<Ward[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [patientType, setPatientType] = useState<'opd' | 'ipd'>('opd')
  const [doctorSpecialty, setDoctorSpecialty] = useState('General Medicine')
  const [doctorId, setDoctorId] = useState('')
  const [patientId, setPatientId] = useState('')
  const [wardId, setWardId] = useState('')
  const [bedId, setBedId] = useState('')
  const [billingMode, setBillingMode] = useState('daily')
  const [deposit, setDeposit] = useState('')
  const [form, setForm] = useState({ name: '', father_name: '', phone: '', gender: 'F', age_years: '', age_months: '', age_days: '', address: '', referring_doctor: '' })
  const [result, setResult] = useState<any>(null)
  const [tab, setTab] = useState('register')
  const [historyRows, setHistoryRows] = useState<any[]>([])
  const [historyQuery, setHistoryQuery] = useState('')
  const [patientHistory, setPatientHistory] = useState<{ name: string; uhid: string; rows: any[]; detail: any } | null>(null)
  const [patientHistoryBusy, setPatientHistoryBusy] = useState(false)
  const [busy, setBusy] = useState(false)

  const [convertPatientId, setConvertPatientId] = useState('')
  const [convertTarget, setConvertTarget] = useState<'opd' | 'ipd'>('ipd')
  const [convertWardId, setConvertWardId] = useState('')
  const [convertBedId, setConvertBedId] = useState('')
  const [convertBeds, setConvertBeds] = useState<Bed[]>([])
  const [convertBusy, setConvertBusy] = useState(false)

  const [ipdActive, setIpdActive] = useState<any[]>([])
  const [dischargePick, setDischargePick] = useState<any | null>(null)
  const [dischargeSummary, setDischargeSummary] = useState('')
  const [dischargeBusy, setDischargeBusy] = useState(false)

  const [appointments, setAppointments] = useState<any[]>([])
  const [apDoctorFilter, setApDoctorFilter] = useState('')
  const [apStatusFilter, setApStatusFilter] = useState('')
  const [apPatientId, setApPatientId] = useState('')
  const [apDoctorSpecialty, setApDoctorSpecialty] = useState('General Medicine')
  const [apDoctorId, setApDoctorId] = useState('')
  const [apScheduledAt, setApScheduledAt] = useState('')
  const [apDuration, setApDuration] = useState('15')
  const [apNotes, setApNotes] = useState('')
  const [apBusy, setApBusy] = useState(false)

  const [queueTokens, setQueueTokens] = useState<any[]>([])
  const [queueByDoctor, setQueueByDoctor] = useState<any[]>([])
  const [queueBusy, setQueueBusy] = useState(false)

  const [depositPick, setDepositPick] = useState<any | null>(null)
  const [extraDepositAmount, setExtraDepositAmount] = useState('')
  const [extraDepositMethod, setExtraDepositMethod] = useState('cash')
  const [extraDepositBusy, setExtraDepositBusy] = useState(false)

  const [convertDeposit, setConvertDeposit] = useState('')
  const [convertBillingMode, setConvertBillingMode] = useState('daily')

  useEffect(() => {
    if (convertTarget === 'ipd' && convertWardId) {
      api.get('/counter/beds', { params: { ward_id: convertWardId, available_only: true } })
        .then((r) => setConvertBeds(r.data))
        .catch((e) => toast.error(getApiError(e)))
    } else {
      setConvertBeds([])
    }
  }, [convertTarget, convertWardId, toast])

  async function convertPatientType() {
    if (!convertPatientId) return toast.error('လူနာ ရွေးပါ')
    if (convertTarget === 'ipd' && !convertBedId) return toast.error('Bed ရွေးပါ')
    setConvertBusy(true)
    try {
      const { data } = await api.post('/counter/convert-type', {
        branch_id: branchId,
        patient_id: Number(convertPatientId),
        target_type: convertTarget,
        bed_id: convertTarget === 'ipd' ? Number(convertBedId) : null,
        deposit: convertTarget === 'ipd' ? Number(convertDeposit) || 0 : 0,
        billing_mode: convertTarget === 'ipd' ? convertBillingMode : 'daily',
      })
      toast.success(`Converted to ${data.patient_type.toUpperCase()} — ${data.invoice_number}`)
      setConvertPatientId('')
      setConvertBedId('')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setConvertBusy(false)
    }
  }

  useEffect(() => {
    const pid = searchParams.get('patient_id')
    if (pid) {
      setMode('existing')
      setPatientId(pid)
      setTab('register')
    }
  }, [searchParams])

  useEffect(() => {
    api.get('/doctors').then((r) => setDoctors(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (doctors.length === 0) return
    const opts = specialtyOptionsForDoctors(doctors)
    if (doctorsInSpecialty(doctors, doctorSpecialty).length === 0 && opts[0]) {
      setDoctorSpecialty(opts[0])
    }
  }, [doctors, doctorSpecialty])

  const doctorSpecialtyOptions = specialtyOptionsForDoctors(doctors)
  const doctorsForSpecialty = doctorsInSpecialty(doctors, doctorSpecialty)

  useEffect(() => {
    if (!doctorId) return
    const still = doctorsForSpecialty.some((d) => String(d.id) === doctorId)
    if (!still) setDoctorId('')
  }, [doctorSpecialty, doctorsForSpecialty, doctorId])

  useEffect(() => {
    api.get('/counter/wards', { params: { branch_id: branchId } })
      .then((r) => setWards(r.data))
      .catch((e) => toast.error(getApiError(e)))
  }, [branchId, toast])

  useEffect(() => {
    if (patientType === 'ipd' && wardId) {
      api.get('/counter/beds', { params: { ward_id: wardId, available_only: true } })
        .then((r) => {
          setBeds(r.data)
          setBedId('')
        })
        .catch((e) => toast.error(getApiError(e)))
    } else {
      setBeds([])
      setBedId('')
    }
  }, [patientType, wardId, toast])

  useEffect(() => {
    if (tab === 'history') {
      api.get('/counter/bill-history', { params: { branch_id: branchId, days: 7 } })
        .then((r) => setHistoryRows(r.data))
        .catch((e) => toast.error(getApiError(e)))
    }
    if (tab === 'discharge' || tab === 'ipd-deposit') {
      api.get('/counter/active-patients', { params: { branch_id: branchId } })
        .then((r) => setIpdActive(r.data.filter((p: any) => (p.invoice_kind || '').toLowerCase() === 'ipd' && p.admission_id)))
        .catch((e) => toast.error(getApiError(e)))
    }
  }, [tab, branchId, toast])

  const apDoctorSpecialtyOptions = specialtyOptionsForDoctors(doctors)
  const apDoctorsForSpecialty = doctorsInSpecialty(doctors, apDoctorSpecialty)

  useEffect(() => {
    if (doctors.length === 0) return
    if (doctorsInSpecialty(doctors, apDoctorSpecialty).length === 0 && apDoctorSpecialtyOptions[0]) {
      setApDoctorSpecialty(apDoctorSpecialtyOptions[0])
    }
  }, [doctors]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadAppointments = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { branch_id: branchId }
      if (apDoctorFilter) params.doctor_id = apDoctorFilter
      if (apStatusFilter) params.status = apStatusFilter
      const { data } = await api.get('/appointments', { params })
      setAppointments(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, apDoctorFilter, apStatusFilter, toast])

  useEffect(() => {
    if (tab === 'appointments') void loadAppointments()
  }, [tab, loadAppointments])

  async function bookAppointment() {
    if (!apPatientId) return toast.error('လူနာ ရွေးပါ')
    if (!apDoctorId) return toast.error('ဆရာဝန် ရွေးပါ')
    if (!apScheduledAt) return toast.error('ရက်စွဲ/အချိန် ထည့်ပါ')
    setApBusy(true)
    try {
      await api.post('/appointments', {
        patient_id: Number(apPatientId),
        doctor_id: Number(apDoctorId),
        branch_id: branchId,
        scheduled_at: apScheduledAt,
        duration_minutes: Number(apDuration) || 15,
        notes: apNotes,
      })
      toast.success('Appointment booked')
      setApPatientId('')
      setApScheduledAt('')
      setApNotes('')
      await loadAppointments()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setApBusy(false)
    }
  }

  async function updateAppointmentStatus(id: number, status: string) {
    setApBusy(true)
    try {
      await api.patch(`/appointments/${id}`, { status })
      toast.success(`Appointment ${status}`)
      await loadAppointments()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setApBusy(false)
    }
  }

  // "Arrived" patient → jump to Register tab with them pre-selected, so the
  // receptionist only has to confirm details and start the OPD bill.
  function registerFromAppointment(ap: any) {
    setPatientType('opd')
    setMode('existing')
    setPatientId(String(ap.patient_id))
    setTab('register')
  }

  const loadQueue = useCallback(async () => {
    try {
      const { data } = await api.get('/queue-dashboard', { params: { branch_id: branchId } })
      setQueueTokens(data.tokens)
      setQueueByDoctor(data.by_doctor)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }, [branchId, toast])

  useEffect(() => {
    if (tab !== 'queue') return
    void loadQueue()
    const id = setInterval(() => { void loadQueue() }, 8000)
    return () => clearInterval(id)
  }, [tab, loadQueue])

  async function callToken(tokenId: number) {
    setQueueBusy(true)
    try {
      await api.patch(`/queue/${tokenId}/call`)
      await loadQueue()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setQueueBusy(false)
    }
  }

  async function finishToken(tokenId: number) {
    setQueueBusy(true)
    try {
      await api.patch(`/queue/${tokenId}/done`)
      await loadQueue()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setQueueBusy(false)
    }
  }

  async function skipToken(tokenId: number) {
    setQueueBusy(true)
    try {
      await api.patch(`/queue/${tokenId}/skip`)
      await loadQueue()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setQueueBusy(false)
    }
  }

  function formatWait(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  async function submitExtraDeposit() {
    if (!depositPick?.admission_id) return toast.error('IPD လူနာ ရွေးပါ')
    const amt = Number(extraDepositAmount)
    if (!amt || amt <= 0) return toast.error('Deposit amount ထည့်ပါ')
    setExtraDepositBusy(true)
    try {
      await api.post(`/ipd/admissions/${depositPick.admission_id}/deposit`, {
        amount: amt,
        method: extraDepositMethod,
      })
      toast.success(`Deposit ${formatMoney(amt)} recorded — ${depositPick.name}`)
      setExtraDepositAmount('')
      const { data: rows } = await api.get('/counter/active-patients', { params: { branch_id: branchId } })
      setIpdActive(rows.filter((p: any) => (p.invoice_kind || '').toLowerCase() === 'ipd' && p.admission_id))
      const updated = rows.find((p: any) => p.admission_id === depositPick.admission_id)
      if (updated) setDepositPick(updated)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setExtraDepositBusy(false)
    }
  }

  async function dischargeIpd() {
    if (!dischargePick?.admission_id) return toast.error('IPD လူနာ ရွေးပါ')
    setDischargeBusy(true)
    try {
      const { data } = await api.post(`/ipd/admissions/${dischargePick.admission_id}/discharge`, { summary: dischargeSummary })
      const inv = data.invoice
      toast.success(
        inv
          ? `Discharged — ${dischargePick.name}: bill ${inv.status}, balance ${formatMoney(inv.balance)} → Cashier`
          : `Discharged — ${dischargePick.name}`,
      )
      setDischargePick(null)
      setDischargeSummary('')
      const { data: rows } = await api.get('/counter/active-patients', { params: { branch_id: branchId } })
      setIpdActive(rows.filter((p: any) => (p.invoice_kind || '').toLowerCase() === 'ipd' && p.admission_id))
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setDischargeBusy(false)
    }
  }

  const historyTerms = historyQuery.trim().toLowerCase().split(/[,\s]+/).filter(Boolean)
  const filteredHistory = historyRows.filter((r) => {
    if (historyTerms.length === 0) return true
    const fields = [
      String(r.patient_name || ''),
      String(r.uhid || ''),
      String(r.number || ''),
      String(r.phone || ''),
      String(r.status || ''),
      String(r.invoice_kind || 'opd'),
    ].map((f) => f.toLowerCase())
    return historyTerms.every((term) => fields.some((f) => f.includes(term)))
  })

  async function openPatientHistory(row: any) {
    setPatientHistoryBusy(true)
    setPatientHistory({ name: row.patient_name, uhid: row.uhid, rows: [], detail: null })
    try {
      const [historyRes, detailRes] = await Promise.all([
        api.get('/counter/bill-history', { params: { branch_id: branchId, q: row.uhid, status: 'all', days: 3650 } }),
        row.patient_id ? api.get(`/patients/${row.patient_id}`).catch(() => null) : Promise.resolve(null),
      ])
      setPatientHistory({ name: row.patient_name, uhid: row.uhid, rows: historyRes.data, detail: detailRes?.data || null })
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setPatientHistoryBusy(false)
    }
  }

  async function register() {
    if (!doctorId) return toast.error('ဆရာဝန် ရွေးပါ')
    if (mode === 'existing' && !patientId) return toast.error('လူနာ ရွေးပါ')
    if (mode === 'new' && !form.name.trim()) return toast.error('အမည် ထည့်ပါ')
    const months = form.age_months === '' ? null : Number(form.age_months)
    const days = form.age_days === '' ? null : Number(form.age_days)
    if (months != null && (months < 0 || months > 11)) return toast.error('လ ကို ၀ ကနေ ၁၁ အထိ ထည့်ပါ')
    if (days != null && (days < 0 || days > 30)) return toast.error('ရက် ကို ၀ ကနေ ၃၀ အထိ ထည့်ပါ')
    if (patientType === 'ipd' && !bedId) return toast.error('Ward / Bed ရွေးပါ')

    setBusy(true)
    try {
      const { data } = await api.post('/counter/reception', {
        branch_id: branchId,
        doctor_id: Number(doctorId),
        patient_id: mode === 'existing' ? Number(patientId) : null,
        name: form.name,
        phone: form.phone,
        gender: form.gender,
        age_years: form.age_years === '' ? (months != null || days != null ? 0 : null) : Number(form.age_years),
        age_months: months,
        age_days: days,
        address: form.address,
        father_name: form.father_name,
        referring_doctor: form.referring_doctor,
        patient_type: patientType,
        bed_id: patientType === 'ipd' ? Number(bedId) : null,
        deposit: patientType === 'ipd' ? Number(deposit) || 0 : 0,
        billing_mode: patientType === 'ipd' ? billingMode : 'daily',
      })
      setResult(data)
      toast.success(patientType === 'ipd' ? `IPD Admitted — ${data.invoice_number}` : `OPD Registered — ${data.invoice_number}`)
      if (mode === 'new') setForm({ name: '', father_name: '', phone: '', gender: 'F', age_years: '', age_months: '', age_days: '', address: '', referring_doctor: '' })
      setPatientId('')
      setBedId('')
      setDeposit('')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Tabs tabs={[
        { id: 'register', label: 'Register' },
        { id: 'appointments', label: 'Appointments' },
        { id: 'queue', label: 'Queue' },
        { id: 'discharge', label: 'IPD Discharge' },
        { id: 'ipd-deposit', label: 'IPD Deposit' },
        { id: 'convert', label: 'Convert OPD ⇄ IPD' },
        { id: 'history', label: 'Bill History' },
      ]} active={tab} onChange={setTab} />

      <div className="mb-4">
        <Link to="/counter/patient-records" className="text-sm text-[var(--brand-600)] hover:underline">
          📁 Patient Records — လူနာ history ကြည့်ရန်
        </Link>
      </div>

      {tab === 'register' && (
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4 items-start">
        <div className="card space-y-5">
          <div>
            <h3 className="font-semibold text-slate-800 mb-3">Patient Type</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <ToggleGroup
                options={[{ value: 'opd', label: 'OPD (Outpatient)' }, { value: 'ipd', label: 'IPD (Inpatient)' }]}
                value={patientType}
                onChange={(v) => setPatientType(v as typeof patientType)}
              />
              <ToggleGroup
                options={[{ value: 'new', label: 'New Patient' }, { value: 'existing', label: 'Existing' }]}
                value={mode}
                onChange={(v) => setMode(v as typeof mode)}
              />
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-800 mb-3 pt-1 border-t border-slate-200">Patient Details</h3>
            {mode === 'new' ? (
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Full name">
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Father name">
                  <input className="input" value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} />
                </Field>
                <Field label="Age">
                  <div className="grid grid-cols-3 gap-2">
                    <input className="input" type="number" min={0} placeholder="နှစ်" value={form.age_years} onChange={(e) => setForm({ ...form, age_years: e.target.value })} />
                    <input className="input" type="number" min={0} max={11} placeholder="လ" value={form.age_months} onChange={(e) => setForm({ ...form, age_months: e.target.value })} />
                    <input className="input" type="number" min={0} max={30} placeholder="ရက်" value={form.age_days} onChange={(e) => setForm({ ...form, age_days: e.target.value })} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">နှစ်၊ လ (၀–၁၁)၊ ရက် (၀–၃၀)</p>
                </Field>
                <Field label="Gender">
                  <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="F">Female</option><option value="M">Male</option>
                  </select>
                </Field>
                <Field label="Phone">
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
                <Field label="Address">
                  <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </Field>
                <Field label="Referring doctor (optional)">
                  <input className="input" value={form.referring_doctor} onChange={(e) => setForm({ ...form, referring_doctor: e.target.value })} />
                </Field>
              </div>
            ) : (
              <Field label="Patient" className="max-w-md">
                <PatientSelect className="input" value={patientId} onChange={setPatientId} />
              </Field>
            )}
          </div>

          <div className="max-w-md space-y-3">
            <Field label="Clinic / Department">
              <select
                className="input"
                value={doctorSpecialty}
                onChange={(e) => setDoctorSpecialty(e.target.value)}
              >
                {doctorSpecialtyOptions.map((sp) => (
                  <option key={sp} value={sp}>{sp}</option>
                ))}
              </select>
            </Field>
            <Field label="Attending Doctor">
              <select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">Select doctor...</option>
                {doctorsForSpecialty.map((d) => (
                  <option key={d.id} value={d.id}>{doctorOptionLabel(d)}</option>
                ))}
              </select>
              {doctorsForSpecialty.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">ဤ department အတွက် ဆရာဝန် မရှိသေး — Cashier → Doctors မှာ specialty ထည့်ပါ။</p>
              )}
            </Field>
          </div>

          {patientType === 'ipd' && (
            <div className="border-t border-slate-200 pt-4">
              <h3 className="font-semibold text-[var(--brand-600)] mb-3">IPD Admission</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Ward">
                  <select className="input" value={wardId} onChange={(e) => setWardId(e.target.value)}>
                    <option value="">Select ward...</option>
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({w.category})</option>
                    ))}
                  </select>
                </Field>
                <Field label="Bed">
                  <select className="input" value={bedId} onChange={(e) => setBedId(e.target.value)} disabled={!wardId}>
                    <option value="">Select bed...</option>
                    {beds.map((b) => (
                      <option key={b.id} value={b.id}>{b.code}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Billing rate">
                  <select className="input" value={billingMode} onChange={(e) => setBillingMode(e.target.value)}>
                    <option value="daily">Daily rate</option>
                    <option value="hourly">Hourly rate</option>
                    <option value="package">Package rate</option>
                  </select>
                </Field>
                <Field label="Deposit (optional)">
                  <input className="input" type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          <button type="button" disabled={busy} className="btn btn-primary w-full sm:w-auto sm:px-10 text-base" onClick={register}>
            {patientType === 'ipd' ? 'Admit IPD & Start Bill' : 'Register OPD & Start Bill'}
          </button>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-3">Last Registration</h3>
          {!result ? (
            <p className="text-slate-500 text-sm">OPD/IPD register လုပ်ပြီးရင် ID, bill number ပြမယ်။</p>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-[var(--brand-600)]">{result.patient?.name}</span>
                <StatusBadge value={result.patient_type === 'ipd' ? 'IPD' : 'OPD'} />
              </div>
              <div>ID: <strong>{result.patient?.uhid}</strong></div>
              <div>Bill: <strong>{result.invoice_number}</strong></div>
              <div>Doctor: {result.doctor_name}{result.doctor_specialty ? ` (${result.doctor_specialty})` : ''}</div>
              {result.patient_type === 'ipd' && (
                <>
                  <div>Ward: {result.ward_name}</div>
                  <div>Bed: <strong>{result.bed_code}</strong></div>
                </>
              )}
              <p className="text-slate-500 pt-2">Pharmacy / X-ray / Cashier မှာ ID နဲ့ ဆက်ရှာပါ။</p>
              <div className="pt-2 no-print">
                <RegistrationLabel name={result.patient?.name || ''} uhid={result.patient?.uhid || ''} />
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {tab === 'appointments' && (
        <div className="grid lg:grid-cols-[1fr_2fr] gap-4 items-start">
          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-800">Book Appointment</h3>
            <Field label="Patient">
              <PatientSelect className="input" value={apPatientId} onChange={setApPatientId} />
            </Field>
            <Field label="Clinic / Department">
              <select className="input" value={apDoctorSpecialty} onChange={(e) => { setApDoctorSpecialty(e.target.value); setApDoctorId('') }}>
                {apDoctorSpecialtyOptions.map((sp) => (
                  <option key={sp} value={sp}>{sp}</option>
                ))}
              </select>
            </Field>
            <Field label="Doctor">
              <select className="input" value={apDoctorId} onChange={(e) => setApDoctorId(e.target.value)}>
                <option value="">Select doctor...</option>
                {apDoctorsForSpecialty.map((d) => (
                  <option key={d.id} value={d.id}>{doctorOptionLabel(d)}</option>
                ))}
              </select>
            </Field>
            <Field label="Date & Time">
              <input className="input" type="datetime-local" value={apScheduledAt} onChange={(e) => setApScheduledAt(e.target.value)} />
            </Field>
            <Field label="Duration (minutes)">
              <input className="input" type="number" min={5} step={5} value={apDuration} onChange={(e) => setApDuration(e.target.value)} />
            </Field>
            <Field label="Notes (optional)">
              <input className="input" value={apNotes} onChange={(e) => setApNotes(e.target.value)} />
            </Field>
            <button type="button" disabled={apBusy} className="btn btn-primary w-full" onClick={bookAppointment}>Book Appointment</button>
          </div>

          <div className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-800">Appointments</h3>
              <div className="flex gap-2">
                <select className="input w-44" value={apDoctorFilter} onChange={(e) => setApDoctorFilter(e.target.value)}>
                  <option value="">All doctors</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name}</option>
                  ))}
                </select>
                <select className="input w-36" value={apStatusFilter} onChange={(e) => setApStatusFilter(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="booked">Booked</option>
                  <option value="arrived">Arrived</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <DataTable
              rows={appointments}
              columns={[
                { key: 'time', label: 'Time', render: (r) => formatDate(String(r.scheduled_at)) },
                { key: 'patient', label: 'Patient', render: (r) => `${patientName(r.patient_id)} (${patientUhid(r.patient_id)})` },
                { key: 'doctor', label: 'Doctor', render: (r) => doctors.find((d) => d.id === r.doctor_id)?.full_name || `#${r.doctor_id}` },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
                { key: 'notes', label: 'Notes', render: (r) => <span className="text-slate-600">{r.notes || '—'}</span> },
                { key: 'act', label: '', render: (r) => (
                  <div className="flex gap-1">
                    {r.status === 'booked' && (
                      <button type="button" disabled={apBusy} className="btn btn-secondary btn-sm" onClick={() => updateAppointmentStatus(r.id, 'arrived')}>Arrived</button>
                    )}
                    {r.status === 'arrived' && (
                      <button type="button" disabled={apBusy} className="btn btn-primary btn-sm" onClick={() => registerFromAppointment(r)}>Register OPD</button>
                    )}
                    {(r.status === 'booked' || r.status === 'arrived') && (
                      <button type="button" disabled={apBusy} className="text-xs text-red-600 hover:underline" onClick={() => updateAppointmentStatus(r.id, 'cancelled')}>Cancel</button>
                    )}
                  </div>
                ) },
              ]}
              emptyText="No appointments found"
            />
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {queueByDoctor.length === 0 && (
              <div className="card text-sm text-slate-500">No one waiting right now</div>
            )}
            {queueByDoctor.map((b) => (
              <div key={b.doctor_name} className="card space-y-1">
                <div className="font-semibold text-slate-800 truncate">{b.doctor_name}</div>
                <div className="text-sm text-slate-600">{b.waiting} waiting · {b.serving} in room</div>
                {b.waiting > 0 && (
                  <div className="text-xs text-slate-500">Avg wait {formatWait(b.avg_wait_seconds)}</div>
                )}
              </div>
            ))}
          </div>

          <div className="card">
            <h3 className="font-semibold text-slate-800 mb-3">Waiting Room</h3>
            <DataTable
              rows={queueTokens}
              keyField="token_id"
              columns={[
                { key: 'number', label: 'Token', render: (r) => String(r.number) },
                { key: 'patient', label: 'Patient', render: (r) => `${r.patient_name} (${r.uhid})` },
                { key: 'doctor', label: 'Doctor', render: (r) => String(r.doctor_name) },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
                { key: 'waited', label: 'Waited', render: (r) => formatWait(r.waited_seconds) },
                { key: 'act', label: '', render: (r) => (
                  <div className="flex gap-1">
                    {r.status === 'waiting' && (
                      <button type="button" disabled={queueBusy} className="btn btn-secondary btn-sm" onClick={() => callToken(r.token_id)}>Call</button>
                    )}
                    {r.status === 'serving' && (
                      <button type="button" disabled={queueBusy} className="btn btn-primary btn-sm" onClick={() => finishToken(r.token_id)}>Done</button>
                    )}
                    {r.status === 'waiting' && (
                      <button type="button" disabled={queueBusy} className="text-xs text-red-600 hover:underline" onClick={() => skipToken(r.token_id)}>Skip</button>
                    )}
                  </div>
                ) },
              ]}
              emptyText="No one waiting right now"
            />
          </div>
        </div>
      )}

      {tab === 'discharge' && (
        <div className="max-w-lg card space-y-4">
          <Alert tone="info">
            ဆေးရုံဆင်းပြီး bed လွှတ်မယ် — IPD bill က Cashier မှာ ရှင်းပါ။ OPD follow-up အတွက် <strong>Convert</strong> tab သုံးပါ (ဒီ tab မဟုတ်)။
          </Alert>
          <h3 className="font-semibold text-slate-800">Admitted IPD patients (open bill)</h3>
          <div className="flex flex-wrap gap-2">
            {ipdActive.length === 0 && <p className="text-sm text-slate-500">No admitted IPD patients with open bills</p>}
            {ipdActive.map((p) => (
              <button
                key={p.invoice_id}
                type="button"
                onClick={() => setDischargePick(p)}
                className={`rounded-full border px-3 py-1.5 text-sm ${dischargePick?.invoice_id === p.invoice_id ? 'border-[var(--brand-600)] bg-[var(--brand-50)]' : 'border-slate-300 hover:border-[var(--brand-600)]'}`}
              >
                {p.name} · {p.uhid} · {formatMoney(p.balance)} due
              </button>
            ))}
          </div>
          {dischargePick && (
            <>
              <div className="text-sm text-slate-600">
                Bill <strong>{dischargePick.invoice_number}</strong>
                <StatusBadge value={String(dischargePick.invoice_status || 'open').toUpperCase()} />
              </div>
              <textarea
                className="input min-h-24"
                placeholder="Discharge summary (optional)"
                value={dischargeSummary}
                onChange={(e) => setDischargeSummary(e.target.value)}
              />
              <button type="button" disabled={dischargeBusy} className="btn btn-primary w-full" onClick={dischargeIpd}>
                Discharge & release bed
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'ipd-deposit' && (
        <div className="max-w-lg card space-y-4">
          <Alert tone="info">
            တက်နေစဉ် အကြိုငွေ ထပ်သွင်းပါ — Cashier မှာလည်း လုပ်နိုင်ပါတယ်။
          </Alert>
          <h3 className="font-semibold text-slate-800">Admitted IPD patients</h3>
          <div className="flex flex-wrap gap-2">
            {ipdActive.length === 0 && <p className="text-sm text-slate-500">No admitted IPD patients with open bills</p>}
            {ipdActive.map((p) => (
              <button
                key={p.invoice_id}
                type="button"
                onClick={() => setDepositPick(p)}
                className={`rounded-full border px-3 py-1.5 text-sm ${depositPick?.invoice_id === p.invoice_id ? 'border-[var(--brand-600)] bg-[var(--brand-50)]' : 'border-slate-300 hover:border-[var(--brand-600)]'}`}
              >
                {p.name} · {p.uhid}
                {p.balance > 0.01 ? ` · ${formatMoney(p.balance)} due` : ' · advance OK'}
              </button>
            ))}
          </div>
          {depositPick && (
            <>
              <div className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
                Bill <strong>{depositPick.invoice_number}</strong>
                <StatusBadge value={String(depositPick.invoice_status || 'open').toUpperCase()} />
                <span>Paid: {formatMoney(Number(depositPick.total || 0) - Number(depositPick.balance || 0))}</span>
                <span>Due: {formatMoney(Number(depositPick.balance || 0))}</span>
              </div>
              <select className="input" value={extraDepositMethod} onChange={(e) => setExtraDepositMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="kpay">KPay</option>
                <option value="wave">Wave</option>
                <option value="deposit">Deposit (ledger)</option>
              </select>
              <input
                className="input"
                type="number"
                placeholder="Deposit amount (MMK)"
                value={extraDepositAmount}
                onChange={(e) => setExtraDepositAmount(e.target.value)}
              />
              <button type="button" disabled={extraDepositBusy} className="btn btn-primary w-full" onClick={submitExtraDeposit}>
                Record deposit
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'convert' && (
        <div className="max-w-lg card space-y-4">
          <p className="text-sm text-slate-600">
            Visit type ပြောင်းခြင်း — OPD ကတွေ့ပြီး ဆေးရုံတက်ရင် <strong>→ IPD</strong>။
            ဆေးရုံမဆင်းသေးပဲ OPD bill အသစ် လိုရင် <strong>→ OPD (new visit)</strong> — IPD discharge မဟုတ်ပါ (အဲဒါက IPD Discharge tab)။
          </p>
          <PatientSelect className="input" value={convertPatientId} onChange={setConvertPatientId} />
          <ToggleGroup
            options={[{ value: 'ipd', label: '→ IPD (Admit)' }, { value: 'opd', label: '→ OPD (ends IPD stay + new OPD bill)' }]}
            value={convertTarget}
            onChange={(v) => setConvertTarget(v as typeof convertTarget)}
          />
          {convertTarget === 'ipd' && (
            <>
              <select className="input" value={convertWardId} onChange={(e) => setConvertWardId(e.target.value)}>
                <option value="">Select ward...</option>
                {wards.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.category})</option>)}
              </select>
              <select className="input" value={convertBedId} onChange={(e) => setConvertBedId(e.target.value)} disabled={!convertWardId}>
                <option value="">Select bed...</option>
                {convertBeds.map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
              </select>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Billing rate">
                  <select className="input" value={convertBillingMode} onChange={(e) => setConvertBillingMode(e.target.value)}>
                    <option value="daily">Daily rate</option>
                    <option value="hourly">Hourly rate</option>
                    <option value="package">Package rate</option>
                  </select>
                </Field>
                <Field label="Deposit (optional)">
                  <input className="input" type="number" value={convertDeposit} onChange={(e) => setConvertDeposit(e.target.value)} />
                </Field>
              </div>
            </>
          )}
          <button type="button" disabled={convertBusy} className="btn btn-primary w-full" onClick={convertPatientType}>
            Convert
          </button>
        </div>
      )}

      {tab === 'history' && (
        <div className="card space-y-3">
          <input
            className="input"
            placeholder="Search name / ID / bill # / phone"
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
          />
          <p className="text-xs text-slate-500">Row တစ်ခုကို နှိပ်ပြီး ဒီလူနာရဲ့ visit history အကုန်ကြည့်နိုင်ပါတယ်</p>
          <DataTable
            rows={filteredHistory}
            onRowClick={openPatientHistory}
            columns={[
              { key: 'number', label: 'Bill', render: (r) => String(r.number) },
              { key: 'kind', label: 'Type', render: (r) => <StatusBadge value={String(r.invoice_kind || 'opd').toUpperCase()} /> },
              { key: 'patient', label: 'Patient', render: (r) => String(r.patient_name) },
              { key: 'uhid', label: 'ID', render: (r) => String(r.uhid) },
              { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
              { key: 'date', label: 'Date', render: (r) => formatDate(String(r.created_at)) },
            ]}
            emptyText={historyQuery.trim() ? `No match for "${historyQuery}"` : 'No records in last 7 days'}
          />
        </div>
      )}

      {patientHistory && (
        <Modal title={`Patient History — ${patientHistory.name} (${patientHistory.uhid})`} onClose={() => setPatientHistory(null)} maxWidth="max-w-2xl">
          {patientHistoryBusy ? (
            <div className="text-center text-slate-500 py-6">Loading...</div>
          ) : (
            <div className="space-y-4">
              {patientHistory.detail && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm border-b border-slate-200 pb-3">
                  <div><span className="text-slate-500">Father name:</span> <strong>{patientHistory.detail.father_name || '—'}</strong></div>
                  <div><span className="text-slate-500">Age:</span> <strong>{formatAge(patientHistory.detail.age_years, patientHistory.detail.age_months, patientHistory.detail.age_days)}</strong></div>
                  <div><span className="text-slate-500">Gender:</span> <strong>{patientHistory.detail.gender || '—'}</strong></div>
                  <div><span className="text-slate-500">Phone:</span> <strong>{patientHistory.detail.phone || '—'}</strong></div>
                  <div><span className="text-slate-500">NRC:</span> <strong>{patientHistory.detail.nrc || '—'}</strong></div>
                  <div><span className="text-slate-500">Blood Group:</span> <strong>{patientHistory.detail.blood_group || '—'}</strong></div>
                  <div><span className="text-slate-500">Referring Doctor:</span> <strong>{patientHistory.detail.referring_doctor || '—'}</strong></div>
                  <div className="col-span-2 sm:col-span-3"><span className="text-slate-500">Address:</span> <strong>{patientHistory.detail.address || '—'}</strong></div>
                  {patientHistory.detail.allergies && (
                    <div className="col-span-2 sm:col-span-3"><span className="text-slate-500">Allergies:</span> <strong className="text-[var(--status-danger-fg)]">{patientHistory.detail.allergies}</strong></div>
                  )}
                </div>
              )}
              <DataTable
                rows={patientHistory.rows}
                columns={[
                  { key: 'number', label: 'Bill', render: (r) => String(r.number) },
                  { key: 'kind', label: 'Type', render: (r) => <StatusBadge value={String(r.invoice_kind || 'opd').toUpperCase()} /> },
                  { key: 'status', label: 'Status', render: (r) => <StatusBadge value={String(r.status)} /> },
                  { key: 'date', label: 'Date', render: (r) => formatDate(String(r.created_at)) },
                ]}
                emptyText="No visit history found"
              />
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
