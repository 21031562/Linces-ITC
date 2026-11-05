import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthContext'
import { FullScreenLoader } from '../components/Feedback'

/** Ruta privada: sin sesión válida (inexistente o expirada) regresa al login. */
export function RequireAuth() {
  const { status, motivo } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullScreenLoader texto="Verificando tu sesión" />
  if (status === 'anon') return <Navigate to="/login" replace state={{ motivo: motivo ?? 'NO_SESSION', desde: location.pathname }} />
  return <Outlet />
}

export function RedirectIfAuth() {
  const { status } = useAuth()
  if (status === 'loading') return <FullScreenLoader texto="Verificando tu sesión" />
  if (status === 'auth') return <Navigate to="/dashboard" replace />
  return <Outlet />
}
