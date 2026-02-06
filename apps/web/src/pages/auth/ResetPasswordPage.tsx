import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../../services/api'

interface ResetPasswordForm {
  password: string
  confirmPassword: string
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<ResetPasswordForm>()

  const password = watch('password')

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      toast.error('Token inválido')
      return
    }

    setIsLoading(true)

    try {
      await authApi.resetPassword(token, data.password)
      setSuccess(true)
    } catch (error: any) {
      const message = error.response?.data?.error || 'Error al restablecer contraseña'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Enlace inválido</h2>
        <p className="text-gray-600 mb-8">
          El enlace de recuperación no es válido o ha expirado.
        </p>
        <Link to="/forgot-password" className="btn-primary inline-flex">
          Solicitar nuevo enlace
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Contraseña actualizada</h2>
        <p className="text-gray-600 mb-8">
          Tu contraseña ha sido restablecida correctamente. Ya puedes iniciar sesión.
        </p>
        <Link to="/login" className="btn-primary inline-flex">
          Iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link
        to="/login"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        Volver
      </Link>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Nueva contraseña</h2>
      <p className="text-gray-600 mb-8">Ingresa tu nueva contraseña</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label htmlFor="password" className="label">
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
              placeholder="••••••••"
              {...register('password', {
                required: 'La contraseña es requerida',
                minLength: {
                  value: 6,
                  message: 'Mínimo 6 caracteres'
                }
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.password && <p className="error-message">{errors.password.message}</p>}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="label">
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            type="password"
            className={`input ${errors.confirmPassword ? 'input-error' : ''}`}
            placeholder="••••••••"
            {...register('confirmPassword', {
              required: 'Confirma tu contraseña',
              validate: (value) => value === password || 'Las contraseñas no coinciden'
            })}
          />
          {errors.confirmPassword && (
            <p className="error-message">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full"
        >
          {isLoading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Guardando...
            </>
          ) : (
            'Guardar contraseña'
          )}
        </button>
      </form>
    </div>
  )
}
