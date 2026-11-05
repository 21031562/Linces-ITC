import { AlertTriangle, Info, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Spinner } from '../components/Feedback'
import { Logo } from '../components/Logo'
import { ApiError } from '../lib/api'
import { useAdmin } from './AdminAuth'

export default function AdminLogin() {
  const { login, status } = useAdmin()
  const navigate = useNavigate()
  const motivo = (useLocation().state as { motivo?: string } | null)?.motivo
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (status === 'auth') return <Navigate to="/admin" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setErr('Escribe tu correo y contraseña.')
      return
    }
    setErr(null)
    setEnviando(true)
    try {
      await login(email.trim(), password)
      navigate('/admin', { replace: true })
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'No se pudo iniciar sesión.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="admin-login">
      <form className="login-form card-form" onSubmit={onSubmit} noValidate>
        <Logo sub="Administración de la bolsa" />
        <h1>
          <ShieldCheck size={24} aria-hidden /> Acceso para coordinadores
        </h1>
        <p className="muted">Cuenta de administración de Linces. No es tu cuenta del SII.</p>
        {motivo && !err && (
          <div className="notice info">
            <Info size={18} aria-hidden /> {motivo === 'LOGOUT' ? 'Cerraste sesión.' : 'Tu sesión expiró. Vuelve a entrar.'}
          </div>
        )}
        {err && (
          <div className="notice error" role="alert">
            <AlertTriangle size={18} aria-hidden /> {err}
          </div>
        )}
        <label className="field">
          <span>Correo</span>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn primary block lg" disabled={enviando}>
          {enviando ? <Spinner size={18} /> : 'Entrar al panel'}
        </button>
        <Link to="/login" className="link center">
          Soy estudiante
        </Link>
      </form>
    </div>
  )
}
