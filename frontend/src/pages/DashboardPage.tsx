import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { visibleCounters } from '../lib/counterLinks'
import { IconAdmin, IconStaff, IconWard, IconOwnerPanel } from '../components/icons/CounterIcons'

const TILE_COLORS = ['#e8f1fb', '#fdf3e3', '#e6f6ea', '#fbeaea', '#eaf2fa', '#f3e8fb', '#e3f6fa', '#fef0e6']

export default function DashboardPage() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const role = session?.role || ''
  const isSuperAdmin = role === 'super_admin'
  const isAdmin = isSuperAdmin || role === 'hospital_admin'
  const tiles = visibleCounters(role, session?.allowed_counters)

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

        {isSuperAdmin && (
          <Link to="/dev/accounts" className="flex flex-col items-center gap-2 text-center group">
            <div className="h-16 w-16 rounded-full flex items-center justify-center transition group-hover:scale-105 group-hover:shadow-md" style={{ background: TILE_COLORS[tiles.length % TILE_COLORS.length] }}>
              <IconAdmin size={30} />
            </div>
            <span className="text-xs font-medium text-slate-700 leading-tight">Developer Panel</span>
          </Link>
        )}

        {isAdmin && (
          <>
            <Link to="/admin/staff" className="flex flex-col items-center gap-2 text-center group">
              <div className="h-16 w-16 rounded-full flex items-center justify-center transition group-hover:scale-105 group-hover:shadow-md" style={{ background: TILE_COLORS[(tiles.length + 1) % TILE_COLORS.length] }}>
                <IconStaff size={30} />
              </div>
              <span className="text-xs font-medium text-slate-700 leading-tight">Staff Accounts</span>
            </Link>
            <Link to="/admin/wards" className="flex flex-col items-center gap-2 text-center group">
              <div className="h-16 w-16 rounded-full flex items-center justify-center transition group-hover:scale-105 group-hover:shadow-md" style={{ background: TILE_COLORS[(tiles.length + 2) % TILE_COLORS.length] }}>
                <IconWard size={30} />
              </div>
              <span className="text-xs font-medium text-slate-700 leading-tight">Ward & Bed Management</span>
            </Link>
            <Link to="/admin/owner" className="flex flex-col items-center gap-2 text-center group">
              <div className="h-16 w-16 rounded-full flex items-center justify-center transition group-hover:scale-105 group-hover:shadow-md" style={{ background: TILE_COLORS[(tiles.length + 3) % TILE_COLORS.length] }}>
                <IconOwnerPanel size={30} />
              </div>
              <span className="text-xs font-medium text-slate-700 leading-tight">Owner Panel</span>
            </Link>
          </>
        )}
      </div>

      {tiles.length === 0 && !isAdmin && (
        <div className="card mt-4 text-slate-500 text-sm">သင့် account အတွက် ဖွင့်ထားတဲ့ counter မရှိသေးပါ။</div>
      )}
    </div>
  )
}
