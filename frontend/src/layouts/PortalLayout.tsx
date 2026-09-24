import { Outlet } from 'react-router-dom'

export default function PortalLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 font-bold text-[#005293]">Shwe Muse Patient Portal</header>
      <main className="max-w-3xl mx-auto p-6"><Outlet /></main>
    </div>
  )
}
