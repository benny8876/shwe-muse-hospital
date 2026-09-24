import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { clearAuth, getSession, login as apiLogin, logout as apiLogout, saveSession, setUnauthorizedHandler, type UserSession } from './api'

type AuthCtx = {
  session: UserSession | null
  login: (u: string, p: string) => Promise<UserSession>
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(() => getSession())
  const navigate = useNavigate()

  const logout = useCallback(() => {
    apiLogout()
    setSession(null)
    navigate('/login', { replace: true })
  }, [navigate])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuth()
      setSession(null)
      navigate('/login', { replace: true })
    })
  }, [navigate])

  const refreshSession = useCallback(async () => {
    const current = getSession()
    if (!current) {
      setSession(null)
      return
    }
    try {
      const { data } = await api.get('/auth/me')
      const merged = { ...current, ...data }
      saveSession(merged)
      setSession(merged)
    } catch {
      clearAuth()
      setSession(null)
    }
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const value = useMemo(
    () => ({
      session,
      login: async (u: string, p: string) => {
        const s = await apiLogin(u, p)
        try {
          const { data } = await api.get('/auth/me')
          const merged = { ...s, ...data }
          saveSession(merged)
          setSession(merged)
          return merged
        } catch {
          setSession(s)
          return s
        }
      },
      logout,
    }),
    [session, logout],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('AuthProvider missing')
  return ctx
}
