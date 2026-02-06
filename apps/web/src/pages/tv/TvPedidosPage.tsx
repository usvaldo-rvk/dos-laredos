import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Package, Clock, AlertTriangle } from 'lucide-react'
import { tvApi } from '../../services/api'

const prioridadStyles = {
  URGENTE: 'tv-card-urgente',
  ALTA: 'tv-card-alta',
  NORMAL: 'tv-card-normal'
}

export default function TvPedidosPage() {
  const { token } = useParams<{ token: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['tv-pedidos', token],
    queryFn: () => tvApi.pedidos(token!),
    refetchInterval: 15000, // Actualizar cada 15 segundos
    enabled: !!token
  })

  if (isLoading) {
    return (
      <div className="tv-view flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-accent-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-xl text-white/70">Cargando...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="tv-view flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-24 h-24 text-red-500 mx-auto mb-4" />
          <p className="text-2xl text-white">Pantalla no disponible</p>
          <p className="text-white/60 mt-2">Verifica el token de acceso</p>
        </div>
      </div>
    )
  }

  return (
    <div className="tv-view p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-accent-400 rounded-xl flex items-center justify-center">
            <span className="text-primary-900 font-bold text-2xl">DL</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">DOS LAREDOS</h1>
            <p className="text-accent-400 text-xl">{data.almacen.nombre}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white/60">Actualizado:</p>
          <p className="text-2xl text-white font-mono">
            {new Date(data.actualizadoEn).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Pedidos */}
      {data.pedidos.length === 0 ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Package className="w-32 h-32 text-white/20 mx-auto mb-4" />
            <p className="text-3xl text-white/50">No hay pedidos pendientes</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {data.pedidos.map((pedido: any) => (
            <div
              key={pedido.id}
              className={`rounded-xl p-6 ${prioridadStyles[pedido.prioridad as keyof typeof prioridadStyles]}`}
            >
              {/* Header del pedido */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold font-mono text-white">
                    {pedido.numeroPedido}
                  </p>
                  <p className="text-lg text-white/80">{pedido.cliente}</p>
                </div>
                {pedido.prioridad === 'URGENTE' && (
                  <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                    URGENTE
                  </div>
                )}
              </div>

              {/* Progreso */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-white/60 mb-1">
                  <span>Progreso</span>
                  <span>
                    {pedido.totalLineas - pedido.lineasPendientes} / {pedido.totalLineas}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-400 transition-all"
                    style={{
                      width: `${((pedido.totalLineas - pedido.lineasPendientes) / pedido.totalLineas) * 100}%`
                    }}
                  />
                </div>
              </div>

              {/* Picks pendientes */}
              {pedido.picks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-white/60 font-medium">Picks pendientes:</p>
                  {pedido.picks.slice(0, 4).map((pick: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-2"
                    >
                      <div className="flex-1">
                        <p className="text-white font-medium truncate">{pick.producto}</p>
                        <p className="text-sm text-white/60">{pick.ubicacion}</p>
                      </div>
                      <p className="text-2xl font-bold text-accent-400">{pick.cantidad}</p>
                    </div>
                  ))}
                  {pedido.picks.length > 4 && (
                    <p className="text-center text-white/50 text-sm">
                      +{pedido.picks.length - 4} más
                    </p>
                  )}
                </div>
              )}

              {/* Fecha requerida */}
              {pedido.fechaRequerida && (
                <div className="flex items-center gap-2 mt-4 text-white/60">
                  <Clock size={16} />
                  <span className="text-sm">
                    Entregar: {new Date(pedido.fechaRequerida).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
