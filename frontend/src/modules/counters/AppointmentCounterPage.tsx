import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import { usePatients } from '../../hooks/usePatients'
import Field from '../../components/Field'
import PatientSelect from '../../components/PatientSelect'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import { formatDate } from '../../lib/format'
import {
  doctorOptionLabel,
  doctorsInSpecialty,
  specialtyOptionsForDoctors,
} from '../../lib/doctorSpecialties'

type Doctor = { id: number; full_name: string; consultation_fee: number; specialty?: string }

// Split out of ReceptionCounterPage into its own counter/nav entry so it can
// be granted to any account independent of Reception — a developer/admin
// assigns the "Appointments" counter to whichever login needs it via the
// Staff Accounts access picker, instead of it being tied to the reception
// role by being buried inside that page's tabs.
export default function AppointmentCounterPage() {
  const branchId = useBranchId()
  const { name: patientName, uhid: patientUhid } = usePatients()
  const toast = useToast()
  const navigate = useNavigate()

  const [doctors, setDoctors] = useState<Doctor[]>([])
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

  useEffect(() => {
    api.get('/doctors').then((r) => setDoctors(r.data)).catch(() => {})
  }, [])

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

  useEffect(() => { void loadAppointments() }, [loadAppointments])

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

  // "Arrived" patient → jump to Reception's Register tab with them pre-selected
  // (Reception already reads ?patient_id= and pre-fills Register on load), so
  // the receptionist only has to confirm details and start the OPD bill.
  function registerFromAppointment(ap: any) {
    navigate(`/counter/reception?patient_id=${ap.patient_id}`)
  }

  return (
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
  )
}
