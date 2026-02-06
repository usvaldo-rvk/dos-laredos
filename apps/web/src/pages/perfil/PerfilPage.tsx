import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { User, Shield, Key, Eye, EyeOff, Loader2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'
import { authApi } from '../../services/api'

export default function PerfilPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [showConfigPin, setShowConfigPin] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showDeletePin, setShowDeletePin] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')

  const { data: pinStatus, isLoading: loadingPinStatus } = useQuery({
    queryKey: ['has-pin'],
    queryFn: () => authApi.hasPin()
  })

  const setPinMutation = useMutation({
    mutationFn: () => authApi.setPin(pin, currentPassword),
    onSuccess: () => {
      toast.success('PIN configurado correctamente')
      queryClient.invalidateQueries({ queryKey: ['has-pin'] })
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al configurar PIN')
    }
  })

  const deletePinMutation = useMutation({
    mutationFn: () => authApi.deletePin(deletePassword),
    onSuccess: () => {
      toast.success('PIN eliminado')
      queryClient.invalidateQueries({ queryKey: ['has-pin'] })
      setShowDeletePin(false)
      setDeletePassword('')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al eliminar PIN')
    }
  })

  const resetForm = () => {
    setShowConfigPin(false)
    setPin('')
    setConfirmPin('')
    setCurrentPassword('')
  }

  const handleSetPin = () => {
    if (pin.length < 4 || pin.length > 6) {
      toast.error('El PIN debe tener entre 4 y 6 dígitos')
      return
    }
    if (pin !== confirmPin) {
      toast.error('Los PINs no coinciden')
      return
    }
    if (!currentPassword) {
      toast.error('Ingresa tu contraseña actual')
      return
    }
    setPinMutation.mutate()
  }

  const canHavePin = pinStatus?.canHavePin ?? (user?.rol !== 'OPERARIO')

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-600">Configuración de tu cuenta</p>
      </div>

      {/* Información del usuario */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User size={32} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{user?.nombre}</h2>
            <p className="text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Rol</p>
            <p className="font-medium flex items-center gap-2">
              <Shield size={16} className="text-accent-500" />
              {user?.rol === 'ADMIN' ? 'Administrador' :
               user?.rol === 'SUPERVISOR' ? 'Supervisor' : 'Operario'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Almacenes asignados</p>
            <p className="font-medium">
              {user?.almacenes?.map((a: any) => a.nombre).join(', ') || 'Ninguno'}
            </p>
          </div>
        </div>
      </div>

      {/* Configuración de PIN */}
      {canHavePin && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Key size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold">PIN de Autorización</h3>
                <p className="text-sm text-gray-500">
                  Usado para autorizar acciones sensibles de otros usuarios
                </p>
              </div>
            </div>

            {loadingPinStatus ? (
              <Loader2 className="animate-spin text-gray-400" size={20} />
            ) : pinStatus?.hasPin ? (
              <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <Check size={16} />
                Configurado
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-400 text-sm">
                <X size={16} />
                No configurado
              </span>
            )}
          </div>

          {!showConfigPin && !showDeletePin && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfigPin(true)}
                className="btn-primary"
              >
                {pinStatus?.hasPin ? 'Cambiar PIN' : 'Configurar PIN'}
              </button>
              {pinStatus?.hasPin && (
                <button
                  onClick={() => setShowDeletePin(true)}
                  className="btn-secondary text-red-600 hover:bg-red-50"
                >
                  Eliminar PIN
                </button>
              )}
            </div>
          )}

          {/* Formulario para configurar PIN */}
          {showConfigPin && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
              <div>
                <label className="label">Nuevo PIN (4-6 dígitos)</label>
                <input
                  type="password"
                  className="input w-full text-center text-2xl tracking-widest"
                  placeholder="••••"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Confirmar PIN</label>
                <input
                  type="password"
                  className="input w-full text-center text-2xl tracking-widest"
                  placeholder="••••"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                />
                {pin && confirmPin && pin !== confirmPin && (
                  <p className="text-red-500 text-sm mt-1">Los PINs no coinciden</p>
                )}
                {pin && confirmPin && pin === confirmPin && (
                  <p className="text-green-500 text-sm mt-1 flex items-center gap-1">
                    <Check size={14} /> Los PINs coinciden
                  </p>
                )}
              </div>

              <div>
                <label className="label">Contraseña actual (para confirmar)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input w-full pr-10"
                    placeholder="Tu contraseña actual"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={resetForm} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  onClick={handleSetPin}
                  disabled={setPinMutation.isPending || pin.length < 4 || pin !== confirmPin || !currentPassword}
                  className="btn-primary flex-1"
                >
                  {setPinMutation.isPending ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    'Guardar PIN'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Formulario para eliminar PIN */}
          {showDeletePin && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg space-y-4">
              <p className="text-sm text-red-700">
                Al eliminar tu PIN, otros usuarios no podrán solicitar tu autorización para acciones sensibles.
              </p>

              <div>
                <label className="label">Contraseña actual (para confirmar)</label>
                <input
                  type="password"
                  className="input w-full"
                  placeholder="Tu contraseña actual"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowDeletePin(false)
                    setDeletePassword('')
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deletePinMutation.mutate()}
                  disabled={deletePinMutation.isPending || !deletePassword}
                  className="btn-primary bg-red-600 hover:bg-red-700 flex-1"
                >
                  {deletePinMutation.isPending ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    'Eliminar PIN'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mensaje para operarios */}
      {!canHavePin && (
        <div className="card p-6 bg-gray-50">
          <div className="flex items-center gap-3">
            <Key size={20} className="text-gray-400" />
            <p className="text-gray-500">
              La configuración de PIN está disponible solo para supervisores y administradores.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
