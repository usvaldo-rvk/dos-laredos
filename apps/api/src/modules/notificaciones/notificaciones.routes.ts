import { FastifyInstance } from 'fastify'
import { prisma } from '../../app.js'

export async function notificacionesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /notificaciones - Notificaciones del usuario
  app.get('/', async (request) => {
    const user = request.user as any
    const { leida, limit = '50' } = request.query as any

    const where: any = { usuarioId: user.id }
    if (leida !== undefined) where.leida = leida === 'true'

    const notificaciones = await prisma.notificacion.findMany({
      where,
      include: {
        tipoNotificacion: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    })

    return notificaciones
  })

  // GET /notificaciones/no-leidas/count
  app.get('/no-leidas/count', async (request) => {
    const user = request.user as any

    const count = await prisma.notificacion.count({
      where: {
        usuarioId: user.id,
        leida: false
      }
    })

    return { count }
  })

  // PATCH /notificaciones/:id/leer
  app.patch('/:id/leer', async (request) => {
    const { id } = request.params as { id: string }

    const notificacion = await prisma.notificacion.update({
      where: { id },
      data: { leida: true }
    })

    return notificacion
  })

  // PATCH /notificaciones/leer-todas
  app.patch('/leer-todas', async (request) => {
    const user = request.user as any

    await prisma.notificacion.updateMany({
      where: { usuarioId: user.id, leida: false },
      data: { leida: true }
    })

    return { success: true }
  })

  // GET /notificaciones/preferencias
  app.get('/preferencias', async (request) => {
    const user = request.user as any

    const tipos = await prisma.tipoNotificacion.findMany()
    const preferencias = await prisma.preferenciaNotificacion.findMany({
      where: { usuarioId: user.id }
    })

    const prefMap = Object.fromEntries(preferencias.map(p => [p.tipoNotificacionId, p]))

    return tipos.map(t => ({
      tipoNotificacion: t,
      emailHabilitado: prefMap[t.id]?.emailHabilitado ?? true,
      pushHabilitado: prefMap[t.id]?.pushHabilitado ?? false
    }))
  })

  // PATCH /notificaciones/preferencias
  app.patch('/preferencias', async (request) => {
    const user = request.user as any
    const { preferencias } = request.body as {
      preferencias: Array<{
        tipoNotificacionId: string
        emailHabilitado: boolean
        pushHabilitado: boolean
      }>
    }

    for (const pref of preferencias) {
      await prisma.preferenciaNotificacion.upsert({
        where: {
          usuarioId_tipoNotificacionId: {
            usuarioId: user.id,
            tipoNotificacionId: pref.tipoNotificacionId
          }
        },
        update: {
          emailHabilitado: pref.emailHabilitado,
          pushHabilitado: pref.pushHabilitado
        },
        create: {
          usuarioId: user.id,
          tipoNotificacionId: pref.tipoNotificacionId,
          emailHabilitado: pref.emailHabilitado,
          pushHabilitado: pref.pushHabilitado
        }
      })
    }

    return { success: true }
  })

  // GET /notificaciones/tipos - Lista de tipos (para admin)
  app.get('/tipos', async (request) => {
    const user = request.user as any

    if (user.rol !== 'ADMIN') {
      return []
    }

    return prisma.tipoNotificacion.findMany()
  })

  // POST /notificaciones/enviar - Enviar notificación (para sistema)
  app.post('/enviar', async (request, reply) => {
    const user = request.user as any

    if (user.rol !== 'ADMIN') {
      return reply.status(403).send({ error: 'Solo administradores' })
    }

    const { usuarioId, tipoNotificacionCodigo, titulo, mensaje } = request.body as any

    // Buscar tipo de notificación
    const tipo = await prisma.tipoNotificacion.findUnique({
      where: { codigo: tipoNotificacionCodigo }
    })

    if (!tipo) {
      return reply.status(400).send({ error: 'Tipo de notificación no encontrado' })
    }

    // Verificar preferencias del usuario
    const preferencia = await prisma.preferenciaNotificacion.findUnique({
      where: {
        usuarioId_tipoNotificacionId: {
          usuarioId,
          tipoNotificacionId: tipo.id
        }
      }
    })

    // Crear notificación en BD
    const notificacion = await prisma.notificacion.create({
      data: {
        usuarioId,
        tipoNotificacionId: tipo.id,
        titulo,
        mensaje
      }
    })

    // TODO: Enviar email si está habilitado
    if (preferencia?.emailHabilitado !== false) {
      console.log(`[EMAIL] Enviando a usuario ${usuarioId}: ${titulo}`)
      // Aquí iría la lógica de envío de email con nodemailer
    }

    // TODO: Enviar push si está habilitado
    if (preferencia?.pushHabilitado) {
      console.log(`[PUSH] Enviando a usuario ${usuarioId}: ${titulo}`)
      // Aquí iría la lógica de web push
    }

    return notificacion
  })
}
