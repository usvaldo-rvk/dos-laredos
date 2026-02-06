import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Loader2, Building2, User, Trash2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientesApi } from '../../services/api'

interface ClienteForm {
  tipo: 'PERSONA' | 'EMPRESA'
  nombreEmpresa: string
  nombreContacto: string
  telefono: string
  telefonoSecundario: string
  email: string
  rfc: string
  direccionCalle: string
  direccionNumero: string
  direccionColonia: string
  direccionCiudad: string
  direccionEstado: string
  direccionCp: string
  notas: string
}

export default function ClienteFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = !!id

  const [tipoCliente, setTipoCliente] = useState<'PERSONA' | 'EMPRESA'>('EMPRESA')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ClienteForm>({
    defaultValues: {
      tipo: 'EMPRESA'
    }
  })

  // Query para obtener cliente existente
  const { data: cliente, isLoading: loadingCliente } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => clientesApi.get(id!),
    enabled: isEditing
  })

  // Cargar datos del cliente al editar
  useEffect(() => {
    if (cliente) {
      setTipoCliente(cliente.tipo)
      reset({
        tipo: cliente.tipo,
        nombreEmpresa: cliente.nombreEmpresa || '',
        nombreContacto: cliente.nombreContacto || '',
        telefono: cliente.telefono || '',
        telefonoSecundario: cliente.telefonoSecundario || '',
        email: cliente.email || '',
        rfc: cliente.rfc || '',
        direccionCalle: cliente.direccionCalle || '',
        direccionNumero: cliente.direccionNumero || '',
        direccionColonia: cliente.direccionColonia || '',
        direccionCiudad: cliente.direccionCiudad || '',
        direccionEstado: cliente.direccionEstado || '',
        direccionCp: cliente.direccionCp || '',
        notas: cliente.notas || ''
      })
    }
  }, [cliente, reset])

  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (isEditing) {
        return clientesApi.update(id!, data)
      }
      return clientesApi.create(data)
    },
    onSuccess: (data) => {
      toast.success(isEditing ? 'Cliente actualizado' : 'Cliente creado')
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      queryClient.invalidateQueries({ queryKey: ['cliente', id] })
      navigate(`/clientes/${data.id || id}`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al guardar cliente')
    }
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

  const onSubmit = (data: ClienteForm) => {
    saveMutation.mutate({
      ...data,
      tipo: tipoCliente,
      nombreEmpresa: tipoCliente === 'EMPRESA' ? data.nombreEmpresa : null
    })
  }

  if (isEditing && loadingCliente) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-accent-500" size={40} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/clientes" className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h1>
          <p className="text-gray-600">
            {isEditing ? cliente?.nombreEmpresa || cliente?.nombreContacto : 'Registrar un nuevo cliente'}
          </p>
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

      {/* Tipo de cliente */}
      <div className="card p-6">
        <label className="label mb-3">Tipo de cliente</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setTipoCliente('EMPRESA')}
            className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
              tipoCliente === 'EMPRESA'
                ? 'border-accent-500 bg-accent-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Building2 size={32} className={tipoCliente === 'EMPRESA' ? 'text-accent-600' : 'text-gray-400'} />
            <span className={tipoCliente === 'EMPRESA' ? 'font-medium text-accent-700' : 'text-gray-600'}>
              Empresa
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTipoCliente('PERSONA')}
            className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
              tipoCliente === 'PERSONA'
                ? 'border-accent-500 bg-accent-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <User size={32} className={tipoCliente === 'PERSONA' ? 'text-accent-600' : 'text-gray-400'} />
            <span className={tipoCliente === 'PERSONA' ? 'font-medium text-accent-700' : 'text-gray-600'}>
              Persona
            </span>
          </button>
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-6">
        {/* Datos básicos */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Datos básicos</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {tipoCliente === 'EMPRESA' && (
              <div className="sm:col-span-2">
                <label className="label">Nombre de la empresa *</label>
                <input
                  type="text"
                  className={`input ${errors.nombreEmpresa ? 'input-error' : ''}`}
                  placeholder="Distribuidora XYZ S.A. de C.V."
                  {...register('nombreEmpresa', {
                    required: tipoCliente === 'EMPRESA' ? 'El nombre de la empresa es requerido' : false
                  })}
                />
                {errors.nombreEmpresa && <p className="error-message">{errors.nombreEmpresa.message}</p>}
              </div>
            )}

            <div className={tipoCliente === 'PERSONA' ? 'sm:col-span-2' : ''}>
              <label className="label">Nombre del contacto *</label>
              <input
                type="text"
                className={`input ${errors.nombreContacto ? 'input-error' : ''}`}
                placeholder="Juan Pérez"
                {...register('nombreContacto', { required: 'El nombre es requerido' })}
              />
              {errors.nombreContacto && <p className="error-message">{errors.nombreContacto.message}</p>}
            </div>

            <div>
              <label className="label">Teléfono principal *</label>
              <input
                type="tel"
                className={`input ${errors.telefono ? 'input-error' : ''}`}
                placeholder="956 123 4567"
                {...register('telefono', {
                  required: 'El teléfono es requerido',
                  minLength: { value: 10, message: 'Mínimo 10 dígitos' }
                })}
              />
              {errors.telefono && <p className="error-message">{errors.telefono.message}</p>}
            </div>

            <div>
              <label className="label">Teléfono secundario</label>
              <input
                type="tel"
                className="input"
                placeholder="956 987 6543"
                {...register('telefonoSecundario')}
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="contacto@empresa.com"
                {...register('email')}
              />
            </div>

            <div>
              <label className="label">RFC</label>
              <input
                type="text"
                className="input"
                placeholder="XAXX010101000"
                maxLength={13}
                {...register('rfc')}
              />
            </div>
          </div>
        </div>

        {/* Dirección */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Dirección</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Calle</label>
              <input
                type="text"
                className="input"
                placeholder="Av. Principal"
                {...register('direccionCalle')}
              />
            </div>

            <div>
              <label className="label">Número</label>
              <input
                type="text"
                className="input"
                placeholder="123"
                {...register('direccionNumero')}
              />
            </div>

            <div>
              <label className="label">Colonia</label>
              <input
                type="text"
                className="input"
                placeholder="Centro"
                {...register('direccionColonia')}
              />
            </div>

            <div>
              <label className="label">Ciudad</label>
              <input
                type="text"
                className="input"
                placeholder="Nuevo Laredo"
                {...register('direccionCiudad')}
              />
            </div>

            <div>
              <label className="label">Estado</label>
              <input
                type="text"
                className="input"
                placeholder="Tamaulipas"
                {...register('direccionEstado')}
              />
            </div>

            <div>
              <label className="label">Código Postal</label>
              <input
                type="text"
                className="input"
                placeholder="88000"
                {...register('direccionCp')}
              />
            </div>
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="label">Notas internas</label>
          <textarea
            className="input min-h-[100px]"
            placeholder="Observaciones sobre el cliente..."
            {...register('notas')}
          />
        </div>

        {/* Botones */}
        <div className="flex gap-4 pt-4 border-t">
          <Link to="/clientes" className="btn-secondary flex-1">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="btn-primary flex-1"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Guardando...
              </>
            ) : (
              isEditing ? 'Guardar Cambios' : 'Crear Cliente'
            )}
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
              <h3 className="text-lg font-bold">Eliminar Cliente</h3>
            </div>

            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que deseas eliminar a <strong>{cliente?.nombreEmpresa || cliente?.nombreContacto}</strong>?
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
