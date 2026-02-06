import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../app.js'

const clienteSchema = z.object({
  tipo: z.enum(['PERSONA', 'EMPRESA']),
  nombreEmpresa: z.string().optional().nullable(),
  nombreContacto: z.string().min(2),
  telefono: z.string().min(10),
  telefonoSecundario: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  rfc: z.string().optional().nullable(),
  direccionCalle: z.string().optional().nullable(),
  direccionNumero: z.string().optional().nullable(),
  direccionColonia: z.string().optional().nullable(),
  direccionCiudad: z.string().optional().nullable(),
  direccionEstado: z.string().optional().nullable(),
  direccionCp: z.string().optional().nullable(),
  coordenadasLat: z.number().optional().nullable(),
  coordenadasLng: z.number().optional().nullable(),
  notas: z.string().optional().nullable()
})

export async function clientesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /clientes
  app.get('/', async (request) => {
    const { search, page = '1', limit = '50' } = request.query as any

    const where: any = { activo: true }
    if (search) {
      where.OR = [
        { nombreContacto: { contains: search, mode: 'insensitive' } },
        { nombreEmpresa: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search } }
      ]
    }

    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        orderBy: { nombreContacto: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.cliente.count({ where })
    ])

    return {
      data: clientes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  })

  // GET /clientes/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        pedidos: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            lineas: {
              include: { producto: true }
            }
          }
        }
      }
    })

    if (!cliente) {
      return reply.status(404).send({ error: 'Cliente no encontrado' })
    }

    return cliente
  })

  // POST /clientes
  app.post('/', async (request, reply) => {
    try {
      const body = clienteSchema.parse(request.body)

      const cliente = await prisma.cliente.create({
        data: body
      })

      return reply.status(201).send(cliente)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // PATCH /clientes/:id
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const body = clienteSchema.partial().parse(request.body)

      const cliente = await prisma.cliente.update({
        where: { id },
        data: body
      })

      return cliente
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // DELETE /clientes/:id - Desactivar cliente
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    // Verificar si tiene pedidos pendientes
    const pedidosPendientes = await prisma.pedido.count({
      where: {
        clienteId: id,
        estado: { in: ['PENDIENTE', 'ASIGNADO', 'EN_PROCESO'] }
      }
    })

    if (pedidosPendientes > 0) {
      return reply.status(400).send({
        error: 'No se puede eliminar el cliente porque tiene pedidos pendientes',
        pedidosPendientes
      })
    }

    await prisma.cliente.update({
      where: { id },
      data: { activo: false }
    })

    return { success: true }
  })

  // GET /clientes/:id/historial
  app.get('/:id/historial', async (request) => {
    const { id } = request.params as { id: string }

    const pedidos = await prisma.pedido.findMany({
      where: { clienteId: id },
      include: {
        lineas: {
          include: { producto: true }
        },
        almacen: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calcular estadísticas
    const totalPedidos = pedidos.length
    const pedidosCompletados = pedidos.filter(p => p.estado === 'COMPLETADO').length

    return {
      pedidos,
      estadisticas: {
        totalPedidos,
        pedidosCompletados,
        tasaCompletado: totalPedidos > 0 ? (pedidosCompletados / totalPedidos * 100).toFixed(1) : 0
      }
    }
  })
}
