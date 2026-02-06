import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Phone, Mail, MapPin, Building2, Trash2, AlertTriangle, Loader2, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientesApi } from '../../services/api'

export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => clientesApi.get(id!)
  })

  const deleteMutation = useMutation({
    mutationFn: () => clientesApi.delete(id!),
    onSuccess: () => {
      toast.success('Cliente eliminado')
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      navigate('/clientes')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar cliente')
    }
  })

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando...</div>
  }

  if (!cliente) {
    return <div className="p-8 text-center text-gray-500">Cliente no encontrado</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/clientes" className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {cliente.nombreEmpresa || cliente.nombreContacto}
          </h1>
          {cliente.nombreEmpresa && (
            <p className="text-gray-600">{cliente.nombreContacto}</p>
          )}
        </div>
        <span className={`badge ${cliente.tipo === 'EMPRESA' ? 'badge-info' : 'badge-neutral'}`}>
          {cliente.tipo}
        </span>
        <Link
          to={`/clientes/${id}/editar`}
          className="btn-secondary"
        >
          <Pencil size={20} />
          Editar
        </Link>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="btn-ghost text-red-500 hover:bg-red-50"
        >
          <Trash2 size={20} />
          Eliminar
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Información de contacto */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Contacto</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="text-gray-400" size={20} />
              <div>
                <p className="font-medium">{cliente.telefono}</p>
                {cliente.telefonoSecundario && (
                  <p className="text-sm text-gray-500">{cliente.telefonoSecundario}</p>
                )}
              </div>
            </div>
            {cliente.email && (
              <div className="flex items-center gap-3">
                <Mail className="text-gray-400" size={20} />
                <p>{cliente.email}</p>
              </div>
            )}
          </div>
        </div>

        {/* Dirección */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Dirección</h2>
          {cliente.direccionCalle ? (
            <div className="flex items-start gap-3">
              <MapPin className="text-gray-400 mt-1" size={20} />
              <div>
                <p>{cliente.direccionCalle} {cliente.direccionNumero}</p>
                <p>{cliente.direccionColonia}</p>
                <p>{cliente.direccionCiudad}, {cliente.direccionEstado}</p>
                <p>C.P. {cliente.direccionCp}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Sin dirección registrada</p>
          )}
        </div>
      </div>

      {/* Historial de pedidos */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Historial de Pedidos</h2>
        </div>
        <div className="card-body">
          {cliente.pedidos?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Productos</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {cliente.pedidos.map((pedido: any) => (
                    <tr key={pedido.id}>
                      <td>
                        <Link
                          to={`/pedidos/${pedido.id}`}
                          className="font-mono text-accent-600 hover:text-accent-700"
                        >
                          {pedido.numeroPedido}
                        </Link>
                      </td>
                      <td>{pedido.lineas?.length || 0} productos</td>
                      <td>
                        <span className={`badge ${
                          pedido.estado === 'COMPLETADO' ? 'badge-success' :
                          pedido.estado === 'CANCELADO' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {pedido.estado}
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
          ) : (
            <p className="text-center text-gray-500 py-8">No hay pedidos registrados</p>
          )}
        </div>
      </div>

      {/* Notas */}
      {cliente.notas && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Notas</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{cliente.notas}</p>
        </div>
      )}

      {/* Modal Confirmar Eliminar */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '400px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={20} />
              </div>
              <h3 className="text-lg font-bold">Eliminar Cliente</h3>
            </div>

            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar a <strong>{cliente.nombreEmpresa || cliente.nombreContacto}</strong>?
              Esta acción desactivará el cliente.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteMutation.isPending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Trash2 size={20} />
                )}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
