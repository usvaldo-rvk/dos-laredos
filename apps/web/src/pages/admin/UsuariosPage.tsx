import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Users } from 'lucide-react'

export default function UsuariosPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="btn-ghost p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
            <p className="text-gray-600">Gestión de usuarios del sistema</p>
          </div>
        </div>
        <button className="btn-primary">
          <Plus size={20} />
          Nuevo Usuario
        </button>
      </div>

      {/* Placeholder */}
      <div className="card p-12 text-center">
        <Users className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Gestión de Usuarios</h3>
        <p className="text-gray-500">
          Esta sección está en desarrollo. Aquí podrás crear, editar y gestionar los usuarios del sistema.
        </p>
      </div>
    </div>
  )
}
