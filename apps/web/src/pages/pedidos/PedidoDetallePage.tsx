import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Play, CheckCircle, Loader2, MapPin, Package, User, Phone, Calendar, FileText, XCircle, Trash2, AlertTriangle, DollarSign, Banknote, Building2, CreditCard, Truck, Store, Receipt, Clock, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { pedidosApi } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'

const estadoPagoColors: Record<string, string> = {
  PENDIENTE: 'bg-red-100 text-red-800',
  PARCIAL: 'bg-amber-100 text-amber-800',
  PAGADO: 'bg-green-100 text-green-800',
  CREDITO: 'bg-blue-100 text-blue-800'
}

// Componente para verificación PIN
function PinModal({
  isOpen,
  onClose,
  onVerify,
  title
}: {
  isOpen: boolean
  onClose: () => void
  onVerify: (pin: string) => void
  title: string
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos')
      return
    }
    onVerify(pin)
    setPin('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-center mb-4">{title}</h3>
        <p className="text-sm text-gray-500 text-center mb-4">
          Ingresa tu PIN de supervisor para autorizar
        </p>
        <input
          type="password"
          className="input text-center text-2xl tracking-widest mb-2"
          placeholder="••••"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
            setError('')
          }}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        {error && <p className="text-red-500 text-sm text-center mb-2">{error}</p>}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 btn-ghost">Cancelar</button>
          <button onClick={handleSubmit} className="flex-1 btn-primary">Autorizar</button>
        </div>
      </div>
    </div>
  )
}

const metodoPagoIcons: Record<string, any> = {
  EFECTIVO: Banknote,
  TRANSFERENCIA: Building2,
  TARJETA: CreditCard,
  CREDITO: Clock
}

const metodoPagoColors: Record<string, string> = {
  EFECTIVO: 'bg-green-100 text-green-600',
  TRANSFERENCIA: 'bg-blue-100 text-blue-600',
  TARJETA: 'bg-purple-100 text-purple-600',
  CREDITO: 'bg-amber-100 text-amber-600'
}

const estadoColors: Record<string, string> = {
  CREADO: 'bg-blue-100 text-blue-800',
  ENVIADO_BODEGA: 'bg-green-100 text-green-800',
  EN_REVISION: 'bg-amber-100 text-amber-800',
  COMPLETADO: 'bg-green-200 text-green-900',
  CANCELADO: 'bg-red-100 text-red-800'
}

const estadoAsignacionColors: Record<string, string> = {
  ABIERTA: 'bg-amber-100 text-amber-800',
  CONFIRMADA: 'bg-green-100 text-green-800',
  CANCELADA: 'bg-red-100 text-red-800'
}

export default function PedidoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [cancelMotivo, setCancelMotivo] = useState('')

  // Estado para revisión
  const [showRevisionModal, setShowRevisionModal] = useState(false)
  const [revisionMotivo, setRevisionMotivo] = useState('')
  const [showResolverModal, setShowResolverModal] = useState(false)
  const [resolucionTexto, setResolucionTexto] = useState('')

  // Estado para confirmar picking manualmente
  const [showPickingModal, setShowPickingModal] = useState(false)
  const [lineasConfirmadas, setLineasConfirmadas] = useState<Record<string, boolean>>({})
  const [showPinModal, setShowPinModal] = useState(false)

  const isAdmin = user?.rol === 'ADMIN'
  const isSupervisor = user?.rol === 'SUPERVISOR'
  const canCancel = isAdmin || isSupervisor
  const canDelete = isAdmin

  const { data: pedido, isLoading } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => pedidosApi.get(id!)
  })

  const asignarMutation = useMutation({
    mutationFn: () => pedidosApi.asignar(id!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      if (data.errores?.length > 0) {
        toast.error(`Asignación parcial: faltan productos`)
      } else {
        toast.success('Pedido asignado correctamente')
      }
    },
    onError: () => toast.error('Error al asignar')
  })

  const cerrarMutation = useMutation({
    mutationFn: () => pedidosApi.cerrar(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      toast.success('Pedido completado')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al cerrar')
  })

  const cancelarMutation = useMutation({
    mutationFn: (motivo?: string) => pedidosApi.cancelar(id!, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      setShowCancelModal(false)
      setCancelMotivo('')
      toast.success('Pedido cancelado correctamente')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al cancelar')
  })

  const eliminarMutation = useMutation({
    mutationFn: () => pedidosApi.eliminar(id!, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      toast.success('Pedido eliminado permanentemente')
      navigate('/pedidos')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al eliminar')
  })

  // Mutation para enviar a revisión (bodega)
  const enviarRevisionMutation = useMutation({
    mutationFn: (motivo: string) => pedidosApi.enviarRevision(id!, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      setShowRevisionModal(false)
      setRevisionMotivo('')
      toast.success('Pedido enviado a revisión')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al enviar a revisión')
  })

  // Mutation para resolver revisión (supervisor)
  const resolverRevisionMutation = useMutation({
    mutationFn: (resolucion: string) => pedidosApi.resolverRevision(id!, resolucion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      setShowResolverModal(false)
      setResolucionTexto('')
      toast.success('Revisión resuelta, pedido devuelto a bodega')
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al resolver revisión')
  })

  // Mutation para confirmar picking manual
  const confirmarPickingMutation = useMutation({
    mutationFn: async () => {
      // Usar el endpoint de cerrar que ya existe
      return pedidosApi.cerrar(id!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      toast.success('Pedido completado correctamente')
      setShowPickingModal(false)
      setShowPinModal(false)
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Error al confirmar')
  })

  const handleVerifyPin = async (pin: string) => {
    try {
      // Verificar PIN (si tienes endpoint de verificación)
      // Por ahora solo validamos que tenga 4+ dígitos
      if (pin.length >= 4) {
        confirmarPickingMutation.mutate()
      }
    } catch {
      toast.error('PIN incorrecto')
    }
  }

  const todasLineasConfirmadas = pedido?.lineas?.every((l: any) => lineasConfirmadas[l.id]) || false

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-accent-500" size={40} />
      </div>
    )
  }

  if (!pedido) {
    return <div className="p-8 text-center text-gray-500">Pedido no encontrado</div>
  }

  const tieneAsignaciones = pedido.lineas?.some((l: any) => l.asignaciones?.length > 0)
  const totalUnidades = pedido.lineas?.reduce((sum: number, l: any) => sum + l.cantidadSolicitada, 0) || 0
  const totalSurtido = pedido.lineas?.reduce((sum: number, l: any) => sum + l.cantidadSurtida, 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/pedidos" className="btn-ghost p-2">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">
                {pedido.numeroPedido}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${estadoColors[pedido.estado]}`}>
                {pedido.estado.replace('_', ' ')}
              </span>
            </div>
            <p className="text-gray-600">
              Creado por {pedido.creadoPorRef?.nombre} • {new Date(pedido.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {pedido.estado === 'CREADO' && (
            <button
              onClick={() => asignarMutation.mutate()}
              disabled={asignarMutation.isPending}
              className="btn-primary"
            >
              {asignarMutation.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Play size={20} />
              )}
              Asignar Picking Automático
            </button>
          )}

          {/* Bodega puede enviar a revisión */}
          {pedido.estado === 'ENVIADO_BODEGA' && (
            <button
              onClick={() => setShowRevisionModal(true)}
              className="btn-ghost text-amber-600 hover:bg-amber-50"
            >
              <AlertTriangle size={20} />
              Reportar Problema
            </button>
          )}

          {/* Supervisor puede resolver revisión */}
          {pedido.estado === 'EN_REVISION' && canCancel && (
            <button
              onClick={() => setShowResolverModal(true)}
              className="btn-accent"
            >
              <CheckCircle size={20} />
              Resolver Revisión
            </button>
          )}

          {/* Botones de Cancelar/Eliminar */}
          {canCancel && pedido.estado !== 'CANCELADO' && pedido.estado !== 'COMPLETADO' && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="btn-ghost text-amber-600 hover:bg-amber-50"
            >
              <XCircle size={20} />
              Cancelar
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="btn-ghost text-red-600 hover:bg-red-50"
            >
              <Trash2 size={20} />
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Info del cliente y resumen */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Cliente */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User size={20} className="text-gray-400" />
            Cliente
          </h2>
          <div className="space-y-2">
            <p className="font-medium text-lg">
              {pedido.cliente.nombreEmpresa || pedido.cliente.nombreContacto}
            </p>
            {pedido.cliente.nombreEmpresa && (
              <p className="text-gray-600">{pedido.cliente.nombreContacto}</p>
            )}
            <p className="flex items-center gap-2 text-gray-600">
              <Phone size={16} />
              {pedido.cliente.telefono}
            </p>
          </div>
        </div>

        {/* Resumen */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package size={20} className="text-gray-400" />
            Resumen
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{pedido.lineas?.length || 0}</p>
              <p className="text-sm text-gray-500">Productos</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totalUnidades.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Solicitadas</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${totalSurtido === totalUnidades ? 'text-green-600' : 'text-amber-600'}`}>
                {totalSurtido.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">Surtidas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tipo de Entrega y Dirección */}
      {pedido.tipoEntrega && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {pedido.tipoEntrega === 'ENVIO' ? (
              <Truck size={20} className="text-blue-500" />
            ) : (
              <Store size={20} className="text-green-500" />
            )}
            {pedido.tipoEntrega === 'ENVIO' ? 'Envío a Domicilio' : 'Recolección en Tienda'}
          </h2>

          {pedido.tipoEntrega === 'ENVIO' && pedido.direccionCalle && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <MapPin size={20} className="text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {pedido.direccionCalle} #{pedido.direccionNumero}
                  </p>
                  <p className="text-gray-600">
                    {pedido.direccionColonia}, {pedido.direccionCiudad}
                    {pedido.direccionEstado && `, ${pedido.direccionEstado}`}
                    {pedido.direccionCp && ` C.P. ${pedido.direccionCp}`}
                  </p>
                  {pedido.direccionReferencia && (
                    <p className="text-sm text-gray-500 mt-1">
                      Ref: {pedido.direccionReferencia}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {pedido.tipoEntrega === 'RECOLECCION' && (
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-green-700">
                El cliente pasará a recoger el pedido en el almacén <span className="font-semibold">{pedido.almacen?.nombre}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Resumen Financiero */}
      {(pedido.total || pedido.subtotal) && (
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm uppercase tracking-wide">Total del Pedido</p>
                <p className="text-4xl font-bold font-mono">${parseFloat(pedido.total || pedido.subtotal || 0).toFixed(2)}</p>
              </div>
              <div className="text-right">
                {pedido.estadoPago && (
                  <span className={`px-4 py-2 rounded-full text-sm font-bold ${estadoPagoColors[pedido.estadoPago]}`}>
                    {pedido.estadoPago === 'PENDIENTE' && '⏳ PENDIENTE'}
                    {pedido.estadoPago === 'PARCIAL' && '⚠️ PARCIAL'}
                    {pedido.estadoPago === 'PAGADO' && '✅ PAGADO'}
                    {pedido.estadoPago === 'CREDITO' && '📋 A CRÉDITO'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Desglose de pagos */}
            {pedido.pagos && pedido.pagos.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Receipt size={16} />
                  Pagos Registrados
                </h3>
                <div className="space-y-2">
                  {pedido.pagos.map((pago: any) => {
                    const IconComponent = metodoPagoIcons[pago.metodoPago] || DollarSign
                    return (
                      <div key={pago.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${metodoPagoColors[pago.metodoPago]}`}>
                          <IconComponent size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{pago.metodoPago}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(pago.createdAt).toLocaleString()}
                            {pago.referencia && ` • Ref: ${pago.referencia}`}
                          </p>
                        </div>
                        <p className="text-lg font-bold font-mono">${parseFloat(pago.monto).toFixed(2)}</p>
                        {pago.comprobante && (
                          <a
                            href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${pago.comprobante}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
                          >
                            <ExternalLink size={14} />
                            Ver
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Créditos pendientes */}
            {pedido.creditos && pedido.creditos.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Clock size={16} />
                  Créditos
                </h3>
                <div className="space-y-2">
                  {pedido.creditos.map((credito: any) => (
                    <div key={credito.id} className={`p-4 rounded-lg border-2 ${
                      credito.estado === 'PENDIENTE' ? 'bg-amber-50 border-amber-200' :
                      credito.estado === 'PARCIAL' ? 'bg-orange-50 border-orange-200' :
                      'bg-green-50 border-green-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          credito.estado === 'PENDIENTE' ? 'bg-amber-200 text-amber-800' :
                          credito.estado === 'PARCIAL' ? 'bg-orange-200 text-orange-800' :
                          'bg-green-200 text-green-800'
                        }`}>
                          {credito.estado === 'PENDIENTE' && '⏳ PENDIENTE'}
                          {credito.estado === 'PARCIAL' && '⚠️ ABONADO PARCIAL'}
                          {credito.estado === 'PAGADO' && '✅ LIQUIDADO'}
                        </span>
                        {credito.fechaVencimiento && (
                          <span className="text-xs text-gray-500">
                            Vence: {new Date(credito.fechaVencimiento).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-gray-500">Original</p>
                          <p className="font-bold font-mono">${parseFloat(credito.montoOriginal).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Abonado</p>
                          <p className="font-bold font-mono text-green-600">
                            ${(parseFloat(credito.montoOriginal) - parseFloat(credito.montoPendiente)).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Pendiente</p>
                          <p className={`font-bold font-mono ${parseFloat(credito.montoPendiente) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            ${parseFloat(credito.montoPendiente).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      {credito.notas && (
                        <p className="text-sm text-gray-600 mt-2 pt-2 border-t">{credito.notas}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen de totales */}
            <div className="bg-gray-100 rounded-xl p-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Subtotal</p>
                  <p className="text-xl font-bold font-mono">${parseFloat(pedido.subtotal || pedido.total || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Pagado</p>
                  <p className="text-xl font-bold font-mono text-green-600">
                    ${(pedido.pagos || [])
                      .filter((p: any) => p.metodoPago !== 'CREDITO')
                      .reduce((sum: number, p: any) => sum + parseFloat(p.monto), 0)
                      .toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">A Crédito</p>
                  <p className="text-xl font-bold font-mono text-amber-600">
                    ${(pedido.creditos || [])
                      .reduce((sum: number, c: any) => sum + parseFloat(c.montoOriginal), 0)
                      .toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Por Cobrar</p>
                  <p className={`text-xl font-bold font-mono ${
                    (pedido.creditos || []).reduce((sum: number, c: any) => sum + parseFloat(c.montoPendiente), 0) > 0
                      ? 'text-red-600'
                      : 'text-gray-400'
                  }`}>
                    ${(pedido.creditos || [])
                      .reduce((sum: number, c: any) => sum + parseFloat(c.montoPendiente), 0)
                      .toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notas */}
      {pedido.notas && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <FileText size={20} className="text-gray-400" />
            Notas
          </h2>
          <p className="text-gray-600">{pedido.notas}</p>
        </div>
      )}

      {/* Instrucciones de Bodega */}
      {tieneAsignaciones && (
        <div className="card">
          <div className="card-header border-b bg-accent-50">
            <h2 className="text-lg font-semibold text-accent-800">
              📋 Instrucciones para Bodega
            </h2>
            <p className="text-sm text-accent-600">
              Siga las instrucciones en orden para surtir el pedido
            </p>
          </div>
          <div className="p-6 space-y-6">
            {pedido.lineas?.map((linea: any, lineaIndex: number) => (
              <div key={linea.id} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{linea.producto.nombre}</p>
                      <p className="text-sm text-gray-500">{linea.producto.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Cantidad</p>
                      <p className="text-xl font-bold">{linea.cantidadSolicitada}</p>
                    </div>
                  </div>
                </div>

                {linea.asignaciones?.length > 0 ? (
                  <div className="divide-y">
                    {linea.asignaciones.map((asig: any, asigIndex: number) => (
                      <div
                        key={asig.id}
                        className={`p-4 flex items-center gap-4 ${
                          asig.estado === 'CONFIRMADA' ? 'bg-green-50' : ''
                        }`}
                      >
                        <div className="w-8 h-8 bg-accent-500 text-white rounded-full flex items-center justify-center font-bold">
                          {asigIndex + 1}
                        </div>

                        <div className="flex items-center gap-2 min-w-[100px]">
                          <MapPin size={18} className="text-red-500" />
                          <span className="font-bold text-lg">{asig.tarima.ubicacion?.codigo || 'S/U'}</span>
                        </div>

                        <div className="flex-1">
                          <p className="font-mono font-medium">{asig.tarima.qrCode}</p>
                          <p className="text-sm text-gray-500">{asig.tarima.proveedor?.nombre || 'Sin proveedor'}</p>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-bold text-accent-600">{asig.cantidadAsignada}</p>
                          <p className="text-xs text-gray-500">unidades</p>
                        </div>

                        <div className="min-w-[100px] text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoAsignacionColors[asig.estado]}`}>
                            {asig.estado === 'ABIERTA' ? 'Pendiente' :
                             asig.estado === 'CONFIRMADA' ? 'Completado' : asig.estado}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    Sin asignaciones
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla resumen de productos */}
      <div className="card">
        <div className="card-header border-b">
          <h2 className="text-lg font-semibold">Detalle de Productos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-right">Cantidad</th>
                <th className="text-right">Precio Unit.</th>
                <th className="text-right">Subtotal</th>
                <th className="text-center">Surtido</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pedido.lineas?.map((linea: any) => {
                const pendiente = linea.cantidadSolicitada - linea.cantidadSurtida
                const precioUnitario = linea.precioUnitario ? parseFloat(linea.precioUnitario) : 0
                const subtotal = linea.subtotal ? parseFloat(linea.subtotal) : (precioUnitario * linea.cantidadSolicitada)
                return (
                  <tr key={linea.id}>
                    <td>
                      <p className="font-medium">{linea.producto.nombre}</p>
                      <p className="text-sm text-gray-500">{linea.producto.sku}</p>
                      {linea.proveedorNombre && (
                        <p className="text-xs text-orange-500">Prov: {linea.proveedorNombre}</p>
                      )}
                    </td>
                    <td className="text-right font-medium">{linea.cantidadSolicitada.toLocaleString()}</td>
                    <td className="text-right font-mono">
                      {precioUnitario > 0 ? `$${precioUnitario.toFixed(2)}` : '-'}
                    </td>
                    <td className="text-right font-mono font-bold">
                      {subtotal > 0 ? `$${subtotal.toFixed(2)}` : '-'}
                    </td>
                    <td className="text-center">
                      <span className={`font-medium ${linea.cantidadSurtida === linea.cantidadSolicitada ? 'text-green-600' : 'text-amber-600'}`}>
                        {linea.cantidadSurtida} / {linea.cantidadSolicitada}
                      </span>
                    </td>
                    <td>
                      {pendiente === 0 ? (
                        <span className="badge badge-success">Completo</span>
                      ) : pendiente === linea.cantidadSolicitada ? (
                        <span className="badge badge-warning">Pendiente</span>
                      ) : (
                        <span className="badge badge-info">Parcial</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {pedido.lineas && pedido.lineas.length > 0 && (
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="text-right font-semibold">Total:</td>
                  <td className="text-right font-mono font-bold text-lg">
                    ${pedido.lineas.reduce((sum: number, l: any) => {
                      const subtotal = l.subtotal ? parseFloat(l.subtotal) : (parseFloat(l.precioUnitario || 0) * l.cantidadSolicitada)
                      return sum + subtotal
                    }, 0).toFixed(2)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Modal de Cancelar */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-amber-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Cancelar Pedido</h3>
                <p className="text-sm text-gray-500">{pedido.numeroPedido}</p>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              Esta acción cancelará el pedido y liberará todas las tarimas asignadas.
              El pedido quedará marcado como CANCELADO pero no se eliminará del sistema.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo de cancelación (opcional)
              </label>
              <textarea
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                className="input w-full"
                rows={3}
                placeholder="Ej: Cliente canceló el pedido, producto no disponible..."
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelMotivo('')
                }}
                className="btn-ghost"
                disabled={cancelarMutation.isPending}
              >
                Volver
              </button>
              <button
                onClick={() => cancelarMutation.mutate(cancelMotivo || undefined)}
                disabled={cancelarMutation.isPending}
                className="btn-primary bg-amber-600 hover:bg-amber-700"
              >
                {cancelarMutation.isPending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <XCircle size={20} />
                )}
                Cancelar Pedido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Eliminar */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-600">Eliminar Permanentemente</h3>
                <p className="text-sm text-gray-500">{pedido.numeroPedido}</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800 font-medium mb-2">⚠️ Advertencia</p>
              <p className="text-red-700 text-sm">
                Esta acción eliminará permanentemente el pedido y todos sus registros asociados:
              </p>
              <ul className="text-red-700 text-sm mt-2 list-disc list-inside">
                <li>Líneas del pedido</li>
                <li>Asignaciones de picking</li>
                <li>Pagos registrados</li>
                <li>Créditos asociados</li>
              </ul>
              <p className="text-red-800 font-semibold mt-2">Esta acción NO se puede deshacer.</p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-ghost"
                disabled={eliminarMutation.isPending}
              >
                Volver
              </button>
              <button
                onClick={() => eliminarMutation.mutate()}
                disabled={eliminarMutation.isPending}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                {eliminarMutation.isPending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Trash2 size={20} />
                )}
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmar Picking/Surtido */}
      {showPickingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-accent-600 text-white p-4">
              <h3 className="text-lg font-bold">Confirmar Surtido de Pedido</h3>
              <p className="text-accent-200 text-sm">{pedido.numeroPedido}</p>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-600 mb-4">
                Marca cada producto conforme lo vayas surtiendo. Una vez confirmados todos,
                podrás autorizar con tu PIN.
              </p>

              <div className="space-y-3">
                {pedido.lineas?.map((linea: any) => (
                  <div
                    key={linea.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      lineasConfirmadas[linea.id]
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setLineasConfirmadas({
                      ...lineasConfirmadas,
                      [linea.id]: !lineasConfirmadas[linea.id]
                    })}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                        lineasConfirmadas[linea.id]
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300'
                      }`}>
                        {lineasConfirmadas[linea.id] && <CheckCircle size={20} className="text-white" />}
                      </div>

                      <div className="flex-1">
                        <p className="font-semibold">{linea.producto.nombre}</p>
                        <p className="text-sm text-gray-500">{linea.producto.sku}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-accent-600">{linea.cantidadSolicitada}</p>
                        <p className="text-xs text-gray-500">unidades</p>
                      </div>
                    </div>

                    {linea.asignaciones?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-dashed space-y-1">
                        {linea.asignaciones.map((asig: any, idx: number) => (
                          <div key={asig.id} className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </span>
                            <MapPin size={14} className="text-red-500" />
                            <span className="font-medium">{asig.tarima?.ubicacion?.codigo || 'S/U'}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-mono">{asig.tarima?.qrCode}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-bold">{asig.cantidadAsignada} uds</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm">
                  <span className="text-gray-500">Confirmados: </span>
                  <span className={`font-bold ${todasLineasConfirmadas ? 'text-green-600' : 'text-amber-600'}`}>
                    {Object.values(lineasConfirmadas).filter(Boolean).length} / {pedido.lineas?.length || 0}
                  </span>
                </div>
                {todasLineasConfirmadas && (
                  <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                    <CheckCircle size={16} /> Todo listo para autorizar
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPickingModal(false)
                    setLineasConfirmadas({})
                  }}
                  className="flex-1 btn-ghost"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setShowPinModal(true)}
                  disabled={!todasLineasConfirmadas || confirmarPickingMutation.isPending}
                  className="flex-1 btn-primary bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {confirmarPickingMutation.isPending ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <CheckCircle size={20} />
                  )}
                  Autorizar con PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de PIN */}
      <PinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onVerify={handleVerifyPin}
        title="Autorizar Surtido"
      />

      {/* Modal de Enviar a Revisión */}
      {showRevisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-amber-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Reportar Problema</h3>
                <p className="text-sm text-gray-500">{pedido.numeroPedido}</p>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              Si encontraste un problema con este pedido (producto faltante, dañado, etc.),
              descríbelo para que un supervisor lo revise.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción del problema *
              </label>
              <textarea
                value={revisionMotivo}
                onChange={(e) => setRevisionMotivo(e.target.value)}
                className="input w-full"
                rows={3}
                placeholder="Ej: No hay suficiente producto en la tarima asignada..."
                required
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRevisionModal(false)
                  setRevisionMotivo('')
                }}
                className="btn-ghost"
                disabled={enviarRevisionMutation.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={() => enviarRevisionMutation.mutate(revisionMotivo)}
                disabled={enviarRevisionMutation.isPending || !revisionMotivo.trim()}
                className="btn-primary bg-amber-600 hover:bg-amber-700"
              >
                {enviarRevisionMutation.isPending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <AlertTriangle size={20} />
                )}
                Enviar a Revisión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resolver Revisión */}
      {showResolverModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="text-green-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Resolver Revisión</h3>
                <p className="text-sm text-gray-500">{pedido.numeroPedido}</p>
              </div>
            </div>

            <p className="text-gray-600 mb-4">
              Describe cómo se resolvió el problema reportado por bodega.
              El pedido volverá al estado ENVIADO_BODEGA.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resolución del problema *
              </label>
              <textarea
                value={resolucionTexto}
                onChange={(e) => setResolucionTexto(e.target.value)}
                className="input w-full"
                rows={3}
                placeholder="Ej: Se reasignó producto de otra tarima, se ajustó la cantidad..."
                required
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowResolverModal(false)
                  setResolucionTexto('')
                }}
                className="btn-ghost"
                disabled={resolverRevisionMutation.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={() => resolverRevisionMutation.mutate(resolucionTexto)}
                disabled={resolverRevisionMutation.isPending || !resolucionTexto.trim()}
                className="btn-primary bg-green-600 hover:bg-green-700"
              >
                {resolverRevisionMutation.isPending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <CheckCircle size={20} />
                )}
                Resolver y Devolver a Bodega
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón rápido para liquidar crédito (si existe) */}
      {pedido.creditos && pedido.creditos.length > 0 && pedido.creditos.some((c: any) => parseFloat(c.montoPendiente) > 0) && (
        <div className="fixed bottom-6 right-6 z-40">
          <Link
            to={`/creditos/${pedido.creditos.find((c: any) => parseFloat(c.montoPendiente) > 0)?.id}`}
            className="btn-primary bg-amber-500 hover:bg-amber-600 shadow-lg flex items-center gap-2 px-6 py-3"
          >
            <DollarSign size={20} />
            Liquidar Crédito (${pedido.creditos.reduce((sum: number, c: any) => sum + parseFloat(c.montoPendiente), 0).toFixed(2)})
          </Link>
        </div>
      )}
    </div>
  )
}
