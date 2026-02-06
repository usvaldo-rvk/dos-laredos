import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Edit2,
  AlertTriangle, Trash2, Move, Lock, Unlock, DollarSign, Loader2, Recycle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'
import { tarimasApi, catalogosApi, authApi } from '../../services/api'
import QRCodeDisplay from '../../components/QRCodeDisplay'

const estadoColors: Record<string, string> = {
  ACTIVA: 'bg-green-100 text-green-800',
  RESERVADA: 'bg-yellow-100 text-yellow-800',
  AGOTADA: 'bg-gray-100 text-gray-800',
  BLOQUEADA: 'bg-red-100 text-red-800'
}

const tipoEventoColors: Record<string, string> = {
  CREACION: 'bg-blue-100 text-blue-800',
  RECEPCION: 'bg-green-100 text-green-800',
  PICK: 'bg-purple-100 text-purple-800',
  MERMA: 'bg-red-100 text-red-800',
  AJUSTE: 'bg-amber-100 text-amber-800',
  REUBICACION: 'bg-cyan-100 text-cyan-800',
  ASIGNACION_PICK: 'bg-indigo-100 text-indigo-800',
  CIERRE_TARIMA: 'bg-gray-100 text-gray-800'
}

// Modal para pedir PIN de administrador
function ModalPinAdmin({
  isOpen,
  onClose,
  onSuccess,
  titulo
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: (supervisorId: string) => void
  titulo: string
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const verificarPin = async () => {
    if (pin.length < 4) {
      setError('PIN debe tener al menos 4 dígitos')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await authApi.verifyPin(pin)
      if (result.valid && result.supervisor) {
        onSuccess(result.supervisor.id)
        setPin('')
        onClose()
      } else {
        setError('PIN inválido o usuario no autorizado')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al verificar PIN')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className="rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl"
        style={{ backgroundColor: 'white' }}
      >
        <h3 className="text-lg font-semibold mb-2 text-gray-900">{titulo}</h3>
        <p className="text-sm text-gray-500 mb-4">
          Ingresa el PIN de un administrador o supervisor para autorizar esta acción
        </p>

        <input
          type="password"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400"
          placeholder="••••"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          autoFocus
        />

        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={verificarPin}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Verificar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TarimaDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const [modalPinOpen, setModalPinOpen] = useState(false)
  const [modalEditarPrecio, setModalEditarPrecio] = useState(false)
  const [modalReubicar, setModalReubicar] = useState(false)
  const [modalMerma, setModalMerma] = useState(false)
  const [modalAjuste, setModalAjuste] = useState(false)
  const [modalCambiarEstado, setModalCambiarEstado] = useState(false)
  const [modalEliminar, setModalEliminar] = useState(false)
  const [accionPendiente, setAccionPendiente] = useState<((supervisorId: string) => void) | null>(null)

  const [nuevaUbicacion, setNuevaUbicacion] = useState('')
  const [motivoReubicacion, setMotivoReubicacion] = useState('')
  const [cantidadMerma, setCantidadMerma] = useState('')
  const [motivoMerma, setMotivoMerma] = useState('')
  const [cantidadAjuste, setCantidadAjuste] = useState('')
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [motivoEstado, setMotivoEstado] = useState('')
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [motivoEliminar, setMotivoEliminar] = useState('')
  const [supervisorIdParaPrecio, setSupervisorIdParaPrecio] = useState<string | undefined>()

  const esAdmin = user?.rol === 'ADMIN'
  const esSupervisor = user?.rol === 'SUPERVISOR'

  const { data: tarima, isLoading } = useQuery({
    queryKey: ['tarima', id],
    queryFn: () => tarimasApi.get(id!)
  })

  const { data: ubicaciones } = useQuery({
    queryKey: ['ubicaciones', tarima?.almacenId],
    queryFn: () => catalogosApi.ubicaciones(tarima!.almacenId),
    enabled: !!tarima?.almacenId
  })

  // Mutaciones
  const actualizarPrecioMutation = useMutation({
    mutationFn: ({ precio, supervisorId }: { precio: number; supervisorId?: string }) =>
      tarimasApi.actualizarPrecio(id!, precio, supervisorId),
    onSuccess: () => {
      toast.success('Precio actualizado')
      queryClient.invalidateQueries({ queryKey: ['tarima', id] })
      setModalEditarPrecio(false)
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al actualizar precio')
  })

  const reubicarMutation = useMutation({
    mutationFn: () => tarimasApi.reubicar(id!, nuevaUbicacion, motivoReubicacion),
    onSuccess: () => {
      toast.success('Tarima reubicada')
      queryClient.invalidateQueries({ queryKey: ['tarima', id] })
      setModalReubicar(false)
      setNuevaUbicacion('')
      setMotivoReubicacion('')
    },
    onError: () => toast.error('Error al reubicar')
  })

  const mermaMutation = useMutation({
    mutationFn: (supervisorId?: string) =>
      tarimasApi.registrarMerma(id!, parseInt(cantidadMerma), motivoMerma, supervisorId),
    onSuccess: () => {
      toast.success('Merma registrada')
      queryClient.invalidateQueries({ queryKey: ['tarima', id] })
      setModalMerma(false)
      setCantidadMerma('')
      setMotivoMerma('')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al registrar merma')
  })

  const ajusteMutation = useMutation({
    mutationFn: (supervisorId?: string) =>
      tarimasApi.ajustarInventario(id!, parseInt(cantidadAjuste), motivoAjuste, supervisorId),
    onSuccess: () => {
      toast.success('Ajuste registrado')
      queryClient.invalidateQueries({ queryKey: ['tarima', id] })
      setModalAjuste(false)
      setCantidadAjuste('')
      setMotivoAjuste('')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al registrar ajuste')
  })

  const cambiarEstadoMutation = useMutation({
    mutationFn: (supervisorId?: string) =>
      tarimasApi.cambiarEstado(id!, nuevoEstado, motivoEstado, supervisorId),
    onSuccess: () => {
      toast.success('Estado actualizado')
      queryClient.invalidateQueries({ queryKey: ['tarima', id] })
      setModalCambiarEstado(false)
      setNuevoEstado('')
      setMotivoEstado('')
    },
    onError: () => toast.error('Error al cambiar estado')
  })

  const eliminarMutation = useMutation({
    mutationFn: () => tarimasApi.eliminar(id!, motivoEliminar),
    onSuccess: () => {
      toast.success('Tarima eliminada')
      queryClient.invalidateQueries({ queryKey: ['tarimas'] })
      navigate('/tarimas')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar tarima')
    }
  })

  // Funciones de acción con verificación de permisos
  const handleEditarPrecio = () => {
    if (esAdmin) {
      setSupervisorIdParaPrecio(undefined)
      setNuevoPrecio(tarima?.precioUnitario?.toString() || '')
      setModalEditarPrecio(true)
    } else {
      setAccionPendiente(() => (supervisorId: string) => {
        setSupervisorIdParaPrecio(supervisorId)
        setNuevoPrecio(tarima?.precioUnitario?.toString() || '')
        setModalEditarPrecio(true)
      })
      setModalPinOpen(true)
    }
  }

  const guardarNuevoPrecio = () => {
    const precio = parseFloat(nuevoPrecio)
    if (precio > 0) {
      actualizarPrecioMutation.mutate({ precio, supervisorId: supervisorIdParaPrecio })
    } else {
      toast.error('El precio debe ser mayor a 0')
    }
  }

  const handleMerma = () => {
    // Operarios SIEMPRE requieren autorización para merma
    if (!esAdmin && !esSupervisor) {
      setAccionPendiente(() => (supervisorId: string) => mermaMutation.mutate(supervisorId))
      setModalPinOpen(true)
    } else {
      mermaMutation.mutate(user?.id)
    }
  }

  const handleAjuste = () => {
    if (esAdmin || esSupervisor) {
      ajusteMutation.mutate(user?.id)
    } else {
      setAccionPendiente(() => (supervisorId: string) => ajusteMutation.mutate(supervisorId))
      setModalPinOpen(true)
    }
  }

  const handleCambiarEstado = () => {
    if (esAdmin || esSupervisor) {
      cambiarEstadoMutation.mutate(user?.id)
    } else {
      setAccionPendiente(() => (supervisorId: string) => cambiarEstadoMutation.mutate(supervisorId))
      setModalPinOpen(true)
    }
  }

  const onPinSuccess = (supervisorId: string) => {
    if (accionPendiente) {
      accionPendiente(supervisorId)
      setAccionPendiente(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-accent-500" size={40} />
      </div>
    )
  }

  if (!tarima) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Tarima no encontrada</p>
        <Link to="/tarimas" className="btn-primary mt-4 inline-flex">
          Volver a tarimas
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link to="/tarimas" className="btn-ghost p-2 self-start">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{tarima.qrCode}</h1>
          <p className="text-gray-600">{tarima.producto?.nombre} • {tarima.proveedor?.nombre}</p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-medium ${estadoColors[tarima.estado]}`}>
          {tarima.estado}
        </span>
      </div>

      {/* Acciones rápidas */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setModalReubicar(true)} className="btn-secondary">
          <Move size={18} />
          Reubicar
        </button>
        <button onClick={() => setModalMerma(true)} className="btn-secondary text-red-600 hover:bg-red-50">
          <Trash2 size={18} />
          Registrar Merma
        </button>
        <button onClick={() => setModalAjuste(true)} className="btn-secondary text-amber-600 hover:bg-amber-50">
          <Edit2 size={18} />
          Ajuste Inventario
        </button>
        <button onClick={() => setModalCambiarEstado(true)} className="btn-secondary">
          {tarima.estado === 'BLOQUEADA' ? <Unlock size={18} /> : <Lock size={18} />}
          Cambiar Estado
        </button>
        {(esAdmin || esSupervisor) && (
          <button
            onClick={() => setModalEliminar(true)}
            className="btn-secondary text-red-600 hover:bg-red-50 border-red-200"
          >
            <Trash2 size={18} />
            Eliminar Tarima
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Información principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos de la tarima */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Información de la Tarima</h2>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Producto</p>
                <p className="font-medium">{tarima.producto?.nombre}</p>
                <p className="text-sm text-gray-500">{tarima.producto?.sku}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Proveedor</p>
                <p className="font-medium">{tarima.proveedor?.nombre}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Ubicación</p>
                <p className="font-medium">{tarima.ubicacion?.codigo || 'Sin asignar'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Lote</p>
                <p className="font-medium font-mono">{tarima.lote || '-'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Fecha de Ingreso</p>
                <p className="font-medium">{new Date(tarima.fechaIngreso).toLocaleDateString()}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Almacén</p>
                <p className="font-medium">{tarima.almacen?.nombre}</p>
              </div>

              {tarima.fechaProduccion && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Fecha Producción</p>
                  <p className="font-medium">{new Date(tarima.fechaProduccion).toLocaleDateString()}</p>
                </div>
              )}

              {tarima.fechaCaducidad && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Fecha Caducidad</p>
                  <p className="font-medium">{new Date(tarima.fechaCaducidad).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {/* Precio y Depósito */}
            <div className="mt-6 pt-6 border-t">
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Precio unitario */}
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-orange-600 font-medium">PRECIO UNITARIO DE COMPRA</p>
                    <button
                      onClick={handleEditarPrecio}
                      className="p-1 hover:bg-orange-100 rounded"
                      title={esAdmin ? 'Editar precio' : 'Requiere PIN de administrador'}
                    >
                      <Edit2 size={14} className="text-orange-500" />
                    </button>
                  </div>
                  <p className="text-2xl font-bold text-orange-700">
                    {tarima.precioUnitario
                      ? `$${parseFloat(tarima.precioUnitario).toFixed(2)}`
                      : 'No definido'
                    }
                  </p>
                  <p className="text-xs text-orange-500 mt-1">
                    Por {tarima.producto?.presentacion || 'unidad'}
                  </p>
                </div>

                {/* Depósito por envase - solo si el producto es retornable */}
                {tarima.producto?.esRetornable && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-600 font-medium flex items-center gap-1 mb-2">
                      <Recycle size={14} />
                      DEPÓSITO POR ENVASE
                    </p>
                    <p className="text-2xl font-bold text-blue-700">
                      {tarima.depositoPorEnvase
                        ? `$${parseFloat(tarima.depositoPorEnvase).toFixed(2)}`
                        : 'No registrado'
                      }
                    </p>
                    {tarima.depositoPorEnvase && tarima.producto?.unidadesPorCarton && (
                      <p className="text-xs text-blue-500 mt-1">
                        × {tarima.producto.unidadesPorCarton} envases = ${(parseFloat(tarima.depositoPorEnvase) * tarima.producto.unidadesPorCarton).toFixed(2)} por {tarima.producto?.presentacion || 'unidad'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Resumen de costos */}
              {tarima.precioUnitario && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid sm:grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-500">Costo Total Compra</p>
                      <p className="text-lg font-bold text-gray-700">
                        ${(tarima.capacidadTotal * parseFloat(tarima.precioUnitario)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {tarima.depositoPorEnvase && tarima.producto?.unidadesPorCarton && (
                      <>
                        <div>
                          <p className="text-xs text-blue-500">Depósito Total</p>
                          <p className="text-lg font-bold text-blue-600">
                            ${(tarima.capacidadTotal * tarima.producto.unidadesPorCarton * parseFloat(tarima.depositoPorEnvase)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-xs text-gray-400">
                            ({(tarima.capacidadTotal * tarima.producto.unidadesPorCarton).toLocaleString()} envases)
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-green-500">Costo Neto</p>
                          <p className="text-lg font-bold text-green-600">
                            ${((tarima.capacidadTotal * parseFloat(tarima.precioUnitario)) - (tarima.capacidadTotal * tarima.producto.unidadesPorCarton * parseFloat(tarima.depositoPorEnvase))).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {!esAdmin && (
                <p className="text-xs text-gray-400 mt-2">
                  * Modificar precio requiere autorización de administrador
                </p>
              )}
            </div>
          </div>

          {/* Inventario visual */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Inventario</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold text-gray-900">
                  {tarima.inventarioActual ?? tarima.capacidadTotal}
                </p>
                <p className="text-gray-500">
                  de {tarima.capacidadTotal} unidades
                </p>
              </div>

              <div className="w-32 h-32 relative">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="12"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="none"
                    stroke="#D4A04C"
                    strokeWidth="12"
                    strokeDasharray={`${((tarima.inventarioActual ?? tarima.capacidadTotal) / tarima.capacidadTotal) * 352} 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold">
                    {Math.round(((tarima.inventarioActual ?? tarima.capacidadTotal) / tarima.capacidadTotal) * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Valor del inventario */}
            {tarima.precioUnitario && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">Valor del inventario actual</p>
                <p className="text-2xl font-bold text-green-600">
                  ${((tarima.inventarioActual ?? tarima.capacidadTotal) * parseFloat(tarima.precioUnitario)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* QR y eventos */}
        <div className="space-y-6">
          {/* QR Code */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 text-center">Código QR</h2>
            <QRCodeDisplay
              value={tarima.qrCode}
              size={160}
              title={tarima.producto?.nombre}
              subtitle={`${tarima.ubicacion?.codigo || 'Sin ubicación'} • ${tarima.proveedor?.nombre}`}
              printable={true}
            />
          </div>
        </div>
      </div>

      {/* Timeline de eventos */}
      <div className="card">
        <div className="card-header border-b">
          <h2 className="text-lg font-semibold">Historial de Eventos</h2>
        </div>
        <div className="p-6">
          {tarima.eventos?.length > 0 ? (
            <div className="space-y-4">
              {tarima.eventos.map((evento: any, index: number) => (
                <div key={evento.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${tipoEventoColors[evento.tipo]?.split(' ')[0] || 'bg-gray-300'}`} />
                    {index < tarima.eventos.length - 1 && (
                      <div className="w-0.5 flex-1 bg-gray-200 mt-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${tipoEventoColors[evento.tipo] || 'bg-gray-100 text-gray-800'}`}>
                        {evento.tipo}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(evento.timestampLocal).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      Por: <span className="font-medium">{evento.usuario?.nombre}</span>
                      <span className="text-gray-400 text-xs ml-1">({evento.rolUsuario})</span>
                      {evento.cantidad && (
                        <span className="ml-2 text-accent-600 font-medium">
                          {evento.tipo === 'PICK' || evento.tipo === 'MERMA' ? '-' : '+'}{evento.cantidad} unidades
                        </span>
                      )}
                    </p>
                    {evento.motivo && (
                      <p className="text-sm text-gray-500 mt-1 italic">"{evento.motivo}"</p>
                    )}
                    {evento.supervisor && evento.supervisor.id !== evento.usuario?.id && (
                      <p className="text-xs mt-1 px-2 py-1 bg-amber-50 text-amber-700 rounded inline-block">
                        🔐 Autorizado por: <span className="font-semibold">{evento.supervisor.nombre}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No hay eventos registrados</p>
          )}
        </div>
      </div>

      {/* Modales */}
      <ModalPinAdmin
        isOpen={modalPinOpen}
        onClose={() => setModalPinOpen(false)}
        onSuccess={onPinSuccess}
        titulo="Autorización Requerida"
      />

      {/* Modal Reubicar */}
      {modalReubicar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Reubicar Tarima</h3>

            <div className="space-y-4">
              <div>
                <label className="label">Nueva ubicación</label>
                <select
                  className="input w-full"
                  value={nuevaUbicacion}
                  onChange={(e) => setNuevaUbicacion(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {(ubicaciones?.data || ubicaciones || []).map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.codigo} - {u.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Motivo (opcional)</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Razón del cambio..."
                  value={motivoReubicacion}
                  onChange={(e) => setMotivoReubicacion(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalReubicar(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={() => reubicarMutation.mutate()}
                disabled={!nuevaUbicacion || reubicarMutation.isPending}
                className="btn-primary flex-1"
              >
                {reubicarMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : 'Reubicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Merma */}
      {modalMerma && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Registrar Merma</h3>

            <div className="space-y-4">
              <div>
                <label className="label">Cantidad dañada/perdida</label>
                <input
                  type="number"
                  className="input w-full"
                  placeholder="0"
                  min="1"
                  max={tarima.inventarioActual}
                  value={cantidadMerma}
                  onChange={(e) => setCantidadMerma(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Disponible: {tarima.inventarioActual} unidades
                </p>
              </div>

              <div>
                <label className="label">Motivo *</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Producto dañado, caducado, etc."
                  value={motivoMerma}
                  onChange={(e) => setMotivoMerma(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalMerma(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={handleMerma}
                disabled={!cantidadMerma || !motivoMerma || mermaMutation.isPending}
                className="btn-primary bg-red-600 hover:bg-red-700 flex-1"
              >
                {mermaMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : 'Registrar Merma'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajuste */}
      {modalAjuste && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4 text-amber-600">Ajuste de Inventario</h3>

            <div className="space-y-4">
              <div>
                <label className="label">Cantidad a ajustar</label>
                <input
                  type="number"
                  className="input w-full"
                  placeholder="Positivo para sumar, negativo para restar"
                  value={cantidadAjuste}
                  onChange={(e) => setCantidadAjuste(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Inventario actual: {tarima.inventarioActual} →
                  Nuevo: {(tarima.inventarioActual || 0) + parseInt(cantidadAjuste || '0')}
                </p>
              </div>

              <div>
                <label className="label">Motivo *</label>
                <textarea
                  className="input w-full min-h-[80px]"
                  placeholder="Razón del ajuste..."
                  value={motivoAjuste}
                  onChange={(e) => setMotivoAjuste(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalAjuste(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={handleAjuste}
                disabled={!cantidadAjuste || !motivoAjuste || ajusteMutation.isPending}
                className="btn-primary bg-amber-600 hover:bg-amber-700 flex-1"
              >
                {ajusteMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : 'Aplicar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cambiar Estado */}
      {modalCambiarEstado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Cambiar Estado</h3>

            <div className="space-y-4">
              <div>
                <label className="label">Nuevo estado</label>
                <select
                  className="input w-full"
                  value={nuevoEstado}
                  onChange={(e) => setNuevoEstado(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  <option value="ACTIVA">Activa</option>
                  <option value="RESERVADA">Reservada</option>
                  <option value="BLOQUEADA">Bloqueada</option>
                  <option value="AGOTADA">Agotada</option>
                </select>
              </div>

              <div>
                <label className="label">Motivo *</label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Razón del cambio..."
                  value={motivoEstado}
                  onChange={(e) => setMotivoEstado(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalCambiarEstado(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={handleCambiarEstado}
                disabled={!nuevoEstado || !motivoEstado || cambiarEstadoMutation.isPending}
                className="btn-primary flex-1"
              >
                {cambiarEstadoMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : 'Cambiar Estado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Precio */}
      {modalEditarPrecio && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-4">Editar Precio Unitario</h3>

            <div>
              <label className="label">Nuevo precio</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  className="input w-full pl-7"
                  placeholder="0.00"
                  value={nuevoPrecio}
                  onChange={(e) => setNuevoPrecio(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Precio actual: ${tarima.precioUnitario ? parseFloat(tarima.precioUnitario).toFixed(2) : '0.00'}
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalEditarPrecio(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={guardarNuevoPrecio}
                disabled={actualizarPrecioMutation.isPending}
                className="btn-primary flex-1"
              >
                {actualizarPrecioMutation.isPending ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  'Guardar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar Tarima */}
      {modalEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-600">Eliminar Tarima</h3>
                <p className="text-sm text-gray-500">{tarima.qrCode}</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700">
                <strong>Esta acción no se puede deshacer.</strong> Se eliminarán todos los eventos asociados a esta tarima.
              </p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Producto:</strong> {tarima.producto?.nombre}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Inventario actual:</strong> {tarima.inventarioActual} unidades
              </p>
              <p className="text-sm text-gray-600">
                <strong>Proveedor:</strong> {tarima.proveedor?.nombre}
              </p>
            </div>

            <div>
              <label className="label">Motivo de eliminación *</label>
              <textarea
                className="input w-full min-h-[80px]"
                placeholder="Ej: Tarima creada por error, datos incorrectos..."
                value={motivoEliminar}
                onChange={(e) => setMotivoEliminar(e.target.value)}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setModalEliminar(false)
                  setMotivoEliminar('')
                }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminarMutation.mutate()}
                disabled={!motivoEliminar || eliminarMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {eliminarMutation.isPending ? (
                  <Loader2 className="animate-spin" size={20} />
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
