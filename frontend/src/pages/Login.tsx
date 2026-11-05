import { AlertTriangle, CloudOff, Eye, EyeOff, Info, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { Logo } from '../components/Logo'
import { Spinner } from '../components/Feedback'
import { ApiError, AUTH_MESSAGES } from '../lib/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const motivo = (location.state as { motivo?: string; desde?: string } | null)?.motivo
  const desde = (location.state as { desde?: string } | null)?.desde

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ver, setVer] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [campos, setCampos] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState<ApiError | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const errs: typeof campos = {}
    if (!email.trim()) errs.email = 'Escribe tu correo institucional.'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'El correo no tiene un formato válido.'
    if (!password) errs.password = 'Escribe tu contraseña.'
    setCampos(errs)
    if (Object.keys(errs).length) return

    setEnviando(true)
    try {
      await login(email.trim(), password)
      navigate(desde && desde !== '/login' ? desde : '/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Ocurrió un error inesperado.'))
      setPassword('')
    } finally {
      setEnviando(false)
    }
  }

  const caido = error && ['SII_UNAVAILABLE', 'NETWORK', 'BACKEND_DOWN'].includes(error.code)

  return (
    <div className="login">
      <section className="login-art" aria-hidden>
        <Logo size={64} />
        <div className="login-art-body">
          <h2>Tu carrera completa, en un solo lugar.</h2>
          <p>Calificaciones, kardex y horario directo del SII, y las vacantes de servicio social y residencia para las que ya calificas.</p>
          <div className="login-rail">
            <div className="login-rail-fill" />
            <span className="izq" style={{ left: '70%' }}>Servicio social</span>
            <span style={{ left: '80%' }}>Residencia</span>
          </div>
        </div>
        <p className="login-art-foot">Proyecto académico. No es un sitio oficial del TecNM.</p>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={onSubmit} noValidate>
          <h1>Inicia sesión</h1>
          <p className="muted">Usa el mismo correo y contraseña que en el SII del Tec de Celaya.</p>

          {motivo && !error && (
            <div className={`notice ${motivo === 'LOGOUT' ? 'info' : 'warn'}`} role="status">
              <Info size={18} aria-hidden />
              <span>{AUTH_MESSAGES[motivo] ?? AUTH_MESSAGES.NO_SESSION}</span>
            </div>
          )}
          {error && (
            <div className={`notice ${caido ? 'warn' : 'error'}`} role="alert">
              {caido ? <CloudOff size={18} aria-hidden /> : <AlertTriangle size={18} aria-hidden />}
              <span>{error.message}</span>
            </div>
          )}

          <label className="field">
            <span>Correo institucional</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="l2103xxxx@celaya.tecnm.mx"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!campos.email}
              aria-describedby={campos.email ? 'err-email' : undefined}
              autoFocus
            />
            {campos.email && (
              <small className="field-error" id="err-email">
                {campos.email}
              </small>
            )}
          </label>

          <label className="field">
            <span>Contraseña</span>
            <div className="input-icon">
              <input
                type={ver ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!campos.password}
                aria-describedby={campos.password ? 'err-pass' : undefined}
              />
              <button type="button" className="icon-btn" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {ver ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {campos.password && (
              <small className="field-error" id="err-pass">
                {campos.password}
              </small>
            )}
          </label>

          <button className="btn primary block lg" disabled={enviando}>
            {enviando ? (
              <>
                <Spinner size={18} /> Conectando con el SII
              </>
            ) : (
              'Entrar'
            )}
          </button>

          <p className="login-secure">
            <Lock size={14} aria-hidden /> Linces reenvía tu contraseña al SII sin guardarla, y el token de acceso nunca llega a tu navegador.
          </p>
        </form>
      </section>
    </div>
  )
}
