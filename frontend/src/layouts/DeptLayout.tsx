import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'

const links = [
  { to: '/app/front-desk', label: 'frontDesk', roles: ['receptionist', 'super_admin', 'hospital_admin'] },
  { to: '/app/opd', label: 'opd', roles: ['doctor', 'super_admin', 'hospital_admin'] },
  { to: '/app/ipd', label: 'ipd', roles: ['nurse', 'doctor', 'super_admin', 'hospital_admin'] },
  { to: '/app/pharmacy', label: 'pharmacy', roles: ['pharmacist', 'super_admin', 'hospital_admin'] },
  { to: '/app/lab', label: 'lab', roles: ['lab_tech', 'super_admin', 'hospital_admin'] },
  { to: '/app/radiology', label: 'radiology', roles: ['radiology', 'super_admin', 'hospital_admin'] },
  { to: '/app/ot', label: 'ot', roles: ['ot_staff', 'super_admin', 'hospital_admin'] },
  { to: '/app/emergency', label: 'emergency', roles: ['casualty', 'super_admin', 'hospital_admin'] },
  { to: '/app/inventory', label: 'inventory', roles: ['warehouse', 'super_admin', 'hospital_admin'] },
  { to: '/app/accounts', label: 'accounts', roles: ['accountant', 'super_admin', 'hospital_admin'] },
  { to: '/app/hr', label: 'hr', roles: ['hr', 'super_admin', 'hospital_admin'] },
  { to: '/app/executive', label: 'executive', roles: ['executive', 'super_admin', 'hospital_admin'] },
  { to: '/pos', label: 'pos', roles: ['cashier', 'super_admin', 'hospital_admin'] },
]

export default function DeptLayout() {
  const { t, i18n } = useTranslation()
  const { session, logout } = useAuth()
  const role = session?.role || ''
  const visible = links.filter((l) => l.roles.includes(role))

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-[#005293] text-white p-4 no-print flex flex-col">
        <div className="text-xl font-bold mb-6">{t('appName')}</div>
        <div className="text-sm mb-4 opacity-90">{session?.full_name}</div>
        <nav className="space-y-1 flex-1 overflow-y-auto">
          {visible.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `block rounded-lg px-3 py-2 ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`}>
              {t(l.label)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 pt-4 border-t border-white/20 space-y-2 shrink-0">
          <button
            type="button"
            className="btn-outline-light w-full"
            onClick={() => {
              const next = i18n.language === 'my' ? 'en' : 'my'
              i18n.changeLanguage(next)
              localStorage.setItem('lang', next)
            }}
          >
            {i18n.language === 'my' ? 'English' : 'မြန်မာ'}
          </button>
          <button type="button" className="btn-outline-light w-full" onClick={logout}>
            {t('logout')}
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
