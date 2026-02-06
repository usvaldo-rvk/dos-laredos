import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Package, Search, Eye, QrCode, LayoutGrid, List } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { tarimasApi, catalogosApi } from '../../services/api'

type VistaActiva = 'todas' | 'por-producto' | 'por-proveedor'
type ModoVista = 'tabla' | 'tarjetas'

const estadoColors: Record<string, string> = {
  ACTIVA: 'bg-green-100 text-green-800',
  RESERVADA: 'bg-yellow-100 text-yellow-800',
  AGOTADA: 'bg-gray-100 text-gray-800',
  BLOQUEADA: 'bg-red-100 text-red-800'
}

export default function TarimasPage() {
  const { almacenActivo } = useAuthStore()
  const [vistaActiva, setVistaActiva] = useState<VistaActiva>('todas')
  const [modoVista, setModoVista] = useState<ModoVista>('tabla')
  const [filtroProducto, setFiltroProducto] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['tarimas', almacenActivo?.id, filtroEstado],
    queryFn: () => tarimasApi.list({
      almacenId: almacenActivo?.id,
      estado: filtroEstado || undefined
    }),
    enabled: !!almacenActivo
  })

  const { data: productos } = useQuery({
    queryKey: ['productos'],
    queryFn: () => catalogosApi.productos()
  })

  const { data: proveedores } = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => catalogosApi.proveedores()
  })

  const tarimas = data?.data || []

  // Filtrar tarimas
  const tarimasFiltradas = tarimas.filter((t: any) => {
    const matchBusqueda = !busqueda ||
      t.qrCode?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.producto?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.lote?.toLowerCase().includes(busqueda.toLowerCase())

    const matchProducto = !filtroProducto || t.productoId === filtroProducto
    const matchProveedor = !filtroProveedor || t.proveedorId === filtroProveedor

    return matchBusqueda && matchProducto && matchProveedor
  })

  // Agrupar tarimas según vista activa
  const agruparTarimas = () => {
    if (vistaActiva === 'por-producto') {
      const grupos: Record<string, any[]> = {}
      tarimasFiltradas.forEach((t: any) => {
        const key = t.producto?.nombre || 'Sin producto'
        if (!grupos[key]) grupos[key] = []
        grupos[key].push(t)
      })
      return grupos
    }

    if (vistaActiva === 'por-proveedor') {
      const grupos: Record<string, any[]> = {}
      tarimasFiltradas.forEach((t: any) => {
        const key = t.proveedor?.nombre || 'Sin proveedor'
        if (!grupos[key]) grupos[key] = []
        grupos[key].push(t)
      })
      return grupos
    }

    return { '': tarimasFiltradas }
  }

  const grupos = agruparTarimas()

  // Calcular totales por grupo
  const calcularTotales = (items: any[]) => {
    return items.reduce((acc, t) => ({
      unidades: acc.unidades + (t.inventarioActual ?? t.capacidadTotal),
      valorCompra: acc.valorCompra + ((t.inventarioActual ?? t.capacidadTotal) * (parseFloat(t.precioUnitario) || 0))
    }), { unidades: 0, valorCompra: 0 })
  }

  if (!almacenActivo) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Selecciona un almacén para ver las tarimas</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tarimas</h1>
          <p className="text-gray-600">Gestión de tarimas en {almacenActivo.nombre}</p>
        </div>
        <Link to="/tarimas/nueva" className="btn-primary">
          <Plus size={20} />
          Nueva Tarima
        </Link>
      </div>

      {/* Tabs de vista y filtros */}
      <div className="card p-4 space-y-4">
        {/* Tabs de agrupación */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setVistaActiva('todas')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                vistaActiva === 'todas'
                  ? 'bg-primary-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setVistaActiva('por-producto')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                vistaActiva === 'por-producto'
                  ? 'bg-primary-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Por Producto
            </button>
            <button
              onClick={() => setVistaActiva('por-proveedor')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                vistaActiva === 'por-proveedor'
                  ? 'bg-primary-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Por Proveedor
            </button>
          </div>

          {/* Modo de vista */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setModoVista('tabla')}
              className={`p-2 rounded ${modoVista === 'tabla' ? 'bg-white shadow' : ''}`}
              title="Vista tabla"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setModoVista('tarjetas')}
              className={`p-2 rounded ${modoVista === 'tarjetas' ? 'bg-white shadow' : ''}`}
              title="Vista tarjetas"
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por QR, lote o producto..."
              className="input pl-10 w-full"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <select
            className="input"
            value={filtroProducto}
            onChange={(e) => setFiltroProducto(e.target.value)}
          >
            <option value="">Todos los productos</option>
            {(productos?.data || productos || []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>

          <select
            className="input"
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
          >
            <option value="">Todos los proveedores</option>
            {(proveedores?.data || proveedores || []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>

          <select
            className="input"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVA">Activa</option>
            <option value="RESERVADA">Reservada</option>
            <option value="AGOTADA">Agotada</option>
            <option value="BLOQUEADA">Bloqueada</option>
          </select>
        </div>
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="card p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-500 mt-4">Cargando tarimas...</p>
        </div>
      ) : tarimasFiltradas.length === 0 ? (
        <div className="card p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay tarimas que mostrar</p>
          <Link to="/tarimas/nueva" className="btn-primary mt-4 inline-flex">
            <Plus size={20} />
            Crear primera tarima
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grupos).map(([nombreGrupo, tarimasGrupo]) => {
            if ((tarimasGrupo as any[]).length === 0) return null
            const totales = calcularTotales(tarimasGrupo as any[])

            return (
              <div key={nombreGrupo || 'all'} className="card overflow-hidden">
                {vistaActiva !== 'todas' && nombreGrupo && (
                  <div className="card-header border-b bg-gray-50 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-gray-900">{nombreGrupo}</h2>
                      <p className="text-sm text-gray-500">{(tarimasGrupo as any[]).length} tarimas</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total unidades: <span className="font-semibold text-gray-900">{totales.unidades.toLocaleString()}</span></p>
                      <p className="text-sm text-gray-500">Valor compra: <span className="font-semibold text-accent-600">${totales.valorCompra.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span></p>
                    </div>
                  </div>
                )}

                {modoVista === 'tabla' ? (
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>QR Code</th>
                          <th>Producto</th>
                          <th>Proveedor</th>
                          <th>Lote</th>
                          <th>Ubicación</th>
                          <th className="text-right">Precio Compra</th>
                          <th className="text-right">Inventario</th>
                          <th>Estado</th>
                          <th>Ingreso</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tarimasGrupo as any[]).map((tarima: any) => (
                          <tr key={tarima.id} className="hover:bg-gray-50">
                            <td>
                              <Link
                                to={`/tarimas/${tarima.id}`}
                                className="font-mono text-accent-600 hover:text-accent-700 font-medium"
                              >
                                {tarima.qrCode}
                              </Link>
                            </td>
                            <td>
                              <div>
                                <p className="font-medium">{tarima.producto?.nombre}</p>
                                <p className="text-sm text-gray-500">{tarima.producto?.sku}</p>
                              </div>
                            </td>
                            <td className="text-gray-600">{tarima.proveedor?.nombre}</td>
                            <td className="font-mono text-sm">{tarima.lote || '-'}</td>
                            <td>{tarima.ubicacion?.codigo || '-'}</td>
                            <td className="text-right">
                              {tarima.precioUnitario ? (
                                <span className="font-medium">${parseFloat(tarima.precioUnitario).toFixed(2)}</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="text-right">
                              <span className="font-bold text-lg">
                                {tarima.inventarioActual ?? tarima.capacidadTotal}
                              </span>
                              <span className="text-gray-400 text-sm"> / {tarima.capacidadTotal}</span>
                            </td>
                            <td>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColors[tarima.estado]}`}>
                                {tarima.estado}
                              </span>
                            </td>
                            <td className="text-gray-500 text-sm">
                              {new Date(tarima.fechaIngreso).toLocaleDateString()}
                            </td>
                            <td>
                              <Link to={`/tarimas/${tarima.id}`} className="btn-ghost p-1">
                                <Eye size={18} />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {(tarimasGrupo as any[]).map((tarima: any) => (
                      <Link
                        key={tarima.id}
                        to={`/tarimas/${tarima.id}`}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <QrCode className="text-gray-400" size={20} />
                            </div>
                            <div>
                              <p className="font-mono font-medium text-sm">{tarima.qrCode}</p>
                              <p className="text-xs text-gray-500">{tarima.lote}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColors[tarima.estado]}`}>
                            {tarima.estado}
                          </span>
                        </div>

                        <p className="font-medium text-gray-900">{tarima.producto?.nombre}</p>
                        <p className="text-sm text-gray-500 mb-3">{tarima.proveedor?.nombre}</p>

                        <div className="flex justify-between items-end pt-3 border-t">
                          <div>
                            <p className="text-xs text-gray-500">Precio compra</p>
                            <p className="font-medium">
                              {tarima.precioUnitario ? `$${parseFloat(tarima.precioUnitario).toFixed(2)}` : '-'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Inventario</p>
                            <p className="text-2xl font-bold text-accent-600">
                              {tarima.inventarioActual ?? tarima.capacidadTotal}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
