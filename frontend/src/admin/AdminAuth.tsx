import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router'
import { FullScreenLoader } from '../components/Feedback'
import { adminApi } from '../lib/api'
import type { AdminUser } from '../lib/types'

interface Ctx {
  status: 'loading' | 'auth' | 'anon'
  admin: AdminUser | null
  login: (email: string, password: string) => Promise<void>
  logout: (motivo?: string) => Promise<void>
}
const AdminCtx = createContext<Ctx | null>(null)

/** Sesión del panel de administración: independiente de la sesión de alumno y del SII */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Ctx['status']>('loading')
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    adminApi
      .get<AdminUser>('/auth/me')
      .then((a) => {
        setAdmin(a)
        setStatus('auth')
      })
      .catch(() => setStatus('anon'))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const a = await adminApi.post<AdminUser>('/auth/login', { email, password })
    setAdmin(a)
    setStatus('auth')
  }, [])

  const logout = useCallback(
    async (motivo = 'LOGOUT') => {
      await adminApi.post('/auth/logout').catch(() => {})
      setAdmin(null)
      setStatus('anon')
      navigate('/admin/login', { replace: true, state: { motivo } })
    },
    [navigate],
  )

  return <AdminCtx.Provider value={{ status, admin, login, logout }}>{children}</AdminCtx.Provider>
}

export function useAdmin() {
  const c = useContext(AdminCtx)
  if (!c) throw new Error('useAdmin fuera de AdminAuthProvider')
  return c
}

export function RequireAdmin() {
  const { status } = useAdmin()
  if (status === 'loading') return <FullScreenLoader texto="Verificando acceso" />
  if (status === 'anon') return <Navigate to="/admin/login" replace />
  return <Outlet />
}
