import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { visibleCounters } from '../lib/counterLinks'
import { IconAdmin } from '../components/icons/CounterIcons'

const TILE_COLORS = ['#e8f1fb', '#fdf3e3', '#e6f6ea', '#fbeaea', '#eaf2fa', '#f3e8fb', '#e3f6fa', '#fef0e6']

export default function DashboardPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const role = session?.role || ''
  // Admin/Developer Panel are a deliberately separate route (see LoginPage's
  // role-based redirect and CounterLayout's sidebar links) — this grid stays
  // counter-only so day-to-day operations and structural admin never mix.
  const isAdmin = role === 'super_admin' || role === 'hospital_admin'
  const tiles = visibleCounters(role, session?.allowed_counters)
  // branch_admin has no counters at all — its only destination is Admin Panel
  // (Staff Accounts, scoped to its own branch), so it needs its own visible
  // tile here rather than relying on the small collapsed sidebar icon.
  const isBranchAdmin = role === 'branch_admin'

  return (
    <div>
      <div className="mb-5 pb-3 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-800">{t('dashboard')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">Welcome, {session?.full_name} · {session?.role}</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 sm:gap-5">
        {tiles.map((tile, i) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="flex flex-col items-center gap-2 text-center group"
          >
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center transition group-hover:scale-105 group-hover:shadow-md"
              style={{ background: TILE_COLORS[i % TILE_COLORS.length] }}
            >
              <tile.icon size={30} />
            </div>
            <span className="text-xs font-medium text-slate-700 leading-tight">{t(tile.label)}</span>
          </Link>
        ))}

        {isBranchAdmin && (
          <Link to="/admin/staff" className="flex flex-col items-center gap-2 text-center group">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center transition group-hover:scale-105 group-hover:shadow-md"
              style={{ background: TILE_COLORS[tiles.length % TILE_COLORS.length] }}
            >
              <IconAdmin size={30} />
            </div>
            <span className="text-xs font-medium text-slate-700 leading-tight">Admin Panel</span>
          </Link>
        )}
      </div>

      {tiles.length === 0 && !isAdmin && !isBranchAdmin && (
        <div className="card mt-4 text-slate-500 text-sm">သင့် account အတွက် ဖွင့်ထားတဲ့ counter မရှိသေးပါ။</div>
      )}
    </div>
  )
}
