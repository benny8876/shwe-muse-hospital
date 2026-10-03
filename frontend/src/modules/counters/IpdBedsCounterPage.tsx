import { useCallback, useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import Modal from '../../components/Modal'
import LabReportView from '../../components/LabReportView'
import RadiologyReportView from '../../components/RadiologyReportView'
import StatusBadge from '../../components/StatusBadge'
import Alert from '../../components/Alert'
import { formatDate, formatMoney } from '../../lib/format'

type BedLine = { id: number; description: string; source: string; category: string | null; qty: number; unit_price: number; amount: number }
type LabOrderSummary = { order_id: number; tests: string; status: string }
type RadiologyOrderSummary = { order_id: number; modality: string; status: string }

type BedAdmission = {
  admission_id: number
  patient_id: number
  patient_name: string
  uhid: string
  admitted_at: string
  diagnosis: string
  billing_mode: string
  invoice_id: number | null
  invoice_number: string | null
  invoice_status: string | null
  total: number
  subtotal: number
  balance: number
  deposit_paid: number
  lines: BedLine[]
  lab_orders: LabOrderSummary[]
  radiology_orders: RadiologyOrderSummary[]
}

type DashBed = {
  id: number
  code: string
  status: string
  daily_rate: number
  hourly_rate: number
  package_rate: number
  admission: BedAdmission | null
}

type DashWard = { ward: { id: number; name: string; category: string; floor: string }; beds: DashBed[] }

// "medicine" / "test" / "room & other" buckets for the per-bed itemized
// breakdown — same source/category values billing already uses, just
// grouped for a quick "what's been given / ordered" read at a glance.
function lineGroup(line: BedLine): 'medicine' | 'test' | 'other' {
  if (line.source === 'pharmacy' || line.category === 'drug') return 'medicine'
  if (['lab', 'xray', 'usg'].includes(line.source) || ['lab', 'radiology'].includes(line.category || '')) return 'test'
  return 'other'
}

export default function IpdBedsCounterPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const [wards, setWards] = useState<DashWard[]>([])
  const [wardsLoading, setWardsLoading] = useState(false)
  const [detailBed, setDetailBed] = useState<DashBed | null>(null)
  const [viewingLabOrderId, setViewingLabOrderId] = useState<number | null>(null)
  const [viewingRadiologyOrderId, setViewingRadiologyOrderId] = useState<number | null>(null)
  const [dischargeSummary, setDischargeSummary] = useState('')
  const [ipdActionBusy, setIpdActionBusy] = useState(false)

  const loadDashboard = useCallback(async () => {
    setWardsLoading(true)
    try {
      const { data } = await api.get('/ipd/dashboard', { params: { branch_id: branchId } })
      setWards(data)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setWardsLoading(false)
    }
  }, [branchId, toast])

  useEffect(() => {
    void loadDashboard()
    const id = setInterval(() => void loadDashboard(), 15000)
    return () => clearInterval(id)
  }, [loadDashboard])

  useEffect(() => {
    setDischargeSummary('')
  }, [detailBed?.id])

  async function dischargePatient(admissionId: number) {
    setIpdActionBusy(true)
    try {
      const { data } = await api.post(`/ipd/admissions/${admissionId}/discharge`, { summary: dischargeSummary })
      const inv = data.invoice
      toast.success(
        inv
          ? `Discharged — bill ${inv.number} (${String(inv.status).toUpperCase()}), balance ${formatMoney(inv.balance)}`
          : 'Patient discharged',
      )
      setDetailBed(null)
      setDischargeSummary('')
      void loadDashboard()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setIpdActionBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {wardsLoading && wards.length === 0 && <div className="card text-slate-500">Loading...</div>}
      {!wardsLoading && wards.length === 0 && <div className="card text-slate-500">No wards configured</div>}
      {wards.map((w) => {
        const availableCount = w.beds.filter((b) => b.status === 'available').length
        const occupiedCount = w.beds.filter((b) => b.status === 'occupied').length
        const maintenanceCount = w.beds.filter((b) => b.status === 'maintenance').length
        return (
          <div key={w.ward.id} className="card space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-800">{w.ward.name}</h3>
              <span className="text-xs text-slate-500">{w.ward.category} · Floor {w.ward.floor || '—'}</span>
              <div className="flex items-center gap-3 text-xs text-slate-500 ml-auto">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Available {availableCount}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Occupied {occupiedCount}</span>
                {maintenanceCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" />Maintenance {maintenanceCount}</span>}
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
              {w.beds.map((bed) => (
                <button
                  key={bed.id}
                  type="button"
                  disabled={!bed.admission}
                  onClick={() => bed.admission && setDetailBed(bed)}
                  className={`rounded-lg border p-2 text-left space-y-0.5 ${
                    bed.status === 'available'
                      ? 'border-green-200 bg-green-50'
                      : bed.status === 'occupied'
                        ? 'border-red-200 bg-red-50 cursor-pointer hover:bg-red-100'
                        : 'border-slate-200 bg-slate-100'
                  }`}
                >
                  <div className="font-semibold text-sm text-slate-800 truncate">{bed.code}</div>
                  {bed.admission ? (
                    <>
                      <div className="text-xs truncate">{bed.admission.patient_name}</div>
                      {bed.admission.balance > 0 && <div className="text-xs font-semibold text-red-600">{formatMoney(bed.admission.balance)} due</div>}
                    </>
                  ) : (
                    <div className="text-xs text-slate-500">{bed.status === 'available' ? 'Available' : 'Maintenance'}</div>
                  )}
                </button>
              ))}
              {w.beds.length === 0 && <div className="text-slate-400 text-sm col-span-full">No beds in this ward</div>}
            </div>
          </div>
        )
      })}

      {detailBed?.admission && (
        <Modal title={`Bed ${detailBed.code} — ${detailBed.admission.patient_name}`} onClose={() => setDetailBed(null)} maxWidth="max-w-lg">
          <div className="space-y-3 text-sm">
            <div className="text-xs text-slate-500 -mt-1">{detailBed.admission.uhid} · Admitted {formatDate(detailBed.admission.admitted_at)}</div>
            <div className="flex flex-wrap items-center gap-2">
              {detailBed.admission.invoice_number && (
                <span className="text-xs text-slate-600">Bill <strong>{detailBed.admission.invoice_number}</strong></span>
              )}
              {detailBed.admission.invoice_status && (
                <StatusBadge value={String(detailBed.admission.invoice_status).toUpperCase()} />
              )}
              <span className="text-xs text-slate-500">Billing: {detailBed.admission.billing_mode}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-slate-50 p-2">
                <div className="text-slate-500 text-xs">Total Cost</div>
                <div className="font-semibold">{formatMoney(detailBed.admission.total)}</div>
              </div>
              <div className="rounded bg-slate-50 p-2">
                <div className="text-slate-500 text-xs">Deposit Paid</div>
                <div className="font-semibold">{formatMoney(detailBed.admission.deposit_paid)}</div>
              </div>
              <div className="rounded bg-slate-50 p-2">
                <div className="text-slate-500 text-xs">Balance</div>
                <div className="font-semibold">{formatMoney(detailBed.admission.balance)}</div>
              </div>
            </div>

            {(() => {
              // FIFO queues so a test ordered more than once (e.g. two lab
              // panels with the same name) each open their own order/report,
              // not always the first one — same pattern as Patient History.
              const labQueue: Record<string, number[]> = {}
              for (const o of detailBed.admission!.lab_orders) (labQueue[o.tests] ||= []).push(o.order_id)
              const radiologyQueue: Record<string, number[]> = {}
              for (const o of detailBed.admission!.radiology_orders) (radiologyQueue[o.modality] ||= []).push(o.order_id)

              return (['medicine', 'test', 'other'] as const).map((group) => {
                const groupLines = detailBed.admission!.lines.filter((l) => lineGroup(l) === group)
                if (groupLines.length === 0) return null
                const label = group === 'medicine' ? 'Medicines Dispensed' : group === 'test' ? 'Tests / Exams Ordered' : 'Room & Other Charges'
                return (
                  <div key={group}>
                    <div className="font-medium text-slate-700 mb-1">{label}</div>
                    <div className="space-y-1">
                      {groupLines.map((l) => {
                        const labOrderId = group === 'test' && l.source === 'lab' ? labQueue[l.description]?.shift() : undefined
                        const radiologyOrderId = group === 'test' && (l.source === 'xray' || l.source === 'usg') ? radiologyQueue[l.source]?.shift() : undefined
                        const qtyLabel = l.qty > 1 ? ` × ${l.qty}` : ''
                        return (
                          <div key={l.id} className="flex justify-between border-b border-slate-100 pb-1">
                            {labOrderId ? (
                              <button type="button" className="text-left text-[var(--brand-600)] hover:underline cursor-pointer" onClick={() => setViewingLabOrderId(labOrderId)}>
                                {l.description}{qtyLabel}
                              </button>
                            ) : radiologyOrderId ? (
                              <button type="button" className="text-left text-[var(--brand-600)] hover:underline cursor-pointer" onClick={() => setViewingRadiologyOrderId(radiologyOrderId)}>
                                {l.description}{qtyLabel}
                              </button>
                            ) : (
                              <span>{l.description}{qtyLabel}</span>
                            )}
                            <span className="font-medium">{formatMoney(l.amount)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            })()}
            {detailBed.admission.lines.length === 0 && <div className="text-slate-400">No charges yet</div>}

            <Alert tone="info">
              <strong>Orders:</strong> ဆေး → <strong>Nurse</strong> counter · Lab / X-ray / USG → သက်ဆိုင်ရာ counter (open IPD bill)။
              <br />
              <strong>Discharge:</strong> ဆေးရုံဆင်းပြီး bed လွှတ်မယ် — ကျန်ငွေ <strong>Cashier</strong>။ OPD follow-up → Reception <strong>Convert</strong> (discharge မဟုတ်)။
            </Alert>
            <textarea
              className="input min-h-20"
              placeholder="Discharge summary (optional)"
              value={dischargeSummary}
              onChange={(e) => setDischargeSummary(e.target.value)}
            />
            <button
              type="button"
              disabled={ipdActionBusy}
              className="btn btn-primary w-full"
              onClick={() => dischargePatient(detailBed.admission!.admission_id)}
            >
              Discharge patient & release bed
            </button>
          </div>
        </Modal>
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
