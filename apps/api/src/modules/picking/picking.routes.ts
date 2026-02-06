import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../app.js'

const confirmarPickSchema = z.object({
  asignacionId: z.string(),
  cantidad: z.number().int().positive(),
  supervisorId: z.string().optional() // Para picks forzados
})

const mermaSchema = z.object({
  tarimaId: z.string(),
  cantidad: z.number().int().positive(),
  motivo: z.string().min(5),
  supervisorId: z.string().optional() // Para mermas grandes
})

export async function pickingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /picking/pendientes - Asignaciones pendientes para picking
  app.get('/pendientes', async (request) => {
    const { almacenId } = request.query as any
    const user = request.user as any

    // Obtener almacenes del usuario
    const almacenesUsuario = user.almacenes?.map((a: any) => a.id) || []

    const where: any = {
      estado: 'ABIERTA',
      tarima: {
        almacenId: almacenId || { in: almacenesUsuario }
      }
    }

    const asignaciones = await prisma.asignacionPick.findMany({
      where,
      include: {
        pedidoLinea: {
          include: {
            pedido: {
              include: { cliente: true }
            },
            producto: true
          }
        },
        tarima: {
          include: {
            ubicacion: true,
            producto: true,
            proveedor: true
          }
        }
      },
      orderBy: {
        pedidoLinea: {
          pedido: { createdAt: 'asc' }
        }
      }
    })

    return asignaciones
  })

  // POST /picking/confirmar - Confirmar un pick
  app.post('/confirmar', async (request, reply) => {
    const user = request.user as any

    try {
      const body = confirmarPickSchema.parse(request.body)

      const asignacion = await prisma.asignacionPick.findUnique({
        where: { id: body.asignacionId },
        include: {
          tarima: true,
          pedidoLinea: {
            include: { pedido: true }
          }
        }
      })

      if (!asignacion) {
        return reply.status(404).send({ error: 'Asignación no encontrada' })
      }

      if (asignacion.estado !== 'ABIERTA') {
        return reply.status(400).send({ error: 'La asignación ya fue procesada' })
      }

      // Validar cantidad
      if (body.cantidad > asignacion.cantidadAsignada) {
        // Requiere supervisor
        if (!body.supervisorId && user.rol === 'OPERARIO') {
          return reply.status(403).send({
            error: 'Cantidad mayor a la asignada requiere autorización de supervisor'
          })
        }
      }

      // Actualizar asignación
      await prisma.asignacionPick.update({
        where: { id: body.asignacionId },
        data: {
          cantidadConfirmada: body.cantidad,
          estado: 'CONFIRMADA'
        }
      })

      // Registrar evento PICK
      await prisma.eventoTarima.create({
        data: {
          tarimaId: asignacion.tarimaId,
          almacenId: asignacion.tarima.almacenId,
          tipo: 'PICK',
          usuarioId: user.id,
          rolUsuario: user.rol,
          supervisorId: body.supervisorId,
          cantidad: body.cantidad,
          pedidoId: asignacion.pedidoLinea.pedidoId,
          timestampLocal: new Date()
        }
      })

      // Actualizar cantidad surtida en la línea del pedido
      await prisma.pedidoLinea.update({
        where: { id: asignacion.pedidoLineaId },
        data: {
          cantidadSurtida: {
            increment: body.cantidad
          }
        }
      })

      // Verificar si la tarima quedó sin inventario
      await actualizarEstadoTarima(asignacion.tarimaId)

      // Verificar si el pedido está completo
      await verificarPedidoCompleto(asignacion.pedidoLinea.pedidoId)

      return { success: true, mensaje: 'Pick confirmado' }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // POST /picking/merma - Registrar merma
  app.post('/merma', async (request, reply) => {
    const user = request.user as any

    try {
      const body = mermaSchema.parse(request.body)

      const tarima = await prisma.tarima.findUnique({
        where: { id: body.tarimaId }
      })

      if (!tarima) {
        return reply.status(404).send({ error: 'Tarima no encontrada' })
      }

      // Calcular inventario actual
      const inventario = await calcularInventarioTarima(body.tarimaId)

      if (body.cantidad > inventario) {
        return reply.status(400).send({
          error: 'Cantidad de merma mayor al inventario disponible',
          inventarioActual: inventario
        })
      }

      // Umbral para requerir supervisor (ej: más del 20% del inventario)
      const umbralSupervisor = inventario * 0.2
      if (body.cantidad > umbralSupervisor && !body.supervisorId && user.rol === 'OPERARIO') {
        return reply.status(403).send({
          error: 'Merma grande requiere autorización de supervisor',
          umbral: Math.ceil(umbralSupervisor)
        })
      }

      // Registrar evento MERMA
      await prisma.eventoTarima.create({
        data: {
          tarimaId: body.tarimaId,
          almacenId: tarima.almacenId,
          tipo: 'MERMA',
          usuarioId: user.id,
          rolUsuario: user.rol,
          supervisorId: body.supervisorId,
          cantidad: body.cantidad,
          motivo: body.motivo,
          timestampLocal: new Date()
        }
      })

      // Actualizar estado de tarima
      await actualizarEstadoTarima(body.tarimaId)

      return { success: true, mensaje: 'Merma registrada' }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // POST /picking/ajuste - Ajuste de inventario (solo supervisor)
  app.post('/ajuste', async (request, reply) => {
    const user = request.user as any
    const { tarimaId, cantidad, motivo } = request.body as {
      tarimaId: string
      cantidad: number // Puede ser negativo
      motivo: string
    }

    if (user.rol === 'OPERARIO') {
      return reply.status(403).send({ error: 'Solo supervisores pueden realizar ajustes' })
    }

    const tarima = await prisma.tarima.findUnique({
      where: { id: tarimaId }
    })

    if (!tarima) {
      return reply.status(404).send({ error: 'Tarima no encontrada' })
    }

    // Registrar evento AJUSTE
    await prisma.eventoTarima.create({
      data: {
        tarimaId,
        almacenId: tarima.almacenId,
        tipo: 'AJUSTE',
        usuarioId: user.id,
        rolUsuario: user.rol,
        cantidad, // Puede ser negativo para restar
        motivo,
        timestampLocal: new Date()
      }
    })

    // Actualizar estado
    await actualizarEstadoTarima(tarimaId)

    return { success: true, mensaje: 'Ajuste registrado' }
  })

  // GET /picking/escanear/:qrCode - Escanear QR para picking
  app.get('/escanear/:qrCode', async (request, reply) => {
    const { qrCode } = request.params as { qrCode: string }

    const tarima = await prisma.tarima.findUnique({
      where: { qrCode },
      include: {
        producto: true,
        ubicacion: true,
        almacen: true
      }
    })

    if (!tarima) {
      return reply.status(404).send({ error: 'Tarima no encontrada' })
    }

    // Buscar asignaciones pendientes para esta tarima
    const asignaciones = await prisma.asignacionPick.findMany({
      where: {
        tarimaId: tarima.id,
        estado: 'ABIERTA'
      },
      include: {
        pedidoLinea: {
          include: {
            pedido: {
              include: { cliente: true }
            },
            producto: true
          }
        }
      }
    })

    const inventario = await calcularInventarioTarima(tarima.id)

    return {
      tarima: { ...tarima, inventarioActual: inventario },
      asignacionesPendientes: asignaciones
    }
  })
}

// Funciones auxiliares
async function calcularInventarioTarima(tarimaId: string): Promise<number> {
  const eventos = await prisma.eventoTarima.findMany({
    where: { tarimaId },
    select: { tipo: true, cantidad: true }
  })

  let inventario = 0
  for (const e of eventos) {
    // Eventos que SUMAN inventario
    // Nota: CREACION no se cuenta porque RECEPCION ya tiene el inventario inicial
    if (['RECEPCION', 'ENTRADA', 'AJUSTE_POSITIVO'].includes(e.tipo)) {
      inventario += e.cantidad || 0
    }
    // Eventos que RESTAN inventario
    else if (['SALIDA', 'PICK', 'MERMA', 'AJUSTE_NEGATIVO'].includes(e.tipo)) {
      inventario -= e.cantidad || 0
    }
    // AJUSTE puede ser positivo o negativo (viene con signo)
    else if (e.tipo === 'AJUSTE') {
      inventario += e.cantidad || 0
    }
    // CREACION, REUBICACION, CIERRE_TARIMA, ASIGNACION_PICK son eventos de auditoría
  }

  return Math.max(0, inventario)
}

async function actualizarEstadoTarima(tarimaId: string) {
  const inventario = await calcularInventarioTarima(tarimaId)

  if (inventario <= 0) {
    await prisma.tarima.update({
      where: { id: tarimaId },
      data: { estado: 'AGOTADA' }
    })

    // Registrar evento de cierre
    // (ya debería estar registrado el último pick/merma)
  } else {
    // Verificar si hay asignaciones pendientes
    const asignacionesPendientes = await prisma.asignacionPick.count({
      where: { tarimaId, estado: 'ABIERTA' }
    })

    const nuevoEstado = asignacionesPendientes > 0 ? 'RESERVADA' : 'ACTIVA'

    await prisma.tarima.update({
      where: { id: tarimaId },
      data: { estado: nuevoEstado }
    })
  }
}

async function verificarPedidoCompleto(pedidoId: string) {
  const lineas = await prisma.pedidoLinea.findMany({
    where: { pedidoId },
    include: {
      asignaciones: true
    }
  })

  const todasCompletas = lineas.every(l => {
    const totalConfirmado = l.asignaciones
      .filter(a => a.estado === 'CONFIRMADA')
      .reduce((sum, a) => sum + a.cantidadConfirmada, 0)
    return totalConfirmado >= l.cantidadSolicitada
  })

  if (todasCompletas) {
    await prisma.pedido.update({
      where: { id: pedidoId },
      data: { estado: 'COMPLETADO' }
    })
  }
}
