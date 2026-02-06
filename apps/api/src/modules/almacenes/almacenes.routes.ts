import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../app.js'

const crearAlmacenSchema = z.object({
  codigo: z.string().min(2).max(10),
  nombre: z.string().min(3),
  direccion: z.string().optional()
})

export async function almacenesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /almacenes
  app.get('/', async () => {
    const almacenes = await prisma.almacen.findMany({
      where: { activo: true },
      include: {
        _count: {
          select: {
            tarimas: true,
            ubicaciones: true,
            usuarios: true
          }
        }
      },
      orderBy: { nombre: 'asc' }
    })

    return almacenes
  })

  // GET /almacenes/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const almacen = await prisma.almacen.findUnique({
      where: { id },
      include: {
        ubicaciones: {
          where: { activo: true },
          orderBy: { codigo: 'asc' }
        },
        _count: {
          select: { tarimas: true, usuarios: true }
        }
      }
    })

    if (!almacen) {
      return reply.status(404).send({ error: 'Almacén no encontrado' })
    }

    return almacen
  })

  // POST /almacenes
  app.post('/', async (request, reply) => {
    const user = request.user as any
    if (user.rol !== 'ADMIN') {
      return reply.status(403).send({ error: 'Solo administradores' })
    }

    try {
      const body = crearAlmacenSchema.parse(request.body)

      const almacen = await prisma.almacen.create({
        data: body
      })

      return reply.status(201).send(almacen)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // GET /almacenes/:id/ubicaciones
  app.get('/:id/ubicaciones', async (request) => {
    const { id } = request.params as { id: string }

    const ubicaciones = await prisma.ubicacion.findMany({
      where: { almacenId: id, activo: true },
      orderBy: { codigo: 'asc' }
    })

    return ubicaciones
  })

  // POST /almacenes/:id/ubicaciones
  app.post('/:id/ubicaciones', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { codigo, tipo, descripcion } = request.body as any

    const ubicacion = await prisma.ubicacion.create({
      data: {
        almacenId: id,
        codigo,
        tipo,
        descripcion
      }
    })

    return reply.status(201).send(ubicacion)
  })
}
