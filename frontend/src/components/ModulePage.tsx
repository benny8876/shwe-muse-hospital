import { type FormEvent, useEffect, useState } from 'react'
import api, { getApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'
import DataTable, { type Column } from './DataTable'
import PageHeader from './PageHeader'
import StatusBadge from './StatusBadge'
import PatientSelect from './PatientSelect'
import Alert from './Alert'
import { formatDate, formatMoney } from '../lib/format'

type Field = { name: string; label: string; type?: string; placeholder?: string; kind?: 'text' | 'patient' | 'select'; options?: string[] }

type Props = {
  title: string
  subtitle?: string
  endpoint: string
  columns: Column<Record<string, unknown>>[]
  fields?: Field[]
  createPath?: string
  createParams?: Record<string, unknown>
  transformRows?: (data: unknown) => Record<string, unknown>[]
  emptyText?: string
}

export default function ModulePage({
  title,
  subtitle,
  endpoint,
  columns,
  fields = [],
  createPath,
  createParams = {},
  transformRows,
  emptyText,
}: Props) {
  const { session } = useAuth()
  const toast = useToast()
  const branchId = session?.branch_id || 1
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get(endpoint, { params: { branch_id: branchId } })
      setRows(transformRows ? transformRows(data) : Array.isArray(data) ? data : data ? [data as Record<string, unknown>] : [])
    } catch (err) {
      setError(getApiError(err))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [endpoint, branchId])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = { branch_id: branchId, ...createParams }
      for (const field of fields) {
        const raw = form[field.name]
        if (!raw && field.kind === 'patient') {
          throw new Error('Please select a patient')
        }
        if (raw) {
          body[field.name] = field.name.endsWith('_id') || field.kind === 'patient' ? Number(raw) : raw
        }
      }
      await api.post(createPath || endpoint, body)
      setForm({})
      toast.success('Saved successfully')
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : getApiError(err)
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle={subtitle} />

      {fields.length > 0 && (
        <form onSubmit={onCreate} className="card grid md:grid-cols-4 gap-3">
          {fields.map((f) => (
            <label key={f.name} className="block">
              <span className="text-xs font-medium text-slate-600">{f.label}</span>
              {f.kind === 'patient' ? (
                <PatientSelect className="input mt-1" value={form[f.name] || ''} onChange={(v) => setForm({ ...form, [f.name]: v })} />
              ) : f.kind === 'select' ? (
                <select className="input mt-1" value={form[f.name] || ''} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                  <option value="">Select...</option>
                  {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type || 'text'}
                  className="input mt-1"
                  placeholder={f.placeholder || f.label}
                  value={form[f.name] || ''}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              )}
            </label>
          ))}
          <div className="flex items-end">
            <button type="submit" disabled={saving} className="btn btn-primary w-full disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      {loading ? <div className="card py-10 text-center text-slate-500">Loading...</div> : (
        <DataTable columns={columns} rows={rows} emptyText={emptyText} />
      )}
    </div>
  )
}

export const col = {
  text: (key: string, label: string): Column<Record<string, unknown>> => ({ key, label, render: (r) => String(r[key] ?? '—') }),
  money: (key: string, label: string): Column<Record<string, unknown>> => ({ key, label, render: (r) => formatMoney(Number(r[key] || 0)) }),
  date: (key: string, label: string): Column<Record<string, unknown>> => ({ key, label, render: (r) => formatDate(String(r[key] || '')) }),
  status: (key: string, label: string): Column<Record<string, unknown>> => ({ key, label, render: (r) => <StatusBadge value={String(r[key] || '')} /> }),
}
