import { useEffect, useState } from 'react'
import api from '../../lib/api'

export default function KioskPage() {
  const [queue, setQueue] = useState<any[]>([])

  useEffect(() => {
    const tick = () => api.get('/queue', { params: { branch_id: 1, department: 'OPD' } }).then((r) => setQueue(r.data))
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [])

  const serving = queue.find((q) => q.status === 'serving')
  const waiting = queue.filter((q) => q.status === 'waiting').slice(0, 8)

  return (
    <div className="text-center p-8 w-full">
      <div className="text-4xl mb-8 opacity-80">Now Serving</div>
      <div className="text-[120px] font-bold leading-none mb-12">{serving?.number || '--'}</div>
      <div className="text-3xl mb-4 opacity-80">Waiting</div>
      <div className="flex flex-wrap justify-center gap-6">
        {waiting.map((q) => <div key={q.id} className="text-5xl font-semibold bg-white/10 rounded-2xl px-8 py-4">{q.number}</div>)}
      </div>
    </div>
  )
}
