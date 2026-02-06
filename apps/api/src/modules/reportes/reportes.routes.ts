import { FastifyInstance } from 'fastify'
import { prisma } from '../../app.js'
import * as XLSX from 'xlsx'
import PDFDocument from 'pdfkit'
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Cache del logo convertido a PNG (alta resolución para nitidez)
let logoPngBuffer: Buffer | null = null
let logoCacheVersion = 0 // Incrementar para forzar recarga

async function getLogoPng(): Promise<Buffer | null> {
  if (logoPngBuffer) return logoPngBuffer

  try {
    const svgPath = path.join(__dirname, '../../../assets/DOS_LAREDOS_Horizontal.svg')
    // Renderizar a alta resolución (3x) para que se vea nítido al escalar en el PDF
    logoPngBuffer = await sharp(svgPath, { density: 300 })
      .resize(600, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer()
    return logoPngBuffer
  } catch (error) {
    console.error('Error loading logo:', error)
    return null
  }
}

// Helper para calcular fechas según período
function calcularFechasPeriodo(periodo: string, fechaInicioCustom?: string, fechaFinCustom?: string) {
  const ahora = new Date()
  let fechaInicio = new Date()
  let fechaFin = new Date(ahora)

  switch (periodo) {
    case 'hoy':
      fechaInicio.setHours(0, 0, 0, 0)
      break
    case 'ayer':
      fechaInicio.setDate(fechaInicio.getDate() - 1)
      fechaInicio.setHours(0, 0, 0, 0)
      fechaFin = new Date(fechaInicio)
      fechaFin.setHours(23, 59, 59, 999)
      break
    case 'semana':
      const diaSemana = fechaInicio.getDay()
      fechaInicio.setDate(fechaInicio.getDate() - diaSemana)
      fechaInicio.setHours(0, 0, 0, 0)
      break
    case 'mes':
      fechaInicio.setDate(1)
      fechaInicio.setHours(0, 0, 0, 0)
      break
    case 'año':
      fechaInicio.setMonth(0, 1)
      fechaInicio.setHours(0, 0, 0, 0)
      break
    case 'custom':
      if (fechaInicioCustom) fechaInicio = new Date(fechaInicioCustom)
      if (fechaFinCustom) fechaFin = new Date(fechaFinCustom)
      break
    default: // últimos 30 días
      fechaInicio.setDate(fechaInicio.getDate() - 30)
  }

  return { fechaInicio, fechaFin }
}

export async function reportesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /reportes/inventario
  app.get('/inventario', async (request) => {
    const { almacenId } = request.query as any

    const where: any = { estado: { in: ['ACTIVA', 'RESERVADA'] } }
    if (almacenId) where.almacenId = almacenId

    const tarimas = await prisma.tarima.findMany({
      where,
      include: {
        producto: true,
        almacen: true,
        ubicacion: true
      }
    })

    // Calcular inventario por producto
    const inventarioPorProducto: Record<string, any> = {}

    for (const tarima of tarimas) {
      const eventos = await prisma.eventoTarima.findMany({
        where: { tarimaId: tarima.id },
        select: { tipo: true, cantidad: true }
      })

      let inv = 0
      for (const e of eventos) {
        if (e.tipo === 'RECEPCION') inv += e.cantidad || 0
        if (e.tipo === 'PICK' || e.tipo === 'MERMA') inv -= e.cantidad || 0
        if (e.tipo === 'AJUSTE') inv += e.cantidad || 0
      }
      inv = Math.max(0, inv)

      const key = `${tarima.productoId}-${tarima.almacenId}`
      if (!inventarioPorProducto[key]) {
        inventarioPorProducto[key] = {
          producto: tarima.producto,
          almacen: tarima.almacen,
          totalTarimas: 0,
          totalInventario: 0,
          tarimasActivas: 0,
          tarimasReservadas: 0
        }
      }

      inventarioPorProducto[key].totalTarimas++
      inventarioPorProducto[key].totalInventario += inv
      if (tarima.estado === 'ACTIVA') inventarioPorProducto[key].tarimasActivas++
      if (tarima.estado === 'RESERVADA') inventarioPorProducto[key].tarimasReservadas++
    }

    return Object.values(inventarioPorProducto)
  })

  // GET /reportes/movimientos
  app.get('/movimientos', async (request) => {
    const { almacenId, fechaInicio, fechaFin, tipo } = request.query as any

    const where: any = {}
    if (almacenId) where.almacenId = almacenId
    if (tipo) where.tipo = tipo
    if (fechaInicio || fechaFin) {
      where.timestampLocal = {}
      if (fechaInicio) where.timestampLocal.gte = new Date(fechaInicio)
      if (fechaFin) where.timestampLocal.lte = new Date(fechaFin)
    }

    const eventos = await prisma.eventoTarima.groupBy({
      by: ['tipo', 'almacenId'],
      where,
      _count: true,
      _sum: { cantidad: true }
    })

    // Obtener nombres de almacenes
    const almacenes = await prisma.almacen.findMany()
    const almacenesMap = Object.fromEntries(almacenes.map(a => [a.id, a.nombre]))

    return eventos.map(e => ({
      tipo: e.tipo,
      almacenId: e.almacenId,
      almacenNombre: almacenesMap[e.almacenId],
      cantidad: e._count,
      totalUnidades: e._sum.cantidad || 0
    }))
  })

  // GET /reportes/mermas
  app.get('/mermas', async (request) => {
    const { almacenId, fechaInicio, fechaFin } = request.query as any

    const where: any = { tipo: 'MERMA' }
    if (almacenId) where.almacenId = almacenId
    if (fechaInicio || fechaFin) {
      where.timestampLocal = {}
      if (fechaInicio) where.timestampLocal.gte = new Date(fechaInicio)
      if (fechaFin) where.timestampLocal.lte = new Date(fechaFin)
    }

    const mermas = await prisma.eventoTarima.findMany({
      where,
      include: {
        tarima: { include: { producto: true } },
        usuario: { select: { id: true, nombre: true } },
        supervisor: { select: { id: true, nombre: true } },
        almacen: true
      },
      orderBy: { timestampLocal: 'desc' }
    })

    // Agrupar por motivo
    const porMotivo: Record<string, { cantidad: number; total: number }> = {}
    for (const m of mermas) {
      const motivo = m.motivo || 'Sin especificar'
      if (!porMotivo[motivo]) porMotivo[motivo] = { cantidad: 0, total: 0 }
      porMotivo[motivo].cantidad++
      porMotivo[motivo].total += m.cantidad || 0
    }

    return {
      detalle: mermas,
      resumenPorMotivo: porMotivo,
      totalEventos: mermas.length,
      totalUnidades: mermas.reduce((s, m) => s + (m.cantidad || 0), 0)
    }
  })

  // GET /reportes/productividad
  app.get('/productividad', async (request) => {
    const { almacenId, fechaInicio, fechaFin } = request.query as any

    const where: any = { tipo: 'PICK' }
    if (almacenId) where.almacenId = almacenId
    if (fechaInicio || fechaFin) {
      where.timestampLocal = {}
      if (fechaInicio) where.timestampLocal.gte = new Date(fechaInicio)
      if (fechaFin) where.timestampLocal.lte = new Date(fechaFin)
    }

    const picks = await prisma.eventoTarima.groupBy({
      by: ['usuarioId'],
      where,
      _count: true,
      _sum: { cantidad: true }
    })

    // Obtener nombres de usuarios
    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: picks.map(p => p.usuarioId) } }
    })
    const usuariosMap = Object.fromEntries(usuarios.map(u => [u.id, u.nombre]))

    return picks.map(p => ({
      usuarioId: p.usuarioId,
      usuarioNombre: usuariosMap[p.usuarioId],
      totalPicks: p._count,
      totalUnidades: p._sum.cantidad || 0
    })).sort((a, b) => b.totalUnidades - a.totalUnidades)
  })

  // GET /reportes/kpis
  app.get('/kpis', async (request) => {
    const { almacenId } = request.query as any

    const whereAlmacen = almacenId ? { almacenId } : {}

    // Tarimas por estado
    const tarimasPorEstado = await prisma.tarima.groupBy({
      by: ['estado'],
      where: whereAlmacen,
      _count: true
    })

    // Pedidos por estado
    const pedidosPorEstado = await prisma.pedido.groupBy({
      by: ['estado'],
      where: whereAlmacen,
      _count: true
    })

    // Eventos de hoy
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const eventosHoy = await prisma.eventoTarima.groupBy({
      by: ['tipo'],
      where: {
        ...whereAlmacen,
        timestampLocal: { gte: hoy }
      },
      _count: true,
      _sum: { cantidad: true }
    })

    // Pedidos completados vs creados (últimos 7 días)
    const hace7Dias = new Date()
    hace7Dias.setDate(hace7Dias.getDate() - 7)

    const pedidos7Dias = await prisma.pedido.findMany({
      where: {
        ...whereAlmacen,
        createdAt: { gte: hace7Dias }
      },
      select: { estado: true }
    })

    const pedidosCreados = pedidos7Dias.length
    const pedidosCompletados = pedidos7Dias.filter(p => p.estado === 'COMPLETADO').length

    return {
      tarimasPorEstado: Object.fromEntries(tarimasPorEstado.map(t => [t.estado, t._count])),
      pedidosPorEstado: Object.fromEntries(pedidosPorEstado.map(p => [p.estado, p._count])),
      eventosHoy: eventosHoy.map(e => ({
        tipo: e.tipo,
        cantidad: e._count,
        unidades: e._sum.cantidad || 0
      })),
      tasaCompletado7Dias: pedidosCreados > 0
        ? ((pedidosCompletados / pedidosCreados) * 100).toFixed(1)
        : 0
    }
  })

  // GET /reportes/clientes-top
  app.get('/clientes-top', async (request) => {
    const { limit = '10' } = request.query as any

    const pedidosPorCliente = await prisma.pedido.groupBy({
      by: ['clienteId'],
      where: { estado: 'COMPLETADO' },
      _count: true
    })

    const clienteIds = pedidosPorCliente.map(p => p.clienteId)
    const clientes = await prisma.cliente.findMany({
      where: { id: { in: clienteIds } }
    })
    const clientesMap = Object.fromEntries(clientes.map(c => [c.id, c]))

    return pedidosPorCliente
      .map(p => ({
        cliente: clientesMap[p.clienteId],
        totalPedidos: p._count
      }))
      .sort((a, b) => b.totalPedidos - a.totalPedidos)
      .slice(0, parseInt(limit))
  })

  // GET /reportes/pagos - Reporte de pagos por período
  app.get('/pagos', async (request) => {
    const { fechaInicio, fechaFin, metodoPago } = request.query as any

    const where: any = {}
    if (metodoPago) where.metodoPago = metodoPago
    if (fechaInicio || fechaFin) {
      where.createdAt = {}
      if (fechaInicio) where.createdAt.gte = new Date(fechaInicio)
      if (fechaFin) where.createdAt.lte = new Date(fechaFin)
    }

    // Obtener pagos agrupados por método
    const pagosPorMetodo = await prisma.pago.groupBy({
      by: ['metodoPago'],
      where,
      _count: true,
      _sum: { monto: true }
    })

    // Obtener detalle de pagos
    const pagos = await prisma.pago.findMany({
      where,
      include: {
        pedido: {
          include: {
            cliente: { select: { id: true, nombreEmpresa: true, nombreContacto: true } }
          }
        },
        registradoPorRef: { select: { id: true, nombre: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })

    // Calcular totales
    const totalPagos = pagosPorMetodo.reduce((sum, p) => sum + (Number(p._sum.monto) || 0), 0)

    return {
      resumenPorMetodo: pagosPorMetodo.map(p => ({
        metodoPago: p.metodoPago,
        cantidad: p._count,
        total: Number(p._sum.monto) || 0
      })),
      totalPagos,
      totalTransacciones: pagos.length,
      detalle: pagos.map(p => ({
        id: p.id,
        metodoPago: p.metodoPago,
        monto: Number(p.monto),
        referencia: p.referencia,
        fecha: p.createdAt,
        pedido: p.pedido?.numeroPedido,
        cliente: p.pedido?.cliente?.nombreEmpresa || p.pedido?.cliente?.nombreContacto,
        registradoPor: p.registradoPorRef?.nombre
      }))
    }
  })

  // GET /reportes/creditos - Reporte de créditos
  app.get('/creditos', async (request) => {
    const { estado } = request.query as any

    const where: any = {}
    if (estado) where.estado = estado

    // Créditos agrupados por estado
    const creditosPorEstado = await prisma.credito.groupBy({
      by: ['estado'],
      where,
      _count: true,
      _sum: { montoOriginal: true, montoPendiente: true }
    })

    // Clientes con más crédito pendiente
    const creditosPorCliente = await prisma.credito.groupBy({
      by: ['clienteId'],
      where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      _sum: { montoPendiente: true }
    })

    const clienteIds = creditosPorCliente.map(c => c.clienteId)
    const clientes = await prisma.cliente.findMany({
      where: { id: { in: clienteIds } },
      select: { id: true, nombreEmpresa: true, nombreContacto: true, telefono: true }
    })
    const clientesMap = Object.fromEntries(clientes.map(c => [c.id, c]))

    const topDeudores = creditosPorCliente
      .map(c => ({
        cliente: clientesMap[c.clienteId],
        deudaTotal: Number(c._sum.montoPendiente) || 0
      }))
      .sort((a, b) => b.deudaTotal - a.deudaTotal)
      .slice(0, 10)

    // Créditos recientes
    const creditosRecientes = await prisma.credito.findMany({
      where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
      include: {
        cliente: { select: { id: true, nombreEmpresa: true, nombreContacto: true } },
        pedido: { select: { id: true, numeroPedido: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    // Totales generales
    const totalOtorgado = creditosPorEstado.reduce((sum, c) => sum + (Number(c._sum.montoOriginal) || 0), 0)
    const totalPendiente = creditosPorEstado
      .filter(c => c.estado !== 'PAGADO')
      .reduce((sum, c) => sum + (Number(c._sum.montoPendiente) || 0), 0)
    const totalRecuperado = totalOtorgado - totalPendiente

    return {
      resumenPorEstado: creditosPorEstado.map(c => ({
        estado: c.estado,
        cantidad: c._count,
        montoOriginal: Number(c._sum.montoOriginal) || 0,
        montoPendiente: Number(c._sum.montoPendiente) || 0
      })),
      totales: {
        totalOtorgado,
        totalPendiente,
        totalRecuperado,
        porcentajeRecuperado: totalOtorgado > 0 ? ((totalRecuperado / totalOtorgado) * 100).toFixed(1) : 0
      },
      topDeudores,
      creditosRecientes: creditosRecientes.map(c => ({
        id: c.id,
        cliente: c.cliente?.nombreEmpresa || c.cliente?.nombreContacto,
        clienteId: c.clienteId,
        pedido: c.pedido?.numeroPedido,
        montoOriginal: Number(c.montoOriginal),
        montoPendiente: Number(c.montoPendiente),
        estado: c.estado,
        fecha: c.createdAt
      }))
    }
  })

  // GET /reportes/ingresos - Ingresos por período
  app.get('/ingresos', async (request) => {
    const { periodo = 'mes' } = request.query as any

    // Calcular fecha de inicio según período
    const fechaInicio = new Date()
    switch (periodo) {
      case 'dia':
        fechaInicio.setHours(0, 0, 0, 0)
        break
      case 'semana':
        fechaInicio.setDate(fechaInicio.getDate() - 7)
        break
      case 'quincena':
        fechaInicio.setDate(fechaInicio.getDate() - 15)
        break
      case 'mes':
        fechaInicio.setMonth(fechaInicio.getMonth() - 1)
        break
      case 'año':
        fechaInicio.setFullYear(fechaInicio.getFullYear() - 1)
        break
    }

    // Pagos en el período
    const pagos = await prisma.pago.groupBy({
      by: ['metodoPago'],
      where: { createdAt: { gte: fechaInicio } },
      _sum: { monto: true },
      _count: true
    })

    // Abonos a créditos en el período
    const abonos = await prisma.abono.groupBy({
      by: ['metodoPago'],
      where: { createdAt: { gte: fechaInicio } },
      _sum: { monto: true },
      _count: true
    })

    // Combinar pagos y abonos
    const ingresosPorMetodo: Record<string, { pagos: number; abonos: number; total: number }> = {}

    for (const p of pagos) {
      if (!ingresosPorMetodo[p.metodoPago]) {
        ingresosPorMetodo[p.metodoPago] = { pagos: 0, abonos: 0, total: 0 }
      }
      ingresosPorMetodo[p.metodoPago].pagos = Number(p._sum.monto) || 0
      ingresosPorMetodo[p.metodoPago].total += Number(p._sum.monto) || 0
    }

    for (const a of abonos) {
      if (!ingresosPorMetodo[a.metodoPago]) {
        ingresosPorMetodo[a.metodoPago] = { pagos: 0, abonos: 0, total: 0 }
      }
      ingresosPorMetodo[a.metodoPago].abonos = Number(a._sum.monto) || 0
      ingresosPorMetodo[a.metodoPago].total += Number(a._sum.monto) || 0
    }

    const totalIngresos = Object.values(ingresosPorMetodo).reduce((sum, v) => sum + v.total, 0)

    return {
      periodo,
      fechaInicio,
      fechaFin: new Date(),
      ingresosPorMetodo: Object.entries(ingresosPorMetodo).map(([metodo, valores]) => ({
        metodoPago: metodo,
        ...valores,
        porcentaje: totalIngresos > 0 ? ((valores.total / totalIngresos) * 100).toFixed(1) : 0
      })),
      totalIngresos,
      totalTransacciones: pagos.reduce((s, p) => s + p._count, 0) + abonos.reduce((s, a) => s + a._count, 0)
    }
  })

  // GET /reportes/depositos - Depósitos pendientes por recuperar
  app.get('/depositos', async (request) => {
    const { almacenId, proveedorId } = request.query as any

    // Obtener tarimas activas con depósito registrado
    const where: any = {
      estado: { in: ['ACTIVA', 'RESERVADA'] },
      depositoPorEnvase: { not: null }
    }
    if (almacenId) where.almacenId = almacenId
    if (proveedorId) where.proveedorId = proveedorId

    const tarimas = await prisma.tarima.findMany({
      where,
      include: {
        producto: true,
        proveedor: true,
        almacen: true
      }
    })

    // Calcular depósitos
    const depositosPorProveedor: Record<string, {
      proveedor: any
      totalUnidades: number
      totalEnvases: number
      totalDeposito: number
      tarimas: number
    }> = {}

    const depositosPorProducto: Record<string, {
      producto: any
      totalUnidades: number
      totalEnvases: number
      totalDeposito: number
    }> = {}

    let totalGeneralDeposito = 0
    let totalGeneralEnvases = 0
    let totalGeneralUnidades = 0

    for (const tarima of tarimas) {
      // Calcular inventario actual de la tarima
      const eventos = await prisma.eventoTarima.findMany({
        where: { tarimaId: tarima.id },
        select: { tipo: true, cantidad: true }
      })

      let inventario = 0
      for (const e of eventos) {
        if (e.tipo === 'RECEPCION') inventario += e.cantidad || 0
        if (e.tipo === 'PICK' || e.tipo === 'MERMA') inventario -= e.cantidad || 0
        if (e.tipo === 'AJUSTE') inventario += e.cantidad || 0
      }
      inventario = Math.max(0, inventario)

      if (inventario === 0) continue // Si no hay inventario, no hay depósito pendiente

      const unidadesPorCarton = tarima.producto.unidadesPorCarton || 1
      const depositoPorEnvase = Number(tarima.depositoPorEnvase) || 0
      const totalEnvases = inventario * unidadesPorCarton
      const depositoTotal = totalEnvases * depositoPorEnvase

      // Por proveedor
      if (!depositosPorProveedor[tarima.proveedorId]) {
        depositosPorProveedor[tarima.proveedorId] = {
          proveedor: tarima.proveedor,
          totalUnidades: 0,
          totalEnvases: 0,
          totalDeposito: 0,
          tarimas: 0
        }
      }
      depositosPorProveedor[tarima.proveedorId].totalUnidades += inventario
      depositosPorProveedor[tarima.proveedorId].totalEnvases += totalEnvases
      depositosPorProveedor[tarima.proveedorId].totalDeposito += depositoTotal
      depositosPorProveedor[tarima.proveedorId].tarimas++

      // Por producto
      if (!depositosPorProducto[tarima.productoId]) {
        depositosPorProducto[tarima.productoId] = {
          producto: tarima.producto,
          totalUnidades: 0,
          totalEnvases: 0,
          totalDeposito: 0
        }
      }
      depositosPorProducto[tarima.productoId].totalUnidades += inventario
      depositosPorProducto[tarima.productoId].totalEnvases += totalEnvases
      depositosPorProducto[tarima.productoId].totalDeposito += depositoTotal

      // Totales generales
      totalGeneralDeposito += depositoTotal
      totalGeneralEnvases += totalEnvases
      totalGeneralUnidades += inventario
    }

    return {
      totales: {
        depositoPendiente: totalGeneralDeposito,
        totalEnvases: totalGeneralEnvases,
        totalUnidades: totalGeneralUnidades,
        totalTarimas: tarimas.length
      },
      porProveedor: Object.values(depositosPorProveedor)
        .sort((a, b) => b.totalDeposito - a.totalDeposito),
      porProducto: Object.values(depositosPorProducto)
        .sort((a, b) => b.totalDeposito - a.totalDeposito)
    }
  })

  // GET /reportes/ventas - Reporte completo de ventas/pedidos
  app.get('/ventas', async (request) => {
    const { periodo = 'mes', fechaInicio: fi, fechaFin: ff, almacenId, estado } = request.query as any

    const { fechaInicio, fechaFin } = calcularFechasPeriodo(periodo, fi, ff)

    const where: any = {
      createdAt: { gte: fechaInicio, lte: fechaFin }
    }
    if (almacenId) where.almacenId = almacenId
    if (estado) where.estado = estado

    // Pedidos en el período
    const pedidos = await prisma.pedido.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombreEmpresa: true, nombreContacto: true } },
        almacen: { select: { id: true, nombre: true } },
        lineas: {
          include: {
            producto: { select: { id: true, nombre: true, sku: true } }
          }
        },
        pagos: true,
        creditos: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calcular totales
    let totalVentas = 0
    let totalPagado = 0
    let totalCredito = 0
    let totalUnidades = 0
    const ventasPorEstado: Record<string, { cantidad: number; monto: number }> = {}
    const ventasPorMetodoPago: Record<string, number> = {}
    const ventasPorProducto: Record<string, { producto: any; cantidad: number; monto: number }> = {}
    const ventasPorDia: Record<string, { fecha: string; cantidad: number; monto: number }> = {}

    for (const pedido of pedidos) {
      const total = Number(pedido.total) || 0
      totalVentas += total

      // Por estado
      if (!ventasPorEstado[pedido.estado]) {
        ventasPorEstado[pedido.estado] = { cantidad: 0, monto: 0 }
      }
      ventasPorEstado[pedido.estado].cantidad++
      ventasPorEstado[pedido.estado].monto += total

      // Por día
      const dia = pedido.createdAt.toISOString().split('T')[0]
      if (!ventasPorDia[dia]) {
        ventasPorDia[dia] = { fecha: dia, cantidad: 0, monto: 0 }
      }
      ventasPorDia[dia].cantidad++
      ventasPorDia[dia].monto += total

      // Pagos
      for (const pago of pedido.pagos) {
        const monto = Number(pago.monto) || 0
        totalPagado += monto
        ventasPorMetodoPago[pago.metodoPago] = (ventasPorMetodoPago[pago.metodoPago] || 0) + monto
      }

      // Créditos
      for (const credito of pedido.creditos) {
        totalCredito += Number(credito.montoOriginal) || 0
      }

      // Por producto
      for (const linea of pedido.lineas) {
        const key = linea.productoId
        if (!ventasPorProducto[key]) {
          ventasPorProducto[key] = { producto: linea.producto, cantidad: 0, monto: 0 }
        }
        ventasPorProducto[key].cantidad += linea.cantidadSolicitada
        ventasPorProducto[key].monto += Number(linea.subtotal) || 0
        totalUnidades += linea.cantidadSolicitada
      }
    }

    return {
      periodo: { inicio: fechaInicio, fin: fechaFin, tipo: periodo },
      resumen: {
        totalPedidos: pedidos.length,
        totalVentas,
        totalPagado,
        totalCredito,
        totalUnidades,
        ticketPromedio: pedidos.length > 0 ? totalVentas / pedidos.length : 0
      },
      porEstado: Object.entries(ventasPorEstado).map(([estado, data]) => ({ estado, ...data })),
      porMetodoPago: Object.entries(ventasPorMetodoPago).map(([metodo, monto]) => ({ metodo, monto })),
      porProducto: Object.values(ventasPorProducto).sort((a, b) => b.monto - a.monto).slice(0, 20),
      porDia: Object.values(ventasPorDia).sort((a, b) => a.fecha.localeCompare(b.fecha)),
      detalle: pedidos.map(p => ({
        id: p.id,
        numeroPedido: p.numeroPedido,
        fecha: p.createdAt,
        cliente: p.cliente?.nombreEmpresa || p.cliente?.nombreContacto,
        clienteId: p.clienteId,
        almacen: p.almacen?.nombre,
        estado: p.estado,
        estadoPago: p.estadoPago,
        total: Number(p.total) || 0,
        lineas: p.lineas.length,
        unidades: p.lineas.reduce((s, l) => s + l.cantidadSolicitada, 0)
      }))
    }
  })

  // GET /reportes/exportar/:tipo - Exportar reporte a Excel
  app.get('/exportar/:tipo', async (request, reply) => {
    const { tipo } = request.params as { tipo: string }
    const { periodo = 'mes', fechaInicio: fi, fechaFin: ff, almacenId } = request.query as any

    const { fechaInicio, fechaFin } = calcularFechasPeriodo(periodo, fi, ff)

    let data: any[] = []
    let nombreArchivo = `reporte_${tipo}_${new Date().toISOString().split('T')[0]}`

    switch (tipo) {
      case 'ventas': {
        const pedidos = await prisma.pedido.findMany({
          where: {
            createdAt: { gte: fechaInicio, lte: fechaFin },
            ...(almacenId ? { almacenId } : {})
          },
          include: {
            cliente: { select: { nombreEmpresa: true, nombreContacto: true } },
            almacen: { select: { nombre: true } },
            lineas: true
          },
          orderBy: { createdAt: 'desc' }
        })

        data = pedidos.map(p => ({
          'Número Pedido': p.numeroPedido,
          'Fecha': p.createdAt.toLocaleDateString('es-MX'),
          'Cliente': p.cliente?.nombreEmpresa || p.cliente?.nombreContacto,
          'Almacén': p.almacen?.nombre,
          'Estado': p.estado,
          'Estado Pago': p.estadoPago,
          'Subtotal': Number(p.subtotal) || 0,
          'Descuento': Number(p.descuento) || 0,
          'Total': Number(p.total) || 0,
          'Líneas': p.lineas.length,
          'Unidades': p.lineas.reduce((s, l) => s + l.cantidadSolicitada, 0)
        }))
        break
      }

      case 'pagos': {
        const pagos = await prisma.pago.findMany({
          where: { createdAt: { gte: fechaInicio, lte: fechaFin } },
          include: {
            pedido: {
              include: { cliente: { select: { nombreEmpresa: true, nombreContacto: true } } }
            },
            registradoPorRef: { select: { nombre: true } }
          },
          orderBy: { createdAt: 'desc' }
        })

        data = pagos.map(p => ({
          'Fecha': p.createdAt.toLocaleDateString('es-MX'),
          'Hora': p.createdAt.toLocaleTimeString('es-MX'),
          'Pedido': p.pedido?.numeroPedido,
          'Cliente': p.pedido?.cliente?.nombreEmpresa || p.pedido?.cliente?.nombreContacto,
          'Método': p.metodoPago,
          'Monto': Number(p.monto),
          'Referencia': p.referencia || '',
          'Registrado Por': p.registradoPorRef?.nombre
        }))
        break
      }

      case 'creditos': {
        const creditos = await prisma.credito.findMany({
          where: { createdAt: { gte: fechaInicio, lte: fechaFin } },
          include: {
            cliente: { select: { nombreEmpresa: true, nombreContacto: true, telefono: true } },
            pedido: { select: { numeroPedido: true } }
          },
          orderBy: { createdAt: 'desc' }
        })

        data = creditos.map(c => ({
          'Fecha': c.createdAt.toLocaleDateString('es-MX'),
          'Cliente': c.cliente?.nombreEmpresa || c.cliente?.nombreContacto,
          'Teléfono': c.cliente?.telefono || '',
          'Pedido': c.pedido?.numeroPedido,
          'Monto Original': Number(c.montoOriginal),
          'Monto Pendiente': Number(c.montoPendiente),
          'Estado': c.estado
        }))
        break
      }

      case 'inventario': {
        const tarimas = await prisma.tarima.findMany({
          where: {
            estado: { in: ['ACTIVA', 'RESERVADA'] },
            ...(almacenId ? { almacenId } : {})
          },
          include: {
            producto: true,
            almacen: true,
            ubicacion: true,
            proveedor: true
          }
        })

        // Calcular inventario para cada tarima
        for (const tarima of tarimas) {
          const eventos = await prisma.eventoTarima.findMany({
            where: { tarimaId: tarima.id },
            select: { tipo: true, cantidad: true }
          })

          let inv = 0
          for (const e of eventos) {
            if (['RECEPCION', 'ENTRADA', 'AJUSTE_POSITIVO'].includes(e.tipo)) inv += e.cantidad || 0
            if (['SALIDA', 'PICK', 'MERMA', 'AJUSTE_NEGATIVO'].includes(e.tipo)) inv -= e.cantidad || 0
            if (e.tipo === 'AJUSTE') inv += e.cantidad || 0
          }

          data.push({
            'Código QR': tarima.qrCode,
            'Producto': tarima.producto.nombre,
            'SKU': tarima.producto.sku,
            'Proveedor': tarima.proveedor?.nombre || '',
            'Almacén': tarima.almacen.nombre,
            'Ubicación': tarima.ubicacion?.codigo || 'Sin ubicación',
            'Estado': tarima.estado,
            'Capacidad': tarima.capacidadTotal,
            'Inventario Actual': Math.max(0, inv),
            'Precio Unitario': Number(tarima.precioUnitario) || 0
          })
        }
        break
      }

      case 'mermas': {
        const mermas = await prisma.eventoTarima.findMany({
          where: {
            tipo: 'MERMA',
            timestampLocal: { gte: fechaInicio, lte: fechaFin },
            ...(almacenId ? { almacenId } : {})
          },
          include: {
            tarima: { include: { producto: true } },
            usuario: { select: { nombre: true } },
            almacen: true
          },
          orderBy: { timestampLocal: 'desc' }
        })

        data = mermas.map(m => ({
          'Fecha': m.timestampLocal?.toLocaleDateString('es-MX') || '',
          'Hora': m.timestampLocal?.toLocaleTimeString('es-MX') || '',
          'Producto': m.tarima?.producto?.nombre || '',
          'Tarima': m.tarima?.qrCode || '',
          'Almacén': m.almacen?.nombre || '',
          'Cantidad': m.cantidad,
          'Motivo': m.motivo || '',
          'Registrado Por': m.usuario?.nombre || ''
        }))
        break
      }

      case 'abonos': {
        const abonos = await prisma.abono.findMany({
          where: { createdAt: { gte: fechaInicio, lte: fechaFin } },
          include: {
            credito: {
              include: {
                cliente: { select: { nombreEmpresa: true, nombreContacto: true } },
                pedido: { select: { numeroPedido: true } }
              }
            },
            registradoPorRef: { select: { nombre: true } }
          },
          orderBy: { createdAt: 'desc' }
        })

        data = abonos.map(a => ({
          'Fecha': a.createdAt.toLocaleDateString('es-MX'),
          'Hora': a.createdAt.toLocaleTimeString('es-MX'),
          'Cliente': a.credito?.cliente?.nombreEmpresa || a.credito?.cliente?.nombreContacto,
          'Pedido Original': a.credito?.pedido?.numeroPedido,
          'Método': a.metodoPago,
          'Monto': Number(a.monto),
          'Referencia': a.referencia || '',
          'Registrado Por': a.registradoPorRef?.nombre
        }))
        break
      }

      default:
        return reply.status(400).send({ error: 'Tipo de reporte no válido' })
    }

    // Crear libro Excel
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)

    // Ajustar ancho de columnas
    const maxWidth = 30
    ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: maxWidth }))

    XLSX.utils.book_append_sheet(wb, ws, tipo.charAt(0).toUpperCase() + tipo.slice(1))

    // Generar buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${nombreArchivo}.xlsx"`)
      .send(buffer)
  })

  // GET /reportes/pdf/:tipo - Exportar reporte formal en PDF
  app.get('/pdf/:tipo', async (request, reply) => {
    const { tipo } = request.params as { tipo: string }
    const { periodo = 'mes', fechaInicio: fi, fechaFin: ff, almacenId } = request.query as any

    const { fechaInicio, fechaFin } = calcularFechasPeriodo(periodo, fi, ff)

    let almacenNombre = 'Todos los almacenes'
    if (almacenId) {
      const almacen = await prisma.almacen.findUnique({ where: { id: almacenId } })
      if (almacen) almacenNombre = almacen.nombre
    }

    const nombrePeriodo: Record<string, string> = {
      'hoy': 'Hoy',
      'ayer': 'Ayer',
      'semana': 'Esta Semana',
      'mes': 'Este Mes',
      'año': 'Este Año',
      'custom': `${fechaInicio.toLocaleDateString('es-MX')} - ${fechaFin.toLocaleDateString('es-MX')}`
    }
    const periodoLabel = nombrePeriodo[periodo] || periodo

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 60, left: 50, right: 50 },
      bufferPages: true
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    const pageWidth = 612
    const marginLeft = 50
    const marginRight = 50
    const contentWidth = pageWidth - marginLeft - marginRight

    // Cargar logo
    const logoPng = await getLogoPng()

    const formatCurrency = (val: number) =>
      new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0)

    // ===== HELPERS =====
    const encabezado = (titulo: string, subtitulo?: string) => {
      // Logo centrado
      if (logoPng) {
        const logoWidth = 180
        const logoHeight = 54
        const logoX = (pageWidth - logoWidth) / 2
        doc.image(logoPng, logoX, 35, { width: logoWidth, height: logoHeight })
      } else {
        // Fallback si no hay logo
        doc.font('Helvetica-Bold').fontSize(22).fillColor('#1e3a5f')
        doc.text('DOS LAREDOS', marginLeft, 50, { width: contentWidth, align: 'center' })
        doc.font('Helvetica').fontSize(10).fillColor('#666666')
        doc.text('Distribuidora', marginLeft, 75, { width: contentWidth, align: 'center' })
      }

      doc.moveTo(marginLeft, 95).lineTo(pageWidth - marginRight, 95).strokeColor('#1e3a5f').lineWidth(2).stroke()

      doc.font('Helvetica-Bold').fontSize(16).fillColor('#333333')
      doc.text(titulo, marginLeft, 110, { width: contentWidth, align: 'center' })

      if (subtitulo) {
        doc.font('Helvetica').fontSize(10).fillColor('#666666')
        doc.text(subtitulo, marginLeft, 130, { width: contentWidth, align: 'center' })
      }

      doc.font('Helvetica').fontSize(9).fillColor('#888888')
      doc.text(`Almacén: ${almacenNombre}   •   Período: ${periodoLabel}   •   Generado: ${new Date().toLocaleString('es-MX')}`,
        marginLeft, subtitulo ? 148 : 135, { width: contentWidth, align: 'center' })

      doc.moveTo(marginLeft, subtitulo ? 165 : 155).lineTo(pageWidth - marginRight, subtitulo ? 165 : 155)
        .strokeColor('#e0e0e0').lineWidth(1).stroke()

      doc.y = subtitulo ? 180 : 170
    }

    const seccion = (titulo: string, descripcion?: string) => {
      if (doc.y > 680) {
        doc.addPage()
        doc.y = 50
      }
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e3a5f')
      doc.text(titulo, marginLeft, doc.y)
      if (descripcion) {
        doc.font('Helvetica').fontSize(9).fillColor('#888888')
        doc.text(descripcion, marginLeft, doc.y + 2)
      }
      doc.y += 8
    }

    const tarjetaKPI = (x: number, y: number, ancho: number, valor: string, etiqueta: string, colorFondo: string, colorTexto: string) => {
      doc.roundedRect(x, y, ancho, 55, 4).fillColor(colorFondo).fill()
      doc.roundedRect(x, y, ancho, 55, 4).strokeColor(colorTexto).lineWidth(1).stroke()

      doc.font('Helvetica-Bold').fontSize(14).fillColor(colorTexto)
      doc.text(valor, x, y + 12, { width: ancho, align: 'center' })

      doc.font('Helvetica').fontSize(9).fillColor('#555555')
      doc.text(etiqueta, x, y + 35, { width: ancho, align: 'center' })
    }

    const tabla = (columnas: { titulo: string; ancho: number; alinear?: 'left' | 'center' | 'right' }[], filas: string[][]) => {
      const rowHeight = 22
      const headerHeight = 24
      let currentY = doc.y

      // Header
      doc.fillColor('#f0f4f8').rect(marginLeft, currentY, contentWidth, headerHeight).fill()
      doc.strokeColor('#d0d7de').rect(marginLeft, currentY, contentWidth, headerHeight).stroke()

      let colX = marginLeft
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e3a5f')
      columnas.forEach(col => {
        doc.text(col.titulo, colX + 6, currentY + 7, { width: col.ancho - 12, align: col.alinear || 'left' })
        colX += col.ancho
      })
      currentY += headerHeight

      // Rows
      doc.font('Helvetica').fontSize(9)
      filas.forEach((fila, idx) => {
        if (currentY > 700) {
          doc.addPage()
          currentY = 50
        }

        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8f9fa'
        doc.fillColor(bgColor).rect(marginLeft, currentY, contentWidth, rowHeight).fill()
        doc.strokeColor('#e8e8e8').rect(marginLeft, currentY, contentWidth, rowHeight).stroke()

        colX = marginLeft
        doc.fillColor('#444444')
        fila.forEach((celda, colIdx) => {
          const col = columnas[colIdx]
          doc.text(celda || '-', colX + 6, currentY + 6, { width: col.ancho - 12, align: col.alinear || 'left' })
          colX += col.ancho
        })
        currentY += rowHeight
      })

      doc.y = currentY + 15
    }

    const parrafo = (texto: string) => {
      doc.font('Helvetica').fontSize(10).fillColor('#444444')
      doc.text(texto, marginLeft, doc.y, { width: contentWidth, align: 'justify', lineGap: 3 })
      doc.y += 10
    }

    switch (tipo) {
      case 'ventas': {
        const pedidos = await prisma.pedido.findMany({
          where: {
            createdAt: { gte: fechaInicio, lte: fechaFin },
            ...(almacenId ? { almacenId } : {})
          },
          include: {
            cliente: { select: { nombreEmpresa: true, nombreContacto: true } },
            lineas: { include: { producto: true } },
            pagos: true,
            creditos: true
          },
          orderBy: { createdAt: 'desc' }
        })

        let totalVentas = 0, totalPagado = 0, totalCredito = 0, totalUnidades = 0
        const porEstado: Record<string, { cantidad: number; monto: number }> = {}
        const porMetodo: Record<string, number> = {}
        const porProducto: Record<string, { nombre: string; cantidad: number; monto: number }> = {}

        for (const p of pedidos) {
          const total = Number(p.total) || 0
          totalVentas += total
          if (!porEstado[p.estado]) porEstado[p.estado] = { cantidad: 0, monto: 0 }
          porEstado[p.estado].cantidad++
          porEstado[p.estado].monto += total
          for (const pago of p.pagos) {
            const monto = Number(pago.monto) || 0
            totalPagado += monto
            porMetodo[pago.metodoPago] = (porMetodo[pago.metodoPago] || 0) + monto
          }
          for (const cred of p.creditos) totalCredito += Number(cred.montoOriginal) || 0
          for (const l of p.lineas) {
            const key = l.productoId
            if (!porProducto[key]) porProducto[key] = { nombre: l.producto.nombre, cantidad: 0, monto: 0 }
            porProducto[key].cantidad += l.cantidadSolicitada
            porProducto[key].monto += Number(l.subtotal) || 0
            totalUnidades += l.cantidadSolicitada
          }
        }

        encabezado('REPORTE DE VENTAS', 'Análisis detallado de pedidos y facturación')
        parrafo('Este reporte presenta un análisis completo de las ventas realizadas durante el período seleccionado, incluyendo métricas clave de desempeño, distribución por método de pago, y detalle de los productos más vendidos.')

        seccion('Resumen Ejecutivo')
        const kpiY = doc.y + 5
        const kpiAncho = 125
        tarjetaKPI(marginLeft, kpiY, kpiAncho, pedidos.length.toString(), 'Total Pedidos', '#e8f5e9', '#2e7d32')
        tarjetaKPI(marginLeft + kpiAncho + 8, kpiY, kpiAncho, formatCurrency(totalVentas), 'Ventas Totales', '#e3f2fd', '#1565c0')
        tarjetaKPI(marginLeft + (kpiAncho + 8) * 2, kpiY, kpiAncho, formatCurrency(totalPagado), 'Total Pagado', '#f3e5f5', '#7b1fa2')
        tarjetaKPI(marginLeft + (kpiAncho + 8) * 3, kpiY, kpiAncho, formatCurrency(totalCredito), 'En Crédito', '#fff3e0', '#ef6c00')
        doc.y = kpiY + 75

        seccion('Distribución por Estado')
        tabla(
          [{ titulo: 'Estado', ancho: 200 }, { titulo: 'Cantidad', ancho: 156, alinear: 'right' }, { titulo: 'Monto', ancho: 156, alinear: 'right' }],
          Object.entries(porEstado).map(([estado, data]) => [estado, data.cantidad.toString(), formatCurrency(data.monto)])
        )

        if (Object.keys(porMetodo).length > 0) {
          seccion('Ingresos por Método de Pago')
          tabla(
            [{ titulo: 'Método', ancho: 200 }, { titulo: 'Monto', ancho: 156, alinear: 'right' }, { titulo: '% del Total', ancho: 156, alinear: 'right' }],
            Object.entries(porMetodo).map(([metodo, monto]) => [metodo, formatCurrency(monto), totalPagado > 0 ? `${((monto / totalPagado) * 100).toFixed(1)}%` : '0%'])
          )
        }

        const topProductos = Object.values(porProducto).sort((a, b) => b.monto - a.monto).slice(0, 10)
        if (topProductos.length > 0) {
          seccion('Top 10 Productos Vendidos')
          tabla(
            [{ titulo: 'Producto', ancho: 280 }, { titulo: 'Unidades', ancho: 116, alinear: 'right' }, { titulo: 'Monto', ancho: 116, alinear: 'right' }],
            topProductos.map(p => [p.nombre.substring(0, 40), p.cantidad.toLocaleString(), formatCurrency(p.monto)])
          )
        }

        if (pedidos.length > 0) {
          doc.addPage()
          doc.y = 50
          seccion('Detalle de Pedidos', `Mostrando ${Math.min(25, pedidos.length)} de ${pedidos.length} pedidos`)
          tabla(
            [{ titulo: 'Pedido', ancho: 85 }, { titulo: 'Fecha', ancho: 75 }, { titulo: 'Cliente', ancho: 180 }, { titulo: 'Estado', ancho: 85 }, { titulo: 'Total', ancho: 87, alinear: 'right' }],
            pedidos.slice(0, 25).map(p => [p.numeroPedido, p.createdAt.toLocaleDateString('es-MX'), (p.cliente?.nombreEmpresa || p.cliente?.nombreContacto || '').substring(0, 28), p.estado, formatCurrency(Number(p.total))])
          )
        }
        break
      }

      case 'inventario': {
        const tarimas = await prisma.tarima.findMany({
          where: {
            estado: { in: ['ACTIVA', 'RESERVADA'] },
            ...(almacenId ? { almacenId } : {})
          },
          include: { producto: true, almacen: true, ubicacion: true, proveedor: true }
        })

        const inventarioPorProducto: Record<string, { producto: any; almacen: string; tarimas: number; activas: number; inventario: number }> = {}

        for (const t of tarimas) {
          const eventos = await prisma.eventoTarima.findMany({ where: { tarimaId: t.id }, select: { tipo: true, cantidad: true } })
          let inv = 0
          for (const e of eventos) {
            if (['RECEPCION', 'ENTRADA', 'AJUSTE_POSITIVO'].includes(e.tipo)) inv += e.cantidad || 0
            if (['SALIDA', 'PICK', 'MERMA', 'AJUSTE_NEGATIVO'].includes(e.tipo)) inv -= e.cantidad || 0
            if (e.tipo === 'AJUSTE') inv += e.cantidad || 0
          }
          inv = Math.max(0, inv)
          const key = `${t.productoId}-${t.almacenId}`
          if (!inventarioPorProducto[key]) inventarioPorProducto[key] = { producto: t.producto, almacen: t.almacen.nombre, tarimas: 0, activas: 0, inventario: 0 }
          inventarioPorProducto[key].tarimas++
          if (t.estado === 'ACTIVA') inventarioPorProducto[key].activas++
          inventarioPorProducto[key].inventario += inv
        }

        const datos = Object.values(inventarioPorProducto)
        const totalTarimas = datos.reduce((s, d) => s + d.tarimas, 0)
        const totalInventario = datos.reduce((s, d) => s + d.inventario, 0)

        encabezado('REPORTE DE INVENTARIO', 'Estado actual del inventario por producto')
        parrafo('Este reporte muestra el inventario actual disponible en el almacén, agrupado por producto. Incluye el conteo de tarimas activas y reservadas, así como las unidades totales disponibles.')

        seccion('Resumen General')
        const kpiY = doc.y + 5
        tarjetaKPI(marginLeft, kpiY, 165, datos.length.toString(), 'Productos', '#e8f5e9', '#2e7d32')
        tarjetaKPI(marginLeft + 173, kpiY, 165, totalTarimas.toString(), 'Total Tarimas', '#e3f2fd', '#1565c0')
        tarjetaKPI(marginLeft + 346, kpiY, 166, totalInventario.toLocaleString(), 'Total Unidades', '#f3e5f5', '#7b1fa2')
        doc.y = kpiY + 75

        seccion('Inventario por Producto')
        tabla(
          [{ titulo: 'Producto', ancho: 180 }, { titulo: 'SKU', ancho: 80 }, { titulo: 'Almacén', ancho: 100 }, { titulo: 'Tarimas', ancho: 70, alinear: 'center' }, { titulo: 'Inventario', ancho: 82, alinear: 'right' }],
          datos.map(d => [d.producto.nombre.substring(0, 28), d.producto.sku || '-', d.almacen, `${d.activas}/${d.tarimas}`, d.inventario.toLocaleString()])
        )
        break
      }

      case 'creditos': {
        const creditos = await prisma.credito.findMany({
          where: { estado: { in: ['PENDIENTE', 'PARCIAL'] } },
          include: {
            cliente: { select: { nombreEmpresa: true, nombreContacto: true, telefono: true } },
            pedido: { select: { numeroPedido: true } }
          },
          orderBy: { montoPendiente: 'desc' }
        })

        const totalOtorgado = creditos.reduce((s, c) => s + Number(c.montoOriginal), 0)
        const totalPendiente = creditos.reduce((s, c) => s + Number(c.montoPendiente), 0)
        const totalRecuperado = totalOtorgado - totalPendiente

        encabezado('REPORTE DE CRÉDITOS', 'Cartera de créditos pendientes de cobro')
        parrafo('Este reporte presenta el estado actual de la cartera de créditos, incluyendo los montos pendientes de cobro por cliente y métricas de recuperación. Es fundamental para la gestión de cobranza.')

        seccion('Resumen de Cartera')
        const kpiY = doc.y + 5
        tarjetaKPI(marginLeft, kpiY, 125, creditos.length.toString(), 'Créditos Activos', '#e8f5e9', '#2e7d32')
        tarjetaKPI(marginLeft + 133, kpiY, 125, formatCurrency(totalOtorgado), 'Total Otorgado', '#e3f2fd', '#1565c0')
        tarjetaKPI(marginLeft + 266, kpiY, 125, formatCurrency(totalPendiente), 'Pendiente', '#ffebee', '#c62828')
        tarjetaKPI(marginLeft + 399, kpiY, 113, formatCurrency(totalRecuperado), 'Recuperado', '#f3e5f5', '#7b1fa2')
        doc.y = kpiY + 75

        seccion('Créditos Pendientes de Cobro', 'Ordenados por monto pendiente (mayor a menor)')
        tabla(
          [{ titulo: 'Cliente', ancho: 150 }, { titulo: 'Teléfono', ancho: 95 }, { titulo: 'Pedido', ancho: 85 }, { titulo: 'Original', ancho: 91, alinear: 'right' }, { titulo: 'Pendiente', ancho: 91, alinear: 'right' }],
          creditos.slice(0, 30).map(c => [(c.cliente?.nombreEmpresa || c.cliente?.nombreContacto || '').substring(0, 22), c.cliente?.telefono || '-', c.pedido?.numeroPedido || '-', formatCurrency(Number(c.montoOriginal)), formatCurrency(Number(c.montoPendiente))])
        )
        break
      }

      case 'pagos': {
        const pagos = await prisma.pago.findMany({
          where: { createdAt: { gte: fechaInicio, lte: fechaFin } },
          include: {
            pedido: { include: { cliente: { select: { nombreEmpresa: true, nombreContacto: true } } } },
            registradoPorRef: { select: { nombre: true } }
          },
          orderBy: { createdAt: 'desc' }
        })

        const totalPagos = pagos.reduce((s, p) => s + Number(p.monto), 0)
        const porMetodo: Record<string, { cantidad: number; monto: number }> = {}
        for (const p of pagos) {
          if (!porMetodo[p.metodoPago]) porMetodo[p.metodoPago] = { cantidad: 0, monto: 0 }
          porMetodo[p.metodoPago].cantidad++
          porMetodo[p.metodoPago].monto += Number(p.monto)
        }

        encabezado('REPORTE DE PAGOS', 'Detalle de pagos recibidos')
        parrafo('Este reporte detalla todos los pagos recibidos durante el período, clasificados por método de pago. Incluye información del cliente, pedido asociado y referencia de la transacción.')

        seccion('Resumen General')
        const kpiY = doc.y + 5
        tarjetaKPI(marginLeft, kpiY, 165, pagos.length.toString(), 'Total Transacciones', '#e8f5e9', '#2e7d32')
        tarjetaKPI(marginLeft + 173, kpiY, 165, formatCurrency(totalPagos), 'Monto Total', '#e3f2fd', '#1565c0')
        tarjetaKPI(marginLeft + 346, kpiY, 166, formatCurrency(pagos.length > 0 ? totalPagos / pagos.length : 0), 'Promedio', '#f3e5f5', '#7b1fa2')
        doc.y = kpiY + 75

        seccion('Resumen por Método de Pago')
        tabla(
          [{ titulo: 'Método', ancho: 160 }, { titulo: 'Transacciones', ancho: 110, alinear: 'right' }, { titulo: 'Monto Total', ancho: 126, alinear: 'right' }, { titulo: '% del Total', ancho: 116, alinear: 'right' }],
          Object.entries(porMetodo).map(([metodo, data]) => [metodo, data.cantidad.toString(), formatCurrency(data.monto), totalPagos > 0 ? `${((data.monto / totalPagos) * 100).toFixed(1)}%` : '0%'])
        )

        seccion('Detalle de Transacciones', `Últimas ${Math.min(25, pagos.length)} transacciones`)
        tabla(
          [{ titulo: 'Fecha', ancho: 75 }, { titulo: 'Cliente', ancho: 155 }, { titulo: 'Pedido', ancho: 85 }, { titulo: 'Método', ancho: 95 }, { titulo: 'Monto', ancho: 102, alinear: 'right' }],
          pagos.slice(0, 25).map(p => [p.createdAt.toLocaleDateString('es-MX'), (p.pedido?.cliente?.nombreEmpresa || p.pedido?.cliente?.nombreContacto || '').substring(0, 22), p.pedido?.numeroPedido || '-', p.metodoPago, formatCurrency(Number(p.monto))])
        )
        break
      }

      case 'mermas': {
        const mermas = await prisma.eventoTarima.findMany({
          where: {
            tipo: 'MERMA',
            timestampLocal: { gte: fechaInicio, lte: fechaFin },
            ...(almacenId ? { almacenId } : {})
          },
          include: {
            tarima: { include: { producto: true } },
            usuario: { select: { nombre: true } },
            almacen: true
          },
          orderBy: { timestampLocal: 'desc' }
        })

        const totalUnidades = mermas.reduce((s, m) => s + (m.cantidad || 0), 0)
        const porMotivo: Record<string, { cantidad: number; unidades: number }> = {}
        for (const m of mermas) {
          const motivo = m.motivo || 'Sin especificar'
          if (!porMotivo[motivo]) porMotivo[motivo] = { cantidad: 0, unidades: 0 }
          porMotivo[motivo].cantidad++
          porMotivo[motivo].unidades += m.cantidad || 0
        }

        encabezado('REPORTE DE MERMAS', 'Análisis de pérdidas de inventario')
        parrafo('Este reporte documenta todas las mermas registradas durante el período, clasificadas por motivo. Las mermas representan pérdidas de inventario que deben monitorearse para identificar áreas de mejora.')

        seccion('Resumen General')
        const kpiY = doc.y + 5
        tarjetaKPI(marginLeft, kpiY, 165, mermas.length.toString(), 'Total Eventos', '#ffebee', '#c62828')
        tarjetaKPI(marginLeft + 173, kpiY, 165, totalUnidades.toLocaleString(), 'Unidades Perdidas', '#fff3e0', '#ef6c00')
        tarjetaKPI(marginLeft + 346, kpiY, 166, Object.keys(porMotivo).length.toString(), 'Motivos Distintos', '#e3f2fd', '#1565c0')
        doc.y = kpiY + 75

        seccion('Resumen por Motivo')
        tabla(
          [{ titulo: 'Motivo', ancho: 220 }, { titulo: 'Eventos', ancho: 95, alinear: 'right' }, { titulo: 'Unidades', ancho: 100, alinear: 'right' }, { titulo: '% del Total', ancho: 97, alinear: 'right' }],
          Object.entries(porMotivo).map(([motivo, data]) => [motivo.substring(0, 35), data.cantidad.toString(), data.unidades.toLocaleString(), totalUnidades > 0 ? `${((data.unidades / totalUnidades) * 100).toFixed(1)}%` : '0%'])
        )

        if (mermas.length > 0) {
          seccion('Detalle de Mermas', `Últimos ${Math.min(20, mermas.length)} registros`)
          tabla(
            [{ titulo: 'Fecha', ancho: 75 }, { titulo: 'Producto', ancho: 150 }, { titulo: 'Cantidad', ancho: 70, alinear: 'right' }, { titulo: 'Motivo', ancho: 130 }, { titulo: 'Registrado por', ancho: 87 }],
            mermas.slice(0, 20).map(m => [m.timestampLocal?.toLocaleDateString('es-MX') || '-', (m.tarima?.producto?.nombre || '').substring(0, 22), (m.cantidad || 0).toString(), (m.motivo || '-').substring(0, 18), (m.usuario?.nombre || '-').substring(0, 12)])
          )
        }
        break
      }

      default:
        return reply.status(400).send({ error: 'Tipo de reporte no válido' })
    }

    // Marca de agua y pie de página en todas las páginas
    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i)

      // Marca de agua diagonal "CONFIDENCIAL"
      doc.save()
      doc.opacity(0.06)
      doc.font('Helvetica-Bold').fontSize(72).fillColor('#1e3a5f')
      // Rotar y posicionar en el centro de la página
      doc.rotate(-45, { origin: [306, 396] })
      doc.text('CONFIDENCIAL', 30, 380, { lineBreak: false })
      doc.restore()

      // Pie de página
      doc.font('Helvetica').fontSize(8).fillColor('#999999')
      doc.text(
        `DOS LAREDOS WMS  •  Página ${i + 1} de ${range.count}  •  ${new Date().toLocaleString('es-MX')}`,
        marginLeft, 752, { width: contentWidth, align: 'center' }
      )
    }

    doc.end()

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks)
        reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="reporte_${tipo}_${new Date().toISOString().split('T')[0]}.pdf"`)
          .send(buffer)
        resolve(undefined)
      })
      doc.on('error', reject)
    })
  })
}
