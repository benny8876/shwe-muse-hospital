import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { getApiError } from '../lib/api'
import { useToast } from '../lib/toast'
import Alert from '../components/Alert'

const QUICK_LOGINS = [
  { user: 'receptionist', label: '1 · Reception' },
  { user: 'pharmacy', label: '2 · Pharmacy' },
  { user: 'lab', label: '3 · Lab' },
  { user: 'xray', label: '4 · X-Ray' },
  { user: 'usg', label: '5 · USG' },
  { user: 'nurse', label: '6 · Nurse' },
  { user: 'warehouse', label: '7 · Store' },
  { user: 'cashier', label: '8 · Cashier' },
]

export default function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [username, setUsername] = useState('cashier')
  const [password, setPassword] = useState('ShweMuse@123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const s = await login(username, password)
      toast.success(`Welcome, ${s.full_name}`)
      nav('/counter')
    } catch (err) {
      const msg = getApiError(err) || 'Invalid login'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--surface-muted)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-4 justify-center">
          <div className="h-9 w-9 rounded-md flex items-center justify-center text-white font-bold" style={{ background: 'var(--brand-600)' }}>+</div>
          <div className="text-lg font-bold text-slate-800">{t('appName')}</div>
        </div>
        <form onSubmit={onSubmit} className="card">
          <h1 className="text-base font-semibold text-slate-800">Sign in</h1>
          <p className="text-sm text-slate-500 mb-4">Hospital POS / HMS</p>
          {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
          <label className="block mb-3">
            <span className="text-xs font-medium text-slate-600">{t('username')}</span>
            <input className="input mt-1" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="block mb-4">
            <span className="text-xs font-medium text-slate-600">{t('password')}</span>
            <input type="password" className="input mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" disabled={busy} className="btn btn-primary w-full">{busy ? '...' : t('login')}</button>
          <div className="mt-5 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-2">Quick demo login (password: ShweMuse@123 for all):</p>
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_LOGINS.map((q) => (
                <button
                  key={q.user}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setUsername(q.user); setPassword('ShweMuse@123') }}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Admin (all counters): <code>admin</code></p>
          </div>
        </form>
      </div>
    </div>
  )
}
