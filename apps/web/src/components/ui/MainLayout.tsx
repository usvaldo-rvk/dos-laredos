import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ScanLine,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronDown,
  Boxes,
  Truck,
  CreditCard
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tarimas', href: '/tarimas', icon: Package },
  { name: 'Pedidos', href: '/pedidos', icon: ClipboardList },
  { name: 'Picking', href: '/picking', icon: ScanLine },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Créditos', href: '/creditos', icon: CreditCard },
  { name: 'Productos', href: '/productos', icon: Boxes },
  { name: 'Proveedores', href: '/proveedores', icon: Truck },
  { name: 'Reportes', href: '/reportes', icon: BarChart3 }
]

const adminNavigation = [
  { name: 'Administración', href: '/admin', icon: Settings }
]

export default function MainLayout() {
  const navigate = useNavigate()
  const { user, almacenActivo, setAlmacenActivo, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [almacenMenuOpen, setAlmacenMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-primary-900 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-400 rounded-lg flex items-center justify-center">
              <span className="text-primary-900 font-bold text-lg">DL</span>
            </div>
            <div>
              <h1 className="text-white font-semibold">DOS LAREDOS</h1>
              <p className="text-white/60 text-xs">Sistema WMS</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/60 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Selector de almacén */}
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <button
              onClick={() => setAlmacenMenuOpen(!almacenMenuOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition"
            >
              <span className="text-sm">{almacenActivo?.nombre || 'Seleccionar almacén'}</span>
              <ChevronDown size={16} />
            </button>

            {almacenMenuOpen && user?.almacenes && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg overflow-hidden z-10">
                {user.almacenes.map((almacen) => (
                  <button
                    key={almacen.id}
                    onClick={() => {
                      setAlmacenActivo(almacen)
                      setAlmacenMenuOpen(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                      almacenActivo?.id === almacen.id ? 'bg-accent-50 text-accent-600' : 'text-gray-700'
                    }`}
                  >
                    {almacen.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                  isActive
                    ? 'bg-accent-400 text-primary-900'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          ))}

          {user?.rol === 'ADMIN' && (
            <>
              <div className="pt-4 mt-4 border-t border-white/10">
                {adminNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                        isActive
                          ? 'bg-accent-400 text-primary-900'
                          : 'text-white/70 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <item.icon size={20} />
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            </>
          )}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <Link
              to="/perfil"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition"
            >
              <div className="w-8 h-8 bg-accent-400 rounded-full flex items-center justify-center">
                <span className="text-primary-900 font-medium text-sm">
                  {user?.nombre?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.nombre}</p>
                <p className="text-white/60 text-xs">{user?.rol}</p>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="text-white/60 hover:text-white transition"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu size={24} />
            </button>

            <div className="flex-1" />

            {/* Notifications */}
            <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
