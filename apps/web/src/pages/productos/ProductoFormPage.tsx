import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { productosApi } from '../../services/api'

// Tipos de producto simplificados para el usuario
const tiposProducto = [
  {
    id: 'TAPA',
    nombre: 'Tapa',
    descripcion: '24 latas de aluminio',
    icono: '🥫',
    tipoEnvase: 'LATA',
    unidades: 24,
    unidadMedida: 'Tapas',
    presentacion: 'Tapa',
    permiteRetornable: false  // Las latas nunca son retornables
  },
  {
    id: 'CARTON_12',
    nombre: 'Cartón 12',
    descripcion: '12 botellas',
    icono: '🍺',
    tipoEnvase: 'BOTELLA',
    unidades: 12,
    unidadMedida: 'Cartones',
    presentacion: 'Cartón',
    permiteRetornable: true   // Puede ser retornable o no
  },
  {
    id: 'CARTON_24',
    nombre: 'Cartón 24',
    descripcion: '24 botellas',
    icono: '🍻',
    tipoEnvase: 'BOTELLA',
    unidades: 24,
    unidadMedida: 'Cartones',
    presentacion: 'Cartón',
    permiteRetornable: true   // Puede ser retornable o no
  },
  {
    id: 'OTRO',
    nombre: 'Otro',
    descripcion: 'Configurar manual',
    icono: '📦',
    tipoEnvase: 'OTRO',
    unidades: 1,
    unidadMedida: 'Piezas',
    presentacion: 'Otro',
    permiteRetornable: true
  }
]

// Función para generar SKU automático
function generarSku(nombre: string, tipoProducto: string, capacidadMl: string): string {
  const partes: string[] = []

  // Nombre: tomar primeras palabras y limpiar
  if (nombre) {
    const nombreLimpio = nombre
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^A-Z0-9\s]/g, '') // Solo letras y números
      .split(/\s+/)
      .slice(0, 2) // Máximo 2 palabras
      .join('-')
    if (nombreLimpio) partes.push(nombreLimpio)
  }

  // Tipo de producto abreviado
  const abreviaturas: Record<string, string> = {
    'TAPA': 'TP',
    'CARTON_12': 'C12',
    'CARTON_24': 'C24',
    'OTRO': 'OT'
  }
  if (tipoProducto && abreviaturas[tipoProducto]) {
    partes.push(abreviaturas[tipoProducto])
  }

  // Capacidad ML
  if (capacidadMl) {
    partes.push(capacidadMl)
  }

  return partes.join('-') || ''
}

export default function ProductoFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!id

  // Form state simplificado
  const [form, setForm] = useState({
    sku: '',
    nombre: '',
    descripcion: '',
    tipoProducto: '',        // TAPA, CARTON_12, CARTON_24, OTRO
    capacidadMl: '',
    precioPublico: '',
    // Campos derivados (se calculan automáticamente)
    presentacion: '',
    unidadMedida: '',
    tipoEnvase: '',
    unidadesPorCarton: '',
    esRetornable: false
  })
  const [skuManual, setSkuManual] = useState(false)
  const [modoAvanzado, setModoAvanzado] = useState(false) // Para configuración manual

  // Auto-generar SKU cuando cambian los campos relevantes
  useEffect(() => {
    if (!isEditing && !skuManual) {
      const nuevoSku = generarSku(form.nombre, form.tipoProducto, form.capacidadMl)
      if (nuevoSku !== form.sku) {
        setForm(prev => ({ ...prev, sku: nuevoSku }))
      }
    }
  }, [form.nombre, form.tipoProducto, form.capacidadMl, isEditing, skuManual])

  // Cuando cambia el tipo de producto, actualizar campos derivados
  const handleTipoProductoChange = (tipoId: string) => {
    const tipo = tiposProducto.find(t => t.id === tipoId)
    if (tipo) {
      setForm(prev => ({
        ...prev,
        tipoProducto: tipoId,
        tipoEnvase: tipo.tipoEnvase,
        unidadesPorCarton: tipo.unidades.toString(),
        unidadMedida: tipo.unidadMedida,
        presentacion: tipo.presentacion,
        // Si es TAPA (latas), nunca es retornable. Si es cartón, por defecto sí es retornable
        esRetornable: tipo.permiteRetornable ? true : false
      }))
      // Mostrar modo avanzado solo si es "OTRO"
      setModoAvanzado(tipoId === 'OTRO')
    }
  }

  // Verificar si el tipo seleccionado permite retornable
  const tipoActual = tiposProducto.find(t => t.id === form.tipoProducto)
  const permiteRetornable = tipoActual?.permiteRetornable || false

  // Queries
  const { data: producto, isLoading: loadingProducto } = useQuery({
    queryKey: ['producto', id],
    queryFn: () => productosApi.get(id!),
    enabled: isEditing
  })

  // Cargar datos del producto al editar
  useEffect(() => {
    if (producto) {
      // Detectar tipo de producto basado en los datos guardados
      let tipoProducto = 'OTRO'
      const esLata = producto.tipoEnvase === 'LATA'
      const esBotella = producto.tipoEnvase === 'BOTELLA'
      const unidades = producto.unidadesPorCarton

      if (esLata && unidades === 24) {
        tipoProducto = 'TAPA'
      } else if (esBotella && unidades === 12) {
        tipoProducto = 'CARTON_12'
      } else if (esBotella && unidades === 24) {
        tipoProducto = 'CARTON_24'
      }

      setForm({
        sku: producto.sku || '',
        nombre: producto.nombre || '',
        descripcion: producto.descripcion || '',
        tipoProducto,
        capacidadMl: producto.capacidadMl?.toString() || '',
        precioPublico: producto.precioPublico?.toString() || '',
        presentacion: producto.presentacion || '',
        unidadMedida: producto.unidadMedida || '',
        tipoEnvase: producto.tipoEnvase || '',
        unidadesPorCarton: producto.unidadesPorCarton?.toString() || '',
        esRetornable: producto.esRetornable || false
      })

      // Mostrar modo avanzado si es tipo OTRO
      setModoAvanzado(tipoProducto === 'OTRO')
    }
  }, [producto])

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        return productosApi.update(id!, data)
      }
      return productosApi.create(data)
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Producto actualizado' : 'Producto creado')
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      navigate('/productos')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al guardar')
    }
  })

  // Estado para modal de confirmación de eliminar
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => productosApi.delete(id!),
    onSuccess: () => {
      toast.success('Producto eliminado')
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      navigate('/productos')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar producto')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.tipoProducto) {
      toast.error('Selecciona el tipo de producto')
      return
    }

    const data: any = {
      sku: form.sku,
      nombre: form.nombre,
      descripcion: form.descripcion || undefined,
      presentacion: form.presentacion,
      unidadMedida: form.unidadMedida,
      tipoEnvase: form.tipoEnvase || null,
      capacidadMl: form.capacidadMl ? parseInt(form.capacidadMl) : null,
      unidadesPorCarton: form.unidadesPorCarton ? parseInt(form.unidadesPorCarton) : null,
      esRetornable: form.esRetornable,
      precioPublico: form.precioPublico ? parseFloat(form.precioPublico) : null
    }

    saveMutation.mutate(data)
  }

  if (isEditing && loadingProducto) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-accent-500" size={40} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/productos')} className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </h1>
          {isEditing && (
            <p className="text-gray-600 font-mono">{producto?.sku}</p>
          )}
        </div>
        {isEditing && (
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="btn-ghost text-red-500 hover:bg-red-50"
          >
            <Trash2 size={20} />
            Eliminar
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PASO 1: Nombre del producto */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 rounded-full bg-accent-500 text-white flex items-center justify-center font-bold">1</span>
            <h2 className="text-lg font-semibold">Nombre del Producto</h2>
          </div>
          <input
            type="text"
            className="input text-xl font-medium"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej: Corona Extra, Modelo Especial, Tecate Light..."
            required
            autoFocus
          />
        </div>

        {/* PASO 2: Tipo de producto (simplificado) */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 rounded-full bg-accent-500 text-white flex items-center justify-center font-bold">2</span>
            <h2 className="text-lg font-semibold">Tipo de Producto</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tiposProducto.map((tipo) => (
              <button
                key={tipo.id}
                type="button"
                onClick={() => handleTipoProductoChange(tipo.id)}
                className={`p-5 rounded-xl border-2 text-center transition-all ${
                  form.tipoProducto === tipo.id
                    ? 'border-accent-500 bg-accent-50 shadow-lg ring-2 ring-accent-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="text-4xl">{tipo.icono}</span>
                <p className="font-bold mt-2 text-lg">{tipo.nombre}</p>
                <p className="text-xs text-gray-500">{tipo.descripcion}</p>
              </button>
            ))}
          </div>

          {/* Toggle de Retornable - solo si el tipo lo permite */}
          {form.tipoProducto && permiteRetornable && form.tipoProducto !== 'OTRO' && (
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, esRetornable: true })}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  form.esRetornable
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">♻️</span>
                <p className="font-semibold mt-1">Retornable</p>
                <p className="text-xs text-gray-500">El cliente devuelve envases</p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, esRetornable: false })}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  !form.esRetornable
                    ? 'border-gray-500 bg-gray-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">🗑️</span>
                <p className="font-semibold mt-1">Desechable</p>
                <p className="text-xs text-gray-500">Envase no se devuelve</p>
              </button>
            </div>
          )}

          {/* Info del tipo seleccionado */}
          {form.tipoProducto && form.tipoProducto !== 'OTRO' && (
            <div className="mt-4 p-3 bg-gray-100 rounded-lg text-sm flex items-center gap-2">
              <span className="text-lg">{form.esRetornable ? '♻️' : '📦'}</span>
              <p className="text-gray-700">
                <strong>{form.unidadesPorCarton} unidades</strong> por {form.presentacion.toLowerCase()}
                {form.esRetornable ? ' • Retornable' : ' • Desechable'}
              </p>
            </div>
          )}
        </div>

        {/* PASO 3: Capacidad */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 rounded-full bg-accent-500 text-white flex items-center justify-center font-bold">3</span>
            <h2 className="text-lg font-semibold">Capacidad del Envase</h2>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="number"
              className="input w-32 text-xl font-bold text-center"
              value={form.capacidadMl}
              onChange={(e) => setForm({ ...form, capacidadMl: e.target.value })}
              placeholder="355"
              min="1"
              required
            />
            <span className="text-xl text-gray-500">ml</span>
          </div>

          {/* Capacidades comunes */}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-sm text-gray-500 mr-2">Comunes:</span>
            {[355, 473, 600, 710, 940, 1000].map((ml) => (
              <button
                key={ml}
                type="button"
                onClick={() => setForm({ ...form, capacidadMl: ml.toString() })}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  form.capacidadMl === ml.toString()
                    ? 'bg-accent-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {ml}ml
              </button>
            ))}
          </div>
        </div>

        {/* PASO 4: Precio al Público */}
        <div className="card p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">4</span>
            <h2 className="text-lg font-semibold text-green-800">Precio de Venta al Público</h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-3xl text-green-600">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input text-3xl font-bold w-48 text-green-700"
              value={form.precioPublico}
              onChange={(e) => setForm({ ...form, precioPublico: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <p className="text-sm text-green-700 mt-2">
            Este es el precio al que vendes al cliente. El costo del proveedor se configura después.
          </p>
        </div>

        {/* Modo avanzado (solo si selecciona OTRO) */}
        {modoAvanzado && (
          <div className="card p-6 border-dashed border-2 border-gray-300">
            <h3 className="font-semibold mb-4 text-gray-700">Configuración Manual</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Presentación</label>
                <input
                  type="text"
                  className="input"
                  value={form.presentacion}
                  onChange={(e) => setForm({ ...form, presentacion: e.target.value })}
                  placeholder="Ej: Caja, Bolsa, Pack..."
                />
              </div>
              <div>
                <label className="label">Unidad de Medida</label>
                <input
                  type="text"
                  className="input"
                  value={form.unidadMedida}
                  onChange={(e) => setForm({ ...form, unidadMedida: e.target.value })}
                  placeholder="Ej: Cajas, Paquetes..."
                />
              </div>
              <div>
                <label className="label">Unidades por Empaque</label>
                <input
                  type="number"
                  className="input"
                  value={form.unidadesPorCarton}
                  onChange={(e) => setForm({ ...form, unidadesPorCarton: e.target.value })}
                  min="1"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded"
                    checked={form.esRetornable}
                    onChange={(e) => setForm({ ...form, esRetornable: e.target.checked })}
                  />
                  <span>Producto Retornable</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* SKU y Descripción (colapsado) */}
        <div className="card p-6">
          <details className="group">
            <summary className="cursor-pointer flex items-center justify-between">
              <span className="font-medium text-gray-600">Opciones Adicionales</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">
                  SKU (Código)
                  <span className="text-xs text-gray-400 ml-2">
                    {skuManual ? '(editado manualmente)' : '(auto-generado)'}
                  </span>
                </label>
                <input
                  type="text"
                  className="input font-mono"
                  value={form.sku}
                  onChange={(e) => {
                    setSkuManual(true)
                    setForm({ ...form, sku: e.target.value })
                  }}
                  placeholder="Se generará automáticamente..."
                  required
                />
                {!isEditing && skuManual && (
                  <button
                    type="button"
                    onClick={() => setSkuManual(false)}
                    className="text-xs text-accent-600 hover:underline mt-1"
                  >
                    Volver a auto-generar
                  </button>
                )}
              </div>
              <div>
                <label className="label">Descripción (opcional)</label>
                <textarea
                  className="input"
                  rows={2}
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Notas adicionales sobre el producto..."
                />
              </div>
            </div>
          </details>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/productos')}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="btn-primary"
          >
            {saveMutation.isPending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Save size={20} />
            )}
            {isEditing ? 'Guardar Cambios' : 'Crear Producto'}
          </button>
        </div>
      </form>

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
              <h3 className="text-lg font-bold">Eliminar Producto</h3>
            </div>

            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar <strong>{producto?.nombre}</strong>?
              Esta acción desactivará el producto y no podrá ser usado en nuevas operaciones.
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
