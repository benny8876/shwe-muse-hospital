import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import Tabs from '../../components/Tabs'
import PatientSelect from '../../components/PatientSelect'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import ToggleGroup from '../../components/ToggleGroup'
import RegistrationLabel from '../../components/RegistrationLabel'
import Modal from '../../components/Modal'
import { formatDate } from '../../lib/format'

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
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [wards, setWards] = useState<Ward[]>([])
  const [beds, setBeds] = useState<Bed[]>([])
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [patientType, setPatientType] = useState<'opd' | 'ipd'>('opd')
  const [doctorId, setDoctorId] = useState('')
  const [patientId, setPatientId] = useState('')
  const [wardId, setWardId] = useState('')
  const [bedId, setBedId] = useState('')
  const [billingMode, setBillingMode] = useState('daily')
  const [deposit, setDeposit] = useState('')
  const [form, setForm] = useState({ name: '', father_name: '', phone: '', gender: 'F', age_years: '', address: '', referring_doctor: '' })
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
  }, [tab, branchId, toast])

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
        age_years: form.age_years ? Number(form.age_years) : null,
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
      if (mode === 'new') setForm({ name: '', father_name: '', phone: '', gender: 'F', age_years: '', address: '', referring_doctor: '' })
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
                  <input className="input" type="number" value={form.age_years} onChange={(e) => setForm({ ...form, age_years: e.target.value })} />
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

          <Field label="Attending Doctor" className="max-w-md">
            <select className="input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Select doctor...</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </Field>

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
              <div>Doctor: {result.doctor_name}</div>
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

      {tab === 'convert' && (
        <div className="max-w-lg card space-y-4">
          <p className="text-sm text-slate-600">စစ်ဆေးပြီးတဲ့ လူနာကို OPD ⇄ IPD ပြောင်းလို့ရပါတယ် (ဥပမာ — OPD ကတွေ့ပြီး ဆေးရုံတက်ဖို့လိုလာရင်)။</p>
          <PatientSelect className="input" value={convertPatientId} onChange={setConvertPatientId} />
          <ToggleGroup
            options={[{ value: 'ipd', label: '→ IPD (Admit)' }, { value: 'opd', label: '→ OPD (Discharge)' }]}
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
                  <div><span className="text-slate-500">Age:</span> <strong>{patientHistory.detail.age_years ?? '—'}</strong></div>
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
