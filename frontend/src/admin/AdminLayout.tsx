import { Building2, FileClock, Inbox, LayoutDashboard, ListChecks, LogOut } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { Logo } from '../components/Logo'
import { useAdmin } from './AdminAuth'

export function AdminLayout() {
  const { admin, logout } = useAdmin()
  const nav = [
    { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
    { to: '/admin/vacantes', label: 'Vacantes', icon: ListChecks },
    { to: '/admin/postulaciones', label: 'Postulaciones', icon: Inbox },
    { to: '/admin/organizaciones', label: 'Organizaciones', icon: Building2 },
    ...(admin?.rol === 'admin' ? [{ to: '/admin/bitacora', label: 'Bitácora', icon: FileClock }] : []),
  ]
  return (
    <div className="shell admin">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/admin" className="topbar-brand" aria-label="Panel de administración">
            <Logo sub="Administración" />
          </Link>
          <nav className="topnav" aria-label="Administración">
            {nav.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="nav-item">
                <Icon size={18} aria-hidden />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="topbar-user">
            <span className="avatar placeholder" style={{ width: 36, height: 36, fontSize: 15 }} aria-hidden>
              {admin?.nombre.charAt(0)}
            </span>
            <div className="who-text">
              <strong>{admin?.nombre}</strong>
              <span>{admin?.rol === 'admin' ? 'Administrador' : 'Revisor'}</span>
            </div>
            <button className="btn ghost on-dark sm" onClick={() => void logout()} aria-label="Cerrar sesión">
              <LogOut size={16} /> <span className="hide-sm">Salir</span>
            </button>
          </div>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
