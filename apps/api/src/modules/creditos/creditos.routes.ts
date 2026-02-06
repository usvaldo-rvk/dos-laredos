import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../app.js'

const registrarAbonoSchema = z.object({
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA']),
  monto: z.number().positive(),
  referencia: z.string().optional(),
  comprobante: z.string().optional()
})

export async function creditosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /creditos/resumen/general - Resumen general de créditos
  // IMPORTANTE: Esta ruta debe ir ANTES de /:id para evitar conflictos
  app.get('/resumen/general', async () => {
    // Obtener todos los totales
    const totales = await prisma.credito.aggregate({
      _sum: {
        montoOriginal: true,
        montoPendiente: true
      },
      _count: true
    })

    // Contar créditos activos (no pagados)
    const creditosActivos = await prisma.credito.count({
      where: {
        estado: { in: ['PENDIENTE', 'PARCIAL'] }
      }
    })

    const totalOtorgado = parseFloat(totales._sum.montoOriginal?.toString() || '0')
    const totalPendiente = parseFloat(totales._sum.montoPendiente?.toString() || '0')
    const totalRecuperado = totalOtorgado - totalPendiente

    return {
      totalOtorgado,
      totalPendiente,
      totalRecuperado,
      creditosActivos,
      totalCreditos: totales._count
    }
  })

  // GET /creditos - Listar todos los créditos con filtros
  app.get('/', async (request) => {
    const { estado, clienteId, page = '1', limit = '50' } = request.query as any

    const where: any = {}

    if (estado) {
      where.estado = estado
    }

    if (clienteId) {
      where.clienteId = clienteId
    }

    const [creditos, total] = await Promise.all([
      prisma.credito.findMany({
        where,
        include: {
          cliente: {
            select: {
              id: true,
              nombreContacto: true,
              nombreEmpresa: true,
              telefono: true
            }
          },
          pedido: {
            select: {
              id: true,
              numeroPedido: true,
              createdAt: true
            }
          },
          abonos: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.credito.count({ where })
    ])

    // Calcular totales
    const totalesResult = await prisma.credito.aggregate({
      where,
      _sum: {
        montoOriginal: true,
        montoPendiente: true
      }
    })

    return {
      data: creditos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      resumen: {
        totalOtorgado: totalesResult._sum.montoOriginal || 0,
        totalPendiente: totalesResult._sum.montoPendiente || 0,
        totalRecuperado: (parseFloat(totalesResult._sum.montoOriginal?.toString() || '0')) -
                         (parseFloat(totalesResult._sum.montoPendiente?.toString() || '0'))
      }
    }
  })

  // GET /creditos/cliente/:clienteId - Créditos de un cliente específico
  app.get('/cliente/:clienteId', async (request) => {
    const { clienteId } = request.params as { clienteId: string }

    const creditos = await prisma.credito.findMany({
      where: { clienteId },
      include: {
        pedido: {
          select: {
            id: true,
            numeroPedido: true,
            createdAt: true
          }
        },
        abonos: {
          include: {
            registradoPorRef: {
              select: { id: true, nombre: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calcular totales del cliente
    const totales = {
      totalOtorgado: 0,
      totalPendiente: 0,
      totalPagado: 0
    }

    for (const credito of creditos) {
      totales.totalOtorgado += parseFloat(credito.montoOriginal.toString())
      totales.totalPendiente += parseFloat(credito.montoPendiente.toString())
    }
    totales.totalPagado = totales.totalOtorgado - totales.totalPendiente

    return { creditos, totales }
  })

  // GET /creditos/:id - Detalle de un crédito con historial de abonos
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const credito = await prisma.credito.findUnique({
      where: { id },
      include: {
        cliente: true,
        pedido: {
          include: {
            lineas: {
              include: { producto: true }
            }
          }
        },
        abonos: {
          include: {
            registradoPorRef: {
              select: { id: true, nombre: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!credito) {
      return reply.status(404).send({ error: 'Crédito no encontrado' })
    }

    return credito
  })

  // POST /creditos/:id/abono - Registrar un abono a un crédito
  app.post('/:id/abono', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as any

    try {
      const body = registrarAbonoSchema.parse(request.body)

      const credito = await prisma.credito.findUnique({
        where: { id }
      })

      if (!credito) {
        return reply.status(404).send({ error: 'Crédito no encontrado' })
      }

      if (credito.estado === 'PAGADO') {
        return reply.status(400).send({ error: 'Este crédito ya está pagado' })
      }

      const montoPendiente = parseFloat(credito.montoPendiente.toString())

      if (body.monto > montoPendiente) {
        return reply.status(400).send({
          error: `El monto del abono ($${body.monto}) excede el saldo pendiente ($${montoPendiente})`
        })
      }

      // Crear el abono
      const abono = await prisma.abono.create({
        data: {
          creditoId: id,
          metodoPago: body.metodoPago,
          monto: body.monto,
          referencia: body.referencia,
          comprobante: body.comprobante,
          registradoPor: user.id
        },
        include: {
          registradoPorRef: {
            select: { id: true, nombre: true }
          }
        }
      })

      // Actualizar el crédito
      const nuevoMontoPendiente = montoPendiente - body.monto
      const nuevoEstado = nuevoMontoPendiente <= 0 ? 'PAGADO' : 'PARCIAL'

      await prisma.credito.update({
        where: { id },
        data: {
          montoPendiente: nuevoMontoPendiente,
          estado: nuevoEstado
        }
      })

      return reply.status(201).send({
        abono,
        creditoActualizado: {
          montoPendiente: nuevoMontoPendiente,
          estado: nuevoEstado
        }
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // GET /creditos/:id/abonos - Historial de abonos de un crédito
  app.get('/:id/abonos', async (request, reply) => {
    const { id } = request.params as { id: string }

    const credito = await prisma.credito.findUnique({
      where: { id }
    })

    if (!credito) {
      return reply.status(404).send({ error: 'Crédito no encontrado' })
    }

    const abonos = await prisma.abono.findMany({
      where: { creditoId: id },
      include: {
        registradoPorRef: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calcular total abonado
    const totalAbonado = abonos.reduce((sum, a) => sum + parseFloat(a.monto.toString()), 0)

    return {
      abonos,
      resumen: {
        montoOriginal: credito.montoOriginal,
        totalAbonado,
        montoPendiente: credito.montoPendiente,
        cantidadAbonos: abonos.length
      }
    }
  })

}
