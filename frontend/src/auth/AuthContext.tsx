import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, api } from '../lib/api'

interface SessionInfo {
  numeroControl: string
  expiraEn: string
}

interface AuthState {
  status: 'loading' | 'auth' | 'anon'
  session: SessionInfo | null
  /** Por qué no hay sesión (se muestra en el login) */
  motivo: string | null
  login: (email: string, password: string) => Promise<void>
  /** Cierra sesión en el servidor y regresa al login mostrando el motivo */
  logout: (motivo?: string) => Promise<void>
  refresh: () => Promise<boolean>
}

const Ctx = createContext<AuthState | null>(null)

// Debe coincidir con SESSION_IDLE_MINUTES del BFF
const IDLE_MS = 20 * 60_000
const EVENTOS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const

// Canal entre pestañas del mismo navegador: un logout o un cambio de cuenta se refleja en todas
type MensajeSesion = { tipo: 'logout' } | { tipo: 'login'; numeroControl: string }
const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('linces-sesion') : null

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [motivo, setMotivo] = useState<string | null>(null)
    const actual = useRef<string | null>(null) // número de control de esta pestaña

  // RequireAuth se encarga de llevar al login con este motivo
  const salirLocal = useCallback((m: string) => {
    actual.current = null
    setMotivo(m)
    setSession(null)
    setStatus('anon')
  }, [])

  const refresh = useCallback(async () => {
    try {
      const s = await api.get<SessionInfo>('/auth/session')
      // Si en otra pestaña entraron con otra cuenta, esta pestaña no debe seguir mostrando datos ajenos
      if (actual.current && actual.current !== s.numeroControl) {
        window.location.assign('/dashboard')
        return true
      }
      actual.current = s.numeroControl
      setMotivo(null)
      setSession(s)
      setStatus('auth')
      return true
    } catch (e) {
      salirLocal(e instanceof ApiError && e.isAuth ? e.code : 'NO_SESSION')
      return false
    }
  }, [salirLocal])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(
    async (email: string, password: string) => {
      await api.post('/auth/login', { email, password })
      await refresh()
      if (actual.current) canal?.postMessage({ tipo: 'login', numeroControl: actual.current } satisfies MensajeSesion)
    },
    [refresh],
  )

  const logout = useCallback(
    async (motivo = 'LOGOUT') => {
      await api.post('/auth/logout').catch(() => {})
      canal?.postMessage({ tipo: 'logout' } satisfies MensajeSesion)
      salirLocal(motivo)
    },
    [salirLocal],
  )

  // Avisos de otras pestañas
  useEffect(() => {
    if (!canal) return
    const onMsg = (e: MessageEvent<MensajeSesion>) => {
      if (e.data.tipo === 'logout' && actual.current) salirLocal('OTRA_PESTANA')
      if (e.data.tipo === 'login') {
        if (actual.current && actual.current !== e.data.numeroControl) {
          // Otra cuenta: recargar para no mezclar datos de dos alumnos
          window.location.assign('/dashboard')
        } else if (!actual.current) {
          void refresh()
        }
      }
    }
    canal.addEventListener('message', onMsg)
    return () => canal.removeEventListener('message', onMsg)
  }, [salirLocal, refresh])

  // Al volver a la pestaña se revalida contra el servidor (cubre sesiones cerradas desde otro dispositivo)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && actual.current) void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refresh])

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

  return <Ctx.Provider value={{ status, session, motivo, login, logout, refresh }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fuera de AuthProvider')
  return c
}
