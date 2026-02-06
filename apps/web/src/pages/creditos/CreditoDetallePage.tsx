import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CreditCard, DollarSign, Calendar, User,
  FileText, Plus, X, CheckCircle, Clock, AlertCircle,
  Banknote, Building2, CreditCard as CardIcon, Trash2
} from 'lucide-react'
import { creditosApi, comprobantesApi } from '../../services/api'
import toast from 'react-hot-toast'

type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'

interface PagoLinea {
  metodoPago: MetodoPago
  monto: number
  referencia?: string
  comprobante?: string
}

export default function CreditoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [showAbonoForm, setShowAbonoForm] = useState(false)

  // Estado para pagos múltiples
  const [pagos, setPagos] = useState<PagoLinea[]>([])
  const [metodoPagoActivo, setMetodoPagoActivo] = useState<MetodoPago | null>(null)
  const [montoParcial, setMontoParcial] = useState('')
  const [referenciaPago, setReferenciaPago] = useState('')
  const [comprobantePago, setComprobantePago] = useState('')

  // Estado para calculadora de cambio
  const [efectivoRecibido, setEfectivoRecibido] = useState('')
  const [mostrarCambio, setMostrarCambio] = useState(false)

  const [uploading, setUploading] = useState(false)

  const { data: credito, isLoading } = useQuery({
    queryKey: ['credito', id],
    queryFn: () => creditosApi.get(id!),
    enabled: !!id
  })

  const { data: abonos } = useQuery({
    queryKey: ['credito-abonos', id],
    queryFn: () => creditosApi.getAbonos(id!),
    enabled: !!id
  })

  const registrarAbonoMutation = useMutation({
    mutationFn: async (pagosData: PagoLinea[]) => {
      // Registrar cada pago por separado
      for (const pago of pagosData) {
        await creditosApi.registrarAbono(id!, {
          metodoPago: pago.metodoPago,
          monto: pago.monto,
          referencia: pago.referencia,
          comprobante: pago.comprobante
        })
      }
    },
    onSuccess: () => {
      toast.success('Pago(s) registrado(s) correctamente')
      queryClient.invalidateQueries({ queryKey: ['credito', id] })
      queryClient.invalidateQueries({ queryKey: ['credito-abonos', id] })
      queryClient.invalidateQueries({ queryKey: ['creditos'] })
      queryClient.invalidateQueries({ queryKey: ['creditos-resumen'] })
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al registrar pago')
    }
  })

  const resetForm = () => {
    setShowAbonoForm(false)
    setPagos([])
    setMetodoPagoActivo(null)
    setMontoParcial('')
    setReferenciaPago('')
    setComprobantePago('')
    setEfectivoRecibido('')
    setMostrarCambio(false)
  }

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

  const getMetodoPagoIcon = (metodo: string) => {
    switch (metodo) {
      case 'EFECTIVO': return <Banknote size={16} className="text-green-600" />
      case 'TRANSFERENCIA': return <Building2 size={16} className="text-blue-600" />
      case 'TARJETA': return <CardIcon size={16} className="text-purple-600" />
      default: return <DollarSign size={16} />
    }
  }


  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando...</div>
  }

  if (!credito) {
    return <div className="p-8 text-center text-red-500">Crédito no encontrado</div>
  }

  const porcentajePagado = ((parseFloat(credito.montoOriginal) - parseFloat(credito.montoPendiente)) / parseFloat(credito.montoOriginal)) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/creditos" className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Detalle de Crédito</h1>
          <p className="text-gray-600">
            {credito.cliente?.nombreEmpresa || credito.cliente?.nombreContacto}
          </p>
        </div>
        {getEstadoBadge(credito.estado)}
      </div>

      {/* Info Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resumen del Crédito */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard size={20} /> Información del Crédito
            </h2>

            {/* Barra de progreso */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span>Progreso de pago</span>
                <span>{porcentajePagado.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-500 h-4 rounded-full transition-all"
                  style={{ width: `${Math.min(porcentajePagado, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Monto Original</p>
                <p className="text-xl font-bold">{formatCurrency(credito.montoOriginal)}</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-600">Pendiente</p>
                <p className="text-xl font-bold text-yellow-700">{formatCurrency(credito.montoPendiente)}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-600">Pagado</p>
                <p className="text-xl font-bold text-green-700">
                  {formatCurrency(parseFloat(credito.montoOriginal) - parseFloat(credito.montoPendiente))}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Abonos Realizados</p>
                <p className="text-xl font-bold">{abonos?.abonos?.length || 0}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User size={16} className="text-gray-400" />
                <span className="text-gray-500">Cliente:</span>
                <Link to={`/clientes/${credito.cliente?.id}`} className="text-accent-600 hover:underline">
                  {credito.cliente?.nombreEmpresa || credito.cliente?.nombreContacto}
                </Link>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileText size={16} className="text-gray-400" />
                <span className="text-gray-500">Pedido:</span>
                <Link to={`/pedidos/${credito.pedido?.id}`} className="text-accent-600 hover:underline">
                  {credito.pedido?.numeroPedido}
                </Link>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={16} className="text-gray-400" />
                <span className="text-gray-500">Fecha:</span>
                <span>{new Date(credito.createdAt).toLocaleDateString('es-MX', {
                  year: 'numeric', month: 'long', day: 'numeric'
                })}</span>
              </div>
              {credito.notas && (
                <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                  <p className="text-gray-500">Notas:</p>
                  <p>{credito.notas}</p>
                </div>
              )}
            </div>
          </div>

          {/* Historial de Abonos */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign size={20} /> Historial de Abonos
              </h2>
              {credito.estado !== 'PAGADO' && (
                <button
                  onClick={() => setShowAbonoForm(true)}
                  className="btn-primary text-sm"
                >
                  <Plus size={16} /> Registrar Abono
                </button>
              )}
            </div>

            {!abonos?.abonos || abonos.abonos.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No hay abonos registrados</p>
            ) : (
              <div className="space-y-3">
                {abonos.abonos.map((abono: any) => (
                  <div key={abono.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getMetodoPagoIcon(abono.metodoPago)}
                      <div>
                        <p className="font-medium">{formatCurrency(abono.monto)}</p>
                        <p className="text-sm text-gray-500">
                          {abono.metodoPago} {abono.referencia && `- ${abono.referencia}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {new Date(abono.createdAt).toLocaleDateString('es-MX')}
                      </p>
                      <p className="text-xs text-gray-400">
                        {abono.registradoPorRef?.nombre}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="space-y-6">
          {credito.estado !== 'PAGADO' && (
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Acción Rápida</h3>
              <button
                onClick={() => setShowAbonoForm(true)}
                className="w-full btn-success"
              >
                <CheckCircle size={20} />
                Liquidar Crédito Completo
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Registra el pago total de {formatCurrency(credito.montoPendiente)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Pago - Estilo POS */}
      {showAbonoForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Liquidar Crédito</h3>
                  <p className="text-amber-200 text-sm">
                    {credito.cliente?.nombreEmpresa || credito.cliente?.nombreContacto}
                  </p>
                </div>
                <button onClick={resetForm} className="text-white/80 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-amber-200 text-xs">PENDIENTE POR COBRAR</p>
                  <p className="text-3xl font-bold font-mono">{formatCurrency(credito.montoPendiente)}</p>
                </div>
                {pagos.length > 0 && (
                  <div className="text-right">
                    <p className="text-amber-200 text-xs">FALTA POR ASIGNAR</p>
                    <p className="text-2xl font-bold font-mono">
                      {formatCurrency(Math.max(0, parseFloat(credito.montoPendiente) - pagos.reduce((s, p) => s + p.monto, 0)))}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
              {/* Selector de método de pago */}
              {(() => {
                const pendienteAsignar = parseFloat(credito.montoPendiente) - pagos.reduce((s, p) => s + p.monto, 0)
                return pendienteAsignar > 0.01 ? (
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-3">Selecciona método de pago</p>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setMetodoPagoActivo('EFECTIVO')
                          setMontoParcial(pendienteAsignar.toFixed(2))
                        }}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                          metodoPagoActivo === 'EFECTIVO'
                            ? 'border-green-500 bg-green-100 ring-2 ring-green-500'
                            : 'border-green-200 bg-green-50 hover:bg-green-100'
                        }`}
                      >
                        <Banknote size={28} className="text-green-600" />
                        <span className="font-semibold text-green-700">Efectivo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMetodoPagoActivo('TRANSFERENCIA')
                          setMontoParcial(pendienteAsignar.toFixed(2))
                        }}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                          metodoPagoActivo === 'TRANSFERENCIA'
                            ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-500'
                            : 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                        }`}
                      >
                        <Building2 size={28} className="text-blue-600" />
                        <span className="font-semibold text-blue-700">Transferencia</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMetodoPagoActivo('TARJETA')
                          setMontoParcial(pendienteAsignar.toFixed(2))
                        }}
                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                          metodoPagoActivo === 'TARJETA'
                            ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-500'
                            : 'border-purple-200 bg-purple-50 hover:bg-purple-100'
                        }`}
                      >
                        <CardIcon size={28} className="text-purple-600" />
                        <span className="font-semibold text-purple-700">Tarjeta</span>
                      </button>
                    </div>
                  </div>
                ) : null
              })()}

              {/* Panel de entrada de monto */}
              {metodoPagoActivo && (
                <div className={`rounded-xl p-4 border-2 ${
                  metodoPagoActivo === 'EFECTIVO' ? 'bg-green-50 border-green-300' :
                  metodoPagoActivo === 'TRANSFERENCIA' ? 'bg-blue-50 border-blue-300' :
                  'bg-purple-50 border-purple-300'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {metodoPagoActivo === 'EFECTIVO' && <Banknote size={20} className="text-green-600" />}
                      {metodoPagoActivo === 'TRANSFERENCIA' && <Building2 size={20} className="text-blue-600" />}
                      {metodoPagoActivo === 'TARJETA' && <CardIcon size={20} className="text-purple-600" />}
                      <span className="font-bold">{metodoPagoActivo}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMetodoPagoActivo(null)
                        setMontoParcial('')
                        setReferenciaPago('')
                        setComprobantePago('')
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Monto */}
                  <div className="mb-3">
                    <label className="text-sm font-medium mb-1 block">Monto:</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold">$</span>
                      <input
                        type="number"
                        className="input text-xl font-bold font-mono flex-1 text-center py-2"
                        value={montoParcial}
                        onChange={(e) => setMontoParcial(e.target.value)}
                        step="0.01"
                        min="0"
                        max={parseFloat(credito.montoPendiente) - pagos.reduce((s, p) => s + p.monto, 0)}
                      />
                    </div>
                  </div>

                  {/* Botones rápidos de monto */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[100, 500, 1000, 2000, 5000].filter(m => m <= parseFloat(credito.montoPendiente) - pagos.reduce((s, p) => s + p.monto, 0) + 0.01).map((monto) => (
                      <button
                        key={monto}
                        type="button"
                        onClick={() => setMontoParcial(Math.min(monto, parseFloat(credito.montoPendiente) - pagos.reduce((s, p) => s + p.monto, 0)).toString())}
                        className="px-3 py-1 rounded-lg text-sm font-bold bg-white border hover:bg-gray-50"
                      >
                        ${monto.toLocaleString()}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMontoParcial((parseFloat(credito.montoPendiente) - pagos.reduce((s, p) => s + p.monto, 0)).toFixed(2))}
                      className="px-3 py-1 rounded-lg text-sm font-bold bg-white border hover:bg-gray-50"
                    >
                      Todo
                    </button>
                  </div>

                  {/* Referencia para transferencia */}
                  {metodoPagoActivo === 'TRANSFERENCIA' && (
                    <div className="mb-3 space-y-2">
                      <input
                        type="text"
                        className="input"
                        placeholder="Número de referencia"
                        value={referenciaPago}
                        onChange={(e) => setReferenciaPago(e.target.value)}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setUploading(true)
                          try {
                            const result = await comprobantesApi.upload(file)
                            setComprobantePago(result.url)
                            toast.success('Comprobante subido')
                          } catch {
                            toast.error('Error al subir')
                          } finally {
                            setUploading(false)
                          }
                        }}
                        className="input text-sm"
                        disabled={uploading}
                      />
                      {comprobantePago && <p className="text-xs text-green-600">Comprobante cargado</p>}
                    </div>
                  )}

                  {/* Botón agregar */}
                  <button
                    type="button"
                    onClick={() => {
                      const monto = parseFloat(montoParcial)
                      if (isNaN(monto) || monto <= 0) {
                        toast.error('Monto inválido')
                        return
                      }
                      const pendiente = parseFloat(credito.montoPendiente) - pagos.reduce((s, p) => s + p.monto, 0)
                      if (monto > pendiente + 0.01) {
                        toast.error('El monto excede el pendiente')
                        return
                      }
                      setPagos([...pagos, {
                        metodoPago: metodoPagoActivo,
                        monto,
                        referencia: referenciaPago || undefined,
                        comprobante: comprobantePago || undefined
                      }])
                      if (metodoPagoActivo === 'EFECTIVO') {
                        setMostrarCambio(true)
                        setEfectivoRecibido('')
                      }
                      setMetodoPagoActivo(null)
                      setMontoParcial('')
                      setReferenciaPago('')
                      setComprobantePago('')
                    }}
                    className={`w-full py-2 rounded-xl font-bold text-white ${
                      metodoPagoActivo === 'EFECTIVO' ? 'bg-green-600 hover:bg-green-700' :
                      metodoPagoActivo === 'TRANSFERENCIA' ? 'bg-blue-600 hover:bg-blue-700' :
                      'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    <Plus size={18} className="inline mr-1" />
                    Agregar ${parseFloat(montoParcial || '0').toFixed(2)}
                  </button>
                </div>
              )}

              {/* Calculadora de cambio para efectivo */}
              {mostrarCambio && pagos.some(p => p.metodoPago === 'EFECTIVO') && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Banknote size={20} className="text-green-600" />
                      <span className="font-bold text-green-800">Calcular Cambio</span>
                    </div>
                    <button onClick={() => setMostrarCambio(false)} className="text-gray-500">
                      <X size={16} />
                    </button>
                  </div>

                  {(() => {
                    const totalEfectivo = pagos.filter(p => p.metodoPago === 'EFECTIVO').reduce((s, p) => s + p.monto, 0)
                    return (
                      <>
                        <p className="text-sm text-green-700 mb-2">
                          Total en efectivo: <span className="font-bold">${totalEfectivo.toFixed(2)}</span>
                        </p>
                        <div className="mb-3">
                          <label className="text-sm text-green-700 mb-1 block">¿Con cuánto paga?</label>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-green-600">$</span>
                            <input
                              type="number"
                              className="input text-2xl font-bold font-mono flex-1 text-center py-3"
                              value={efectivoRecibido}
                              onChange={(e) => setEfectivoRecibido(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {[20, 50, 100, 200, 500, 1000].filter(m => m >= totalEfectivo).slice(0, 5).map((monto) => (
                            <button
                              key={monto}
                              type="button"
                              onClick={() => setEfectivoRecibido(monto.toString())}
                              className={`px-3 py-1 rounded-lg font-bold text-sm ${
                                parseFloat(efectivoRecibido) === monto
                                  ? 'bg-green-600 text-white'
                                  : 'bg-white border border-green-300 text-green-700'
                              }`}
                            >
                              ${monto}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setEfectivoRecibido(totalEfectivo.toFixed(2))}
                            className="px-3 py-1 rounded-lg font-bold text-sm bg-white border border-green-300 text-green-700"
                          >
                            Exacto
                          </button>
                        </div>
                        {efectivoRecibido && parseFloat(efectivoRecibido) >= totalEfectivo && (
                          <div className="bg-white rounded-lg p-3 border-2 border-green-400">
                            <p className="text-green-600 text-sm font-medium">CAMBIO A ENTREGAR</p>
                            <p className="text-3xl font-bold text-green-700 font-mono">
                              ${(parseFloat(efectivoRecibido) - totalEfectivo).toFixed(2)}
                            </p>
                          </div>
                        )}
                        {efectivoRecibido && parseFloat(efectivoRecibido) < totalEfectivo && (
                          <div className="bg-red-50 rounded-lg p-3 border border-red-300">
                            <p className="text-red-600 font-bold">Monto insuficiente</p>
                            <p className="text-red-500 text-sm">Faltan ${(totalEfectivo - parseFloat(efectivoRecibido)).toFixed(2)}</p>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}

              {/* Lista de pagos agregados */}
              {pagos.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">Pagos a registrar:</p>
                  <div className="space-y-2">
                    {pagos.map((pago, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          pago.metodoPago === 'EFECTIVO' ? 'bg-green-100 text-green-600' :
                          pago.metodoPago === 'TRANSFERENCIA' ? 'bg-blue-100 text-blue-600' :
                          'bg-purple-100 text-purple-600'
                        }`}>
                          {pago.metodoPago === 'EFECTIVO' && <Banknote size={16} />}
                          {pago.metodoPago === 'TRANSFERENCIA' && <Building2 size={16} />}
                          {pago.metodoPago === 'TARJETA' && <CardIcon size={16} />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{pago.metodoPago}</p>
                          {pago.referencia && <p className="text-xs text-gray-500">Ref: {pago.referencia}</p>}
                        </div>
                        <p className="font-bold font-mono">${pago.monto.toFixed(2)}</p>
                        <button
                          type="button"
                          onClick={() => {
                            const nuevosPagos = pagos.filter((_, i) => i !== idx)
                            setPagos(nuevosPagos)
                            if (!nuevosPagos.some(p => p.metodoPago === 'EFECTIVO')) {
                              setMostrarCambio(false)
                            }
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen */}
              {pagos.length > 0 && (
                <div className="bg-gray-100 rounded-xl p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-gray-500">DEUDA</p>
                      <p className="text-lg font-bold font-mono">{formatCurrency(credito.montoPendiente)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">PAGANDO</p>
                      <p className="text-lg font-bold font-mono text-green-600">
                        {formatCurrency(pagos.reduce((s, p) => s + p.monto, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">QUEDARÁ</p>
                      <p className={`text-lg font-bold font-mono ${
                        parseFloat(credito.montoPendiente) - pagos.reduce((s, p) => s + p.monto, 0) <= 0.01
                          ? 'text-green-600'
                          : 'text-amber-600'
                      }`}>
                        {formatCurrency(Math.max(0, parseFloat(credito.montoPendiente) - pagos.reduce((s, p) => s + p.monto, 0)))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-gray-50">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 btn-ghost"
                  disabled={registrarAbonoMutation.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => registrarAbonoMutation.mutate(pagos)}
                  disabled={pagos.length === 0 || registrarAbonoMutation.isPending}
                  className="flex-1 btn-primary bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {registrarAbonoMutation.isPending ? (
                    'Registrando...'
                  ) : (
                    <>
                      <CheckCircle size={18} className="inline mr-1" />
                      Confirmar Pago{pagos.length > 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
