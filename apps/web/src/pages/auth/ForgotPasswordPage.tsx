import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { authApi } from '../../services/api'

interface ForgotPasswordForm {
  email: string
}

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ForgotPasswordForm>()

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true)

    try {
      await authApi.forgotPassword(data.email)
      setEmailSent(true)
    } catch (error) {
      toast.error('Error al enviar el correo')
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
          <Mail className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Revisa tu correo</h2>
        <p className="text-gray-600 mb-8">
          Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.
        </p>
        <Link to="/login" className="btn-primary inline-flex">
          <ArrowLeft size={20} />
          Volver al inicio
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

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Recuperar contraseña</h2>
      <p className="text-gray-600 mb-8">
        Ingresa tu correo y te enviaremos instrucciones para restablecer tu contraseña.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label htmlFor="email" className="label">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            className={`input ${errors.email ? 'input-error' : ''}`}
            placeholder="tu@email.com"
            {...register('email', {
              required: 'El correo es requerido',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Correo inválido'
              }
            })}
          />
          {errors.email && <p className="error-message">{errors.email.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full"
        >
          {isLoading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Enviando...
            </>
          ) : (
            'Enviar instrucciones'
          )}
        </button>
      </form>
    </div>
  )
}
