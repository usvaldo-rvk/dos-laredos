import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'

// Layouts
import MainLayout from './components/ui/MainLayout'
import AuthLayout from './components/ui/AuthLayout'

// Pages
import LoginPage from './pages/auth/LoginPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import TarimasPage from './pages/tarimas/TarimasPage'
import TarimaDetallePage from './pages/tarimas/TarimaDetallePage'
import NuevaTarimaPage from './pages/tarimas/NuevaTarimaPage'
import PedidosPage from './pages/pedidos/PedidosPage'
import PedidoDetallePage from './pages/pedidos/PedidoDetallePage'
import NuevoPedidoPage from './pages/pedidos/NuevoPedidoPage'
import PickingPage from './pages/picking/PickingPage'
import ClientesPage from './pages/clientes/ClientesPage'
import ClienteFormPage from './pages/clientes/ClienteFormPage'
import ClienteDetallePage from './pages/clientes/ClienteDetallePage'
import ReportesPage from './pages/reportes/ReportesPage'
import AdminPage from './pages/admin/AdminPage'
import UsuariosPage from './pages/admin/UsuariosPage'
import ConfiguracionPage from './pages/admin/ConfiguracionPage'
import TvPedidosPage from './pages/tv/TvPedidosPage'
import PerfilPage from './pages/perfil/PerfilPage'
import ProductosPage from './pages/productos/ProductosPage'
import ProductoFormPage from './pages/productos/ProductoFormPage'
import ProveedoresPage from './pages/proveedores/ProveedoresPage'
import ProveedorFormPage from './pages/proveedores/ProveedorFormPage'
import CreditosPage from './pages/creditos/CreditosPage'
import CreditoDetallePage from './pages/creditos/CreditoDetallePage'

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Admin Route wrapper
function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)

  if (user?.rol !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* TV route - sin layout */}
      <Route path="/tv/pedidos/:token" element={<TvPedidosPage />} />

      {/* Protected routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Tarimas */}
        <Route path="/tarimas" element={<TarimasPage />} />
        <Route path="/tarimas/nueva" element={<NuevaTarimaPage />} />
        <Route path="/tarimas/:id" element={<TarimaDetallePage />} />

        {/* Pedidos */}
        <Route path="/pedidos" element={<PedidosPage />} />
        <Route path="/pedidos/nuevo" element={<NuevoPedidoPage />} />
        <Route path="/pedidos/:id" element={<PedidoDetallePage />} />

        {/* Picking */}
        <Route path="/picking" element={<PickingPage />} />

        {/* Clientes */}
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/clientes/nuevo" element={<ClienteFormPage />} />
        <Route path="/clientes/:id" element={<ClienteDetallePage />} />
        <Route path="/clientes/:id/editar" element={<ClienteFormPage />} />

        {/* Productos */}
        <Route path="/productos" element={<ProductosPage />} />
        <Route path="/productos/nuevo" element={<ProductoFormPage />} />
        <Route path="/productos/:id" element={<ProductoFormPage />} />

        {/* Proveedores */}
        <Route path="/proveedores" element={<ProveedoresPage />} />
        <Route path="/proveedores/nuevo" element={<ProveedorFormPage />} />
        <Route path="/proveedores/:id" element={<ProveedorFormPage />} />

        {/* Créditos */}
        <Route path="/creditos" element={<CreditosPage />} />
        <Route path="/creditos/:id" element={<CreditoDetallePage />} />

        {/* Reportes */}
        <Route path="/reportes" element={<ReportesPage />} />

        {/* Perfil */}
        <Route path="/perfil" element={<PerfilPage />} />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <AdminRoute>
              <UsuariosPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/configuracion"
          element={
            <AdminRoute>
              <ConfiguracionPage />
            </AdminRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App
