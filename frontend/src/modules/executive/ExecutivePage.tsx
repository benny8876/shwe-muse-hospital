import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useAuth } from '../../lib/auth'
import PageHeader from '../../components/PageHeader'
import { formatMoney } from '../../lib/format'

export default function ExecutivePage() {
  const { session } = useAuth()
  const [kpi, setKpi] = useState<any>(null)

  useEffect(() => {
    api.get('/analytics/kpi', { params: { branch_id: session?.branch_id || 1 } }).then((r) => setKpi(r.data))
  }, [session?.branch_id])

  if (!kpi) return <div className="card">Loading KPI...</div>

  const cards = [
    { label: 'Revenue (30 days)', value: formatMoney(kpi.revenue_30d) },
    { label: 'Forecast (7 days)', value: formatMoney(kpi.forecast_7d) },
    { label: 'Bed Occupancy', value: `${kpi.beds?.rate_pct ?? 0}%` },
    { label: 'Visits Today', value: String(kpi.visits_today ?? 0) },
    { label: 'Lab Orders Today', value: String(kpi.lab_today ?? 0) },
    { label: 'IPD Admissions', value: String(kpi.ipd_active ?? 0) },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Executive Dashboard" subtitle="Revenue, occupancy and department performance" />
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div className="text-xs text-slate-500 uppercase tracking-wide">{c.label}</div>
            <div className="text-xl font-bold text-[#005293] mt-1">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold mb-3">Doctor Performance</h2>
          {(kpi.doctor_performance || []).map((d: any) => (
            <div key={d.doctor} className="flex justify-between border-b py-2 text-sm">
              <span>{d.doctor}</span>
              <span className="font-medium">{formatMoney(d.commission)}</span>
            </div>
          ))}
          {!kpi.doctor_performance?.length && <div className="text-slate-500 text-sm">No data yet</div>}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Department P&L</h2>
          {(kpi.department_pl || []).map((d: any) => (
            <div key={d.department} className="flex justify-between border-b py-2 text-sm">
              <span>{d.department}</span>
              <span className="font-medium">{formatMoney(d.revenue)}</span>
            </div>
          ))}
          {!kpi.department_pl?.length && <div className="text-slate-500 text-sm">No data yet</div>}
        </div>
      </div>
    </div>
  )
}
