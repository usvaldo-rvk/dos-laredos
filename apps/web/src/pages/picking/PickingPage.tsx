import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ScanLine,
  CheckCircle,
  Loader2,
  MapPin,
  Package,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  XCircle,
  Clock,
  User
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'
import { pedidosApi, pickingApi, authApi } from '../../services/api'

// Modal para PIN de supervisor (cuando escanean tarima incorrecta)
function ModalPinOverride({
  open,
  onClose,
  onConfirm,
  tarimaEsperada,
  tarimaEscaneada
}: {
  open: boolean
  onClose: () => void
  onConfirm: (supervisorId: string) => void
  tarimaEsperada: string
  tarimaEscaneada: string
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length !== 4) {
      setError('El PIN debe tener 4 dígitos')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await authApi.verifyPin(pin)
      onConfirm(result.supervisor.id)
      setPin('')
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.error || 'PIN inválido')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
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
        <div className="flex items-center gap-3 mb-4 text-amber-600">
          <AlertTriangle size={24} />
          <h3 className="text-lg font-bold">Tarima Diferente</h3>
        </div>

        <div className="mb-4 p-3 bg-amber-50 rounded-lg text-sm">
          <p className="mb-2"><strong>Esperada:</strong> {tarimaEsperada}</p>
          <p><strong>Escaneada:</strong> {tarimaEscaneada}</p>
        </div>

        <p className="text-gray-600 mb-4 text-sm">
          Para usar una tarima diferente a la asignada, ingrese el PIN de un supervisor.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            className="input text-center text-2xl tracking-widest mb-3"
            placeholder="****"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />

          {error && (
            <p className="text-red-500 text-sm mb-3 text-center">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setPin(''); setError(''); onClose() }}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || pin.length !== 4}
              className="btn-primary flex-1"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Autorizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PickingPage() {
  const { almacenActivo } = useAuthStore()
  const queryClient = useQueryClient()

  // Estados
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<any>(null)
  const [asignacionActual, setAsignacionActual] = useState<number>(0)
  const [qrCode, setQrCode] = useState('')
  const [qrValidado, setQrValidado] = useState(false)
  const [cantidadConfirmar, setCantidadConfirmar] = useState<number>(0)
  const [modalPinOpen, setModalPinOpen] = useState(false)
  const [tarimaEscaneadaInfo, setTarimaEscaneadaInfo] = useState<any>(null)

  // Query: Pedidos enviados a bodega
  const { data: pedidosData, isLoading: loadingPedidos } = useQuery({
    queryKey: ['pedidos-picking', almacenActivo?.id],
    queryFn: () => pedidosApi.list({
      almacenId: almacenActivo?.id,
      estado: 'ENVIADO_BODEGA'
    }),
    refetchInterval: 15000
  })

  // Query: Detalle del pedido seleccionado
  const { data: pedidoDetalle, isLoading: loadingDetalle } = useQuery({
    queryKey: ['pedido', pedidoSeleccionado?.id],
    queryFn: () => pedidosApi.get(pedidoSeleccionado!.id),
    enabled: !!pedidoSeleccionado?.id
  })

  // Mutation: Confirmar pick
  const confirmarMutation = useMutation({
    mutationFn: ({ asignacionId, cantidad, supervisorId }: {
      asignacionId: string
      cantidad: number
      supervisorId?: string
    }) => pickingApi.confirmar(asignacionId, cantidad, supervisorId),
    onSuccess: () => {
      toast.success('Pick confirmado')
      queryClient.invalidateQueries({ queryKey: ['pedido', pedidoSeleccionado?.id] })
      queryClient.invalidateQueries({ queryKey: ['pedidos-picking'] })

      // Avanzar a la siguiente asignación
      avanzarSiguienteAsignacion()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al confirmar pick')
    }
  })

  // Obtener todas las asignaciones pendientes del pedido
  const asignacionesPendientes = pedidoDetalle?.lineas?.flatMap((linea: any) =>
    linea.asignaciones
      ?.filter((a: any) => a.estado === 'ABIERTA')
      .map((a: any) => ({
        ...a,
        linea,
        producto: linea.producto
      }))
  ) || []

  const asignacionesCompletadas = pedidoDetalle?.lineas?.flatMap((linea: any) =>
    linea.asignaciones
      ?.filter((a: any) => a.estado === 'CONFIRMADA')
      .map((a: any) => ({
        ...a,
        linea,
        producto: linea.producto
      }))
  ) || []

  const asignacionEnCurso = asignacionesPendientes[asignacionActual]
  const totalAsignaciones = asignacionesPendientes.length + asignacionesCompletadas.length
  const progreso = asignacionesCompletadas.length

  // Handlers
  const handleSeleccionarPedido = (pedido: any) => {
    setPedidoSeleccionado(pedido)
    setAsignacionActual(0)
    setQrCode('')
    setQrValidado(false)
    setCantidadConfirmar(0)
  }

  const handleVolverLista = () => {
    setPedidoSeleccionado(null)
    setAsignacionActual(0)
    setQrCode('')
    setQrValidado(false)
    setCantidadConfirmar(0)
    setTarimaEscaneadaInfo(null)
  }

  const handleEscanear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!qrCode.trim() || !asignacionEnCurso) return

    const qrLimpio = qrCode.trim().toUpperCase()
    const qrEsperado = asignacionEnCurso.tarima.qrCode.toUpperCase()

    if (qrLimpio === qrEsperado) {
      // QR correcto
      setQrValidado(true)
      setCantidadConfirmar(asignacionEnCurso.cantidadAsignada)
      toast.success('Tarima correcta')
    } else {
      // QR diferente - pedir autorización
      try {
        const tarimaInfo = await pickingApi.escanear(qrLimpio)
        setTarimaEscaneadaInfo(tarimaInfo)
        setModalPinOpen(true)
      } catch {
        toast.error('Tarima no encontrada')
      }
    }
    setQrCode('')
  }

  const handlePinOverride = (supervisorId: string) => {
    // Supervisor autorizó usar tarima diferente
    setQrValidado(true)
    setCantidadConfirmar(asignacionEnCurso.cantidadAsignada)
    toast.success('Autorizado por supervisor')
    setTarimaEscaneadaInfo(null)
  }

  const handleConfirmarPick = () => {
    if (!asignacionEnCurso || cantidadConfirmar <= 0) return

    confirmarMutation.mutate({
      asignacionId: asignacionEnCurso.id,
      cantidad: cantidadConfirmar
    })
  }

  const avanzarSiguienteAsignacion = () => {
    setQrValidado(false)
    setCantidadConfirmar(0)
    setQrCode('')

    if (asignacionActual < asignacionesPendientes.length - 1) {
      setAsignacionActual(prev => prev + 1)
    } else {
      // Pedido completado
      toast.success('Pedido completado!')
      handleVolverLista()
    }
  }

  const pedidos = pedidosData?.data || []

  // ==================== RENDER ====================

  // Vista: Lista de pedidos
  if (!pedidoSeleccionado) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Picking de Bodega</h1>
          <p className="text-gray-600">Selecciona un pedido para comenzar el surtido</p>
        </div>

        {loadingPedidos ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-accent-500" size={40} />
          </div>
        ) : pedidos.length === 0 ? (
          <div className="card p-12 text-center">
            <Package size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-500">No hay pedidos pendientes</h3>
            <p className="text-gray-400">Los pedidos en preparación aparecerán aquí</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pedidos.map((pedido: any) => {
              const totalLineas = pedido.lineas?.length || 0
              const totalUnidades = pedido.lineas?.reduce((sum: number, l: any) =>
                sum + l.cantidadSolicitada, 0) || 0

              return (
                <div
                  key={pedido.id}
                  onClick={() => handleSeleccionarPedido(pedido)}
                  className="card p-6 cursor-pointer hover:border-accent-400 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-accent-100 rounded-full flex items-center justify-center">
                        <Package size={24} className="text-accent-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg font-mono">{pedido.numeroPedido}</h3>
                        <p className="text-gray-600 flex items-center gap-2">
                          <User size={14} />
                          {pedido.cliente?.nombreEmpresa || pedido.cliente?.nombreContacto}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-accent-600">{totalLineas}</p>
                        <p className="text-xs text-gray-500">Productos</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{totalUnidades}</p>
                        <p className="text-xs text-gray-500">Unidades</p>
                      </div>
                      <ArrowRight size={24} className="text-gray-400" />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                    <Clock size={14} />
                    {new Date(pedido.createdAt).toLocaleString()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Vista: Proceso de picking
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={handleVolverLista} className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 font-mono">
            {pedidoSeleccionado.numeroPedido}
          </h1>
          <p className="text-gray-600">
            {pedidoSeleccionado.cliente?.nombreEmpresa || pedidoSeleccionado.cliente?.nombreContacto}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Progreso</p>
          <p className="text-xl font-bold">
            <span className="text-green-600">{progreso}</span>
            <span className="text-gray-400">/{totalAsignaciones}</span>
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${totalAsignaciones > 0 ? (progreso / totalAsignaciones) * 100 : 0}%` }}
        />
      </div>

      {loadingDetalle ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-accent-500" size={40} />
        </div>
      ) : asignacionesPendientes.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-bold text-green-600 mb-2">Pedido Completado</h3>
          <p className="text-gray-500 mb-6">Todas las asignaciones han sido confirmadas</p>
          <button onClick={handleVolverLista} className="btn-primary">
            Volver a la lista
          </button>
        </div>
      ) : (
        <>
          {/* Instrucción actual */}
          <div className="card border-2 border-accent-400">
            <div className="bg-accent-50 px-6 py-4 border-b border-accent-200">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-accent-800">
                  Paso {asignacionActual + 1} de {asignacionesPendientes.length}
                </h2>
                <span className="badge badge-info">
                  {asignacionEnCurso?.producto?.nombre}
                </span>
              </div>
            </div>

            <div className="p-6">
              {/* Info de ubicación y tarima */}
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="text-center p-4 bg-red-50 rounded-lg border-2 border-red-200">
                  <MapPin size={32} className="mx-auto text-red-500 mb-2" />
                  <p className="text-sm text-gray-500">Ubicación</p>
                  <p className="text-3xl font-bold text-red-600">
                    {asignacionEnCurso?.tarima?.ubicacion?.codigo || 'S/U'}
                  </p>
                </div>

                <div className="text-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <ScanLine size={32} className="mx-auto text-blue-500 mb-2" />
                  <p className="text-sm text-gray-500">Tarima</p>
                  <p className="text-lg font-bold font-mono text-blue-600">
                    {asignacionEnCurso?.tarima?.qrCode}
                  </p>
                  {asignacionEnCurso?.tarima?.proveedor && (
                    <p className="text-xs text-gray-500 mt-1">
                      {asignacionEnCurso.tarima.proveedor.nombre}
                    </p>
                  )}
                </div>

                <div className="text-center p-4 bg-accent-50 rounded-lg border-2 border-accent-200">
                  <Package size={32} className="mx-auto text-accent-500 mb-2" />
                  <p className="text-sm text-gray-500">Cantidad</p>
                  <p className="text-4xl font-bold text-accent-600">
                    {asignacionEnCurso?.cantidadAsignada}
                  </p>
                </div>
              </div>

              {/* Escáner o confirmación */}
              {!qrValidado ? (
                <div>
                  <p className="text-center text-gray-600 mb-4">
                    Escanea el código QR de la tarima para continuar
                  </p>
                  <form onSubmit={handleEscanear} className="flex gap-3">
                    <div className="flex-1 relative">
                      <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="text"
                        className="input pl-10 text-lg"
                        placeholder="Escanear código QR..."
                        value={qrCode}
                        onChange={(e) => setQrCode(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <button type="submit" className="btn-primary px-8">
                      Verificar
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                    <CheckCircle size={24} />
                    <span className="font-medium">Tarima verificada</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="text-gray-600">Cantidad tomada:</label>
                    <input
                      type="number"
                      className="input w-32 text-center text-xl font-bold"
                      value={cantidadConfirmar}
                      onChange={(e) => setCantidadConfirmar(parseInt(e.target.value) || 0)}
                      min={1}
                      max={asignacionEnCurso?.cantidadAsignada}
                    />
                    <span className="text-gray-500">
                      de {asignacionEnCurso?.cantidadAsignada} asignadas
                    </span>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setQrValidado(false)}
                      className="btn-secondary flex-1"
                    >
                      <XCircle size={20} />
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmarPick}
                      disabled={confirmarMutation.isPending || cantidadConfirmar <= 0}
                      className="btn-accent flex-1"
                    >
                      {confirmarMutation.isPending ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <CheckCircle size={20} />
                      )}
                      Confirmar Pick
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lista de instrucciones restantes */}
          {asignacionesPendientes.length > 1 && (
            <div className="card">
              <div className="card-header border-b">
                <h3 className="font-semibold text-gray-700">Instrucciones siguientes</h3>
              </div>
              <div className="divide-y">
                {asignacionesPendientes.slice(asignacionActual + 1).map((asig: any, idx: number) => (
                  <div key={asig.id} className="p-4 flex items-center gap-4">
                    <div className="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center font-bold text-sm">
                      {asignacionActual + idx + 2}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{asig.producto.nombre}</p>
                      <p className="text-sm text-gray-500 font-mono">{asig.tarima.qrCode}</p>
                      {asig.tarima.proveedor && (
                        <p className="text-xs text-gray-400">{asig.tarima.proveedor.nombre}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <MapPin size={16} />
                      <span className="font-medium">{asig.tarima.ubicacion?.codigo || 'S/U'}</span>
                    </div>
                    <div className="font-bold text-lg">{asig.cantidadAsignada}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completados */}
          {asignacionesCompletadas.length > 0 && (
            <div className="card">
              <div className="card-header border-b bg-green-50">
                <h3 className="font-semibold text-green-700 flex items-center gap-2">
                  <CheckCircle size={18} />
                  Completados ({asignacionesCompletadas.length})
                </h3>
              </div>
              <div className="divide-y">
                {asignacionesCompletadas.map((asig: any) => (
                  <div key={asig.id} className="p-4 flex items-center gap-4 bg-green-50/50">
                    <CheckCircle size={20} className="text-green-500" />
                    <div className="flex-1">
                      <p className="font-medium">{asig.producto.nombre}</p>
                      <p className="text-sm text-gray-500 font-mono">{asig.tarima.qrCode}</p>
                    </div>
                    <div className="font-bold text-green-600">
                      {asig.cantidadConfirmada || asig.cantidadAsignada}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal PIN para override */}
      <ModalPinOverride
        open={modalPinOpen}
        onClose={() => {
          setModalPinOpen(false)
          setTarimaEscaneadaInfo(null)
        }}
        onConfirm={handlePinOverride}
        tarimaEsperada={asignacionEnCurso?.tarima?.qrCode || ''}
        tarimaEscaneada={tarimaEscaneadaInfo?.tarima?.qrCode || qrCode}
      />
    </div>
  )
}
