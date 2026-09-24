import { useEffect, useState } from 'react'
import api from '../lib/api'

export type PatientRow = { id: number; name: string; uhid: string; phone?: string }

export function usePatients() {
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [map, setMap] = useState<Record<number, PatientRow>>({})

  useEffect(() => {
    api.get('/patients').then((r) => {
      setPatients(r.data)
      const m: Record<number, PatientRow> = {}
      r.data.forEach((p: PatientRow) => { m[p.id] = p })
      setMap(m)
    }).catch(() => {})
  }, [])

  return {
    patients,
    map,
    name: (id: number) => map[id]?.name || `#${id}`,
    uhid: (id: number) => map[id]?.uhid || '',
    phone: (id: number) => map[id]?.phone || '',
  }
}
