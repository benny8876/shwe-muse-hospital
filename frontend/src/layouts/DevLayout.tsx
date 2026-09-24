import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const links = [
  { to: '/dev/accounts', label: 'Account Management', icon: '🛠️' },
]

export default function DevLayout() {
  const { session, logout } = useAuth()
  const { pathname } = useLocation()
  const activeLabel = links.find((l) => pathname.startsWith(l.to))?.label

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 text-white no-print flex flex-col" style={{ background: 'var(--brand-600)' }}>
        <div className="px-4 py-4 border-b border-white/15">
          <div className="text-lg font-bold leading-tight">Developer Panel</div>
          <div className="text-xs opacity-75">Shwe Muse Hospital</div>
        </div>
        <nav className="flex-1 py-2 space-y-0.5 px-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white text-[var(--brand-600)]' : 'text-white/90 hover:bg-white/10'}`
              }
            >
              <span className="text-base leading-none">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-2 pb-3 pt-2 border-t border-white/15 space-y-1.5">
          <Link to="/admin/staff" className="btn-outline-light w-full block text-center text-sm">Admin Panel</Link>
          <Link to="/counter" className="btn-outline-light w-full block text-center">← Back to Counters</Link>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-5 no-print">
          <div className="text-sm font-semibold text-slate-700">{activeLabel || 'Developer Panel'}</div>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-slate-800">{session?.full_name}</div>
              <div className="text-xs text-slate-500">{session?.role}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto" style={{ background: 'var(--surface-muted)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
