import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'

interface SessionInfo {
  numeroControl: string
  expiraEn: string
}

interface AuthState {
  status: 'loading' | 'auth' | 'anon'
  session: SessionInfo | null
  login: (email: string, password: string) => Promise<void>
  /** Cierra sesión en el servidor y regresa al login mostrando el motivo */
  logout: (motivo?: string) => Promise<void>
  refresh: () => Promise<boolean>
}

const Ctx = createContext<AuthState | null>(null)

// Debe coincidir con SESSION_IDLE_MINUTES del BFF
const IDLE_MS = 20 * 60_000
const EVENTOS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    try {
      const s = await api.get<SessionInfo>('/auth/session')
      setSession(s)
      setStatus('auth')
      return true
    } catch {
      setSession(null)
      setStatus('anon')
      return false
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(
    async (email: string, password: string) => {
      await api.post('/auth/login', { email, password })
      await refresh()
    },
    [refresh],
  )

  const logout = useCallback(
    async (motivo = 'LOGOUT') => {
      await api.post('/auth/logout').catch(() => {})
      setSession(null)
      setStatus('anon')
      navigate('/login', { replace: true, state: { motivo } })
    },
    [navigate],
  )

  // Cierre por inactividad y por vencimiento del token (también se valida en el servidor)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (status !== 'auth' || !session) return
    const reset = () => {
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void logout('SESSION_IDLE'), IDLE_MS)
    }
    reset()
    EVENTOS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    const msExp = new Date(session.expiraEn).getTime() - Date.now()
    const expTimer = window.setTimeout(() => void logout('SESSION_EXPIRED'), Math.max(msExp, 0))
    return () => {
      window.clearTimeout(timer.current)
      window.clearTimeout(expTimer)
      EVENTOS.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [status, session, logout])

  return <Ctx.Provider value={{ status, session, login, logout, refresh }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fuera de AuthProvider')
  return c
}
