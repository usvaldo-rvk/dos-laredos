import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Loader2, Package, MapPin, ChevronDown, ChevronUp, Check, DollarSign, CreditCard, Banknote, Building2, Upload, X, Image, Truck, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'
import { pedidosApi, catalogosApi, tarimasApi, comprobantesApi } from '../../services/api'
import ClienteSelector from '../../components/ClienteSelector'

type MetodoPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CREDITO'

interface PagoLinea {
  metodoPago: MetodoPago
  monto: number
  referencia?: string
  comprobante?: string
  comprobanteFile?: File
}

interface AsignacionTarima {
  tarimaId: string
  tarimaQr: string
  proveedorId: string           // ID del proveedor
  proveedorNombre: string       // Nombre del proveedor
  ubicacionCodigo: string
  disponible: number
  costoUnitario: number | null  // Costo del proveedor (lo que pagamos)
  cantidadAsignada: number
}

interface LineaPedido {
  productoId: string
  productoSku: string
  productoNombre: string
  cantidadSolicitada: number
  precioPublico: number       // Precio de venta al cliente
  asignaciones: AsignacionTarima[]
}

export default function NuevoPedidoPage() {
  const navigate = useNavigate()
  const { almacenActivo } = useAuthStore()

  const [clienteId, setClienteId] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState<LineaPedido[]>([])
  const [lineaExpandida, setLineaExpandida] = useState<number | null>(null)

  // Estado para entrega
  const [tipoEntrega, setTipoEntrega] = useState<'RECOLECCION' | 'ENVIO'>('RECOLECCION')
  const [direccion, setDireccion] = useState({
    calle: '',
    numero: '',
    colonia: '',
    ciudad: '',
    estado: '',
    cp: '',
    referencia: ''
  })

  // Estado para pagos
  const [pagos, setPagos] = useState<PagoLinea[]>([])
  const [nuevoMetodoPago, setNuevoMetodoPago] = useState<MetodoPago>('EFECTIVO')
  const [nuevoMontoPago, setNuevoMontoPago] = useState('')
  const [nuevaReferencia, setNuevaReferencia] = useState('')
  const [uploadingComprobante, setUploadingComprobante] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado para POS - efectivo recibido
  const [efectivoRecibido, setEfectivoRecibido] = useState<string>('')
  const [mostrarCambio, setMostrarCambio] = useState(false)

  // Estado para pago parcial
  const [metodoPagoActivo, setMetodoPagoActivo] = useState<MetodoPago | null>(null)
  const [montoParcial, setMontoParcial] = useState<string>('')

  // Para agregar nueva línea
  const [productoSeleccionado, setProductoSeleccionado] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [mostrarSelectorTarimas, setMostrarSelectorTarimas] = useState(false)
  const [tarimasDisponibles, setTarimasDisponibles] = useState<any[]>([])
  const [asignacionesTemporal, setAsignacionesTemporal] = useState<AsignacionTarima[]>([])
  const [loadingTarimas, setLoadingTarimas] = useState(false)

  const { data: productos } = useQuery({
    queryKey: ['productos'],
    queryFn: () => catalogosApi.productos()
  })

  // Cargar tarimas activas para calcular inventario disponible por producto
  const { data: tarimasInventario } = useQuery({
    queryKey: ['tarimas-inventario', almacenActivo?.id],
    queryFn: () => tarimasApi.list({ almacenId: almacenActivo?.id, estado: 'ACTIVA' }),
    enabled: !!almacenActivo?.id
  })

  // Calcular inventario disponible por producto
  const inventarioPorProducto = (tarimasInventario?.data || []).reduce((acc: Record<string, number>, tarima: any) => {
    const productoId = tarima.productoId
    const inventario = tarima.inventarioActual ?? tarima.capacidadTotal ?? 0
    acc[productoId] = (acc[productoId] || 0) + inventario
    return acc
  }, {} as Record<string, number>)

  const mutation = useMutation({
    mutationFn: (data: any) => pedidosApi.create(data),
    onSuccess: (data) => {
      toast.success('Pedido creado correctamente')
      navigate(`/pedidos/${data.id}`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear pedido')
    }
  })

  // Cargar tarimas disponibles para un producto
  const cargarTarimasProducto = async (productoId: string) => {
    if (!almacenActivo?.id) return

    setLoadingTarimas(true)
    try {
      const response = await tarimasApi.list({
        almacenId: almacenActivo.id,
        estado: 'ACTIVA'
      })

      // Filtrar solo las tarimas del producto seleccionado con inventario
      const tarimasProducto = (response.data || []).filter(
        (t: any) => t.productoId === productoId && (t.inventarioActual > 0 || t.capacidadTotal > 0)
      )

      setTarimasDisponibles(tarimasProducto)
      setAsignacionesTemporal([])
    } catch (error) {
      toast.error('Error al cargar tarimas')
    } finally {
      setLoadingTarimas(false)
    }
  }

  const handleSeleccionarProducto = async () => {
    if (!productoSeleccionado || cantidad < 1) {
      toast.error('Selecciona un producto y cantidad')
      return
    }

    // Verificar si ya existe
    if (lineas.some(l => l.productoId === productoSeleccionado)) {
      toast.error('Este producto ya está en el pedido')
      return
    }

    await cargarTarimasProducto(productoSeleccionado)
    setMostrarSelectorTarimas(true)
  }

  const toggleAsignacionTarima = (tarima: any, cantidadAsignar: number) => {
    const existe = asignacionesTemporal.find(a => a.tarimaId === tarima.id)

    if (existe) {
      // Quitar
      setAsignacionesTemporal(asignacionesTemporal.filter(a => a.tarimaId !== tarima.id))
    } else {
      // Agregar
      const disponible = tarima.inventarioActual ?? tarima.capacidadTotal
      setAsignacionesTemporal([...asignacionesTemporal, {
        tarimaId: tarima.id,
        tarimaQr: tarima.qrCode,
        proveedorId: tarima.proveedor?.id || '',
        proveedorNombre: tarima.proveedor?.nombre || 'Sin proveedor',
        ubicacionCodigo: tarima.ubicacion?.codigo || 'Sin ubicación',
        disponible,
        costoUnitario: tarima.precioUnitario ? parseFloat(tarima.precioUnitario) : null, // Costo del proveedor
        cantidadAsignada: Math.min(cantidadAsignar, disponible)
      }])
    }
  }

  const actualizarCantidadAsignada = (tarimaId: string, nuevaCantidad: number) => {
    setAsignacionesTemporal(asignacionesTemporal.map(a => {
      if (a.tarimaId === tarimaId) {
        return { ...a, cantidadAsignada: Math.min(nuevaCantidad, a.disponible) }
      }
      return a
    }))
  }

  const getTotalAsignado = () => {
    return asignacionesTemporal.reduce((sum, a) => sum + a.cantidadAsignada, 0)
  }

  const confirmarLinea = () => {
    const totalAsignado = getTotalAsignado()

    if (totalAsignado < cantidad) {
      toast.error(`Faltan ${cantidad - totalAsignado} unidades por asignar`)
      return
    }

    const producto = productos?.find((p: any) => p.id === productoSeleccionado)
    if (!producto) return

    // Obtener precio al público del producto
    const precioPublico = producto.precioPublico ? parseFloat(producto.precioPublico) : 0

    if (precioPublico <= 0) {
      toast.error('Este producto no tiene precio al público configurado')
      return
    }

    setLineas([...lineas, {
      productoId: producto.id,
      productoSku: producto.sku,
      productoNombre: producto.nombre,
      cantidadSolicitada: cantidad,
      precioPublico,
      asignaciones: asignacionesTemporal
    }])

    // Limpiar
    setProductoSeleccionado('')
    setCantidad(1)
    setMostrarSelectorTarimas(false)
    setTarimasDisponibles([])
    setAsignacionesTemporal([])
  }

  const cancelarSeleccion = () => {
    setMostrarSelectorTarimas(false)
    setTarimasDisponibles([])
    setAsignacionesTemporal([])
  }

  const eliminarLinea = (index: number) => {
    setLineas(lineas.filter((_, i) => i !== index))
    if (lineaExpandida === index) setLineaExpandida(null)
  }

  // Calcular total del pedido (usando precio al público)
  const calcularTotalPedido = () => {
    return lineas.reduce((total, linea) => {
      return total + (linea.precioPublico * linea.cantidadSolicitada)
    }, 0)
  }

  // Calcular costo total (lo que pagamos al proveedor)
  const calcularCostoTotal = () => {
    return lineas.reduce((total, linea) => {
      const costoLinea = linea.asignaciones.reduce((sum, asig) => {
        return sum + ((asig.costoUnitario || 0) * asig.cantidadAsignada)
      }, 0)
      return total + costoLinea
    }, 0)
  }

  // Calcular ganancia
  const calcularGanancia = () => {
    return calcularTotalPedido() - calcularCostoTotal()
  }

  const totalPedido = calcularTotalPedido()
  const totalPagado = pagos.filter(p => p.metodoPago !== 'CREDITO').reduce((sum, p) => sum + p.monto, 0)
  const totalCredito = pagos.filter(p => p.metodoPago === 'CREDITO').reduce((sum, p) => sum + p.monto, 0)
  const pendientePorAsignar = totalPedido - totalPagado - totalCredito

  // Agregar un pago
  const agregarPago = async () => {
    const monto = parseFloat(nuevoMontoPago)
    if (isNaN(monto) || monto <= 0) {
      toast.error('Ingresa un monto válido')
      return
    }

    if (monto > pendientePorAsignar + 0.01) {
      toast.error('El monto excede el pendiente por pagar')
      return
    }

    const nuevoPago: PagoLinea = {
      metodoPago: nuevoMetodoPago,
      monto,
      referencia: nuevaReferencia || undefined
    }

    setPagos([...pagos, nuevoPago])
    setNuevoMontoPago('')
    setNuevaReferencia('')
  }

  // Eliminar un pago
  const eliminarPago = (index: number) => {
    setPagos(pagos.filter((_, i) => i !== index))
  }

  // Subir comprobante
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, pagoIndex: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingComprobante(true)
    try {
      const result = await comprobantesApi.upload(file)
      const nuevosPagos = [...pagos]
      nuevosPagos[pagoIndex] = {
        ...nuevosPagos[pagoIndex],
        comprobante: result.url,
        comprobanteFile: file
      }
      setPagos(nuevosPagos)
      toast.success('Comprobante subido')
    } catch (error) {
      toast.error('Error al subir comprobante')
    } finally {
      setUploadingComprobante(false)
    }
  }

  // Asignar todo el pendiente a un método
  const asignarTodoA = (metodo: MetodoPago) => {
    if (pendientePorAsignar <= 0) return
    setPagos([...pagos, { metodoPago: metodo, monto: pendientePorAsignar }])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!clienteId) {
      toast.error('Selecciona un cliente')
      return
    }

    if (lineas.length === 0) {
      toast.error('Agrega al menos un producto')
      return
    }

    // Validar dirección si es envío
    if (tipoEntrega === 'ENVIO') {
      if (!direccion.calle || !direccion.numero || !direccion.colonia || !direccion.ciudad) {
        toast.error('Completa la dirección de entrega (calle, número, colonia y ciudad)')
        return
      }
    }

    // Validar que el total esté cubierto
    if (totalPedido > 0 && pendientePorAsignar > 0.01) {
      toast.error('Debes asignar la forma de pago para todo el monto')
      return
    }

    // Calcular subtotales por línea
    const lineasConPrecios = lineas.map(l => {
      // Subtotal usando precio al público
      const subtotalLinea = l.precioPublico * l.cantidadSolicitada

      // Calcular costo promedio ponderado de los proveedores
      const costoTotal = l.asignaciones.reduce((sum, asig) => {
        return sum + ((asig.costoUnitario || 0) * asig.cantidadAsignada)
      }, 0)
      const costoPromedio = l.cantidadSolicitada > 0 ? costoTotal / l.cantidadSolicitada : 0

      // Obtener el proveedor principal (el que más aportó)
      const proveedorPrincipal = l.asignaciones.reduce((max, asig) =>
        asig.cantidadAsignada > (max?.cantidadAsignada || 0) ? asig : max, l.asignaciones[0])

      return {
        productoId: l.productoId,
        cantidadSolicitada: l.cantidadSolicitada,
        precioUnitario: l.precioPublico,          // Precio al público
        costoUnitario: costoPromedio,             // Costo promedio del proveedor
        subtotal: subtotalLinea,
        proveedorId: proveedorPrincipal?.proveedorId,
        proveedorNombre: proveedorPrincipal?.proveedorNombre,
        asignaciones: l.asignaciones.map(a => ({
          tarimaId: a.tarimaId,
          cantidadAsignada: a.cantidadAsignada
        }))
      }
    })

    mutation.mutate({
      almacenId: almacenActivo?.id,
      clienteId,
      notas,
      // Datos de entrega
      tipoEntrega,
      direccionCalle: tipoEntrega === 'ENVIO' ? direccion.calle : null,
      direccionNumero: tipoEntrega === 'ENVIO' ? direccion.numero : null,
      direccionColonia: tipoEntrega === 'ENVIO' ? direccion.colonia : null,
      direccionCiudad: tipoEntrega === 'ENVIO' ? direccion.ciudad : null,
      direccionEstado: tipoEntrega === 'ENVIO' ? direccion.estado : null,
      direccionCp: tipoEntrega === 'ENVIO' ? direccion.cp : null,
      direccionReferencia: tipoEntrega === 'ENVIO' ? direccion.referencia : null,
      // Totales
      subtotal: totalPedido,
      descuento: 0,
      total: totalPedido,
      lineas: lineasConPrecios,
      pagos: pagos.map(p => ({
        metodoPago: p.metodoPago,
        monto: p.monto,
        referencia: p.referencia,
        comprobante: p.comprobante
      }))
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/pedidos" className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Pedido</h1>
          <p className="text-gray-600">Crear pedido para {almacenActivo?.nombre}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cliente */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Cliente</h2>
          <ClienteSelector
            value={clienteId}
            onChange={(id, cliente) => {
              setClienteId(id)
              setClienteSeleccionado(cliente)
              // Auto-llenar dirección si el cliente tiene una
              if (cliente?.direccionCalle) {
                setDireccion({
                  calle: cliente.direccionCalle || '',
                  numero: cliente.direccionNumero || '',
                  colonia: cliente.direccionColonia || '',
                  ciudad: cliente.direccionCiudad || '',
                  estado: cliente.direccionEstado || '',
                  cp: cliente.direccionCp || '',
                  referencia: ''
                })
              }
            }}
            placeholder="Buscar por nombre o teléfono..."
          />
        </div>

        {/* Tipo de Entrega */}
        {clienteId && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Tipo de Entrega</h2>

            {/* Selector de tipo */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                type="button"
                onClick={() => setTipoEntrega('RECOLECCION')}
                className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                  tipoEntrega === 'RECOLECCION'
                    ? 'border-accent-500 bg-accent-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Store size={32} className={tipoEntrega === 'RECOLECCION' ? 'text-accent-600' : 'text-gray-400'} />
                <span className={`font-medium ${tipoEntrega === 'RECOLECCION' ? 'text-accent-700' : 'text-gray-600'}`}>
                  Recolección en tienda
                </span>
                <span className="text-xs text-gray-500">El cliente recoge en almacén</span>
              </button>
              <button
                type="button"
                onClick={() => setTipoEntrega('ENVIO')}
                className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                  tipoEntrega === 'ENVIO'
                    ? 'border-accent-500 bg-accent-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Truck size={32} className={tipoEntrega === 'ENVIO' ? 'text-accent-600' : 'text-gray-400'} />
                <span className={`font-medium ${tipoEntrega === 'ENVIO' ? 'text-accent-700' : 'text-gray-600'}`}>
                  Envío a domicilio
                </span>
                <span className="text-xs text-gray-500">Se entrega en dirección</span>
              </button>
            </div>

            {/* Campos de dirección si es ENVIO */}
            {tipoEntrega === 'ENVIO' && (
              <div className="border-t pt-4 mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-700 flex items-center gap-2">
                    <MapPin size={18} />
                    Dirección de entrega
                  </h3>
                  {clienteSeleccionado?.direccionCalle && (
                    <button
                      type="button"
                      onClick={() => setDireccion({
                        calle: clienteSeleccionado.direccionCalle || '',
                        numero: clienteSeleccionado.direccionNumero || '',
                        colonia: clienteSeleccionado.direccionColonia || '',
                        ciudad: clienteSeleccionado.direccionCiudad || '',
                        estado: clienteSeleccionado.direccionEstado || '',
                        cp: clienteSeleccionado.direccionCp || '',
                        referencia: ''
                      })}
                      className="text-sm text-accent-600 hover:text-accent-700"
                    >
                      Usar dirección del cliente
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="label">Calle *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Av. Principal"
                      value={direccion.calle}
                      onChange={(e) => setDireccion({ ...direccion, calle: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Número *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="123"
                      value={direccion.numero}
                      onChange={(e) => setDireccion({ ...direccion, numero: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Colonia *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Centro"
                      value={direccion.colonia}
                      onChange={(e) => setDireccion({ ...direccion, colonia: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Ciudad *</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Nuevo Laredo"
                      value={direccion.ciudad}
                      onChange={(e) => setDireccion({ ...direccion, ciudad: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Estado</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Tamaulipas"
                      value={direccion.estado}
                      onChange={(e) => setDireccion({ ...direccion, estado: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Código Postal</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="88000"
                      value={direccion.cp}
                      onChange={(e) => setDireccion({ ...direccion, cp: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Referencias para encontrar el lugar</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Casa azul, junto a la tienda de abarrotes"
                    value={direccion.referencia}
                    onChange={(e) => setDireccion({ ...direccion, referencia: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Productos */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Productos</h2>

          {/* Agregar producto */}
          {!mostrarSelectorTarimas && (
            <div className="flex gap-2 mb-4">
              <select
                className="input flex-1"
                value={productoSeleccionado}
                onChange={(e) => setProductoSeleccionado(e.target.value)}
              >
                <option value="">Seleccionar producto...</option>
                {(productos?.data || productos || [])
                  .sort((a: any, b: any) => {
                    // Ordenar: primero los que tienen stock, luego por nombre
                    const stockA = inventarioPorProducto[a.id] || 0
                    const stockB = inventarioPorProducto[b.id] || 0
                    if (stockA > 0 && stockB === 0) return -1
                    if (stockA === 0 && stockB > 0) return 1
                    return a.nombre.localeCompare(b.nombre)
                  })
                  .map((p: any) => {
                    const disponible = inventarioPorProducto[p.id] || 0
                    return (
                      <option
                        key={p.id}
                        value={p.id}
                        disabled={disponible === 0}
                        className={disponible === 0 ? 'text-gray-400' : ''}
                      >
                        {p.sku} - {p.nombre} [{disponible > 0 ? `${disponible.toLocaleString()} disponibles` : 'Sin stock'}]
                      </option>
                    )
                  })}
              </select>
              <input
                type="number"
                className="input w-32"
                value={cantidad}
                onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                min={1}
                max={inventarioPorProducto[productoSeleccionado] || 999999}
                placeholder="Cantidad"
              />
              <button
                type="button"
                onClick={handleSeleccionarProducto}
                className="btn-primary"
                disabled={!productoSeleccionado || (inventarioPorProducto[productoSeleccionado] || 0) === 0}
              >
                <Plus size={20} />
                Agregar
              </button>
            </div>
          )}

          {/* Mostrar stock disponible del producto seleccionado */}
          {productoSeleccionado && !mostrarSelectorTarimas && (
            <div className={`mb-4 p-3 rounded-lg ${
              (inventarioPorProducto[productoSeleccionado] || 0) > 0
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {(productos?.data || productos || []).find((p: any) => p.id === productoSeleccionado)?.nombre}
                </span>
                <span className={`font-bold ${
                  (inventarioPorProducto[productoSeleccionado] || 0) > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(inventarioPorProducto[productoSeleccionado] || 0).toLocaleString()} unidades disponibles
                </span>
              </div>
              {cantidad > (inventarioPorProducto[productoSeleccionado] || 0) && (
                <p className="text-red-600 text-sm mt-1">
                  ⚠️ La cantidad solicitada excede el stock disponible
                </p>
              )}
            </div>
          )}

          {/* Selector de tarimas */}
          {mostrarSelectorTarimas && (
            <div className="border-2 border-accent-400 rounded-lg p-4 mb-4 bg-accent-50">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-semibold">
                    {productos?.find((p: any) => p.id === productoSeleccionado)?.nombre}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Cantidad solicitada: <span className="font-bold">{cantidad}</span> |
                    Asignado: <span className={`font-bold ${getTotalAsignado() >= cantidad ? 'text-green-600' : 'text-amber-600'}`}>
                      {getTotalAsignado()}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={cancelarSeleccion} className="btn-secondary">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarLinea}
                    disabled={getTotalAsignado() < cantidad}
                    className="btn-primary"
                  >
                    <Check size={18} />
                    Confirmar
                  </button>
                </div>
              </div>

              {loadingTarimas ? (
                <div className="text-center py-8">
                  <Loader2 className="animate-spin mx-auto text-accent-500" size={32} />
                  <p className="text-gray-500 mt-2">Cargando tarimas...</p>
                </div>
              ) : tarimasDisponibles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No hay tarimas disponibles para este producto</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {tarimasDisponibles.map((tarima: any) => {
                    const asignacion = asignacionesTemporal.find(a => a.tarimaId === tarima.id)
                    const seleccionada = !!asignacion
                    const disponible = tarima.inventarioActual ?? tarima.capacidadTotal
                    const faltante = cantidad - getTotalAsignado() + (asignacion?.cantidadAsignada || 0)

                    return (
                      <div
                        key={tarima.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-all ${
                          seleccionada
                            ? 'border-accent-500 bg-white shadow-md'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => !seleccionada && toggleAsignacionTarima(tarima, Math.min(faltante, disponible))}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            seleccionada ? 'border-accent-500 bg-accent-500' : 'border-gray-300'
                          }`}>
                            {seleccionada && <Check size={14} className="text-white" />}
                          </div>

                          <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                            <div>
                              <p className="font-mono text-sm font-medium">{tarima.qrCode}</p>
                              <p className="text-xs text-gray-500">{tarima.proveedor?.nombre}</p>
                            </div>
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin size={14} className="text-gray-400" />
                              <span className="font-medium">{tarima.ubicacion?.codigo || '-'}</span>
                            </div>
                            <div className="text-sm">
                              <span className="font-bold text-lg">{disponible}</span>
                              <span className="text-gray-500"> disponibles</span>
                            </div>
                            <div className="text-sm text-right">
                              {tarima.precioUnitario ? (
                                <div>
                                  <span className="text-orange-600 font-medium">
                                    ${parseFloat(tarima.precioUnitario).toFixed(2)}
                                  </span>
                                  <p className="text-xs text-gray-400">costo</p>
                                </div>
                              ) : (
                                <span className="text-gray-400">Sin costo</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {seleccionada && (
                          <div className="mt-3 pt-3 border-t flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                            <label className="text-sm text-gray-600">Cantidad a tomar:</label>
                            <input
                              type="number"
                              className="input w-32"
                              value={asignacion?.cantidadAsignada || 0}
                              onChange={(e) => actualizarCantidadAsignada(tarima.id, parseInt(e.target.value) || 0)}
                              min={1}
                              max={disponible}
                            />
                            <span className="text-sm text-gray-500">máx: {disponible}</span>
                            <button
                              type="button"
                              onClick={() => toggleAsignacionTarima(tarima, 0)}
                              className="ml-auto text-red-500 hover:text-red-700"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Lista de líneas confirmadas */}
          {lineas.length > 0 ? (
            <div className="border rounded-lg divide-y">
              {lineas.map((linea, index) => {
                const subtotalLinea = linea.precioPublico * linea.cantidadSolicitada
                const costoLinea = linea.asignaciones.reduce((sum, a) => sum + ((a.costoUnitario || 0) * a.cantidadAsignada), 0)
                const gananciaLinea = subtotalLinea - costoLinea
                const margenLinea = subtotalLinea > 0 ? (gananciaLinea / subtotalLinea) * 100 : 0

                return (
                  <div key={index} className="p-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setLineaExpandida(lineaExpandida === index ? null : index)}
                    >
                      <div className="flex items-center gap-3">
                        {lineaExpandida === index ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        <div>
                          <p className="font-medium">{linea.productoSku} - {linea.productoNombre}</p>
                          <p className="text-sm text-gray-500">
                            {linea.cantidadSolicitada} unidades | {linea.asignaciones.length} tarima(s)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-gray-900">${subtotalLinea.toFixed(2)}</p>
                          <p className="text-xs text-green-600">+${gananciaLinea.toFixed(2)} ({margenLinea.toFixed(0)}%)</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); eliminarLinea(index); }}
                          className="text-red-500 hover:text-red-700 p-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {lineaExpandida === index && (
                      <div className="mt-3 ml-7 space-y-3">
                        {/* Info de precios */}
                        <div className="grid grid-cols-3 gap-4 p-3 bg-blue-50 rounded-lg text-sm">
                          <div>
                            <p className="text-blue-600">Precio Público</p>
                            <p className="font-bold">${linea.precioPublico.toFixed(2)} c/u</p>
                          </div>
                          <div>
                            <p className="text-orange-600">Costo Prom.</p>
                            <p className="font-bold">${(costoLinea / linea.cantidadSolicitada).toFixed(2)} c/u</p>
                          </div>
                          <div>
                            <p className="text-green-600">Ganancia</p>
                            <p className="font-bold text-green-700">${gananciaLinea.toFixed(2)}</p>
                          </div>
                        </div>

                        <p className="text-sm font-medium text-gray-700">Instrucciones para bodega:</p>
                        {linea.asignaciones.map((asig, i) => (
                          <div key={i} className="flex items-center gap-4 text-sm bg-gray-50 p-2 rounded">
                            <span className="w-6 h-6 bg-accent-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {i + 1}
                            </span>
                            <MapPin size={14} className="text-gray-400" />
                            <span className="font-medium">{asig.ubicacionCodigo}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-mono">{asig.tarimaQr}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-bold text-accent-600">{asig.cantidadAsignada} unidades</span>
                            <span className="text-gray-400 text-xs">({asig.proveedorNombre})</span>
                            {asig.costoUnitario && (
                              <span className="text-orange-500 text-xs">${asig.costoUnitario.toFixed(2)} c/u</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            !mostrarSelectorTarimas && (
              <p className="text-center text-gray-500 py-8">No hay productos agregados</p>
            )
          )}
        </div>

        {/* Resumen Financiero */}
        {lineas.length > 0 && (
          <div className="card p-6 bg-gradient-to-r from-blue-50 to-green-50">
            <h2 className="text-lg font-semibold mb-4">Resumen Financiero</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-gray-500">Venta (Precio Público)</p>
                <p className="text-2xl font-bold text-gray-900">${totalPedido.toFixed(2)}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-orange-600">Costo (Proveedores)</p>
                <p className="text-2xl font-bold text-orange-600">${calcularCostoTotal().toFixed(2)}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-green-600">Ganancia Bruta</p>
                <p className="text-2xl font-bold text-green-600">${calcularGanancia().toFixed(2)}</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <p className="text-sm text-blue-600">Margen</p>
                <p className="text-2xl font-bold text-blue-600">
                  {totalPedido > 0 ? ((calcularGanancia() / totalPedido) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Forma de Pago - Estilo POS */}
        {lineas.length > 0 && totalPedido > 0 && (
          <div className="card overflow-hidden">
            {/* Header con total grande */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">TOTAL A COBRAR</p>
                  <p className="text-4xl font-bold font-mono">${totalPedido.toFixed(2)}</p>
                </div>
                {pendientePorAsignar <= 0.01 && pagos.length > 0 && (
                  <div className="bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                    <Check size={24} />
                    <span className="font-bold">PAGADO</span>
                  </div>
                )}
                {pendientePorAsignar > 0.01 && (
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">PENDIENTE</p>
                    <p className="text-2xl font-bold font-mono text-amber-400">${pendientePorAsignar.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Métodos de pago - Seleccionar y agregar monto */}
              {pendientePorAsignar > 0.01 && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-3">Selecciona método de pago</p>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setMetodoPagoActivo('EFECTIVO')
                        setMontoParcial(pendientePorAsignar.toFixed(2))
                        setMostrarCambio(false)
                      }}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        metodoPagoActivo === 'EFECTIVO'
                          ? 'border-green-500 bg-green-100 ring-2 ring-green-500'
                          : 'border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-400'
                      }`}
                    >
                      <Banknote size={32} className="text-green-600" />
                      <span className="font-semibold text-green-700">Efectivo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMetodoPagoActivo('TRANSFERENCIA')
                        setMontoParcial(pendientePorAsignar.toFixed(2))
                        setMostrarCambio(false)
                      }}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        metodoPagoActivo === 'TRANSFERENCIA'
                          ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-500'
                          : 'border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-400'
                      }`}
                    >
                      <Building2 size={32} className="text-blue-600" />
                      <span className="font-semibold text-blue-700">Transferencia</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMetodoPagoActivo('TARJETA')
                        setMontoParcial(pendientePorAsignar.toFixed(2))
                        setMostrarCambio(false)
                      }}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        metodoPagoActivo === 'TARJETA'
                          ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-500'
                          : 'border-purple-200 bg-purple-50 hover:bg-purple-100 hover:border-purple-400'
                      }`}
                    >
                      <CreditCard size={32} className="text-purple-600" />
                      <span className="font-semibold text-purple-700">Tarjeta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMetodoPagoActivo('CREDITO')
                        setMontoParcial(pendientePorAsignar.toFixed(2))
                        setMostrarCambio(false)
                      }}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        metodoPagoActivo === 'CREDITO'
                          ? 'border-amber-500 bg-amber-100 ring-2 ring-amber-500'
                          : 'border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-400'
                      }`}
                    >
                      <DollarSign size={32} className="text-amber-600" />
                      <span className="font-semibold text-amber-700">Crédito</span>
                    </button>
                  </div>

                  {/* Panel de entrada de monto cuando hay método seleccionado */}
                  {metodoPagoActivo && (
                    <div className={`rounded-xl p-5 border-2 ${
                      metodoPagoActivo === 'EFECTIVO' ? 'bg-green-50 border-green-300' :
                      metodoPagoActivo === 'TRANSFERENCIA' ? 'bg-blue-50 border-blue-300' :
                      metodoPagoActivo === 'TARJETA' ? 'bg-purple-50 border-purple-300' :
                      'bg-amber-50 border-amber-300'
                    }`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {metodoPagoActivo === 'EFECTIVO' && <Banknote size={24} className="text-green-600" />}
                          {metodoPagoActivo === 'TRANSFERENCIA' && <Building2 size={24} className="text-blue-600" />}
                          {metodoPagoActivo === 'TARJETA' && <CreditCard size={24} className="text-purple-600" />}
                          {metodoPagoActivo === 'CREDITO' && <DollarSign size={24} className="text-amber-600" />}
                          <h3 className="font-bold text-lg">
                            {metodoPagoActivo === 'EFECTIVO' && 'Pago en Efectivo'}
                            {metodoPagoActivo === 'TRANSFERENCIA' && 'Pago por Transferencia'}
                            {metodoPagoActivo === 'TARJETA' && 'Pago con Tarjeta'}
                            {metodoPagoActivo === 'CREDITO' && 'Dejar a Crédito'}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMetodoPagoActivo(null)
                            setMontoParcial('')
                            setEfectivoRecibido('')
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {/* Entrada de monto */}
                      <div className="mb-4">
                        <label className="text-sm font-medium mb-2 block">
                          Monto a pagar con {metodoPagoActivo.toLowerCase()}:
                        </label>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-bold">$</span>
                          <input
                            type="number"
                            className="input text-2xl font-bold font-mono flex-1 text-center py-3"
                            placeholder="0.00"
                            value={montoParcial}
                            onChange={(e) => setMontoParcial(e.target.value)}
                            step="0.01"
                            min="0"
                            max={pendientePorAsignar}
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Botones de monto rápido */}
                      <div className="mb-4">
                        <p className="text-xs text-gray-600 mb-2">Montos rápidos:</p>
                        <div className="flex flex-wrap gap-2">
                          {[100, 200, 500, 1000, 2000, 5000].filter(m => m <= pendientePorAsignar + 0.01).map((monto) => (
                            <button
                              key={monto}
                              type="button"
                              onClick={() => setMontoParcial(Math.min(monto, pendientePorAsignar).toString())}
                              className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                                parseFloat(montoParcial) === monto
                                  ? 'bg-gray-800 text-white'
                                  : 'bg-white border border-gray-300 hover:bg-gray-100'
                              }`}
                            >
                              ${monto.toLocaleString()}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setMontoParcial(pendientePorAsignar.toFixed(2))}
                            className={`px-3 py-1.5 rounded-lg font-bold text-sm transition-all ${
                              parseFloat(montoParcial) === pendientePorAsignar
                                ? 'bg-gray-800 text-white'
                                : 'bg-white border border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            Todo (${pendientePorAsignar.toFixed(2)})
                          </button>
                        </div>
                      </div>

                      {/* Referencia para transferencia o tarjeta */}
                      {(metodoPagoActivo === 'TRANSFERENCIA' || metodoPagoActivo === 'TARJETA') && (
                        <div className="mb-4">
                          <label className="text-sm font-medium mb-2 block">
                            Referencia (opcional):
                          </label>
                          <input
                            type="text"
                            className="input"
                            placeholder={metodoPagoActivo === 'TRANSFERENCIA' ? 'Número de referencia' : 'Últimos 4 dígitos'}
                            value={nuevaReferencia}
                            onChange={(e) => setNuevaReferencia(e.target.value)}
                          />
                        </div>
                      )}

                      {/* Botón para agregar el pago */}
                      <button
                        type="button"
                        onClick={() => {
                          const monto = parseFloat(montoParcial)
                          if (isNaN(monto) || monto <= 0) {
                            toast.error('Ingresa un monto válido')
                            return
                          }
                          if (monto > pendientePorAsignar + 0.01) {
                            toast.error('El monto excede el pendiente')
                            return
                          }
                          setPagos([...pagos, {
                            metodoPago: metodoPagoActivo,
                            monto,
                            referencia: nuevaReferencia || undefined
                          }])
                          // Si es efectivo, mostrar calculadora de cambio
                          if (metodoPagoActivo === 'EFECTIVO') {
                            setMostrarCambio(true)
                            setEfectivoRecibido('')
                          }
                          setMetodoPagoActivo(null)
                          setMontoParcial('')
                          setNuevaReferencia('')
                        }}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
                          metodoPagoActivo === 'EFECTIVO' ? 'bg-green-600 hover:bg-green-700' :
                          metodoPagoActivo === 'TRANSFERENCIA' ? 'bg-blue-600 hover:bg-blue-700' :
                          metodoPagoActivo === 'TARJETA' ? 'bg-purple-600 hover:bg-purple-700' :
                          'bg-amber-600 hover:bg-amber-700'
                        }`}
                      >
                        <Plus size={20} className="inline mr-2" />
                        Agregar ${parseFloat(montoParcial || '0').toFixed(2)} en {metodoPagoActivo}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Cálculo de cambio para efectivo */}
              {mostrarCambio && pagos.some(p => p.metodoPago === 'EFECTIVO') && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Banknote size={24} className="text-green-600" />
                    <h3 className="font-bold text-green-800 text-lg">Calcular Cambio</h3>
                    <button
                      type="button"
                      onClick={() => setMostrarCambio(false)}
                      className="ml-auto text-gray-500 hover:text-gray-700"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Total en efectivo */}
                  {(() => {
                    const totalEfectivo = pagos.filter(p => p.metodoPago === 'EFECTIVO').reduce((sum, p) => sum + p.monto, 0)
                    return (
                      <>
                        <p className="text-sm text-green-700 mb-3">
                          Total a cobrar en efectivo: <span className="font-bold">${totalEfectivo.toFixed(2)}</span>
                        </p>

                        {/* Monto que paga el cliente */}
                        <div className="mb-4">
                          <label className="text-sm text-green-700 font-medium mb-2 block">
                            ¿Con cuánto paga el cliente?
                          </label>
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-green-600">$</span>
                            <input
                              type="number"
                              className="input text-3xl font-bold font-mono flex-1 text-center py-4"
                              placeholder="0.00"
                              value={efectivoRecibido}
                              onChange={(e) => setEfectivoRecibido(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Botones de monto rápido */}
                        <div className="mb-4">
                          <p className="text-xs text-green-600 mb-2">Montos rápidos:</p>
                          <div className="flex flex-wrap gap-2">
                            {[20, 50, 100, 200, 500, 1000, 2000].filter(m => m >= totalEfectivo).slice(0, 6).map((monto) => (
                              <button
                                key={monto}
                                type="button"
                                onClick={() => setEfectivoRecibido(monto.toString())}
                                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                  parseFloat(efectivoRecibido) === monto
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white border border-green-300 text-green-700 hover:bg-green-100'
                                }`}
                              >
                                ${monto.toLocaleString()}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setEfectivoRecibido(totalEfectivo.toFixed(2))}
                              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                parseFloat(efectivoRecibido) === totalEfectivo
                                  ? 'bg-green-600 text-white'
                                  : 'bg-white border border-green-300 text-green-700 hover:bg-green-100'
                              }`}
                            >
                              Exacto
                            </button>
                          </div>
                        </div>

                        {/* Mostrar cambio */}
                        {efectivoRecibido && parseFloat(efectivoRecibido) >= totalEfectivo && (
                          <div className="bg-white rounded-xl p-4 border-2 border-green-400">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-green-600 text-sm font-medium">CAMBIO A ENTREGAR</p>
                                <p className="text-4xl font-bold text-green-700 font-mono">
                                  ${(parseFloat(efectivoRecibido) - totalEfectivo).toFixed(2)}
                                </p>
                              </div>
                              <div className="text-right text-sm text-gray-500">
                                <p>Recibido: ${parseFloat(efectivoRecibido).toFixed(2)}</p>
                                <p>Efectivo: ${totalEfectivo.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {efectivoRecibido && parseFloat(efectivoRecibido) < totalEfectivo && (
                          <div className="bg-red-50 rounded-xl p-4 border-2 border-red-300">
                            <div className="flex items-center gap-2 text-red-600">
                              <X size={24} />
                              <div>
                                <p className="font-bold">Monto insuficiente</p>
                                <p className="text-sm">Faltan ${(totalEfectivo - parseFloat(efectivoRecibido)).toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}

              {/* Lista de pagos registrados */}
              {pagos.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-3">Pagos registrados</p>
                  <div className="space-y-2">
                    {pagos.map((pago, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          pago.metodoPago === 'EFECTIVO' ? 'bg-green-100 text-green-600' :
                          pago.metodoPago === 'TRANSFERENCIA' ? 'bg-blue-100 text-blue-600' :
                          pago.metodoPago === 'TARJETA' ? 'bg-purple-100 text-purple-600' :
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {pago.metodoPago === 'EFECTIVO' && <Banknote size={20} />}
                          {pago.metodoPago === 'TRANSFERENCIA' && <Building2 size={20} />}
                          {pago.metodoPago === 'TARJETA' && <CreditCard size={20} />}
                          {pago.metodoPago === 'CREDITO' && <DollarSign size={20} />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{pago.metodoPago}</p>
                          {pago.referencia && <p className="text-sm text-gray-500">Ref: {pago.referencia}</p>}
                        </div>
                        <p className="text-lg font-bold font-mono">${pago.monto.toFixed(2)}</p>

                        {/* Upload de comprobante para transferencias */}
                        {pago.metodoPago === 'TRANSFERENCIA' && (
                          <div className="flex items-center gap-2">
                            {pago.comprobante ? (
                              <a
                                href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${pago.comprobante}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                              >
                                <Image size={16} /> Ver
                              </a>
                            ) : (
                              <label className="cursor-pointer text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                <Upload size={16} />
                                <span className="text-sm">Comprobante</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleFileUpload(e, index)}
                                  disabled={uploadingComprobante}
                                />
                              </label>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            eliminarPago(index)
                            if (!pagos.some((p, i) => i !== index && p.metodoPago === 'EFECTIVO')) {
                              setMostrarCambio(false)
                              setEfectivoRecibido('')
                            }
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen de pagos */}
              {pagos.length > 0 && (
                <div className="bg-gray-100 rounded-xl p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-green-600 font-mono">${totalPagado.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Pagado</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600 font-mono">${totalCredito.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">A crédito</p>
                    </div>
                    <div>
                      <p className={`text-2xl font-bold font-mono ${pendientePorAsignar > 0.01 ? 'text-red-600' : 'text-gray-400'}`}>
                        ${pendientePorAsignar.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Pendiente</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notas */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Notas</h2>
          <textarea
            className="input"
            rows={3}
            placeholder="Notas adicionales para el pedido..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        {/* Resumen */}
        {lineas.length > 0 && (
          <div className="card p-6 bg-gray-50">
            <h2 className="text-lg font-semibold mb-4">Resumen del Pedido</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{lineas.length}</p>
                <p className="text-sm text-gray-500">Productos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {lineas.reduce((sum, l) => sum + l.cantidadSolicitada, 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Unidades totales</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {lineas.reduce((sum, l) => sum + l.asignaciones.length, 0)}
                </p>
                <p className="text-sm text-gray-500">Tarimas a visitar</p>
              </div>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-4">
          <Link to="/pedidos" className="btn-secondary flex-1">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending || lineas.length === 0}
            className="btn-primary flex-1"
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Creando...
              </>
            ) : (
              'Crear Pedido y Enviar a Bodega'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
