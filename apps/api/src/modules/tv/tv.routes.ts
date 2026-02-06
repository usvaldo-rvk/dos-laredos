import { FastifyInstance } from 'fastify'
import { prisma } from '../../app.js'
import { randomBytes } from 'crypto'

export async function tvRoutes(app: FastifyInstance) {
  // GET /tv/pedidos/:token - Vista pública para TV (sin auth)
  app.get('/pedidos/:token', async (request, reply) => {
    const { token } = request.params as { token: string }

    const pantalla = await prisma.pantallaTv.findUnique({
      where: { token },
      include: { almacen: true }
    })

    if (!pantalla || !pantalla.activa) {
      return reply.status(404).send({ error: 'Pantalla no encontrada o inactiva' })
    }

    // Obtener pedidos enviados a bodega
    const pedidos = await prisma.pedido.findMany({
      where: {
        almacenId: pantalla.almacenId,
        estado: { in: ['ENVIADO_BODEGA', 'EN_REVISION'] }
      },
      include: {
        cliente: true,
        lineas: {
          include: {
            producto: true,
            asignaciones: {
              where: { estado: 'ABIERTA' },
              include: {
                tarima: {
                  include: { ubicacion: true }
                }
              }
            }
          }
        }
      },
      orderBy: [
        { fechaRequerida: 'asc' },
        { createdAt: 'asc' }
      ]
    })

    // Formatear para vista TV
    const pedidosFormateados = pedidos.map(p => {
      const lineasPendientes = p.lineas.filter(l =>
        l.asignaciones.some(a => a.estado === 'ABIERTA')
      )

      return {
        id: p.id,
        numeroPedido: p.numeroPedido,
        cliente: p.cliente.nombreEmpresa || p.cliente.nombreContacto,
        estado: p.estado,
        fechaRequerida: p.fechaRequerida,
        prioridad: calcularPrioridad(p),
        lineasPendientes: lineasPendientes.length,
        totalLineas: p.lineas.length,
        picks: lineasPendientes.flatMap(l =>
          l.asignaciones.map(a => ({
            producto: l.producto.nombre,
            cantidad: a.cantidadAsignada,
            ubicacion: a.tarima.ubicacion?.codigo || 'Sin ubicación'
          }))
        )
      }
    })

    return {
      almacen: pantalla.almacen,
      pantalla: { id: pantalla.id, nombre: pantalla.nombre },
      pedidos: pedidosFormateados,
      actualizadoEn: new Date().toISOString()
    }
  })

  // Las siguientes rutas requieren autenticación
  app.register(async (appAuth) => {
    appAuth.addHook('preHandler', app.authenticate)

    // GET /tv/pantallas - Listar pantallas
    appAuth.get('/pantallas', async (request) => {
      const user = request.user as any

      const where: any = {}
      if (user.rol !== 'ADMIN') {
        const almacenesIds = user.almacenes?.map((a: any) => a.id) || []
        where.almacenId = { in: almacenesIds }
      }

      const pantallas = await prisma.pantallaTv.findMany({
        where,
        include: { almacen: true }
      })

      return pantallas
    })

    // POST /tv/pantallas - Crear pantalla
    appAuth.post('/pantallas', async (request, reply) => {
      const user = request.user as any

      if (user.rol !== 'ADMIN') {
        return reply.status(403).send({ error: 'Solo administradores' })
      }

      const { almacenId, nombre } = request.body as any

      const token = randomBytes(16).toString('hex')

      const pantalla = await prisma.pantallaTv.create({
        data: {
          almacenId,
          nombre,
          token
        },
        include: { almacen: true }
      })

      return reply.status(201).send(pantalla)
    })

    // PATCH /tv/pantallas/:id
    appAuth.patch('/pantallas/:id', async (request, reply) => {
      const user = request.user as any
      const { id } = request.params as { id: string }

      if (user.rol !== 'ADMIN') {
        return reply.status(403).send({ error: 'Solo administradores' })
      }

      const { nombre, activa } = request.body as any

      const pantalla = await prisma.pantallaTv.update({
        where: { id },
        data: { nombre, activa }
      })

      return pantalla
    })

    // DELETE /tv/pantallas/:id
    appAuth.delete('/pantallas/:id', async (request, reply) => {
      const user = request.user as any
      const { id } = request.params as { id: string }

      if (user.rol !== 'ADMIN') {
        return reply.status(403).send({ error: 'Solo administradores' })
      }

      await prisma.pantallaTv.delete({ where: { id } })

      return { success: true }
    })

    // POST /tv/pantallas/:id/regenerar-token
    appAuth.post('/pantallas/:id/regenerar-token', async (request, reply) => {
      const user = request.user as any
      const { id } = request.params as { id: string }

      if (user.rol !== 'ADMIN') {
        return reply.status(403).send({ error: 'Solo administradores' })
      }

      const token = randomBytes(16).toString('hex')

      const pantalla = await prisma.pantallaTv.update({
        where: { id },
        data: { token }
      })

      return pantalla
    })
  })
}

function calcularPrioridad(pedido: any): 'URGENTE' | 'ALTA' | 'NORMAL' {
  if (!pedido.fechaRequerida) return 'NORMAL'

  const ahora = new Date()
  const requerida = new Date(pedido.fechaRequerida)
  const horasRestantes = (requerida.getTime() - ahora.getTime()) / (1000 * 60 * 60)

  if (horasRestantes < 2) return 'URGENTE'
  if (horasRestantes < 8) return 'ALTA'
  return 'NORMAL'
}
