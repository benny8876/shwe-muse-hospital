import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useBranchId } from '../../hooks/useBranchId'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import Modal from '../../components/Modal'

const CATEGORIES = ['general', 'icu', 'ccu', 'vip', 'private']

type Ward = { id: number; branch_id: number; name: string; category: string; floor: string }
type Bed = { id: number; ward_id: number; code: string; status: string; daily_rate: number; hourly_rate: number; package_rate: number }

const emptyWardForm = { name: '', category: 'general', floor: '' }
const emptyBedForm = { code: '', daily_rate: '', hourly_rate: '', package_rate: '' }

export default function AdminWardsPage() {
  const branchId = useBranchId()
  const toast = useToast()
  const [wards, setWards] = useState<Ward[]>([])
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null)
  const [beds, setBeds] = useState<Bed[]>([])
  const [wardForm, setWardForm] = useState(emptyWardForm)
  const [bedForm, setBedForm] = useState(emptyBedForm)
  const [editWard, setEditWard] = useState<Ward | null>(null)
  const [editBed, setEditBed] = useState<Bed | null>(null)
  const [busy, setBusy] = useState(false)

  async function loadWards() {
    try {
      const { data } = await api.get('/admin/wards', { params: { branch_id: branchId } })
      setWards(data)
      if (!selectedWard && data.length) setSelectedWard(data[0])
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  useEffect(() => { void loadWards() }, [branchId])

  async function loadBeds(wardId: number) {
    try {
      const { data } = await api.get(`/admin/wards/${wardId}/beds`)
      setBeds(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  useEffect(() => { if (selectedWard) void loadBeds(selectedWard.id) }, [selectedWard])

  async function addWard() {
    if (!wardForm.name.trim()) return toast.error('Ward name required')
    setBusy(true)
    try {
      const { data } = await api.post('/admin/wards', { branch_id: branchId, ...wardForm })
      toast.success('Ward created')
      setWardForm(emptyWardForm)
      await loadWards()
      setSelectedWard(data)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveWardEdit() {
    if (!editWard) return
    setBusy(true)
    try {
      await api.patch(`/admin/wards/${editWard.id}`, { name: editWard.name, category: editWard.category, floor: editWard.floor })
      toast.success('Updated')
      setEditWard(null)
      await loadWards()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function addBed() {
    if (!selectedWard) return
    if (!bedForm.code.trim()) return toast.error('Bed code required')
    setBusy(true)
    try {
      await api.post('/admin/beds', {
        ward_id: selectedWard.id,
        code: bedForm.code.trim(),
        daily_rate: Number(bedForm.daily_rate) || 0,
        hourly_rate: Number(bedForm.hourly_rate) || 0,
        package_rate: Number(bedForm.package_rate) || 0,
      })
      toast.success('Bed added')
      setBedForm(emptyBedForm)
      await loadBeds(selectedWard.id)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveBedEdit() {
    if (!editBed || !selectedWard) return
    setBusy(true)
    try {
      await api.patch(`/admin/beds/${editBed.id}`, {
        code: editBed.code,
        daily_rate: Number(editBed.daily_rate),
        hourly_rate: Number(editBed.hourly_rate),
        package_rate: Number(editBed.package_rate),
      })
      toast.success('Updated')
      setEditBed(null)
      await loadBeds(selectedWard.id)
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Ward & Bed Management" subtitle="Ward အသစ်ဖန်တီး၊ Bed နှင့် rate (daily/hourly/package) သတ်မှတ်ပါ" />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-800">Add Ward</h3>
            <input className="input" placeholder="Ward name *" value={wardForm.name} onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })} />
            <select className="input" value={wardForm.category} onChange={(e) => setWardForm({ ...wardForm, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
            <input className="input" placeholder="Floor (optional)" value={wardForm.floor} onChange={(e) => setWardForm({ ...wardForm, floor: e.target.value })} />
            <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={addWard}>Create Ward</button>
          </div>

          <div className="card p-0">
            <h3 className="font-semibold text-slate-800 px-4 pt-4 pb-2">Wards</h3>
            <div className="divide-y divide-slate-200">
              {wards.length === 0 && <div className="text-slate-500 text-sm px-4 py-4">No wards yet</div>}
              {wards.map((w) => (
                <button
                  type="button"
                  key={w.id}
                  onClick={() => setSelectedWard(w)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between cursor-pointer ${selectedWard?.id === w.id ? 'bg-[var(--brand-50)]' : 'hover:bg-slate-50'}`}
                >
                  <div>
                    <div className="font-medium text-slate-800">{w.name}</div>
                    <div className="text-xs text-slate-500">{w.category.toUpperCase()}{w.floor ? ` · Floor ${w.floor}` : ''}</div>
                  </div>
                  <span
                    className="text-xs text-[var(--brand-600)] hover:underline"
                    onClick={(e) => { e.stopPropagation(); setEditWard(w) }}
                  >
                    Edit
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!selectedWard ? (
            <div className="card text-slate-500">Ward list ကနေ ရွေးပါ (or create one)</div>
          ) : (
            <>
              <div className="card space-y-3">
                <h3 className="font-semibold text-slate-800">Add Bed — {selectedWard.name}</h3>
                <div className="grid sm:grid-cols-4 gap-2">
                  <input className="input" placeholder="Bed code *" value={bedForm.code} onChange={(e) => setBedForm({ ...bedForm, code: e.target.value })} />
                  <input className="input" type="number" placeholder="Daily rate" value={bedForm.daily_rate} onChange={(e) => setBedForm({ ...bedForm, daily_rate: e.target.value })} />
                  <input className="input" type="number" placeholder="Hourly rate" value={bedForm.hourly_rate} onChange={(e) => setBedForm({ ...bedForm, hourly_rate: e.target.value })} />
                  <input className="input" type="number" placeholder="Package rate" value={bedForm.package_rate} onChange={(e) => setBedForm({ ...bedForm, package_rate: e.target.value })} />
                </div>
                <button type="button" disabled={busy} className="btn btn-primary" onClick={addBed}>Add Bed</button>
              </div>

              <DataTable
                rows={beds}
                columns={[
                  { key: 'code', label: 'Bed Code', render: (r) => <span className="font-medium">{r.code}</span> },
                  { key: 'status', label: 'Status', render: (r) => (
                    <span className={`badge ${r.status === 'available' ? 'bg-[var(--status-success-bg)] text-[var(--status-success-fg)]' : r.status === 'occupied' ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]' : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]'}`}>
                      {String(r.status).toUpperCase()}
                    </span>
                  ) },
                  { key: 'daily', label: 'Daily', render: (r) => Number(r.daily_rate).toLocaleString() },
                  { key: 'hourly', label: 'Hourly', render: (r) => Number(r.hourly_rate).toLocaleString() },
                  { key: 'package', label: 'Package', render: (r) => Number(r.package_rate).toLocaleString() },
                  { key: 'act', label: '', render: (r) => (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditBed(r)}>Edit</button>
                  ) },
                ]}
                emptyText="No beds in this ward yet"
              />
            </>
          )}
        </div>
      </div>

      {editWard && (
        <Modal title={`Edit Ward — ${editWard.name}`} onClose={() => setEditWard(null)}>
          <input className="input" value={editWard.name} onChange={(e) => setEditWard({ ...editWard, name: e.target.value })} />
          <select className="input" value={editWard.category} onChange={(e) => setEditWard({ ...editWard, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
          <input className="input" placeholder="Floor" value={editWard.floor} onChange={(e) => setEditWard({ ...editWard, floor: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={saveWardEdit}>Save</button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditWard(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {editBed && (
        <Modal title={`Edit Bed — ${editBed.code}`} onClose={() => setEditBed(null)}>
          <input className="input" value={editBed.code} onChange={(e) => setEditBed({ ...editBed, code: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input className="input" type="number" placeholder="Daily" value={editBed.daily_rate} onChange={(e) => setEditBed({ ...editBed, daily_rate: Number(e.target.value) })} />
            <input className="input" type="number" placeholder="Hourly" value={editBed.hourly_rate} onChange={(e) => setEditBed({ ...editBed, hourly_rate: Number(e.target.value) })} />
            <input className="input" type="number" placeholder="Package" value={editBed.package_rate} onChange={(e) => setEditBed({ ...editBed, package_rate: Number(e.target.value) })} />
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={saveBedEdit}>Save</button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditBed(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
