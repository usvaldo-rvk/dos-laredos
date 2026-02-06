import { useQuery } from '@tanstack/react-query'
import { Package, ClipboardList, AlertTriangle, TrendingUp } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { reportesApi } from '../../services/api'

export default function DashboardPage() {
  const { user, almacenActivo } = useAuthStore()

  const { data: kpis, isLoading } = useQuery({
    queryKey: ['kpis', almacenActivo?.id],
    queryFn: () => reportesApi.kpis(almacenActivo?.id),
    refetchInterval: 30000 // Actualizar cada 30 segundos
  })

  const stats = [
    {
      name: 'Tarimas Activas',
      value: kpis?.tarimasPorEstado?.ACTIVA || 0,
      icon: Package,
      color: 'bg-green-500'
    },
    {
      name: 'Tarimas Reservadas',
      value: kpis?.tarimasPorEstado?.RESERVADA || 0,
      icon: Package,
      color: 'bg-amber-500'
    },
    {
      name: 'Pedidos Nuevos',
      value: kpis?.pedidosPorEstado?.CREADO || 0,
      icon: ClipboardList,
      color: 'bg-blue-500'
    },
    {
      name: 'Enviados a Bodega',
      value: kpis?.pedidosPorEstado?.ENVIADO_BODEGA || 0,
      icon: TrendingUp,
      color: 'bg-green-500'
    },
    {
      name: 'En Revisión',
      value: kpis?.pedidosPorEstado?.EN_REVISION || 0,
      icon: AlertTriangle,
      color: 'bg-amber-500'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Bienvenido, {user?.nombre}. Almacén: {almacenActivo?.nombre}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="card p-6">
            <div className="flex items-center gap-4">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {isLoading ? '-' : stat.value}
                </p>
                <p className="text-sm text-gray-600">{stat.name}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Eventos de hoy */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold">Actividad de hoy</h2>
        </div>
        <div className="card-body">
          {isLoading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : kpis?.eventosHoy?.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpis.eventosHoy.map((evento: any) => (
                <div key={evento.tipo} className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{evento.cantidad}</p>
                  <p className="text-sm text-gray-600">{evento.tipo}</p>
                  <p className="text-xs text-gray-400">{evento.unidades} unidades</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No hay actividad hoy</p>
          )}
        </div>
      </div>

      {/* Tasa de completado */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Tasa de completado (7 días)</h3>
            <p className="text-gray-600">Pedidos completados vs creados</p>
          </div>
          <div className="text-4xl font-bold text-accent-500">
            {isLoading ? '-' : `${kpis?.tasaCompletado7Dias}%`}
          </div>
        </div>
      </div>
    </div>
  )
}
