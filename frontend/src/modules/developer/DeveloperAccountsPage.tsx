import { useEffect, useMemo, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import { useAuth } from '../../lib/auth'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import Modal from '../../components/Modal'
import AccessPermissionPicker from '../../components/AccessPermissionPicker'

const FALLBACK_ROLES = [
  'hospital_admin', 'executive', 'cashier', 'receptionist', 'doctor', 'nurse',
  'pharmacist', 'lab_tech', 'radiology', 'usg', 'ot_staff', 'casualty', 'warehouse', 'accountant', 'hr',
]

type DevUser = {
  id: number
  username: string
  full_name: string
  role: string
  branch_id: number | null
  phone: string
  email: string
  employee_code: string
  is_active: boolean
  allowed_counters: string[]
  allowed_features: string[]
  effective_permissions: string[]
}

type CounterDef = { key: string; label: string; subtitle: string }
type TabDef = { key: string; label: string }
type Branch = { id: number; code: string; name: string }
type Meta = {
  roles: string[]
  counters: CounterDef[]
  counter_tabs: Record<string, TabDef[]>
  role_defaults: Record<string, { counters: string[]; features: string[]; permissions: string[] }>
}

const emptyForm = {
  username: '',
  password: '',
  full_name: '',
  role: 'cashier',
  branch_id: '',
  phone: '',
  email: '',
  employee_code: '',
  allowed_counters: [] as string[],
  allowed_features: [] as string[],
}

async function loadBranches(): Promise<Branch[]> {
  try {
    const { data } = await api.get('/admin/branches')
    return data
  } catch {
    const { data } = await api.get('/branches')
    return data
  }
}

export default function DeveloperAccountsPage() {
  const toast = useToast()
  const { session } = useAuth()
  // A branch-scoped dev account (e.g. "dev1"/"dev2" on each offline branch
  // server) only ever manages its own branch — mirrors the server-side scoping
  // in app/api/v1/developer.py. branch_id === null means unscoped/global.
  const scopeBranchId = session?.branch_id ?? null
  const [users, setUsers] = useState<DevUser[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editUser, setEditUser] = useState<DevUser | null>(null)
  const [resetTarget, setResetTarget] = useState<DevUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const roles = meta?.roles?.length ? meta.roles.filter((r) => r !== 'super_admin') : FALLBACK_ROLES

  async function load() {
    try {
      const [usersRes, metaRes] = await Promise.all([
        api.get('/developer/users'),
        api.get('/developer/meta'),
      ])
      setUsers(usersRes.data)
      setMeta(metaRes.data)
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  useEffect(() => {
    void load()
    loadBranches()
      .then(setBranches)
      .catch((e) => toast.error(getApiError(e)))
  }, [])

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      u.username.toLowerCase().includes(q)
      || u.full_name.toLowerCase().includes(q)
      || u.role.toLowerCase().includes(q)
    )
  })

  const roleDefaults = useMemo(() => meta?.role_defaults[form.role], [meta, form.role])

  function applyRoleDefaults(role: string, target: 'form' | 'edit') {
    const defs = meta?.role_defaults[role]
    if (!defs) {
      if (target === 'form') setForm((f) => ({ ...f, role }))
      else if (editUser) setEditUser({ ...editUser, role })
      return
    }
    if (target === 'form') {
      setForm((f) => ({
        ...f,
        role,
        allowed_counters: [...defs.counters],
        allowed_features: [...defs.features],
      }))
    } else if (editUser) {
      setEditUser({
        ...editUser,
        role,
        allowed_counters: [...defs.counters],
        allowed_features: [...defs.features],
      })
    }
  }

  async function createUser() {
    if (!form.username.trim() || !form.full_name.trim() || !form.password) {
      return toast.error('Username, full name, password လိုအပ်ပါတယ်')
    }
    setBusy(true)
    try {
      await api.post('/developer/users', {
        username: form.username.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
        branch_id: form.branch_id ? Number(form.branch_id) : null,
        phone: form.phone.trim(),
        email: form.email.trim(),
        employee_code: form.employee_code.trim(),
        allowed_counters: form.allowed_counters,
        allowed_features: form.allowed_features,
        extra_permissions: [],
      })
      toast.success('Account created')
      setForm(emptyForm)
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    if (!editUser) return
    setBusy(true)
    try {
      await api.patch(`/developer/users/${editUser.id}`, {
        full_name: editUser.full_name,
        role: editUser.role,
        branch_id: editUser.branch_id,
        phone: editUser.phone,
        email: editUser.email,
        employee_code: editUser.employee_code,
        is_active: editUser.is_active,
        allowed_counters: editUser.allowed_counters,
        allowed_features: editUser.allowed_features,
        extra_permissions: [],
      })
      toast.success('Updated')
      setEditUser(null)
      await load()
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  async function submitReset() {
    if (!resetTarget || !newPassword) return toast.error('Password အသစ် ထည့်ပါ')
    setBusy(true)
    try {
      await api.post(`/developer/users/${resetTarget.id}/reset-password`, { new_password: newPassword })
      toast.success('Password reset')
      setResetTarget(null)
      setNewPassword('')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setBusy(false)
    }
  }

  function formatFeatures(u: DevUser) {
    if (!u.allowed_features?.length) return 'role default'
    const labels = u.allowed_features.map((f) => {
      const [counter, tab] = f.split('.')
      const tabLabel = meta?.counter_tabs?.[counter]?.find((t) => t.key === tab)?.label || tab
      const counterLabel = meta?.counters?.find((c) => c.key === counter)?.label || counter
      return `${counterLabel}: ${tabLabel}`
    })
    return labels.slice(0, 3).join(', ') + (labels.length > 3 ? ` +${labels.length - 3}` : '')
  }

  const pickerMeta = {
    counters: meta?.counters || [],
    counterTabs: meta?.counter_tabs || {},
  }

  return (
    <div>
      <PageHeader
        title="Account Management"
        subtitle="Navbar counter နှင့် counter အတွင်းရှိ tab တွေကို တစ်ခုချင်း ခွင့်ပြုချက် သတ်မှတ်ပါ"
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card space-y-3">
          <h3 className="font-semibold">Create Account</h3>
          <input className="input" placeholder="Username *" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input className="input" type="password" placeholder="Password *" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="input" placeholder="Full name *" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Role *</span>
            <select
              className="input mt-1"
              value={form.role}
              onChange={(e) => applyRoleDefaults(e.target.value, 'form')}
            >
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Branch</span>
            {scopeBranchId !== null ? (
              <div className="input mt-1 bg-slate-50 text-slate-500">{branches.find((b) => b.id === scopeBranchId)?.name || 'My Branch'}</div>
            ) : (
              <select className="input mt-1" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}>
                <option value="">No branch</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </label>
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Employee code" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />

          {pickerMeta.counters.length > 0 ? (
            <AccessPermissionPicker
              counters={pickerMeta.counters}
              counterTabs={pickerMeta.counterTabs}
              selectedCounters={form.allowed_counters}
              selectedFeatures={form.allowed_features}
              onChange={(counters, features) => setForm({ ...form, allowed_counters: counters, allowed_features: features })}
            />
          ) : (
            <p className="text-sm text-slate-500">Permission list ဖွင့်ရန် backend server ကို restart လုပ်ပါ</p>
          )}

          {roleDefaults && (
            <p className="text-xs text-slate-500">
              Role <strong>{form.role}</strong> default counters: {roleDefaults.counters.join(', ') || '—'}
            </p>
          )}
          <button type="button" disabled={busy} className="btn btn-primary w-full" onClick={createUser}>Create Account</button>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <input className="input" placeholder="Search username / name / role" value={query} onChange={(e) => setQuery(e.target.value)} />
          <DataTable
            rows={filtered}
            columns={[
              { key: 'username', label: 'Username', render: (r) => <span className="font-mono text-sm">{r.username}</span> },
              { key: 'name', label: 'Full Name', render: (r) => String(r.full_name) },
              { key: 'role', label: 'Role', render: (r) => <StatusBadge value={String(r.role).toUpperCase()} /> },
              { key: 'access', label: 'Access', render: (r) => (
                <span className="text-xs text-slate-600">{formatFeatures(r)}</span>
              ) },
              { key: 'status', label: 'Status', render: (r) => (
                <span className={`badge ${r.is_active ? 'bg-[var(--status-success-bg)] text-[var(--status-success-fg)]' : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]'}`}>
                  {r.is_active ? 'Active' : 'Disabled'}
                </span>
              ) },
              { key: 'act', label: '', render: (r) => (
                <div className="flex gap-1 flex-wrap">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditUser({ ...r })}>Edit</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setResetTarget(r); setNewPassword('') }}>Reset PW</button>
                </div>
              ) },
            ]}
            emptyText="No accounts"
          />
        </div>
      </div>

      {editUser && (
        <Modal title={`Edit — ${editUser.username}`} onClose={() => setEditUser(null)}>
          <input className="input" value={editUser.full_name} onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })} />
          <select className="input" value={editUser.role} onChange={(e) => applyRoleDefaults(e.target.value, 'edit')}>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {scopeBranchId !== null ? (
            <div className="input bg-slate-50 text-slate-500">{branches.find((b) => b.id === editUser.branch_id)?.name || 'My Branch'}</div>
          ) : (
            <select className="input" value={editUser.branch_id ?? ''} onChange={(e) => setEditUser({ ...editUser, branch_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">No branch</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editUser.is_active} onChange={(e) => setEditUser({ ...editUser, is_active: e.target.checked })} />
            Active
          </label>
          {pickerMeta.counters.length > 0 && (
            <AccessPermissionPicker
              counters={pickerMeta.counters}
              counterTabs={pickerMeta.counterTabs}
              selectedCounters={editUser.allowed_counters}
              selectedFeatures={editUser.allowed_features || []}
              onChange={(counters, features) => setEditUser({ ...editUser, allowed_counters: counters, allowed_features: features })}
            />
          )}
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={saveEdit}>Save</button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setEditUser(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`Reset Password — ${resetTarget.username}`} onClose={() => setResetTarget(null)}>
          <input className="input" type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="btn btn-primary flex-1" onClick={submitReset}>Reset</button>
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setResetTarget(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
