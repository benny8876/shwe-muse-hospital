import { useEffect, useState } from 'react'
import api, { getApiError } from '../../lib/api'
import { useToast } from '../../lib/toast'
import PageHeader from '../../components/PageHeader'
import Tabs from '../../components/Tabs'
import DataTable from '../../components/DataTable'
import { formatDate } from '../../lib/format'

export default function HrPage() {
  const toast = useToast()
  const [tab, setTab] = useState('staff')
  const [staff, setStaff] = useState<any[]>([])
  const [roster, setRoster] = useState<any[]>([])
  const [commissions, setCommissions] = useState<any[]>([])
  const [audit, setAudit] = useState<any[]>([])
  const [rForm, setRForm] = useState({ user_id: '', shift: 'morning', department: '' })

  async function load() {
    const [s, c, a] = await Promise.all([
      api.get('/hr/staff'),
      api.get('/hr/commissions'),
      api.get('/hr/audit'),
    ])
    setStaff(s.data)
    setCommissions(c.data)
    setAudit(a.data)
  }

  useEffect(() => { void load() }, [])

  async function loadRoster() {
    const { data } = await api.get('/hr/roster')
    setRoster(data)
  }

  useEffect(() => {
    if (tab === 'roster') void loadRoster()
  }, [tab])

  async function addRoster() {
    try {
      await api.post('/hr/roster', null, {
        params: {
          user_id: Number(rForm.user_id),
          branch_id: 1,
          work_date: new Date().toISOString().slice(0, 10),
          shift: rForm.shift,
          department: rForm.department,
        },
      })
      toast.success('Roster added')
      await loadRoster()
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  async function checkIn(userId: number) {
    try {
      await api.post('/hr/attendance/check-in', null, { params: { user_id: userId } })
      toast.success('Checked in')
    } catch (e) {
      toast.error(getApiError(e))
    }
  }

  return (
    <div>
      <PageHeader title="HR & Admin" subtitle="Staff, roster, commissions and audit trail" />
      <Tabs tabs={[
        { id: 'staff', label: 'Staff' },
        { id: 'roster', label: 'Roster' },
        { id: 'commissions', label: 'Commissions' },
        { id: 'audit', label: 'Audit Log' },
      ]} active={tab} onChange={setTab} />

      {tab === 'staff' && (
        <DataTable rows={staff} columns={[
          { key: 'full_name', label: 'Name', render: (r) => String(r.full_name) },
          { key: 'role', label: 'Role', render: (r) => String(r.role) },
          { key: 'department', label: 'Dept', render: (r) => String(r.department || '—') },
          { key: 'phone', label: 'Phone', render: (r) => String(r.phone || '—') },
          { key: 'act', label: '', render: (r) => (
            <button type="button" className="btn btn-secondary !py-1" onClick={() => checkIn(Number(r.id))}>Check In</button>
          ) },
        ]} />
      )}

      {tab === 'roster' && (
        <div className="space-y-4">
          <div className="card grid md:grid-cols-4 gap-2">
            <select className="input" value={rForm.user_id} onChange={(e) => setRForm({ ...rForm, user_id: e.target.value })}>
              <option value="">Staff...</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <select className="input" value={rForm.shift} onChange={(e) => setRForm({ ...rForm, shift: e.target.value })}>
              <option value="morning">Morning</option><option value="evening">Evening</option><option value="night">Night</option>
            </select>
            <input className="input" placeholder="Department" value={rForm.department} onChange={(e) => setRForm({ ...rForm, department: e.target.value })} />
            <button type="button" className="btn btn-primary" onClick={addRoster}>Add</button>
          </div>
          <DataTable rows={roster} columns={[
            { key: 'user_id', label: 'Staff', render: (r) => String(r.user_id) },
            { key: 'work_date', label: 'Date', render: (r) => String(r.work_date) },
            { key: 'shift', label: 'Shift', render: (r) => String(r.shift) },
            { key: 'department', label: 'Dept', render: (r) => String(r.department) },
          ]} />
        </div>
      )}

      {tab === 'commissions' && (
        <DataTable rows={commissions} columns={[
          { key: 'user_id', label: 'User', render: (r) => String(r.user_id) },
          { key: 'amount', label: 'Amount', render: (r) => String(r.amount) },
          { key: 'kind', label: 'Kind', render: (r) => String(r.kind) },
          { key: 'date', label: 'Date', render: (r) => formatDate(String(r.created_at)) },
        ]} />
      )}

      {tab === 'audit' && (
        <DataTable rows={audit} columns={[
          { key: 'action', label: 'Action', render: (r) => String(r.action) },
          { key: 'entity', label: 'Entity', render: (r) => String(r.entity) },
          { key: 'detail', label: 'Detail', render: (r) => String(r.detail) },
          { key: 'date', label: 'Date', render: (r) => formatDate(String(r.created_at)) },
        ]} />
      )}
    </div>
  )
}
