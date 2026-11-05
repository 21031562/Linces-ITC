import { BookOpenCheck, Briefcase, CalendarDays, ClipboardList, GraduationCap, LayoutDashboard, LogOut, Send } from 'lucide-react'
import { createContext, useContext, type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { api, type ApiError } from '../lib/api'
import { nombreCompleto, nombrePila } from '../lib/format'
import type { Perfil } from '../lib/types'
import { useApi } from '../lib/useApi'
import { Logo } from './Logo'

interface PerfilCtx {
  perfil: Perfil | null
  loading: boolean
  error: ApiError | null
  reload: () => void
}
const PerfilContext = createContext<PerfilCtx>({ perfil: null, loading: true, error: null, reload: () => {} })
export const usePerfil = () => useContext(PerfilContext)

const NAV = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/calificaciones', label: 'Calificaciones', icon: ClipboardList },
  { to: '/kardex', label: 'Kardex', icon: BookOpenCheck },
  { to: '/horario', label: 'Horario', icon: CalendarDays },
  { to: '/bolsa', label: 'Bolsa', icon: Briefcase, largo: 'Servicio social y residencias' },
  { to: '/postulaciones', label: 'Postulaciones', icon: Send, largo: 'Mis postulaciones' },
]

export function Avatar({ perfil, size = 40 }: { perfil: Perfil | null; size?: number }) {
  if (perfil?.foto) return <img className="avatar" src={perfil.foto} alt="" width={size} height={size} />
  const ini = perfil ? nombrePila(perfil.nombre).charAt(0) : '·'
  return (
    <span className="avatar placeholder" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
      {ini}
    </span>
  )
}

export function AppLayout() {
  const { logout } = useAuth()
  const { data, loading, error, reload } = useApi(() => api.get<Perfil>('/estudiante'))
  const nombre = data ? nombreCompleto(data.nombre) : error ? 'Sin datos del SII' : 'Cargando…'

  return (
    <PerfilContext.Provider value={{ perfil: data, loading, error, reload }}>
      <div className="shell">
        <header className="topbar">
          <div className="topbar-inner">
            <Link to="/dashboard" className="topbar-brand" aria-label="Linces ITC, ir al inicio">
              <Logo />
            </Link>
            <nav className="topnav" aria-label="Secciones">
              {NAV.map(({ to, label, largo, icon: Icon }) => (
                <NavLink key={to} to={to} className="nav-item" title={largo ?? label}>
                  <Icon size={18} aria-hidden />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="topbar-user">
              <Avatar perfil={data} size={36} />
              <div className="who-text">
                <strong>{nombre}</strong>
                <span>{data?.numeroControl ?? ''}</span>
              </div>
              <button className="btn ghost on-dark sm" onClick={() => void logout()} aria-label="Cerrar sesión">
                <LogOut size={16} /> <span className="hide-sm">Salir</span>
              </button>
            </div>
          </div>
        </header>
        <main className="main" id="contenido">
          <Outlet />
        </main>
      </div>
    </PerfilContext.Provider>
  )
}

export function PageHeader({ titulo, children, icon }: { titulo: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>
          {icon}
          {titulo}
        </h1>
        {children && <div className="page-sub">{children}</div>}
      </div>
    </header>
  )
}

export const GradIcon = GraduationCap
