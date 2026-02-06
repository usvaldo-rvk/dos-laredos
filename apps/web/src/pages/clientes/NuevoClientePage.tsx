import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Loader2, Building2, User } from 'lucide-react'
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

export default function NuevoClientePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tipoCliente, setTipoCliente] = useState<'PERSONA' | 'EMPRESA'>('EMPRESA')

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ClienteForm>({
    defaultValues: {
      tipo: 'EMPRESA'
    }
  })

  const mutation = useMutation({
    mutationFn: (data: any) => clientesApi.create(data),
    onSuccess: (data) => {
      toast.success('Cliente creado correctamente')
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      navigate(`/clientes/${data.id}`)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear cliente')
    }
  })

  const onSubmit = (data: ClienteForm) => {
    mutation.mutate({
      ...data,
      tipo: tipoCliente,
      nombreEmpresa: tipoCliente === 'EMPRESA' ? data.nombreEmpresa : null
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/clientes" className="btn-ghost p-2">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo Cliente</h1>
          <p className="text-gray-600">Registrar un nuevo cliente</p>
        </div>
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
            disabled={mutation.isPending}
            className="btn-primary flex-1"
          >
            {mutation.isPending ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Guardando...
              </>
            ) : (
              'Crear Cliente'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
