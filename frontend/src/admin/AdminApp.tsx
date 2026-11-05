import { Route, Routes } from 'react-router'
import { NotFound } from '../components/NotFound'
import { AdminAuthProvider, RequireAdmin } from './AdminAuth'
import { AdminLayout } from './AdminLayout'
import AdminLogin from './AdminLogin'
import { AdminBitacora, AdminDashboard, AdminOrganizaciones, AdminPostulaciones, AdminVacantes } from './AdminPages'

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="vacantes" element={<AdminVacantes />} />
            <Route path="postulaciones" element={<AdminPostulaciones />} />
            <Route path="organizaciones" element={<AdminOrganizaciones />} />
            <Route path="bitacora" element={<AdminBitacora />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </AdminAuthProvider>
  )
}
