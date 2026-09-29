import { useEffect, useState } from 'react'
import api, { getApiError } from '../lib/api'
import { useToast } from '../lib/toast'
import { formatAge, formatDate } from '../lib/format'
import { findLabTemplate } from '../lib/labTemplates'
import LabTemplateResult, { type LabResultValues } from './LabTemplateResult'
import letterhead from '../assets/letterhead.png'

type LabOrderDetail = {
  order_id: number
  patient_name: string
  uhid: string
  age_years: number | null
  age_months?: number | null
  age_days?: number | null
  gender: string
  tests: string
  result: string
  status: string
  sample_id: string
  created_at: string | null
}

// Fetches and renders a single lab order's full report — shared by the
// standalone /lab-report/:orderId page and the in-app modal opened from
// Patient History (kept as one component so both stay in sync).
export default function LabReportView({ orderId }: { orderId: string | number }) {
  const toast = useToast()
  const [order, setOrder] = useState<LabOrderDetail | null>(null)
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    setBusy(true)
    api.get(`/counter/lab-order/${orderId}`)
      .then((r) => setOrder(r.data))
      .catch((e) => toast.error(getApiError(e)))
      .finally(() => setBusy(false))
  }, [orderId, toast])

  if (busy) return <div className="p-8 text-center text-slate-500">Loading...</div>
  if (!order) return <div className="p-8 text-center text-slate-500">Lab order not found</div>

  const template = findLabTemplate(order.tests)
  let values: LabResultValues = {}
  if (template && order.result) {
    try {
      values = JSON.parse(order.result)
    } catch {
      values = {}
    }
  }

  if (template) {
    return (
      <LabTemplateResult
        template={template}
        values={values}
        onChange={() => {}}
        readOnly
        patientName={order.patient_name}
        uhid={order.uhid}
        age={formatAge(order.age_years, order.age_months, order.age_days)}
        ageYears={order.age_years}
        ageMonths={order.age_months}
        gender={order.gender}
        date={order.created_at}
        sampleId={order.sample_id}
      />
    )
  }

  return (
    <>
      <div className="no-print flex justify-end mb-3">
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print</button>
      </div>
      <div className="p-8 border border-slate-200 rounded-lg">
        <img src={letterhead} alt="Shwe Muse Hospital" className="w-full mb-4" />
        <div className="text-center text-lg font-semibold mb-3">Laboratory Report</div>
        <div className="grid grid-cols-2 gap-1 text-sm border-t border-b py-2 mb-3">
          <div>Patient: <strong>{order.patient_name}</strong></div>
          <div>ID: <strong>{order.uhid}</strong></div>
          <div>Lab No: <strong>{order.sample_id || '—'}</strong></div>
          <div>Date: <strong>{formatDate(order.created_at)}</strong></div>
        </div>
        <div className="text-sm font-medium text-slate-600 mb-1">{order.tests}</div>
        <div className="whitespace-pre-wrap border rounded-lg p-3 min-h-24 text-sm">{order.result || '—'}</div>
      </div>
    </>
  )
}
