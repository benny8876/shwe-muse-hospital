import { Outlet } from 'react-router-dom'

export default function KioskLayout() {
  return (
    <div className="min-h-screen bg-[#005293] text-white flex items-center justify-center">
      <Outlet />
    </div>
  )
}