import { useEffect, useState } from 'react'
import api, { getApiError } from '../lib/api'
import { useToast } from '../lib/toast'
import { formatAge } from '../lib/format'
import { parseRadiologyFindings } from '../lib/radiologyReport'
import ResultSlip from './ResultSlip'

type RadiologyOrderDetail = {
  order_id: number
  patient_name: string
  uhid: string
  age_years: number | null
  age_months?: number | null
  age_days?: number | null
  gender: string
  modality: string
  findings: string
  status: string
  created_at: string | null
}

// Fetches and renders a single X-ray/USG order's full report — mirrors
// LabReportView.tsx so both can be opened the same way (a click on a
// "Tests / Exams Ordered" line) from Patient History / Ward Dashboard.
export default function RadiologyReportView({ orderId }: { orderId: string | number }) {
  const toast = useToast()
  const [order, setOrder] = useState<RadiologyOrderDetail | null>(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    setBusy(true)
    api.get(`/counter/radiology/${orderId}`)
      .then((r) => setOrder(r.data))
      .catch((e) => toast.error(getApiError(e)))
      .finally(() => setBusy(false))
  }, [orderId, toast])

  if (busy) return <div className="p-8 text-center text-slate-500">Loading...</div>
  if (!order) return <div className="p-8 text-center text-slate-500">Radiology order not found</div>

  const parsed = parseRadiologyFindings(order.findings)
  const title = order.modality === 'usg' ? 'Ultrasound' : 'X-Ray'

  return (
    <ResultSlip
      title={title}
      patientName={order.patient_name}
      uhid={order.uhid}
      age={formatAge(order.age_years, order.age_months, order.age_days)}
      gender={order.gender}
      date={order.created_at}
      bodyLabel="Findings"
      bodyText={parsed.body}
      bodyIsHtml
      examType={parsed.examType}
      impression={parsed.impression}
      reporterName={parsed.reporterName}
      readOnly
    />
  )
}
