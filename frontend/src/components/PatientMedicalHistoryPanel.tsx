import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { getApiError } from '../lib/api'
import { useToast } from '../lib/toast'
import { formatDate } from '../lib/format'
import PatientSelect from './PatientSelect'
import StatusBadge from './StatusBadge'
import Modal from './Modal'
import LabReportView from './LabReportView'
import RadiologyReportView from './RadiologyReportView'

type TreatmentGroup = {
  category: string
  label: string
  items: { description: string; qty: number; source?: string }[]
}

type LabOrderSummary = { order_id: number; tests: string; status: string }
type RadiologyOrderSummary = { order_id: number; modality: string; status: string }

type VisitRecord = {
  invoice_id: number
  bill_number: string
  visit_date: string | null
  type: string
  status: string
  doctor_name: string
  treatments: TreatmentGroup[]
  radiology_findings: string
  lab_result: string
  lab_tests: string
  lab_orders?: LabOrderSummary[]
  radiology_orders?: RadiologyOrderSummary[]
}

type ClinicalNote = {
  date: string | null
  doctor_name: string
  chief_complaint: string
  diagnosis: string
  notes: string
}

type MedicalHistory = {
  patient: {
    name: string
    uhid: string
    father_name?: string
    phone?: string
    gender?: string
    age_years?: number | null
    address?: string
    allergies?: string
  }
  visits: VisitRecord[]
  clinical_notes: ClinicalNote[]
}

export default function PatientMedicalHistoryPanel({
  branchId,
  initialPatientId = '',
  showRegisterVisit = false,
}: {
  branchId: number
  initialPatientId?: string
  showRegisterVisit?: boolean
}) {
  const toast = useToast()
  const [patientId, setPatientId] = useState(initialPatientId)
  const [data, setData] = useState<MedicalHistory | null>(null)
  const [busy, setBusy] = useState(false)
  const [expandedVisit, setExpandedVisit] = useState<number | null>(null)
  const [viewingLabOrderId, setViewingLabOrderId] = useState<number | null>(null)
  const [viewingRadiologyOrderId, setViewingRadiologyOrderId] = useState<number | null>(null)

  useEffect(() => {
    if (initialPatientId) setPatientId(initialPatientId)
  }, [initialPatientId])

  useEffect(() => {
    if (!patientId) {
      setData(null)
      setExpandedVisit(null)
      return
    }
    setBusy(true)
    api.get('/counter/patient-medical-history', { params: { patient_id: patientId, branch_id: branchId } })
      .then((r) => {
        setData(r.data)
        setExpandedVisit(r.data.visits[0]?.invoice_id ?? null)
      })
      .catch((e) => toast.error(getApiError(e)))
      .finally(() => setBusy(false))
  }, [patientId, branchId, toast])

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold text-slate-800">Search Patient</h3>
        <p className="text-xs text-slate-500">ID၊ အမည်၊ အဖအမည်၊ ဖုန်းနံပါတ်နဲ့ ရှာပြီး လူနာရဲ့ medical history ကြည့်ပါ</p>
        <PatientSelect className="input" value={patientId} onChange={setPatientId} />
      </div>

      {!patientId && (
        <div className="card text-sm text-slate-500">လူနာတစ်ယောက် ရွေးပြီးရင် visit history ပြမယ်</div>
      )}

      {patientId && busy && (
        <div className="card text-center text-slate-500 py-8">Loading medical history...</div>
      )}

      {patientId && !busy && data && (
        <>
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold text-[var(--brand-600)]">{data.patient.name}</h3>
                <StatusBadge value={data.patient.uhid} />
              </div>
              {showRegisterVisit && (
                <Link
                  to={`/counter/reception?patient_id=${patientId}`}
                  className="btn btn-primary btn-sm"
                >
                  Register Visit →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
              <div><span className="text-slate-500">Father:</span> <strong>{data.patient.father_name || '—'}</strong></div>
              <div><span className="text-slate-500">Age:</span> <strong>{data.patient.age_years ?? '—'}</strong></div>
              <div><span className="text-slate-500">Gender:</span> <strong>{data.patient.gender || '—'}</strong></div>
              <div><span className="text-slate-500">Phone:</span> <strong>{data.patient.phone || '—'}</strong></div>
              {data.patient.allergies && (
                <div className="col-span-2 sm:col-span-4">
                  <span className="text-slate-500">Allergies:</span>{' '}
                  <strong className="text-[var(--status-danger-fg)]">{data.patient.allergies}</strong>
                </div>
              )}
            </div>
          </div>

          {data.clinical_notes.length > 0 && (
            <div className="card space-y-3">
              <h3 className="font-semibold text-slate-800">Clinical Notes</h3>
              {data.clinical_notes.map((note, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{formatDate(note.date)}</span>
                    {note.doctor_name && <span>· Dr. {note.doctor_name}</span>}
                  </div>
                  {note.chief_complaint && <div><span className="text-slate-500">Complaint:</span> {note.chief_complaint}</div>}
                  {note.diagnosis && <div><span className="text-slate-500">Diagnosis:</span> <strong>{note.diagnosis}</strong></div>}
                  {note.notes && <div><span className="text-slate-500">Notes:</span> {note.notes}</div>}
                </div>
              ))}
            </div>
          )}

          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-800">Visit History ({data.visits.length})</h3>
            {data.visits.length === 0 ? (
              <p className="text-sm text-slate-500">Visit မှတ်တမ်း မရှိသေးပါ</p>
            ) : (
              <div className="space-y-2">
                {data.visits.map((visit) => {
                  const open = expandedVisit === visit.invoice_id
                  return (
                    <div key={visit.invoice_id} className="border border-slate-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-[var(--brand-50)] flex flex-wrap items-center gap-2 justify-between"
                        onClick={() => setExpandedVisit(open ? null : visit.invoice_id)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{formatDate(visit.visit_date)}</span>
                          <StatusBadge value={visit.type.toUpperCase()} />
                          <span className="text-sm text-slate-600">Bill {visit.bill_number}</span>
                          {visit.doctor_name && <span className="text-sm text-slate-500">· Dr. {visit.doctor_name}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge value={visit.status} />
                          <span className="text-slate-400">{open ? '▲' : '▼'}</span>
                        </div>
                      </button>
                      {open && (
                        <div className="px-4 py-3 space-y-3 text-sm border-t border-slate-200">
                          {visit.treatments.length === 0 ? (
                            <p className="text-slate-500">ကုသမှု မှတ်တမ်း မရှိပါ</p>
                          ) : (
                            visit.treatments.map((group) => {
                              const labQueue: Record<string, number[]> = {}
                              for (const o of visit.lab_orders || []) (labQueue[o.tests] ||= []).push(o.order_id)
                              const radiologyQueue: Record<string, number[]> = {}
                              for (const o of visit.radiology_orders || []) (radiologyQueue[o.modality] ||= []).push(o.order_id)
                              return (
                              <div key={group.category}>
                                <div className="font-medium text-[var(--brand-600)] mb-1">{group.label}</div>
                                <ul className="space-y-1 pl-1">
                                  {group.items.map((item, i) => {
                                    const labOrderId = item.source === 'lab' ? labQueue[item.description]?.shift() : undefined
                                    const radiologyOrderId = item.source === 'xray' || item.source === 'usg' ? radiologyQueue[item.source]?.shift() : undefined
                                    return (
                                    <li key={i} className="flex justify-between gap-3 text-slate-700">
                                      {labOrderId ? (
                                        <button type="button" className="text-left text-[var(--brand-600)] hover:underline" onClick={() => setViewingLabOrderId(labOrderId)}>
                                          {item.description}
                                        </button>
                                      ) : radiologyOrderId ? (
                                        <button type="button" className="text-left text-[var(--brand-600)] hover:underline" onClick={() => setViewingRadiologyOrderId(radiologyOrderId)}>
                                          {item.description}
                                        </button>
                                      ) : (
                                        <span>{item.description}</span>
                                      )}
                                      <span className="text-slate-500 shrink-0">×{item.qty}</span>
                                    </li>
                                    )
                                  })}
                                </ul>
                              </div>
                              )
                            })
                          )}
                          {visit.radiology_findings && (
                            <div className="border-t border-slate-100 pt-2">
                              <div className="font-medium text-slate-700 mb-1">X-ray / Radiology Findings</div>
                              <p className="text-slate-600 whitespace-pre-wrap">{visit.radiology_findings}</p>
                            </div>
                          )}
                          {(visit.lab_tests || visit.lab_result) && (
                            <div className="border-t border-slate-100 pt-2">
                              <div className="font-medium text-slate-700 mb-1">Lab</div>
                              {visit.lab_tests && <p className="text-slate-600">Tests: {visit.lab_tests}</p>}
                              {visit.lab_result && <p className="text-slate-600 whitespace-pre-wrap mt-1">Result: {visit.lab_result}</p>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {viewingLabOrderId !== null && (
        <Modal title="Lab Report" onClose={() => setViewingLabOrderId(null)} maxWidth="max-w-4xl">
          <div className="max-h-[80vh] overflow-y-auto">
            <LabReportView orderId={viewingLabOrderId} />
          </div>
        </Modal>
      )}
      {viewingRadiologyOrderId !== null && (
        <Modal title="Radiology Report" onClose={() => setViewingRadiologyOrderId(null)} maxWidth="max-w-4xl">
          <div className="max-h-[80vh] overflow-y-auto">
            <RadiologyReportView orderId={viewingRadiologyOrderId} />
          </div>
        </Modal>
      )}
    </div>
  )
}
