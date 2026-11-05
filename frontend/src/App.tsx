import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RedirectIfAuth, RequireAuth } from './auth/RequireAuth'
import { FullScreenLoader } from './components/Feedback'
import { NotFound } from './components/NotFound'
import { AppLayout } from './components/Layout'
import Bolsa from './pages/Bolsa'
import Calificaciones from './pages/Calificaciones'
import Dashboard from './pages/Dashboard'
import Horario from './pages/Horario'
import Kardex from './pages/Kardex'
import Login from './pages/Login'
import MisPostulaciones from './pages/MisPostulaciones'

// El panel de administración se descarga aparte: los alumnos no lo cargan
const AdminApp = lazy(() => import('./admin/AdminApp'))

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<RedirectIfAuth />}>
        <Route path="/login" element={<Login />} />
      </Route>
      {/* Rutas privadas: requieren sesión válida */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calificaciones" element={<Calificaciones />} />
          <Route path="/kardex" element={<Kardex />} />
          <Route path="/horario" element={<Horario />} />
          <Route path="/bolsa" element={<Bolsa />} />
          <Route path="/postulaciones" element={<MisPostulaciones />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<FullScreenLoader texto="Cargando panel" />}>
            <AdminApp />
          </Suspense>
        }
      />
    </Routes>
  )
}
