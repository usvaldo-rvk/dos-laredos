import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Package, TrendingDown, Users, DollarSign, CreditCard,
  Banknote, Building2, CreditCard as CardIcon, Download, Calendar,
  ShoppingCart, FileSpreadsheet, Loader2, FileText
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { reportesApi } from '../../services/api'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

type TabType = 'ventas' | 'inventario' | 'pagos' | 'creditos' | 'mermas' | 'productividad' | 'clientes'
type PeriodoType = 'hoy' | 'ayer' | 'semana' | 'mes' | 'año' | 'custom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function ReportesPage() {
  const { almacenActivo, token } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabType>('ventas')
  const [periodo, setPeriodo] = useState<PeriodoType>('mes')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [exportando, setExportando] = useState(false)
  const [exportandoPDF, setExportandoPDF] = useState(false)

  const tabs = [
    { id: 'ventas', name: 'Ventas', icon: ShoppingCart },
    { id: 'pagos', name: 'Pagos', icon: DollarSign },
    { id: 'creditos', name: 'Créditos', icon: CreditCard },
    { id: 'inventario', name: 'Inventario', icon: Package },
    { id: 'mermas', name: 'Mermas', icon: TrendingDown },
    { id: 'productividad', name: 'Productividad', icon: BarChart3 },
    { id: 'clientes', name: 'Top Clientes', icon: Users }
  ] as const

  const periodos = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'ayer', label: 'Ayer' },
    { id: 'semana', label: 'Esta Semana' },
    { id: 'mes', label: 'Este Mes' },
    { id: 'año', label: 'Este Año' },
    { id: 'custom', label: 'Personalizado' }
  ] as const

  const handleExportar = async (tipo: string) => {
    setExportando(true)
    try {
      const params = new URLSearchParams()
      params.append('periodo', periodo)
      if (periodo === 'custom') {
        if (fechaInicio) params.append('fechaInicio', fechaInicio)
        if (fechaFin) params.append('fechaFin', fechaFin)
      }
      if (almacenActivo?.id) params.append('almacenId', almacenActivo.id)

      const response = await fetch(`${API_URL}/reportes/exportar/${tipo}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Error al exportar')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_${tipo}_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Reporte exportado correctamente')
    } catch (error) {
      toast.error('Error al exportar el reporte')
    } finally {
      setExportando(false)
    }
  }

  const handleExportarPDF = async (tipo: string) => {
    // Solo algunos tipos soportan PDF
    const tiposSoportados = ['ventas', 'inventario', 'creditos', 'pagos', 'mermas']
    if (!tiposSoportados.includes(tipo)) {
      toast.error('Este reporte no tiene formato PDF disponible')
      return
    }

    setExportandoPDF(true)
    try {
      const params = new URLSearchParams()
      params.append('periodo', periodo)
      if (periodo === 'custom') {
        if (fechaInicio) params.append('fechaInicio', fechaInicio)
        if (fechaFin) params.append('fechaFin', fechaFin)
      }
      if (almacenActivo?.id) params.append('almacenId', almacenActivo.id)

      const response = await fetch(`${API_URL}/reportes/pdf/${tipo}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) throw new Error('Error al exportar PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_${tipo}_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Reporte PDF generado correctamente')
    } catch (error) {
      toast.error('Error al generar el PDF')
    } finally {
      setExportandoPDF(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600">Análisis y estadísticas de {almacenActivo?.nombre}</p>
        </div>
      </div>

      {/* Selector de Período */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-600">Período:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {periodos.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  periodo === p.id
                    ? 'bg-primary-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {periodo === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="input text-sm py-1"
              />
              <span className="text-gray-400">a</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="input text-sm py-1"
              />
            </div>
          )}

          {/* Botones Exportar */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => handleExportarPDF(activeTab)}
              disabled={exportandoPDF || !['ventas', 'inventario', 'creditos', 'pagos', 'mermas'].includes(activeTab)}
              className="btn-ghost flex items-center gap-2 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar documento formal en PDF"
            >
              {exportandoPDF ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <FileText size={18} />
              )}
              <span className="hidden sm:inline">PDF Formal</span>
            </button>
            <button
              onClick={() => handleExportar(activeTab)}
              disabled={exportando}
              className="btn-ghost flex items-center gap-2 text-green-600 hover:bg-green-50"
              title="Exportar datos en Excel"
            >
              {exportando ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={18} />
              )}
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-2">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-primary-900 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon size={18} />
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'ventas' && (
        <ReporteVentas
          almacenId={almacenActivo?.id}
          periodo={periodo}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
        />
      )}
      {activeTab === 'inventario' && <ReporteInventario almacenId={almacenActivo?.id} />}
      {activeTab === 'mermas' && (
        <ReporteMermas
          almacenId={almacenActivo?.id}
          periodo={periodo}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
        />
      )}
      {activeTab === 'productividad' && (
        <ReporteProductividad
          almacenId={almacenActivo?.id}
          periodo={periodo}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
        />
      )}
      {activeTab === 'clientes' && <ReporteClientes />}
      {activeTab === 'pagos' && (
        <ReportePagos
          periodo={periodo}
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
        />
      )}
      {activeTab === 'creditos' && <ReporteCreditosTab />}
    </div>
  )
}

// Utilidades
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value || 0)
}

const getMetodoPagoIcon = (metodo: string) => {
  switch (metodo) {
    case 'EFECTIVO': return <Banknote size={18} className="text-green-600" />
    case 'TRANSFERENCIA': return <Building2 size={18} className="text-blue-600" />
    case 'TARJETA': return <CardIcon size={18} className="text-purple-600" />
    default: return <DollarSign size={18} />
  }
}

// Reporte de Ventas
function ReporteVentas({ almacenId, periodo, fechaInicio, fechaFin }: {
  almacenId?: string; periodo: string; fechaInicio: string; fechaFin: string
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['reporte-ventas', almacenId, periodo, fechaInicio, fechaFin],
    queryFn: () => reportesApi.ventas({
      almacenId,
      periodo,
      fechaInicio: periodo === 'custom' ? fechaInicio : undefined,
      fechaFin: periodo === 'custom' ? fechaFin : undefined
    })
  })

  if (isLoading) return <div className="card p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="card p-4 text-center bg-blue-50">
          <p className="text-3xl font-bold text-blue-600">{data?.resumen?.totalPedidos || 0}</p>
          <p className="text-sm text-blue-700">Pedidos</p>
        </div>
        <div className="card p-4 text-center bg-green-50">
          <p className="text-2xl font-bold text-green-600">{formatCurrency(data?.resumen?.totalVentas)}</p>
          <p className="text-sm text-green-700">Total Ventas</p>
        </div>
        <div className="card p-4 text-center bg-emerald-50">
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(data?.resumen?.totalPagado)}</p>
          <p className="text-sm text-emerald-700">Pagado</p>
        </div>
        <div className="card p-4 text-center bg-amber-50">
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(data?.resumen?.totalCredito)}</p>
          <p className="text-sm text-amber-700">En Crédito</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-700">{(data?.resumen?.totalUnidades || 0).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Unidades</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(data?.resumen?.ticketPromedio)}</p>
          <p className="text-sm text-purple-700">Ticket Promedio</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Por Estado */}
        <div className="card p-4">
          <h3 className="font-semibold mb-4">Por Estado</h3>
          <div className="space-y-2">
            {data?.porEstado?.map((item: any) => (
              <div key={item.estado} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="font-medium">{item.estado}</span>
                <div className="text-right">
                  <span className="text-sm text-gray-500 mr-3">{item.cantidad} pedidos</span>
                  <span className="font-bold">{formatCurrency(item.monto)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Por Método de Pago */}
        <div className="card p-4">
          <h3 className="font-semibold mb-4">Por Método de Pago</h3>
          <div className="space-y-2">
            {data?.porMetodoPago?.map((item: any) => (
              <div key={item.metodo} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  {getMetodoPagoIcon(item.metodo)}
                  <span className="font-medium">{item.metodo}</span>
                </div>
                <span className="font-bold">{formatCurrency(item.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Productos */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Top Productos Vendidos</h3>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {data?.porProducto?.slice(0, 10).map((item: any) => (
              <tr key={item.producto?.id}>
                <td>
                  <p className="font-medium">{item.producto?.nombre}</p>
                  <p className="text-sm text-gray-500">{item.producto?.sku}</p>
                </td>
                <td className="text-right">{item.cantidad.toLocaleString()}</td>
                <td className="text-right font-bold">{formatCurrency(item.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalle de Pedidos */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Detalle de Pedidos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Pago</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data?.detalle?.slice(0, 50).map((pedido: any) => (
                <tr key={pedido.id}>
                  <td>
                    <Link to={`/pedidos/${pedido.id}`} className="text-accent-600 hover:underline font-medium">
                      {pedido.numeroPedido}
                    </Link>
                  </td>
                  <td className="text-sm text-gray-500">
                    {new Date(pedido.fecha).toLocaleDateString('es-MX')}
                  </td>
                  <td>{pedido.cliente}</td>
                  <td>
                    <span className={`badge ${
                      pedido.estado === 'ENVIADO_BODEGA' ? 'badge-success' :
                      pedido.estado === 'CANCELADO' ? 'badge-danger' :
                      pedido.estado === 'EN_REVISION' ? 'badge-warning' :
                      'badge-info'
                    }`}>
                      {pedido.estado}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      pedido.estadoPago === 'PAGADO' ? 'badge-success' :
                      pedido.estadoPago === 'CREDITO' ? 'badge-warning' :
                      'badge-info'
                    }`}>
                      {pedido.estadoPago}
                    </span>
                  </td>
                  <td className="text-right font-bold">{formatCurrency(pedido.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ReporteInventario({ almacenId }: { almacenId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reporte-inventario', almacenId],
    queryFn: () => reportesApi.inventario(almacenId)
  })

  if (isLoading) return <div className="card p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>

  const totalInventario = data?.reduce((sum: number, item: any) => sum + item.totalInventario, 0) || 0
  const totalTarimas = data?.reduce((sum: number, item: any) => sum + item.totalTarimas, 0) || 0

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-6 text-center bg-blue-50">
          <p className="text-3xl font-bold text-blue-600">{data?.length || 0}</p>
          <p className="text-blue-700">Productos</p>
        </div>
        <div className="card p-6 text-center bg-green-50">
          <p className="text-3xl font-bold text-green-600">{totalTarimas}</p>
          <p className="text-green-700">Tarimas</p>
        </div>
        <div className="card p-6 text-center bg-purple-50">
          <p className="text-3xl font-bold text-purple-600">{totalInventario.toLocaleString()}</p>
          <p className="text-purple-700">Unidades Totales</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Almacén</th>
              <th className="text-center">Tarimas</th>
              <th className="text-right">Inventario</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((item: any, index: number) => (
              <tr key={index}>
                <td>
                  <p className="font-medium">{item.producto.nombre}</p>
                  <p className="text-sm text-gray-500">{item.producto.sku}</p>
                </td>
                <td>{item.almacen.nombre}</td>
                <td className="text-center">
                  <span className="text-green-600">{item.tarimasActivas}</span>
                  <span className="text-gray-400"> / </span>
                  <span>{item.totalTarimas}</span>
                </td>
                <td className="text-right font-bold text-lg">{item.totalInventario.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReporteMermas({ almacenId, periodo, fechaInicio, fechaFin }: {
  almacenId?: string; periodo: string; fechaInicio: string; fechaFin: string
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['reporte-mermas', almacenId, periodo, fechaInicio, fechaFin],
    queryFn: () => reportesApi.mermas({
      almacenId,
      fechaInicio: periodo === 'custom' ? fechaInicio : undefined,
      fechaFin: periodo === 'custom' ? fechaFin : undefined
    })
  })

  if (isLoading) return <div className="card p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-6 text-center bg-red-50">
          <p className="text-3xl font-bold text-red-600">{data?.totalEventos || 0}</p>
          <p className="text-red-700">Total Mermas</p>
        </div>
        <div className="card p-6 text-center bg-red-50">
          <p className="text-3xl font-bold text-red-600">{(data?.totalUnidades || 0).toLocaleString()}</p>
          <p className="text-red-700">Unidades Perdidas</p>
        </div>
        <div className="card p-6">
          <p className="font-semibold mb-2">Por Motivo:</p>
          {data?.resumenPorMotivo && Object.entries(data.resumenPorMotivo).map(([motivo, info]: [string, any]) => (
            <div key={motivo} className="flex justify-between text-sm py-1">
              <span className="truncate">{motivo}</span>
              <span className="font-medium text-red-600">{info.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ReporteProductividad({ almacenId, periodo, fechaInicio, fechaFin }: {
  almacenId?: string; periodo: string; fechaInicio: string; fechaFin: string
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['reporte-productividad', almacenId, periodo, fechaInicio, fechaFin],
    queryFn: () => reportesApi.productividad({
      almacenId,
      fechaInicio: periodo === 'custom' ? fechaInicio : undefined,
      fechaFin: periodo === 'custom' ? fechaFin : undefined
    })
  })

  if (isLoading) return <div className="card p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>

  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Operario</th>
            <th className="text-right">Total Picks</th>
            <th className="text-right">Unidades</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((item: any, index: number) => (
            <tr key={item.usuarioId}>
              <td className="font-bold text-accent-500">{index + 1}</td>
              <td className="font-medium">{item.usuarioNombre}</td>
              <td className="text-right">{item.totalPicks}</td>
              <td className="text-right font-bold text-accent-600">{item.totalUnidades.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReporteClientes() {
  const { data, isLoading } = useQuery({
    queryKey: ['reporte-clientes-top'],
    queryFn: () => reportesApi.clientesTop(10)
  })

  if (isLoading) return <div className="card p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>

  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th className="text-right">Pedidos Completados</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((item: any, index: number) => (
            <tr key={item.cliente.id}>
              <td className="font-bold text-accent-500">{index + 1}</td>
              <td>
                <Link to={`/clientes/${item.cliente.id}`} className="font-medium text-accent-600 hover:underline">
                  {item.cliente.nombreEmpresa || item.cliente.nombreContacto}
                </Link>
              </td>
              <td className="text-right font-bold">{item.totalPedidos}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportePagos({ periodo, fechaInicio, fechaFin }: {
  periodo: string; fechaInicio: string; fechaFin: string
}) {
  const { data: ingresos, isLoading: loadingIngresos } = useQuery({
    queryKey: ['reporte-ingresos', periodo],
    queryFn: () => reportesApi.ingresos(periodo === 'hoy' ? 'dia' : periodo)
  })

  const { data: pagos, isLoading: loadingPagos } = useQuery({
    queryKey: ['reporte-pagos', periodo, fechaInicio, fechaFin],
    queryFn: () => reportesApi.pagos({
      fechaInicio: periodo === 'custom' ? fechaInicio : undefined,
      fechaFin: periodo === 'custom' ? fechaFin : undefined
    })
  })

  if (loadingIngresos || loadingPagos) return <div className="card p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>

  return (
    <div className="space-y-6">
      {/* Resumen de ingresos */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="card p-6 text-center bg-green-50 border-green-200">
          <p className="text-3xl font-bold text-green-600">{formatCurrency(ingresos?.totalIngresos)}</p>
          <p className="text-green-700">Total Ingresos</p>
        </div>
        {ingresos?.ingresosPorMetodo?.map((m: any) => (
          <div key={m.metodoPago} className="card p-6">
            <div className="flex items-center gap-2 mb-2">
              {getMetodoPagoIcon(m.metodoPago)}
              <span className="font-medium">{m.metodoPago}</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(m.total)}</p>
            <p className="text-sm text-gray-500">{m.porcentaje}% del total</p>
          </div>
        ))}
      </div>

      {/* Últimos pagos */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Últimos Pagos</h3>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Pedido</th>
              <th>Método</th>
              <th className="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {pagos?.detalle?.slice(0, 30).map((pago: any) => (
              <tr key={pago.id}>
                <td className="text-sm text-gray-500">
                  {new Date(pago.fecha).toLocaleDateString('es-MX')}
                </td>
                <td>{pago.cliente}</td>
                <td>{pago.pedido}</td>
                <td>
                  <div className="flex items-center gap-1">
                    {getMetodoPagoIcon(pago.metodoPago)}
                    <span className="text-sm">{pago.metodoPago}</span>
                  </div>
                </td>
                <td className="text-right font-bold">{formatCurrency(pago.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReporteCreditosTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['reporte-creditos'],
    queryFn: () => reportesApi.creditos()
  })

  if (isLoading) return <div className="card p-8 text-center"><Loader2 className="animate-spin mx-auto" /></div>

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="card p-6 text-center bg-blue-50 border-blue-200">
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(data?.totales?.totalOtorgado)}</p>
          <p className="text-blue-700">Total Otorgado</p>
        </div>
        <div className="card p-6 text-center bg-yellow-50 border-yellow-200">
          <p className="text-2xl font-bold text-yellow-600">{formatCurrency(data?.totales?.totalPendiente)}</p>
          <p className="text-yellow-700">Pendiente de Cobro</p>
        </div>
        <div className="card p-6 text-center bg-green-50 border-green-200">
          <p className="text-2xl font-bold text-green-600">{formatCurrency(data?.totales?.totalRecuperado)}</p>
          <p className="text-green-700">Recuperado</p>
        </div>
        <div className="card p-6 text-center">
          <p className="text-3xl font-bold text-primary-600">{data?.totales?.porcentajeRecuperado}%</p>
          <p className="text-gray-600">Tasa Recuperación</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Deudores */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-red-50">
            <h3 className="font-semibold text-red-800">Top Deudores</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="text-right">Deuda Total</th>
              </tr>
            </thead>
            <tbody>
              {data?.topDeudores?.map((item: any) => (
                <tr key={item.cliente?.id}>
                  <td>
                    <Link to={`/clientes/${item.cliente?.id}`} className="text-accent-600 hover:underline">
                      {item.cliente?.nombreEmpresa || item.cliente?.nombreContacto}
                    </Link>
                  </td>
                  <td className="text-right font-bold text-red-600">{formatCurrency(item.deudaTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Créditos Recientes */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Créditos Pendientes</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Pedido</th>
                  <th className="text-right">Pendiente</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.creditosRecientes?.map((credito: any) => (
                  <tr key={credito.id}>
                    <td className="text-sm">{credito.cliente}</td>
                    <td className="text-sm">{credito.pedido}</td>
                    <td className="text-right font-bold text-yellow-600">{formatCurrency(credito.montoPendiente)}</td>
                    <td>
                      <Link to={`/creditos/${credito.id}`} className="text-accent-600 hover:underline text-sm">
                        Cobrar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
