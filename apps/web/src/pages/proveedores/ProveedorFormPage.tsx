import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Loader2, Package, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { proveedoresApi } from '../../services/api'

export default function ProveedorFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!id

  // Form state
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    contacto: '',
    telefono: '',
    email: '',
    rfc: '',
    direccion: '',
    notas: ''
  })

  // Queries
  const { data: proveedor, isLoading: loadingProveedor } = useQuery({
    queryKey: ['proveedor', id],
    queryFn: () => proveedoresApi.get(id!),
    enabled: isEditing
  })

  // Cargar datos del proveedor al editar
  useEffect(() => {
    if (proveedor) {
      setForm({
        codigo: proveedor.codigo || '',
        nombre: proveedor.nombre || '',
        contacto: proveedor.contacto || '',
        telefono: proveedor.telefono || '',
        email: proveedor.email || '',
        rfc: proveedor.rfc || '',
        direccion: proveedor.direccion || '',
        notas: proveedor.notas || ''
      })
    }
  }, [proveedor])

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        return proveedoresApi.update(id!, data)
      }
      return proveedoresApi.create(data)
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Proveedor actualizado' : 'Proveedor creado')
      queryClient.invalidateQueries({ queryKey: ['proveedores'] })
      navigate('/proveedores')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al guardar')
    }
  })

  // Estado para modal de confirmación de eliminar
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => proveedoresApi.delete(id!),
    onSuccess: () => {
      toast.success('Proveedor eliminado')
      queryClient.invalidateQueries({ queryKey: ['proveedores'] })
      navigate('/proveedores')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar proveedor')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const data: any = {
      codigo: form.codigo,
      nombre: form.nombre,
      contacto: form.contacto || undefined,
      telefono: form.telefono || undefined,
      email: form.email || undefined,
      rfc: form.rfc || undefined,
      direccion: form.direccion || undefined,
      notas: form.notas || undefined
    }

    saveMutation.mutate(data)
  }

  if (isEditing && loadingProveedor) {
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
        <button onClick={() => navigate('/proveedores')} className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </h1>
          {isEditing && (
            <p className="text-gray-600 font-mono">{proveedor?.codigo}</p>
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
        {/* Información básica */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Información Básica</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label">Código *</label>
              <input
                type="text"
                className="input"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                placeholder="PROV-001"
                required
              />
            </div>
            <div>
              <label className="label">Nombre *</label>
              <input
                type="text"
                className="input"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre del proveedor"
                required
              />
            </div>
            <div>
              <label className="label">Contacto</label>
              <input
                type="text"
                className="input"
                value={form.contacto}
                onChange={(e) => setForm({ ...form, contacto: e.target.value })}
                placeholder="Nombre del contacto"
              />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input
                type="tel"
                className="input"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="(123) 456-7890"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contacto@proveedor.com"
              />
            </div>
            <div>
              <label className="label">RFC</label>
              <input
                type="text"
                className="input"
                value={form.rfc}
                onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
                placeholder="RFC para facturación"
              />
            </div>
          </div>
        </div>

        {/* Dirección y notas */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Información Adicional</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Dirección</label>
              <textarea
                className="input"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                rows={2}
                placeholder="Dirección completa del proveedor..."
              />
            </div>
            <div>
              <label className="label">Notas</label>
              <textarea
                className="input"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={3}
                placeholder="Notas adicionales sobre el proveedor..."
              />
            </div>
          </div>
        </div>

        {/* Productos del proveedor (solo al editar) */}
        {isEditing && proveedor?.productosProveedor?.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package size={20} className="text-gray-400" />
              Productos ({proveedor.productosProveedor.length})
            </h2>
            <div className="divide-y">
              {proveedor.productosProveedor.map((pp: any) => (
                <div key={pp.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{pp.producto.nombre}</p>
                    <p className="text-sm text-gray-500 font-mono">{pp.producto.sku}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Precio</p>
                      <p className="font-bold text-green-600">${parseFloat(pp.precioCompra).toFixed(2)}</p>
                    </div>
                    {pp.valorDeposito && (
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Depósito</p>
                        <p className="font-bold text-blue-600">${parseFloat(pp.valorDeposito).toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/proveedores')}
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
            {isEditing ? 'Guardar Cambios' : 'Crear Proveedor'}
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
              <h3 className="text-lg font-bold">Eliminar Proveedor</h3>
            </div>

            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar <strong>{proveedor?.nombre}</strong>?
              Esta acción desactivará el proveedor.
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
