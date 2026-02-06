import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-primary-900 flex">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12">
        <div className="max-w-md text-center">
          {/* Logo */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-accent-400 rounded-2xl mb-6">
              <span className="text-primary-900 font-bold text-4xl">DL</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">DOS LAREDOS</h1>
            <p className="text-accent-400 text-lg tracking-widest">DISTRIBUIDORA</p>
          </div>

          <p className="text-white/70 text-lg">
            Sistema de gestión de almacén con trazabilidad completa
          </p>
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white lg:rounded-l-3xl">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-900 rounded-xl mb-4">
              <span className="text-accent-400 font-bold text-2xl">DL</span>
            </div>
            <h1 className="text-2xl font-bold text-primary-900">DOS LAREDOS</h1>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  )
}
