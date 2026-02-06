import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, User, Building2, Phone, X, Loader2, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientesApi } from '../services/api'

interface ClienteSelectorProps {
  value: string
  onChange: (clienteId: string, cliente?: any) => void
  placeholder?: string
}

export default function ClienteSelector({ value, onChange, placeholder = 'Buscar cliente...' }: ClienteSelectorProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Query para clientes
  const { data: clientesData, isLoading } = useQuery({
    queryKey: ['clientes', search],
    queryFn: () => clientesApi.list({ search: search || undefined }),
  })

  const clientes = clientesData?.data || clientesData || []

  // Cliente seleccionado actualmente
  const clienteSeleccionado = clientes.find((c: any) => c.id === value)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (cliente: any) => {
    onChange(cliente.id, cliente)
    setSearch('')
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange('', undefined)
    setSearch('')
  }

  const handleInputFocus = () => {
    setIsOpen(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    if (!isOpen) setIsOpen(true)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input de búsqueda o cliente seleccionado */}
      {value && clienteSeleccionado ? (
        <div className="flex items-center gap-3 p-3 bg-accent-50 border-2 border-accent-500 rounded-lg">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            clienteSeleccionado.tipo === 'EMPRESA' ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            {clienteSeleccionado.tipo === 'EMPRESA' ? (
              <Building2 className="text-blue-600" size={20} />
            ) : (
              <User className="text-gray-600" size={20} />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">
              {clienteSeleccionado.nombreEmpresa || clienteSeleccionado.nombreContacto}
            </p>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Phone size={12} />
              {clienteSeleccionado.telefono}
              {clienteSeleccionado.nombreEmpresa && (
                <span className="text-gray-400">• {clienteSeleccionado.nombreContacto}</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            ref={inputRef}
            type="text"
            className="input pl-10 pr-4"
            placeholder={placeholder}
            value={search}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
          />
        </div>
      )}

      {/* Dropdown de resultados */}
      {isOpen && !value && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Opción de crear nuevo */}
          <button
            type="button"
            onClick={() => {
              setShowCreateModal(true)
              setIsOpen(false)
            }}
            className="w-full px-4 py-3 flex items-center gap-3 text-accent-600 hover:bg-accent-50 border-b border-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center">
              <Plus size={18} />
            </div>
            <span className="font-medium">Crear nuevo cliente</span>
            {search && <span className="text-gray-400 text-sm ml-auto">"{search}"</span>}
          </button>

          {/* Lista de clientes */}
          <div className="overflow-y-auto max-h-60">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="animate-spin mr-2" size={20} />
                Buscando...
              </div>
            ) : clientes.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <User className="mx-auto mb-2 opacity-50" size={32} />
                <p>No se encontraron clientes</p>
                {search && <p className="text-sm">Intenta con otro término o crea uno nuevo</p>}
              </div>
            ) : (
              clientes.map((cliente: any) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => handleSelect(cliente)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    cliente.tipo === 'EMPRESA' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    {cliente.tipo === 'EMPRESA' ? (
                      <Building2 className="text-blue-600" size={16} />
                    ) : (
                      <User className="text-gray-600" size={16} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {cliente.nombreEmpresa || cliente.nombreContacto}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {cliente.telefono}
                      {cliente.nombreEmpresa && ` • ${cliente.nombreContacto}`}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    cliente.tipo === 'EMPRESA' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {cliente.tipo}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal Crear Cliente Rápido */}
      {showCreateModal && (
        <ClienteQuickCreateModal
          initialName={search}
          onClose={() => setShowCreateModal(false)}
          onCreated={(cliente) => {
            queryClient.invalidateQueries({ queryKey: ['clientes'] })
            onChange(cliente.id, cliente)
            setShowCreateModal(false)
            setSearch('')
          }}
        />
      )}
    </div>
  )
}

// Modal para crear cliente rápido
interface QuickCreateModalProps {
  initialName: string
  onClose: () => void
  onCreated: (cliente: any) => void
}

function ClienteQuickCreateModal({ initialName, onClose, onCreated }: QuickCreateModalProps) {
  const [tipo, setTipo] = useState<'PERSONA' | 'EMPRESA'>('PERSONA')
  const [nombreEmpresa, setNombreEmpresa] = useState('')
  const [nombreContacto, setNombreContacto] = useState(initialName)
  const [telefono, setTelefono] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: (data: any) => clientesApi.create(data),
    onSuccess: (data) => {
      toast.success('Cliente creado')
      onCreated(data)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al crear cliente')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validaciones
    const newErrors: Record<string, string> = {}

    if (tipo === 'EMPRESA' && !nombreEmpresa.trim()) {
      newErrors.nombreEmpresa = 'Requerido'
    }
    if (!nombreContacto.trim()) {
      newErrors.nombreContacto = 'Requerido'
    }
    if (!telefono.trim() || telefono.length < 10) {
      newErrors.telefono = 'Mínimo 10 dígitos'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    mutation.mutate({
      tipo,
      nombreEmpresa: tipo === 'EMPRESA' ? nombreEmpresa : null,
      nombreContacto,
      telefono,
      // Campos opcionales como null
      telefonoSecundario: null,
      email: null,
      rfc: null,
      direccionCalle: null,
      direccionNumero: null,
      direccionColonia: null,
      direccionCiudad: null,
      direccionEstado: null,
      direccionCp: null,
      notas: null
    })
  }

  return (
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          width: '90%',
          maxWidth: '450px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Crear Cliente Rápido</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTipo('PERSONA')}
              className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors ${
                tipo === 'PERSONA'
                  ? 'border-accent-500 bg-accent-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <User size={20} className={tipo === 'PERSONA' ? 'text-accent-600' : 'text-gray-400'} />
              <span className={tipo === 'PERSONA' ? 'font-medium text-accent-700' : 'text-gray-600'}>
                Persona
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTipo('EMPRESA')}
              className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors ${
                tipo === 'EMPRESA'
                  ? 'border-accent-500 bg-accent-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Building2 size={20} className={tipo === 'EMPRESA' ? 'text-accent-600' : 'text-gray-400'} />
              <span className={tipo === 'EMPRESA' ? 'font-medium text-accent-700' : 'text-gray-600'}>
                Empresa
              </span>
            </button>
          </div>

          {/* Nombre Empresa (solo si es empresa) */}
          {tipo === 'EMPRESA' && (
            <div>
              <label className="label">Nombre de la empresa *</label>
              <input
                type="text"
                className={`input ${errors.nombreEmpresa ? 'input-error' : ''}`}
                placeholder="Distribuidora XYZ"
                value={nombreEmpresa}
                onChange={(e) => {
                  setNombreEmpresa(e.target.value)
                  setErrors({ ...errors, nombreEmpresa: '' })
                }}
                autoFocus={tipo === 'EMPRESA'}
              />
              {errors.nombreEmpresa && <p className="text-red-500 text-sm mt-1">{errors.nombreEmpresa}</p>}
            </div>
          )}

          {/* Nombre Contacto */}
          <div>
            <label className="label">
              {tipo === 'EMPRESA' ? 'Nombre del contacto *' : 'Nombre completo *'}
            </label>
            <input
              type="text"
              className={`input ${errors.nombreContacto ? 'input-error' : ''}`}
              placeholder="Juan Pérez"
              value={nombreContacto}
              onChange={(e) => {
                setNombreContacto(e.target.value)
                setErrors({ ...errors, nombreContacto: '' })
              }}
              autoFocus={tipo === 'PERSONA'}
            />
            {errors.nombreContacto && <p className="text-red-500 text-sm mt-1">{errors.nombreContacto}</p>}
          </div>

          {/* Teléfono */}
          <div>
            <label className="label">Teléfono *</label>
            <input
              type="tel"
              className={`input ${errors.telefono ? 'input-error' : ''}`}
              placeholder="956 123 4567"
              value={telefono}
              onChange={(e) => {
                setTelefono(e.target.value)
                setErrors({ ...errors, telefono: '' })
              }}
            />
            {errors.telefono && <p className="text-red-500 text-sm mt-1">{errors.telefono}</p>}
          </div>

          {/* Nota */}
          <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
            Puedes completar los demás datos del cliente después desde el módulo de Clientes.
          </p>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="btn-primary flex-1"
            >
              {mutation.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <Check size={20} />
                  Crear y Seleccionar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
