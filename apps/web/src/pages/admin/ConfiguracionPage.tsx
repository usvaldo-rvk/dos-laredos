import { Link } from 'react-router-dom'
import { ArrowLeft, Settings } from 'lucide-react'

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin" className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-600">Configuración general del sistema</p>
        </div>
      </div>

      {/* Placeholder */}
      <div className="card p-12 text-center">
        <Settings className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Configuración del Sistema</h3>
        <p className="text-gray-500">
          Esta sección está en desarrollo. Aquí podrás configurar parámetros generales del sistema.
        </p>
      </div>
    </div>
  )
}
