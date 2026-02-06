import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Search,
  Plus,
  Truck,
  Loader2,
  RefreshCw,
  ChevronRight,
  Phone,
  Mail
} from 'lucide-react'
import { proveedoresApi } from '../../services/api'

export default function ProveedoresPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['proveedores', search],
    queryFn: () => proveedoresApi.list({ search: search || undefined })
  })

  const proveedores = data?.data || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-gray-600">Gestiona tus distribuidores y proveedores</p>
        </div>
        <Link to="/proveedores/nuevo" className="btn-primary">
          <Plus size={20} />
          Nuevo Proveedor
        </Link>
      </div>

      {/* Búsqueda */}
      <div className="card p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              className="input pl-10"
              placeholder="Buscar por nombre, código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => refetch()} className="btn-ghost p-2">
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-accent-500" size={40} />
        </div>
      ) : proveedores.length === 0 ? (
        <div className="card p-12 text-center">
          <Truck size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-500">No hay proveedores</h3>
          <p className="text-gray-400 mb-4">Registra tu primer proveedor para comenzar</p>
          <Link to="/proveedores/nuevo" className="btn-primary inline-flex">
            <Plus size={20} />
            Nuevo Proveedor
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {proveedores.map((proveedor: any) => (
            <Link
              key={proveedor.id}
              to={`/proveedores/${proveedor.id}`}
              className="card p-6 hover:border-accent-400 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-accent-100 rounded-full flex items-center justify-center">
                    <Truck size={24} className="text-accent-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{proveedor.nombre}</h3>
                    <p className="text-gray-500 font-mono text-sm">{proveedor.codigo}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {proveedor.telefono && (
                    <div className="hidden sm:flex items-center gap-2 text-gray-500">
                      <Phone size={16} />
                      <span>{proveedor.telefono}</span>
                    </div>
                  )}
                  {proveedor.email && (
                    <div className="hidden md:flex items-center gap-2 text-gray-500">
                      <Mail size={16} />
                      <span>{proveedor.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-center">
                    <div>
                      <p className="text-xl font-bold text-accent-600">
                        {proveedor._count?.productosProveedor || 0}
                      </p>
                      <p className="text-xs text-gray-500">Productos</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">
                        {proveedor._count?.tarimas || 0}
                      </p>
                      <p className="text-xs text-gray-500">Tarimas</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-400" />
                </div>
              </div>

              {proveedor.contacto && (
                <p className="mt-3 text-sm text-gray-500">
                  Contacto: {proveedor.contacto}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
