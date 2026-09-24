import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const api = axios.create({ baseURL: '/api/v1' })

export type UserSession = {
  access_token: string
  refresh_token: string
  user_id: number
  role: string
  home: string
  full_name: string
  branch_id: number | null
  allowed_counters?: string[]
  allowed_features?: string[]
  extra_permissions?: string[]
  effective_permissions?: string[]
}

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean }

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

export function saveSession(data: UserSession) {
  localStorage.setItem('token', data.access_token)
  localStorage.setItem('refresh_token', data.refresh_token)
  localStorage.setItem('session', JSON.stringify(data))
}

export function clearAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('session')
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined
    const status = error.response?.status
    const url = config?.url || ''

    if (status !== 401 || !config || url.includes('/auth/login') || url.includes('/auth/refresh')) {
      return Promise.reject(error)
    }

    if (config._retried) {
      clearAuth()
      onUnauthorized?.()
      return Promise.reject(error)
    }

    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      clearAuth()
      onUnauthorized?.()
      return Promise.reject(error)
    }

    config._retried = true
    try {
      const { data } = await axios.post<UserSession>('/api/v1/auth/refresh', {
        refresh_token: refreshToken,
      })
      saveSession(data)
      config.headers.Authorization = `Bearer ${data.access_token}`
      return api(config)
    } catch {
      clearAuth()
      onUnauthorized?.()
      return Promise.reject(error)
    }
  },
)

export default api

export function getApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
    if (detail && typeof detail === 'object') return JSON.stringify(detail)
    return err.message
  }
  return 'Something went wrong'
}

export async function login(username: string, password: string) {
  const body = new URLSearchParams({ username, password })
  const { data } = await api.post<UserSession>('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  saveSession(data)
  return data
}

export function getSession(): UserSession | null {
  const token = localStorage.getItem('token')
  const raw = localStorage.getItem('session')
  if (!token || !raw) {
    if (token || raw) clearAuth()
    return null
  }
  try {
    return JSON.parse(raw) as UserSession
  } catch {
    clearAuth()
    return null
  }
}

export function logout() {
  clearAuth()
}
