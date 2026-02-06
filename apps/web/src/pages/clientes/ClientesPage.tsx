import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Users, RefreshCw } from 'lucide-react'
import { clientesApi } from '../../services/api'

export default function ClientesPage() {
  const [busqueda, setBusqueda] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clientes', busqueda],
    queryFn: () => clientesApi.list({ search: busqueda || undefined })
  })

  const clientes = data?.data || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600">Base de datos de clientes</p>
        </div>
        <Link to="/clientes/nuevo" className="btn-primary">
          <Plus size={20} />
          Nuevo Cliente
        </Link>
      </div>

      {/* Búsqueda */}
      <div className="card p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre, empresa o teléfono..."
              className="input pl-10"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <button onClick={() => refetch()} className="btn-ghost p-2" title="Refrescar">
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : clientes.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay clientes que mostrar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Ciudad</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente: any) => (
                  <tr key={cliente.id}>
                    <td>
                      <Link
                        to={`/clientes/${cliente.id}`}
                        className="text-accent-600 hover:text-accent-700"
                      >
                        <p className="font-medium">
                          {cliente.nombreEmpresa || cliente.nombreContacto}
                        </p>
                        {cliente.nombreEmpresa && (
                          <p className="text-sm text-gray-500">{cliente.nombreContacto}</p>
                        )}
                      </Link>
                    </td>
                    <td>{cliente.telefono}</td>
                    <td>{cliente.direccionCiudad || '-'}</td>
                    <td>
                      <span className={`badge ${cliente.tipo === 'EMPRESA' ? 'badge-info' : 'badge-neutral'}`}>
                        {cliente.tipo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
