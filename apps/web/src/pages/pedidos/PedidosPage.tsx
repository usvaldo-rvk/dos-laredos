import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, ClipboardList } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { pedidosApi } from '../../services/api'

const estadoColors: Record<string, string> = {
  CREADO: 'badge-info',
  ENVIADO_BODEGA: 'badge-success',
  EN_REVISION: 'badge-warning',
  COMPLETADO: 'bg-green-200 text-green-900',
  CANCELADO: 'badge-danger'
}

export default function PedidosPage() {
  const { almacenActivo } = useAuthStore()
  const [filtroEstado, setFiltroEstado] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['pedidos', almacenActivo?.id, filtroEstado],
    queryFn: () => pedidosApi.list({
      almacenId: almacenActivo?.id,
      estado: filtroEstado || undefined
    })
  })

  const pedidos = data?.data || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-600">Gestión de pedidos en {almacenActivo?.nombre}</p>
        </div>
        <Link to="/pedidos/nuevo" className="btn-primary">
          <Plus size={20} />
          Nuevo Pedido
        </Link>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <select
          className="input w-full sm:w-48"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="CREADO">Creado</option>
          <option value="ENVIADO_BODEGA">Enviado a Bodega</option>
          <option value="EN_REVISION">En Revisión</option>
          <option value="COMPLETADO">Completado</option>
          <option value="CANCELADO">Cancelado</option>
        </select>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : pedidos.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay pedidos que mostrar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Líneas</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((pedido: any) => (
                  <tr key={pedido.id}>
                    <td>
                      <Link
                        to={`/pedidos/${pedido.id}`}
                        className="font-mono text-accent-600 hover:text-accent-700"
                      >
                        {pedido.numeroPedido}
                      </Link>
                    </td>
                    <td>
                      <p className="font-medium">
                        {pedido.cliente.nombreEmpresa || pedido.cliente.nombreContacto}
                      </p>
                    </td>
                    <td>{pedido.lineas?.length || 0} productos</td>
                    <td>
                      <span className={`badge ${estadoColors[pedido.estado]}`}>
                        {pedido.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-gray-500">
                      {new Date(pedido.createdAt).toLocaleDateString()}
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
