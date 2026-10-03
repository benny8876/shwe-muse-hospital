import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import Alert from './Alert'

const COUNTER_LOGINS: Record<string, { users: string[]; title: string; titleMm: string }> = {
  reception: { users: ['receptionist'], title: 'Reception counter', titleMm: 'Reception ကောင်တာ' },
  appointments: { users: ['receptionist'], title: 'Appointments', titleMm: 'Appointment ချိန်းဆို' },
  'patient-records': { users: ['receptionist', 'pharmacy', 'nurse'], title: 'Patient Records', titleMm: 'လူနာ မှတ်တမ်း' },
  pharmacy: { users: ['pharmacy'], title: 'Pharmacy counter', titleMm: 'ဆေးခန်း ကောင်တာ' },
  lab: { users: ['lab'], title: 'Lab counter', titleMm: 'ဓာတ်ခွဲခန်း ကောင်တာ' },
  xray: { users: ['xray'], title: 'X-Ray counter', titleMm: 'X-Ray ကောင်တာ' },
  usg: { users: ['usg'], title: 'USG counter', titleMm: 'USG ကောင်တာ' },
  nurse: { users: ['nurse'], title: 'Nurse station', titleMm: 'သူနာပြု စခန်း' },
  ipd: { users: ['nurse'], title: 'IPD Beds', titleMm: 'IPD အိပ်ရာ စခန်း' },
  store: { users: ['warehouse', 'cashier', 'pharmacy'], title: 'Stock Management', titleMm: 'ကုန်ပစ္စည်းစီမံခန့်ခွဲမှု' },
  cashier: { users: ['cashier'], title: 'Cashier counter', titleMm: 'Cashier ကောင်တာ' },
  'ward-management': { users: ['admin1', 'admin2'], title: 'Ward & Bed Management', titleMm: 'Ward & Bed စီမံခန့်ခွဲမှု' },
}

type Props = {
  counter: keyof typeof COUNTER_LOGINS
  roles: string[]
  children: ReactNode
}

function canAccessCounter(role: string, counter: string, roleList: string[], allowedCounters?: string[] | null) {
  if (allowedCounters && allowedCounters.length > 0) {
    return allowedCounters.includes(counter)
  }
  return roleList.includes(role)
}

export default function CounterGuard({ counter, roles, children }: Props) {
  const { session, logout } = useAuth()
  const role = session?.role || ''

  if (canAccessCounter(role, counter, roles, session?.allowed_counters)) return <>{children}</>

  const info = COUNTER_LOGINS[counter]

  return (
    <div className="max-w-lg card space-y-4">
      <Alert tone="danger">
        <strong>ဤ counter အတွက် login မှားနေပါသည်</strong>
        <p className="mt-1">
          <strong>{info.titleMm}</strong> မှာ <strong>{info.users.join(' / ')}</strong> account ဖြင့် login လုပ်ရပါမယ်။
        </p>
      </Alert>
      <p className="text-sm text-slate-600">
        လက်ရှိ: <strong>{session?.full_name}</strong> ({role}) — ဤ account ဖြင့် ဤ counter အတွက် action လုပ်ခွင့် မရှိပါ။
      </p>
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
        {Object.entries(COUNTER_LOGINS).map(([key, c]) => (
          <div key={key}>{c.title} → <code>{c.users.join(' / ')}</code></div>
        ))}
        <div className="mt-2">Password: ShweMuse@123</div>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={logout}>Logout & Login Again</button>
        {session?.home && (
          <Link to={session.home} className="btn btn-secondary">Go to My Counter</Link>
        )}
      </div>
    </div>
  )
}

export { COUNTER_LOGINS }
