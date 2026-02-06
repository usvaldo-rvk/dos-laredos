import { FastifyInstance } from 'fastify'
import { prisma } from '../../app.js'

export async function eventosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /eventos - Listar eventos (para auditoría)
  app.get('/', async (request) => {
    const {
      tarimaId,
      almacenId,
      tipo,
      usuarioId,
      fechaInicio,
      fechaFin,
      page = '1',
      limit = '100'
    } = request.query as any

    const where: any = {}
    if (tarimaId) where.tarimaId = tarimaId
    if (almacenId) where.almacenId = almacenId
    if (tipo) where.tipo = tipo
    if (usuarioId) where.usuarioId = usuarioId
    if (fechaInicio || fechaFin) {
      where.timestampLocal = {}
      if (fechaInicio) where.timestampLocal.gte = new Date(fechaInicio)
      if (fechaFin) where.timestampLocal.lte = new Date(fechaFin)
    }

    const [eventos, total] = await Promise.all([
      prisma.eventoTarima.findMany({
        where,
        include: {
          tarima: {
            include: { producto: true }
          },
          usuario: { select: { id: true, nombre: true, rol: true } },
          supervisor: { select: { id: true, nombre: true } },
          almacen: true,
          pedido: { select: { id: true, numeroPedido: true } },
          ubicacionOrigen: true,
          ubicacionDestino: true
        },
        orderBy: { timestampLocal: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.eventoTarima.count({ where })
    ])

    return {
      data: eventos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  })

  // POST /eventos/sync - Sincronizar eventos offline
  app.post('/sync', async (request, reply) => {
    const { eventos } = request.body as { eventos: any[] }
    const user = request.user as any

    if (!eventos || !Array.isArray(eventos)) {
      return reply.status(400).send({ error: 'Se requiere array de eventos' })
    }

    const syncBatchId = `SYNC-${Date.now()}-${user.id.slice(0, 8)}`
    const resultados: any[] = []

    // Procesar eventos en orden cronológico
    const eventosOrdenados = eventos.sort((a, b) =>
      new Date(a.timestampLocal).getTime() - new Date(b.timestampLocal).getTime()
    )

    for (const evento of eventosOrdenados) {
      try {
        const created = await prisma.eventoTarima.create({
          data: {
            tarimaId: evento.tarimaId,
            almacenId: evento.almacenId,
            tipo: evento.tipo,
            usuarioId: evento.usuarioId || user.id,
            rolUsuario: evento.rolUsuario || user.rol,
            supervisorId: evento.supervisorId,
            cantidad: evento.cantidad,
            pedidoId: evento.pedidoId,
            ubicacionOrigenId: evento.ubicacionOrigenId,
            ubicacionDestinoId: evento.ubicacionDestinoId,
            motivo: evento.motivo,
            timestampLocal: new Date(evento.timestampLocal),
            syncBatchId
          }
        })

        // Actualizar estado de tarima si es necesario
        if (evento.tipo === 'PICK' || evento.tipo === 'MERMA') {
          await actualizarEstadoTarima(evento.tarimaId)
        }

        resultados.push({
          localId: evento.localId,
          serverId: created.id,
          status: 'ok'
        })
      } catch (error: any) {
        resultados.push({
          localId: evento.localId,
          status: 'error',
          message: error.message
        })
      }
    }

    return {
      syncBatchId,
      procesados: resultados.filter(r => r.status === 'ok').length,
      errores: resultados.filter(r => r.status === 'error').length,
      resultados
    }
  })

  // GET /eventos/tarima/:tarimaId - Historial de una tarima
  app.get('/tarima/:tarimaId', async (request) => {
    const { tarimaId } = request.params as { tarimaId: string }

    const eventos = await prisma.eventoTarima.findMany({
      where: { tarimaId },
      include: {
        usuario: { select: { id: true, nombre: true } },
        supervisor: { select: { id: true, nombre: true } },
        pedido: { select: { id: true, numeroPedido: true } },
        ubicacionOrigen: true,
        ubicacionDestino: true
      },
      orderBy: { timestampLocal: 'asc' }
    })

    return eventos
  })
}

// Función auxiliar para actualizar estado de tarima
async function actualizarEstadoTarima(tarimaId: string) {
  const eventos = await prisma.eventoTarima.findMany({
    where: { tarimaId },
    select: { tipo: true, cantidad: true }
  })

  let inventario = 0
  for (const e of eventos) {
    if (e.tipo === 'RECEPCION') inventario += e.cantidad || 0
    if (e.tipo === 'PICK' || e.tipo === 'MERMA') inventario -= e.cantidad || 0
    if (e.tipo === 'AJUSTE') inventario += e.cantidad || 0
  }

  if (inventario <= 0) {
    await prisma.tarima.update({
      where: { id: tarimaId },
      data: { estado: 'AGOTADA' }
    })
  }
}
