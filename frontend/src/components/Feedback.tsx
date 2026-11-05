import { AlertTriangle, CloudOff, LogIn, RotateCw, ShieldAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'

export function Spinner({ size = 20 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Cargando" />
}

export function FullScreenLoader({ texto }: { texto: string }) {
  return (
    <div className="fullscreen-loader">
      <Spinner size={32} />
      <p>{texto}…</p>
    </div>
  )
}

/** Bloques grises que imitan el contenido mientras carga */
export function Skeleton({ h = 16, w = '100%', r = 6 }: { h?: number; w?: number | string; r?: number }) {
  return <span className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden />
}

export function SkeletonRows({ n = 6 }: { n?: number }) {
  return (
    <div className="skeleton-rows" aria-busy="true" aria-label="Cargando datos">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} h={44} w={`${100 - (i % 3) * 6}%`} />
      ))}
    </div>
  )
}

/**
 * Error claro y accionable. Si la sesión dejó de ser válida, lo explica y
 * regresa al login automáticamente tras unos segundos.
 */
export function ErrorState({ error, onRetry, onAuthLost }: { error: ApiError; onRetry?: () => void; onAuthLost?: (code: string) => void }) {
  const auth = useAuth()
  const logout = onAuthLost ?? ((code: string) => void auth.logout(code))
  const [seg, setSeg] = useState(6)

  useEffect(() => {
    if (!error.isAuth) return
    if (seg <= 0) {
      void logout(error.code)
      return
    }
    const t = window.setTimeout(() => setSeg((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [error, seg, logout])

  const Icon = error.isAuth ? ShieldAlert : error.code === 'NETWORK' || error.status >= 502 ? CloudOff : AlertTriangle
  const tituloErr = error.isAuth
    ? 'Tu sesión ya no es válida'
    : error.code === 'SII_UNAVAILABLE'
      ? 'El SII no responde'
      : 'No pudimos cargar esta información'

  return (
    <div className={`error-state ${error.isAuth ? 'auth' : ''}`} role="alert">
      <Icon size={28} aria-hidden />
      <div>
        <h3>{tituloErr}</h3>
        <p>{error.message}</p>
        {error.isAuth && <p className="muted">Te llevaremos al inicio de sesión en {seg} s.</p>}
        <div className="row gap-s">
          {error.isAuth ? (
            <button className="btn primary" onClick={() => void logout(error.code)}>
              <LogIn size={16} /> Iniciar sesión de nuevo
            </button>
          ) : (
            onRetry && (
              <button className="btn" onClick={onRetry}>
                <RotateCw size={16} /> Reintentar
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export function Empty({ icon, titulo, children }: { icon: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <h3>{titulo}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  )
}
