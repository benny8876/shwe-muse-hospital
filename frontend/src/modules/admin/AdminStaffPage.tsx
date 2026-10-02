import { useEffect, useMemo, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useAuth } from '../../lib/auth'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'

const ROLES = [
  'hospital_admin', 'branch_admin', 'executive', 'cashier', 'receptionist',
  'doctor', 'nurse', 'pharmacist', 'lab_tech', 'radiology', 'usg',
  'ot_staff', 'casualty', 'warehouse', 'accountant', 'hr',
]

// branch_admin can only create/edit staff in its own branch and can never
// grant an admin-tier role — mirrors the server-side check in
// app/api/v1/admin.py's ADMIN_TIER_ROLES, which rejects this regardless.
const ADMIN_TIER_ROLES = ['super_admin', 'hospital_admin', 'branch_admin']

type Staff = {
  id: number
  username: string
  full_name: string
  role: string
  branch_id: number | null
  phone: string
  email: string
  employee_code: string
  is_active: boolean
}

type Branch = { id: number; code: string; name: string }

const emptyForm = { username: '', password: '', full_name: '', role: 'nurse', branch_id: '', phone: '', email: '', employee_code: '' }

export default function AdminStaffPage() {
  const toast = useToast()
  const { session } = useAuth()
  const isBranchAdmin = session?.role === 'branch_admin'
  const creatableRoles = useMemo(
    () => (isBranchAdmin ? ROLES.filter((r) => !ADMIN_TIER_ROLES.includes(r)) : ROLES),
    [isBranchAdmin],
  )
  const [staff, setStaff] = useState<Staff[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editStaff, setEditStaff] = useState<Staff | null>(null)
  const [resetTarget, setResetTarget] = useState<Staff | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadStaff() {
    try {
      const { data } = await api.get('/admin/staff')
      setStaff(data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  useEffect(() => {
    void loadStaff()
    api.get('/branches').then((r) => setBranches(r.data)).catch((e) => toast.error(getApiError(e)))
  }, [])

  const filtered = staff.filter((s) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      s.username.toLowerCase().includes(q)
      || s.full_name.toLowerCase().includes(q)
      || s.role.toLowerCase().includes(q)
      || (s.employee_code || '').toLowerCase().includes(q)
    )
  })

  async function addStaff() {
    if (!form.username.trim() || !form.full_name.trim() || !form.password) {
      return toast.error('Username, full name, password လိုအပ်ပါတယ်')
    }
    setBusy(true)
    try {
      await api.post('/admin/staff', {
        username: form.username.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
        phone: form.phone.trim(),
        email: form.email.trim(),
        employee_code: form.employee_code.trim(),
      })
      toast.success('Staff account created')
      setForm(emptyForm)
      await loadStaff()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveStaffEdit() {
    if (!editStaff) return
    setBusy(true)
    try {
      await api.patch(`/admin/staff/${editStaff.id}`, {
        full_name: editStaff.full_name,
        role: editStaff.role,
        branch_id: editStaff.branch_id,
        phone: editStaff.phone,
        email: editStaff.email,
        employee_code: editStaff.employee_code,
      })
      toast.success('Updated')
      setEditStaff(null)
      await loadStaff()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(s: Staff) {
    setBusy(true)
    try {
      await api.patch(`/admin/staff/${s.id}`, { is_active: !s.is_active })
      await loadStaff()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function submitReset() {
    if (!resetTarget) return
    if (!newPassword) return toast.error('Password အသစ် ထည့်ပါ')
    setBusy(true)
    try {
      await api.post(`/admin/staff/${resetTarget.id}/reset-password`, { new_password: newPassword })
      toast.success('Password reset')
      setResetTarget(null)
      setNewPassword('')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="Staff Accounts" subtitle="Counter login account တွေကို ဖန်တီး/ပြင်ဆင်/disable လုပ်ပါ" />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card space-y-3">
          <h3 className="font-semibold">Add Staff Account</h3>
          <input className="input" placeholder="Username *" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className="input" type="password" placeholder="Password * (min 8, upper/lower/digit/symbol)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="input" placeholder="Full name *" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {creatableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {isBranchAdmin ? (
            <div className="input bg-slate-50 text-slate-500">{branches.find((b) => b.id === session?.branch_id)?.name || 'My Branch'}</div>
          ) : (
            <select className="input" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
              <option value="">No branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Employee code" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
          <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={addStaff}>Create Account</button>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <input className="input" placeholder="Search username / name / role / employee code" value={query} onChange={(e) => setQuery(e.target.value)} />
          <DataTable
            rows={filtered}
            columns={[
              { key: 'username', label: 'Username', render: (r) => <span className="font-mono text-sm">{r.username}</span> },
              { key: 'name', label: 'Full Name', render: (r) => String(r.full_name) },
              { key: 'role', label: 'Role', render: (r) => <StatusBadge value={String(r.role).toUpperCase()} /> },
              { key: 'branch', label: 'Branch', render: (r) => branches.find((b) => b.id === r.branch_id)?.name || '—' },
              { key: 'phone', label: 'Phone', render: (r) => String(r.phone || '—') },
              { key: 'status', label: 'Status', render: (r) => (
                <span className={`badge ${r.is_active ? 'bg-[var(--status-success-bg)] text-[var(--status-success-fg)]' : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]'}`}>
                  {r.is_active ? 'Active' : 'Disabled'}
                </span>
              ) },
              { key: 'act', label: '', render: (r) => (
                isBranchAdmin && ADMIN_TIER_ROLES.includes(r.role) ? (
                  <span className="text-xs text-slate-400">—</span>
                ) : (
                  <div className="flex gap-1 flex-wrap">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditStaff(r)}>Edit</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setResetTarget(r); setNewPassword('') }}>Reset PW</button>
                    {!['super_admin', 'hospital_admin'].includes(r.role) && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleActive(r)}>{r.is_active ? 'Disable' : 'Enable'}</button>
                    )}
                  </div>
                )
              ) },
            ]}
            emptyText="No staff accounts"
          />
        </div>
      </div>

      {editStaff && (
        <Modal title={`Edit — ${editStaff.username}`} onClose={() => setEditStaff(null)}>
          <input className="input" value={editStaff.full_name} onChange={(e) => setEditStaff({ ...editStaff, full_name: e.target.value })} />
          <select className="input" value={editStaff.role} onChange={(e) => setEditStaff({ ...editStaff, role: e.target.value })}>
            {creatableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {isBranchAdmin ? (
            <div className="input bg-slate-50 text-slate-500">{branches.find((b) => b.id === editStaff.branch_id)?.name || 'My Branch'}</div>
          ) : (
            <select className="input" value={editStaff.branch_id ?? ''} onChange={(e) => setEditStaff({ ...editStaff, branch_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">No branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <input className="input" placeholder="Phone" value={editStaff.phone} onChange={(e) => setEditStaff({ ...editStaff, phone: e.target.value })} />
          <input className="input" placeholder="Employee code" value={editStaff.employee_code} onChange={(e) => setEditStaff({ ...editStaff, employee_code: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={saveStaffEdit}>Save</button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditStaff(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`Reset Password — ${resetTarget.username}`} onClose={() => setResetTarget(null)}>
          <input className="input" type="password" placeholder="New password (min 8, upper/lower/digit/symbol)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={submitReset}>Reset</button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setResetTarget(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
