import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Search,
  Plus,
  Package,
  Loader2,
  Filter,
  RefreshCw,
  ChevronRight,
  DollarSign,
  AlertCircle
} from 'lucide-react'
import { productosApi } from '../../services/api'

const tipoEnvaseLabels: Record<string, string> = {
  LATA: 'Lata',
  BOTELLA: 'Botella',
  OTRO: 'Otro'
}

export default function ProductosPage() {
  const [search, setSearch] = useState('')
  const [filtroRetornable, setFiltroRetornable] = useState<string>('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['productos', search, filtroRetornable],
    queryFn: () => productosApi.list({
      search: search || undefined,
      esRetornable: filtroRetornable ? filtroRetornable === 'true' : undefined
    })
  })

  const productos = data?.data || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600">Gestiona el catálogo de productos</p>
        </div>
        <Link to="/productos/nuevo" className="btn-primary">
          <Plus size={20} />
          Nuevo Producto
        </Link>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              className="input pl-10"
              placeholder="Buscar por nombre, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-400" />
            <select
              className="input w-40"
              value={filtroRetornable}
              onChange={(e) => setFiltroRetornable(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="true">Retornables</option>
              <option value="false">No retornables</option>
            </select>
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
      ) : productos.length === 0 ? (
        <div className="card p-12 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-500">No hay productos</h3>
          <p className="text-gray-400 mb-4">Crea tu primer producto para comenzar</p>
          <Link to="/productos/nuevo" className="btn-primary inline-flex">
            <Plus size={20} />
            Nuevo Producto
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Presentación</th>
                  <th>Envase</th>
                  <th className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <DollarSign size={14} />
                      Precio Público
                    </span>
                  </th>
                  <th className="text-center">Retornable</th>
                  <th className="text-center">Proveedores</th>
                  <th className="text-center">Tarimas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {productos.map((producto: any) => {
                  const tienePrecio = producto.precioPublico && parseFloat(producto.precioPublico) > 0

                  return (
                    <tr key={producto.id} className="hover:bg-gray-50">
                      <td>
                        <div>
                          <p className="font-medium">{producto.nombre}</p>
                          <p className="text-sm text-gray-500 font-mono">{producto.sku}</p>
                        </div>
                      </td>
                      <td>
                        <p>{producto.presentacion}</p>
                        <p className="text-sm text-gray-500">{producto.unidadMedida}</p>
                      </td>
                      <td>
                        {producto.tipoEnvase ? (
                          <div>
                            <p>{tipoEnvaseLabels[producto.tipoEnvase] || producto.tipoEnvase}</p>
                            {producto.capacidadMl && (
                              <p className="text-sm text-gray-500">{producto.capacidadMl} ml</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="text-right">
                        {tienePrecio ? (
                          <span className="text-lg font-bold text-green-600">
                            ${parseFloat(producto.precioPublico).toFixed(2)}
                          </span>
                        ) : (
                          <span className="flex items-center justify-end gap-1 text-amber-500">
                            <AlertCircle size={14} />
                            <span className="text-sm">Sin precio</span>
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        {producto.esRetornable ? (
                          <span className="badge badge-info">
                            {producto.unidadesPorCarton ? `${producto.unidadesPorCarton} uds` : 'Sí'}
                          </span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="text-center">
                        <span className="font-medium">{producto.productosProveedor?.length || 0}</span>
                      </td>
                      <td className="text-center">
                        <span className="font-medium">{producto._count?.tarimas || 0}</span>
                      </td>
                      <td>
                        <Link
                          to={`/productos/${producto.id}`}
                          className="btn-ghost p-2"
                        >
                          <ChevronRight size={20} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
