import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, CreditCard, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { creditosApi } from '../../services/api'

export default function CreditosPage() {
  const [filtroEstado, setFiltroEstado] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['creditos', filtroEstado],
    queryFn: () => creditosApi.list({ estado: filtroEstado || undefined })
  })

  const { data: resumen } = useQuery({
    queryKey: ['creditos-resumen'],
    queryFn: () => creditosApi.resumenGeneral()
  })

  const creditos = data?.data || []

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(num || 0)
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE':
        return <span className="badge badge-warning flex items-center gap-1"><Clock size={14} /> Pendiente</span>
      case 'PARCIAL':
        return <span className="badge badge-info flex items-center gap-1"><AlertCircle size={14} /> Parcial</span>
      case 'PAGADO':
        return <span className="badge badge-success flex items-center gap-1"><CheckCircle size={14} /> Pagado</span>
      default:
        return <span className="badge">{estado}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Créditos</h1>
          <p className="text-gray-600">Gestión de créditos y cobranza</p>
        </div>
      </div>

      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-blue-600">Total Otorgado</p>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(resumen.totalOtorgado)}</p>
          </div>
          <div className="card p-4 bg-yellow-50 border-yellow-200">
            <p className="text-sm text-yellow-600">Total Pendiente</p>
            <p className="text-2xl font-bold text-yellow-700">{formatCurrency(resumen.totalPendiente)}</p>
          </div>
          <div className="card p-4 bg-green-50 border-green-200">
            <p className="text-sm text-green-600">Total Recuperado</p>
            <p className="text-2xl font-bold text-green-700">{formatCurrency(resumen.totalRecuperado)}</p>
          </div>
          <div className="card p-4 bg-gray-50 border-gray-200">
            <p className="text-sm text-gray-600">Créditos Activos</p>
            <p className="text-2xl font-bold text-gray-700">{resumen.creditosActivos || 0}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex gap-4 flex-wrap">
          <select
            className="input w-48"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PARCIAL">Parcial</option>
            <option value="PAGADO">Pagado</option>
          </select>
          <button onClick={() => refetch()} className="btn-ghost p-2" title="Refrescar">
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : creditos.length === 0 ? (
          <div className="p-8 text-center">
            <CreditCard className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No hay créditos que mostrar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Pedido</th>
                  <th>Monto Original</th>
                  <th>Pendiente</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {creditos.map((credito: any) => (
                  <tr key={credito.id}>
                    <td>
                      <Link
                        to={`/clientes/${credito.cliente?.id}`}
                        className="text-accent-600 hover:text-accent-700"
                      >
                        <p className="font-medium">
                          {credito.cliente?.nombreEmpresa || credito.cliente?.nombreContacto}
                        </p>
                      </Link>
                    </td>
                    <td>
                      <Link
                        to={`/pedidos/${credito.pedido?.id}`}
                        className="text-accent-600 hover:text-accent-700"
                      >
                        {credito.pedido?.numeroPedido}
                      </Link>
                    </td>
                    <td className="font-medium">{formatCurrency(credito.montoOriginal)}</td>
                    <td className="font-bold text-yellow-600">{formatCurrency(credito.montoPendiente)}</td>
                    <td>{getEstadoBadge(credito.estado)}</td>
                    <td className="text-sm text-gray-500">
                      {new Date(credito.createdAt).toLocaleDateString('es-MX')}
                    </td>
                    <td>
                      <Link
                        to={`/creditos/${credito.id}`}
                        className="btn-ghost text-sm px-3 py-1"
                      >
                        Ver detalle
                      </Link>
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
