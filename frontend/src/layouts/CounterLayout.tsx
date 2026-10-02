import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { visibleCounters } from '../lib/counterLinks'
import { IconAdmin, IconHome, IconHospitalMark } from '../components/icons/CounterIcons'

export default function CounterLayout() {
  const { t, i18n } = useTranslation()
  const { session, logout } = useAuth()
  const role = session?.role || ''
  const visible = visibleCounters(role, session?.allowed_counters)
  const { pathname } = useLocation()
  const activeLink = pathname === '/counter' ? null : visible.find((l) => pathname.startsWith(l.to))
  const activeLabel = pathname === '/counter' ? 'dashboard' : activeLink?.label

  return (
    <div className="min-h-screen flex">
      <aside
        className="group w-16 hover:w-60 shrink-0 text-white no-print flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out"
        style={{ background: 'var(--brand-600)' }}
      >
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/15">
          <span className="shrink-0"><IconHospitalMark size={22} /></span>
          <div className="max-w-0 group-hover:max-w-[160px] overflow-hidden transition-[max-width] duration-200 whitespace-nowrap">
            <div className="text-lg font-bold leading-tight">{t('appName')}</div>
            <div className="text-xs opacity-75">Hospital Workflow</div>
          </div>
        </div>
        <nav className="flex-1 py-2 space-y-0.5 px-2">
          <NavLink
            to="/counter"
            end
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition overflow-hidden ${isActive ? 'bg-white text-[var(--brand-600)]' : 'text-white/90 hover:bg-white/10'}`
            }
          >
            <span className="shrink-0"><IconHome size={18} /></span>
            <span className="max-w-0 group-hover:max-w-[160px] overflow-hidden transition-[max-width] duration-200 whitespace-nowrap">{t('dashboard')}</span>
          </NavLink>
          <div className="my-1.5 border-t border-white/15" />
          {visible.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition overflow-hidden ${isActive ? 'bg-white text-[var(--brand-600)]' : 'text-white/90 hover:bg-white/10'}`
              }
            >
              <span className="shrink-0"><l.icon size={18} /></span>
              <span className="max-w-0 group-hover:max-w-[160px] overflow-hidden transition-[max-width] duration-200 whitespace-nowrap">{t(l.label)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-2 pb-3 pt-2 border-t border-white/15 space-y-1.5">
          {role === 'super_admin' && (
            <Link to="/dev/accounts" className="btn-outline-light w-full flex items-center justify-center gap-1.5 overflow-hidden">
              <span className="shrink-0"><IconAdmin size={16} /></span>
              <span className="max-w-0 group-hover:max-w-[160px] overflow-hidden transition-[max-width] duration-200 whitespace-nowrap">Developer Panel</span>
            </Link>
          )}
          {(role === 'super_admin' || role === 'hospital_admin' || role === 'branch_admin') && (
            <Link to="/admin/staff" className="btn-outline-light w-full flex items-center justify-center gap-1.5 overflow-hidden">
              <span className="shrink-0"><IconAdmin size={16} /></span>
              <span className="max-w-0 group-hover:max-w-[160px] overflow-hidden transition-[max-width] duration-200 whitespace-nowrap">Admin Panel</span>
            </Link>
          )}
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-5 no-print">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-sm font-semibold text-slate-700 shrink-0">{activeLabel ? t(activeLabel) : t('appName')}</span>
            {activeLink?.subtitle && (
              <span className="text-xs text-slate-400 truncate">· {activeLink.subtitle}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
              onClick={() => {
                const next = i18n.language === 'my' ? 'en' : 'my'
                i18n.changeLanguage(next)
                localStorage.setItem('lang', next)
              }}
            >
              {i18n.language === 'my' ? 'English' : 'မြန်မာ'}
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-slate-800">{session?.full_name}</div>
              <div className="text-xs text-slate-500">{session?.role}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>{t('logout')}</button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto" style={{ background: 'var(--surface-muted)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
