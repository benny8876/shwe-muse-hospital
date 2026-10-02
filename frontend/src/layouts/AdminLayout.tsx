import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const links = [
  { to: '/admin/staff', label: 'Staff Accounts', icon: '👤' },
  { to: '/admin/owner', label: 'Owner Panel', icon: '📊' },
]

export default function AdminLayout() {
  const { session, logout } = useAuth()
  const { pathname } = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // branch_admin is scoped to its own branch's Staff Accounts only — Owner Panel
  // (cross-branch income/stock/CAPEX) stays owner-only (super_admin/hospital_admin).
  const visibleLinks = session?.role === 'branch_admin' ? links.filter((l) => l.to !== '/admin/owner') : links
  const activeLabel = visibleLinks.find((l) => pathname.startsWith(l.to))?.label

  return (
    <div className="min-h-screen flex">
      {mobileNavOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMobileNavOpen(false)} />
      )}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-60 shrink-0 text-white no-print flex flex-col transition-transform duration-200 md:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--brand-600)' }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/15">
          <div>
            <div className="text-lg font-bold leading-tight">Admin Panel</div>
            <div className="text-xs opacity-75">Shwe Muse Hospital</div>
          </div>
          <button
            type="button"
            className="md:hidden text-white/80 hover:text-white text-xl leading-none"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 py-2 space-y-0.5 px-2">
          {visibleLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setMobileNavOpen(false)}
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
          {session?.role === 'super_admin' && (
            <Link to="/dev/accounts" className="btn-outline-light w-full block text-center text-sm">Developer Panel</Link>
          )}
          <Link to="/counter" className="btn-outline-light w-full block text-center">← Back to Counters</Link>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-5 no-print gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="md:hidden shrink-0 text-slate-600 hover:text-slate-900 p-1"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="text-sm font-semibold text-slate-700 truncate">{activeLabel || 'Admin Panel'}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-medium text-slate-800">{session?.full_name}</div>
              <div className="text-xs text-slate-500">{session?.role}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>Logout</button>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-6 overflow-auto" style={{ background: 'var(--surface-muted)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
