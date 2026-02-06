import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { ArrowLeft, Loader2, RefreshCw, Package, DollarSign, Recycle, CheckCircle, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'
import { tarimasApi, catalogosApi } from '../../services/api'
import QRCodeDisplay from '../../components/QRCodeDisplay'

interface TarimaForm {
  productoId: string
  proveedorId: string
  ubicacionId: string
  capacidadTotal: number
  precioUnitario: number
  depositoPorEnvase: number
  lote: string
  fechaProduccion: string
  fechaCaducidad: string
}

// Generar lote automático: LOT-YYYYMMDD-XXXX
function generarLoteAutomatico(): string {
  const fecha = new Date()
  const year = fecha.getFullYear()
  const month = String(fecha.getMonth() + 1).padStart(2, '0')
  const day = String(fecha.getDate()).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `LOT-${year}${month}${day}-${random}`
}

export default function NuevaTarimaPage() {
  const navigate = useNavigate()
  const { almacenActivo } = useAuthStore()
  const [loteGenerado, setLoteGenerado] = useState(generarLoteAutomatico())
  const [tarimaCreada, setTarimaCreada] = useState<any>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const { data: productos, isLoading: loadingProductos } = useQuery({
    queryKey: ['productos'],
    queryFn: () => catalogosApi.productos()
  })

  const { data: proveedores, isLoading: loadingProveedores } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => catalogosApi.proveedores()
  })

  const { data: ubicaciones } = useQuery({
    queryKey: ['ubicaciones', almacenActivo?.id],
    queryFn: () => catalogosApi.ubicaciones(almacenActivo!.id),
    enabled: !!almacenActivo
  })

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors }
  } = useForm<TarimaForm>({
    defaultValues: {
      lote: loteGenerado
    }
  })

  // Observar valores para cálculos en tiempo real
  const productoIdWatch = useWatch({ control, name: 'productoId' })
  const capacidadWatch = useWatch({ control, name: 'capacidadTotal' })
  const precioWatch = useWatch({ control, name: 'precioUnitario' })
  const depositoWatch = useWatch({ control, name: 'depositoPorEnvase' })

  // Obtener producto seleccionado
  const productoSeleccionado = productos?.data?.find((p: any) => p.id === productoIdWatch) ||
                               productos?.find?.((p: any) => p.id === productoIdWatch)

  // Cálculos
  const unidadesPorCarton = productoSeleccionado?.unidadesPorCarton || 1
  const esRetornable = productoSeleccionado?.esRetornable || false
  const capacidad = parseInt(capacidadWatch as any) || 0
  const precio = parseFloat(precioWatch as any) || 0
  const deposito = parseFloat(depositoWatch as any) || 0

  // Costo total de compra
  const costoTotalCompra = capacidad * precio

  // Depósito total = depósito por envase × unidades por cartón × cantidad de cartones
  const depositoTotal = deposito * unidadesPorCarton * capacidad

  // Actualizar el valor del lote cuando cambie
  useEffect(() => {
    setValue('lote', loteGenerado)
  }, [loteGenerado, setValue])

  const regenerarLote = () => {
    const nuevoLote = generarLoteAutomatico()
    setLoteGenerado(nuevoLote)
    setValue('lote', nuevoLote)
  }

  const mutation = useMutation({
    mutationFn: (data: any) => tarimasApi.create(data),
    onSuccess: (data) => {
      toast.success('Tarima creada correctamente')
      setTarimaCreada(data)
      setShowSuccessModal(true)
    },
    onError: (error: any) => {
      // Manejar errores de validación (pueden ser arrays de objetos)
      const errorData = error.response?.data?.error
      let mensaje = 'Error al crear tarima'

      if (typeof errorData === 'string') {
        mensaje = errorData
      } else if (Array.isArray(errorData)) {
        // Es un array de errores de validación Zod
        mensaje = errorData.map((e: any) => e.message || e.path?.join('.')).join(', ')
      } else if (errorData?.message) {
        mensaje = errorData.message
      }

      toast.error(mensaje)
    }
  })

  const onSubmit = (data: TarimaForm) => {
    if (!almacenActivo?.id) {
      toast.error('Selecciona un almacén primero')
      return
    }

    mutation.mutate({
      ...data,
      almacenId: almacenActivo.id,
      capacidadTotal: parseInt(data.capacidadTotal as any),
      precioUnitario: parseFloat(data.precioUnitario as any),
      depositoPorEnvase: data.depositoPorEnvase ? parseFloat(data.depositoPorEnvase as any) : undefined,
      fechaProduccion: data.fechaProduccion || undefined,
      fechaCaducidad: data.fechaCaducidad || undefined,
      ubicacionId: data.ubicacionId || undefined
    })
  }

  // Verificar si hay almacén activo
  if (!almacenActivo) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-6 text-center">
          <p className="text-gray-600 mb-4">Debes seleccionar un almacén para crear tarimas</p>
          <Link to="/dashboard" className="btn-primary">
            Ir al Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/tarimas" className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva Tarima</h1>
          <p className="text-gray-600">Registrar recepción de mercancía - {almacenActivo.nombre}</p>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Producto */}
          <div className="sm:col-span-2">
            <label className="label">Producto *</label>
            <select
              className={`input ${errors.productoId ? 'input-error' : ''}`}
              {...register('productoId', { required: 'Selecciona un producto' })}
              disabled={loadingProductos}
            >
              <option value="">Seleccionar producto...</option>
              {productos?.data?.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.nombre}
                </option>
              )) || productos?.map?.((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.nombre}
                </option>
              ))}
            </select>
            {errors.productoId && <p className="error-message">{errors.productoId.message}</p>}
          </div>

          {/* Proveedor */}
          <div>
            <label className="label">Proveedor *</label>
            <select
              className={`input ${errors.proveedorId ? 'input-error' : ''}`}
              {...register('proveedorId', { required: 'Selecciona un proveedor' })}
              disabled={loadingProveedores}
            >
              <option value="">Seleccionar...</option>
              {proveedores?.data?.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              )) || proveedores?.map?.((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {errors.proveedorId && <p className="error-message">{errors.proveedorId.message}</p>}
          </div>

          {/* Ubicación */}
          <div>
            <label className="label">Ubicación</label>
            <select className="input" {...register('ubicacionId')}>
              <option value="">Sin ubicación</option>
              {ubicaciones?.data?.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.codigo} - {u.descripcion}
                </option>
              )) || ubicaciones?.map?.((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.codigo} - {u.descripcion}
                </option>
              ))}
            </select>
          </div>

          {/* Capacidad */}
          <div>
            <label className="label">Capacidad total (unidades) *</label>
            <input
              type="number"
              className={`input ${errors.capacidadTotal ? 'input-error' : ''}`}
              placeholder="1000"
              {...register('capacidadTotal', {
                required: 'Ingresa la capacidad',
                min: { value: 1, message: 'Debe ser mayor a 0' }
              })}
            />
            {errors.capacidadTotal && (
              <p className="error-message">{errors.capacidadTotal.message}</p>
            )}
          </div>

          {/* Precio Unitario */}
          <div>
            <label className="label">Precio unitario de compra *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                className={`input pl-7 ${errors.precioUnitario ? 'input-error' : ''}`}
                placeholder="190.00"
                {...register('precioUnitario', {
                  required: 'Ingresa el precio',
                  min: { value: 0.01, message: 'Debe ser mayor a 0' }
                })}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Precio al que se compró cada unidad ({productoSeleccionado?.presentacion || 'unidad'})</p>
            {errors.precioUnitario && (
              <p className="error-message">{errors.precioUnitario.message}</p>
            )}
          </div>

          {/* Depósito por Envase - Solo para retornables */}
          {esRetornable && (
            <div>
              <label className="label flex items-center gap-2">
                <Recycle size={16} className="text-blue-500" />
                Depósito por envase
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  className="input pl-7"
                  placeholder="15.00"
                  {...register('depositoPorEnvase')}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                El distribuidor paga este monto por cada envase devuelto
              </p>
            </div>
          )}

          {/* Lote - Automático pero modificable */}
          <div>
            <label className="label">Lote (automático)</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="LOT-20260129-0001"
                {...register('lote')}
              />
              <button
                type="button"
                onClick={regenerarLote}
                className="btn-ghost p-2"
                title="Regenerar lote"
              >
                <RefreshCw size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Se genera automáticamente, pero puedes modificarlo</p>
          </div>

          {/* Fecha producción */}
          <div>
            <label className="label">Fecha de producción</label>
            <input type="date" className="input" {...register('fechaProduccion')} />
          </div>

          {/* Fecha caducidad */}
          <div>
            <label className="label">Fecha de caducidad</label>
            <input type="date" className="input" {...register('fechaCaducidad')} />
          </div>
        </div>

        {/* Resumen de Costos */}
        {(capacidad > 0 && precio > 0) && (
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <DollarSign size={18} />
              Resumen de la Recepción
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Info del producto */}
              {productoSeleccionado && (
                <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-white rounded-lg border">
                  <Package size={24} className="text-accent-500" />
                  <div>
                    <p className="font-medium">{productoSeleccionado.nombre}</p>
                    <p className="text-sm text-gray-500">
                      {productoSeleccionado.presentacion} • {unidadesPorCarton} unidades por {productoSeleccionado.presentacion?.toLowerCase()}
                      {esRetornable && <span className="ml-2 text-blue-600">• Retornable</span>}
                    </p>
                  </div>
                </div>
              )}

              {/* Costo de compra */}
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-xs text-orange-600 font-medium">COSTO TOTAL DE COMPRA</p>
                <p className="text-2xl font-bold text-orange-700">
                  ${costoTotalCompra.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-orange-500 mt-1">
                  {capacidad.toLocaleString()} × ${precio.toFixed(2)}
                </p>
              </div>

              {/* Depósito total - Solo si es retornable y tiene depósito */}
              {esRetornable && deposito > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                    <Recycle size={12} />
                    DEPÓSITO TOTAL A RECUPERAR
                  </p>
                  <p className="text-2xl font-bold text-blue-700">
                    ${depositoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    ${deposito.toFixed(2)} × {unidadesPorCarton} env. × {capacidad.toLocaleString()} = {(unidadesPorCarton * capacidad).toLocaleString()} envases
                  </p>
                </div>
              )}

              {/* Costo neto - Solo si hay depósito */}
              {esRetornable && deposito > 0 && (
                <div className="sm:col-span-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600 font-medium">COSTO NETO (Compra - Depósito)</p>
                  <p className="text-2xl font-bold text-green-700">
                    ${(costoTotalCompra - depositoTotal).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-4 pt-4 border-t">
          <Link to="/tarimas" className="btn-secondary flex-1">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary flex-1"
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Creando...
              </>
            ) : (
              'Crear Tarima'
            )}
          </button>
        </div>
      </form>

      {/* Modal de éxito con QR */}
      {showSuccessModal && tarimaCreada && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">¡Tarima Creada!</h3>
              <p className="text-gray-600 mt-1">
                {tarimaCreada.producto?.nombre || productoSeleccionado?.nombre}
              </p>
            </div>

            <div className="border-t border-b py-4 my-4">
              <QRCodeDisplay
                value={tarimaCreada.qrCode}
                size={180}
                title={tarimaCreada.producto?.nombre || productoSeleccionado?.nombre}
                subtitle={`Ubicación: ${tarimaCreada.ubicacion?.codigo || 'Sin asignar'}`}
                printable={true}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div>
                <p className="text-gray-500">Cantidad</p>
                <p className="font-semibold">{tarimaCreada.capacidadTotal} unidades</p>
              </div>
              <div>
                <p className="text-gray-500">Ubicación</p>
                <p className="font-semibold">{tarimaCreada.ubicacion?.codigo || 'Sin asignar'}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSuccessModal(false)
                  setTarimaCreada(null)
                  // Resetear formulario
                  const nuevoLote = generarLoteAutomatico()
                  setLoteGenerado(nuevoLote)
                  setValue('lote', nuevoLote)
                  setValue('productoId', '')
                  setValue('proveedorId', '')
                  setValue('ubicacionId', '')
                  setValue('capacidadTotal', 0 as any)
                  setValue('precioUnitario', 0 as any)
                  setValue('depositoPorEnvase', 0 as any)
                }}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Crear otra
              </button>
              <button
                onClick={() => navigate(`/tarimas/${tarimaCreada.id}`)}
                className="btn-primary flex-1"
              >
                Ver detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
