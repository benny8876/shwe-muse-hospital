import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function PosLayout() {
  const { session, logout } = useAuth()
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-[#005293] text-white px-6 py-3 flex items-center justify-between no-print">
        <div className="text-2xl font-bold">Shwe Muse POS</div>
        <div className="flex gap-3 items-center">
          <span>{session?.full_name}</span>
          <NavLink to="/pos/shift" className="btn-outline-light !py-2">Shift</NavLink>
          <button type="button" className="btn-outline-light !py-2" onClick={logout}>Logout</button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
