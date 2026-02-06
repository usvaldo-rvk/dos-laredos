import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../app.js'

const registrarPagoSchema = z.object({
  pedidoId: z.string(),
  metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CREDITO']),
  monto: z.number().positive(),
  referencia: z.string().optional(),
  comprobante: z.string().optional(),
  notas: z.string().optional()
})

const registrarMultiplesPagosSchema = z.object({
  pedidoId: z.string(),
  pagos: z.array(z.object({
    metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CREDITO']),
    monto: z.number().positive(),
    referencia: z.string().optional(),
    comprobante: z.string().optional(),
    notas: z.string().optional()
  }))
})

export async function pagosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /pagos/pedido/:pedidoId - Obtener pagos de un pedido
  app.get('/pedido/:pedidoId', async (request, reply) => {
    const { pedidoId } = request.params as { pedidoId: string }

    const pagos = await prisma.pago.findMany({
      where: { pedidoId },
      include: {
        registradoPorRef: {
          select: { id: true, nombre: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Calcular totales por método
    const totales = {
      efectivo: 0,
      transferencia: 0,
      tarjeta: 0,
      credito: 0,
      total: 0
    }

    for (const pago of pagos) {
      const monto = parseFloat(pago.monto.toString())
      totales.total += monto
      switch (pago.metodoPago) {
        case 'EFECTIVO': totales.efectivo += monto; break
        case 'TRANSFERENCIA': totales.transferencia += monto; break
        case 'TARJETA': totales.tarjeta += monto; break
        case 'CREDITO': totales.credito += monto; break
      }
    }

    return { pagos, totales }
  })

  // POST /pagos - Registrar un pago
  app.post('/', async (request, reply) => {
    const user = request.user as any

    try {
      const body = registrarPagoSchema.parse(request.body)

      // Verificar que el pedido existe
      const pedido = await prisma.pedido.findUnique({
        where: { id: body.pedidoId },
        include: { pagos: true }
      })

      if (!pedido) {
        return reply.status(404).send({ error: 'Pedido no encontrado' })
      }

      // Si es pago a crédito, crear registro de crédito
      if (body.metodoPago === 'CREDITO') {
        const credito = await prisma.credito.create({
          data: {
            clienteId: pedido.clienteId,
            pedidoId: pedido.id,
            montoOriginal: body.monto,
            montoPendiente: body.monto,
            estado: 'PENDIENTE'
          }
        })
      }

      // Crear el pago
      const pago = await prisma.pago.create({
        data: {
          pedidoId: body.pedidoId,
          metodoPago: body.metodoPago,
          monto: body.monto,
          referencia: body.referencia,
          comprobante: body.comprobante,
          notas: body.notas,
          registradoPor: user.id
        },
        include: {
          registradoPorRef: {
            select: { id: true, nombre: true }
          }
        }
      })

      // Actualizar estado de pago del pedido
      await actualizarEstadoPagoPedido(body.pedidoId)

      return reply.status(201).send(pago)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // POST /pagos/multiples - Registrar múltiples pagos de una vez
  app.post('/multiples', async (request, reply) => {
    const user = request.user as any

    try {
      const body = registrarMultiplesPagosSchema.parse(request.body)

      // Verificar que el pedido existe
      const pedido = await prisma.pedido.findUnique({
        where: { id: body.pedidoId }
      })

      if (!pedido) {
        return reply.status(404).send({ error: 'Pedido no encontrado' })
      }

      const pagosCreados = []

      for (const pagoData of body.pagos) {
        // Si es pago a crédito, crear registro de crédito
        if (pagoData.metodoPago === 'CREDITO') {
          await prisma.credito.create({
            data: {
              clienteId: pedido.clienteId,
              pedidoId: pedido.id,
              montoOriginal: pagoData.monto,
              montoPendiente: pagoData.monto,
              estado: 'PENDIENTE'
            }
          })
        }

        // Crear el pago
        const pago = await prisma.pago.create({
          data: {
            pedidoId: body.pedidoId,
            metodoPago: pagoData.metodoPago,
            monto: pagoData.monto,
            referencia: pagoData.referencia,
            comprobante: pagoData.comprobante,
            notas: pagoData.notas,
            registradoPor: user.id
          }
        })

        pagosCreados.push(pago)
      }

      // Actualizar estado de pago del pedido
      await actualizarEstadoPagoPedido(body.pedidoId)

      return reply.status(201).send({ pagos: pagosCreados })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // DELETE /pagos/:id - Anular un pago (requiere supervisor)
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as any

    // Solo supervisores y admins pueden anular pagos
    if (user.rol === 'OPERARIO') {
      return reply.status(403).send({ error: 'No tiene permisos para anular pagos' })
    }

    const pago = await prisma.pago.findUnique({
      where: { id },
      include: { pedido: true }
    })

    if (!pago) {
      return reply.status(404).send({ error: 'Pago no encontrado' })
    }

    // Si era un pago a crédito, eliminar el crédito asociado
    if (pago.metodoPago === 'CREDITO') {
      await prisma.credito.deleteMany({
        where: {
          pedidoId: pago.pedidoId,
          montoOriginal: pago.monto
        }
      })
    }

    // Eliminar el pago
    await prisma.pago.delete({ where: { id } })

    // Actualizar estado de pago del pedido
    await actualizarEstadoPagoPedido(pago.pedidoId)

    return { success: true }
  })
}

// Función auxiliar para actualizar el estado de pago de un pedido
async function actualizarEstadoPagoPedido(pedidoId: string) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { pagos: true }
  })

  if (!pedido || !pedido.total) return

  const totalPedido = parseFloat(pedido.total.toString())
  let totalPagado = 0
  let totalCredito = 0

  for (const pago of pedido.pagos) {
    const monto = parseFloat(pago.monto.toString())
    if (pago.metodoPago === 'CREDITO') {
      totalCredito += monto
    } else {
      totalPagado += monto
    }
  }

  let estadoPago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'CREDITO' = 'PENDIENTE'

  const totalRegistrado = totalPagado + totalCredito

  if (totalRegistrado >= totalPedido) {
    if (totalCredito > 0 && totalCredito >= totalPedido) {
      estadoPago = 'CREDITO'
    } else if (totalCredito > 0) {
      estadoPago = 'CREDITO' // Mixto con crédito
    } else {
      estadoPago = 'PAGADO'
    }
  } else if (totalRegistrado > 0) {
    estadoPago = 'PARCIAL'
  }

  await prisma.pedido.update({
    where: { id: pedidoId },
    data: { estadoPago }
  })
}
