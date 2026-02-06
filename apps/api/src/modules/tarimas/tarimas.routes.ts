import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../app.js'
import { randomUUID } from 'crypto'

// Schemas
const crearTarimaSchema = z.object({
  almacenId: z.string(),
  productoId: z.string(),
  proveedorId: z.string(),
  ubicacionId: z.string().optional(),
  capacidadTotal: z.number().int().positive(),
  precioUnitario: z.number().positive().optional(),
  depositoPorEnvase: z.number().positive().optional(), // Depósito por cada envase retornable
  lote: z.string().optional(),
  fechaProduccion: z.string().datetime().optional(),
  fechaCaducidad: z.string().datetime().optional()
})

const mermaSchema = z.object({
  cantidad: z.number().int().positive(),
  motivo: z.string().min(1, 'El motivo es requerido'),
  supervisorId: z.string().optional()
})

const ajusteSchema = z.object({
  cantidad: z.number().int(),
  motivo: z.string().min(1, 'El motivo es requerido'),
  supervisorId: z.string().optional()
})

const actualizarPrecioSchema = z.object({
  precioUnitario: z.number().positive(),
  supervisorId: z.string().optional()
})

export async function tarimasRoutes(app: FastifyInstance) {
  // Middleware de autenticación para todas las rutas
  app.addHook('preHandler', app.authenticate)

  // GET /tarimas - Listar tarimas
  app.get('/', async (request) => {
    const { almacenId, estado, productoId, page = '1', limit = '50' } = request.query as any

    const where: any = {}
    if (almacenId) where.almacenId = almacenId
    if (estado) where.estado = estado
    if (productoId) where.productoId = productoId

    const [tarimas, total] = await Promise.all([
      prisma.tarima.findMany({
        where,
        include: {
          producto: true,
          proveedor: true,
          ubicacion: true,
          almacen: true
        },
        orderBy: { fechaIngreso: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.tarima.count({ where })
    ])

    // Calcular inventario para cada tarima
    const tarimasConInventario = await Promise.all(
      tarimas.map(async (tarima) => {
        const inventario = await calcularInventarioTarima(tarima.id)
        return { ...tarima, inventarioActual: inventario }
      })
    )

    return {
      data: tarimasConInventario,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  })

  // GET /tarimas/:id - Obtener tarima por ID
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const tarima = await prisma.tarima.findUnique({
      where: { id },
      include: {
        producto: true,
        proveedor: true,
        ubicacion: true,
        almacen: true,
        eventos: {
          orderBy: { timestampLocal: 'desc' },
          take: 50,
          include: {
            usuario: { select: { id: true, nombre: true } },
            supervisor: { select: { id: true, nombre: true } }
          }
        }
      }
    })

    if (!tarima) {
      return reply.status(404).send({ error: 'Tarima no encontrada' })
    }

    const inventario = await calcularInventarioTarima(tarima.id)

    return { ...tarima, inventarioActual: inventario }
  })

  // GET /tarimas/qr/:qrCode - Buscar por QR
  app.get('/qr/:qrCode', async (request, reply) => {
    const { qrCode } = request.params as { qrCode: string }

    const tarima = await prisma.tarima.findUnique({
      where: { qrCode },
      include: {
        producto: true,
        proveedor: true,
        ubicacion: true,
        almacen: true
      }
    })

    if (!tarima) {
      return reply.status(404).send({ error: 'Tarima no encontrada' })
    }

    const inventario = await calcularInventarioTarima(tarima.id)

    return { ...tarima, inventarioActual: inventario }
  })

  // POST /tarimas - Crear tarima (recepción)
  app.post('/', async (request, reply) => {
    try {
      const body = crearTarimaSchema.parse(request.body)
      const user = request.user as any

      // Generar QR único
      const qrCode = `DL-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`

      // Crear tarima
      const tarima = await prisma.tarima.create({
        data: {
          almacenId: body.almacenId,
          productoId: body.productoId,
          proveedorId: body.proveedorId,
          ubicacionId: body.ubicacionId,
          capacidadTotal: body.capacidadTotal,
          precioUnitario: body.precioUnitario,
          depositoPorEnvase: body.depositoPorEnvase,
          lote: body.lote,
          fechaProduccion: body.fechaProduccion ? new Date(body.fechaProduccion) : null,
          fechaCaducidad: body.fechaCaducidad ? new Date(body.fechaCaducidad) : null,
          qrCode,
          estado: 'ACTIVA'
        },
        include: {
          producto: true,
          proveedor: true,
          ubicacion: true,
          almacen: true
        }
      })

      // Crear evento CREACION
      await prisma.eventoTarima.create({
        data: {
          tarimaId: tarima.id,
          almacenId: tarima.almacenId,
          tipo: 'CREACION',
          usuarioId: user.id,
          rolUsuario: user.rol,
          cantidad: body.capacidadTotal,
          timestampLocal: new Date()
        }
      })

      // Crear evento RECEPCION
      await prisma.eventoTarima.create({
        data: {
          tarimaId: tarima.id,
          almacenId: tarima.almacenId,
          tipo: 'RECEPCION',
          usuarioId: user.id,
          rolUsuario: user.rol,
          cantidad: body.capacidadTotal,
          ubicacionDestinoId: body.ubicacionId,
          timestampLocal: new Date()
        }
      })

      return reply.status(201).send({ ...tarima, inventarioActual: body.capacidadTotal })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // PATCH /tarimas/:id/reubicar - Cambiar ubicación
  app.patch('/:id/reubicar', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { ubicacionId, motivo } = request.body as { ubicacionId: string; motivo?: string }
    const user = request.user as any

    const tarima = await prisma.tarima.findUnique({
      where: { id }
    })

    if (!tarima) {
      return reply.status(404).send({ error: 'Tarima no encontrada' })
    }

    // Actualizar ubicación
    const tarimaActualizada = await prisma.tarima.update({
      where: { id },
      data: { ubicacionId },
      include: {
        producto: true,
        proveedor: true,
        ubicacion: true,
        almacen: true
      }
    })

    // Registrar evento
    await prisma.eventoTarima.create({
      data: {
        tarimaId: id,
        almacenId: tarima.almacenId,
        tipo: 'REUBICACION',
        usuarioId: user.id,
        rolUsuario: user.rol,
        ubicacionOrigenId: tarima.ubicacionId,
        ubicacionDestinoId: ubicacionId,
        motivo,
        timestampLocal: new Date()
      }
    })

    return tarimaActualizada
  })

  // PATCH /tarimas/:id/estado - Cambiar estado (solo supervisor)
  app.patch('/:id/estado', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { estado, motivo, supervisorId } = request.body as {
      estado: string
      motivo: string
      supervisorId?: string
    }
    const user = request.user as any

    // Verificar que sea supervisor o admin
    if (user.rol === 'OPERARIO' && !supervisorId) {
      return reply.status(403).send({ error: 'Requiere autorización de supervisor' })
    }

    const tarima = await prisma.tarima.update({
      where: { id },
      data: { estado: estado as any },
      include: {
        producto: true,
        proveedor: true,
        ubicacion: true,
        almacen: true
      }
    })

    // Registrar evento de ajuste
    await prisma.eventoTarima.create({
      data: {
        tarimaId: id,
        almacenId: tarima.almacenId,
        tipo: 'AJUSTE',
        usuarioId: user.id,
        rolUsuario: user.rol,
        supervisorId: supervisorId || (user.rol !== 'OPERARIO' ? user.id : null),
        motivo: `Cambio de estado a ${estado}: ${motivo}`,
        timestampLocal: new Date()
      }
    })

    return tarima
  })

  // PATCH /tarimas/:id/precio - Actualizar precio unitario
  app.patch('/:id/precio', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = actualizarPrecioSchema.parse(request.body)
      const user = request.user as any

      // Solo ADMIN puede cambiar precios directamente
      // SUPERVISOR necesita validación de PIN de admin (manejado en frontend)
      if (user.rol === 'OPERARIO') {
        return reply.status(403).send({ error: 'No tienes permisos para modificar precios' })
      }

      const tarima = await prisma.tarima.findUnique({
        where: { id }
      })

      if (!tarima) {
        return reply.status(404).send({ error: 'Tarima no encontrada' })
      }

      const precioAnterior = tarima.precioUnitario

      const tarimaActualizada = await prisma.tarima.update({
        where: { id },
        data: { precioUnitario: body.precioUnitario },
        include: {
          producto: true,
          proveedor: true,
          ubicacion: true,
          almacen: true
        }
      })

      // Registrar evento de ajuste por cambio de precio
      await prisma.eventoTarima.create({
        data: {
          tarimaId: id,
          almacenId: tarima.almacenId,
          tipo: 'AJUSTE',
          usuarioId: user.id,
          rolUsuario: user.rol,
          supervisorId: body.supervisorId,
          motivo: `Precio actualizado de $${precioAnterior || 0} a $${body.precioUnitario}`,
          timestampLocal: new Date()
        }
      })

      const inventario = await calcularInventarioTarima(id)
      return { ...tarimaActualizada, inventarioActual: inventario }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // POST /tarimas/:id/merma - Registrar merma
  app.post('/:id/merma', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = mermaSchema.parse(request.body)
      const user = request.user as any

      const tarima = await prisma.tarima.findUnique({
        where: { id }
      })

      if (!tarima) {
        return reply.status(404).send({ error: 'Tarima no encontrada' })
      }

      // Verificar que hay suficiente inventario
      const inventarioActual = await calcularInventarioTarima(id)
      if (body.cantidad > inventarioActual) {
        return reply.status(400).send({
          error: `No hay suficiente inventario. Disponible: ${inventarioActual}`
        })
      }

      // Registrar evento de merma
      await prisma.eventoTarima.create({
        data: {
          tarimaId: id,
          almacenId: tarima.almacenId,
          tipo: 'MERMA',
          usuarioId: user.id,
          rolUsuario: user.rol,
          supervisorId: body.supervisorId || (user.rol !== 'OPERARIO' ? user.id : null),
          cantidad: body.cantidad,
          motivo: body.motivo,
          timestampLocal: new Date()
        }
      })

      // Verificar si la tarima queda agotada
      const nuevoInventario = inventarioActual - body.cantidad
      if (nuevoInventario === 0) {
        await prisma.tarima.update({
          where: { id },
          data: { estado: 'AGOTADA' }
        })
      }

      const tarimaActualizada = await prisma.tarima.findUnique({
        where: { id },
        include: {
          producto: true,
          proveedor: true,
          ubicacion: true,
          almacen: true
        }
      })

      return { ...tarimaActualizada, inventarioActual: nuevoInventario }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // POST /tarimas/:id/ajuste - Ajuste de inventario
  app.post('/:id/ajuste', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = ajusteSchema.parse(request.body)
      const user = request.user as any

      // Solo SUPERVISOR o ADMIN pueden hacer ajustes
      if (user.rol === 'OPERARIO' && !body.supervisorId) {
        return reply.status(403).send({ error: 'Requiere autorización de supervisor' })
      }

      const tarima = await prisma.tarima.findUnique({
        where: { id }
      })

      if (!tarima) {
        return reply.status(404).send({ error: 'Tarima no encontrada' })
      }

      const inventarioActual = await calcularInventarioTarima(id)
      const nuevoInventario = inventarioActual + body.cantidad

      // Validar que no quede negativo
      if (nuevoInventario < 0) {
        return reply.status(400).send({
          error: `El ajuste resultaría en inventario negativo. Inventario actual: ${inventarioActual}`
        })
      }

      // NOTA: Validación de capacidad máxima desactivada por solicitud del usuario
      // Si se requiere en el futuro, agregar configuración en ConfiguracionSistema

      // Registrar evento de ajuste
      await prisma.eventoTarima.create({
        data: {
          tarimaId: id,
          almacenId: tarima.almacenId,
          tipo: 'AJUSTE',
          usuarioId: user.id,
          rolUsuario: user.rol,
          supervisorId: body.supervisorId || (user.rol !== 'OPERARIO' ? user.id : null),
          cantidad: body.cantidad,
          motivo: body.motivo,
          timestampLocal: new Date()
        }
      })

      // Actualizar estado según inventario resultante
      let nuevoEstado = tarima.estado
      if (nuevoInventario === 0) {
        nuevoEstado = 'AGOTADA'
      } else if (tarima.estado === 'AGOTADA' && nuevoInventario > 0) {
        nuevoEstado = 'ACTIVA'
      }

      if (nuevoEstado !== tarima.estado) {
        await prisma.tarima.update({
          where: { id },
          data: { estado: nuevoEstado }
        })
      }

      const tarimaActualizada = await prisma.tarima.findUnique({
        where: { id },
        include: {
          producto: true,
          proveedor: true,
          ubicacion: true,
          almacen: true
        }
      })

      return { ...tarimaActualizada, inventarioActual: nuevoInventario }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // DELETE /tarimas/:id - Eliminar tarima (solo ADMIN/SUPERVISOR)
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { motivo } = request.body as { motivo?: string }
    const user = request.user as any

    // Solo ADMIN o SUPERVISOR pueden eliminar
    if (user.rol === 'OPERARIO') {
      return reply.status(403).send({ error: 'No tienes permisos para eliminar tarimas' })
    }

    const tarima = await prisma.tarima.findUnique({
      where: { id },
      include: {
        asignaciones: true,
        eventos: {
          where: { tipo: 'PICK' }
        }
      }
    })

    if (!tarima) {
      return reply.status(404).send({ error: 'Tarima no encontrada' })
    }

    // Verificar que no tenga picks realizados
    if (tarima.eventos.length > 0) {
      return reply.status(400).send({
        error: 'No se puede eliminar una tarima que ya tiene picks realizados',
        picksRealizados: tarima.eventos.length
      })
    }

    // Verificar que no tenga asignaciones activas
    const asignacionesActivas = tarima.asignaciones.filter(a => a.estado === 'ABIERTA')
    if (asignacionesActivas.length > 0) {
      return reply.status(400).send({
        error: 'No se puede eliminar una tarima con asignaciones pendientes',
        asignacionesPendientes: asignacionesActivas.length
      })
    }

    // Eliminar eventos asociados primero
    await prisma.eventoTarima.deleteMany({
      where: { tarimaId: id }
    })

    // Eliminar asignaciones (si las hay canceladas)
    await prisma.asignacionPick.deleteMany({
      where: { tarimaId: id }
    })

    // Eliminar la tarima
    await prisma.tarima.delete({
      where: { id }
    })

    return {
      success: true,
      message: 'Tarima eliminada correctamente',
      motivo: motivo || 'Sin motivo especificado'
    }
  })
}

// Función auxiliar para calcular inventario de tarima
async function calcularInventarioTarima(tarimaId: string): Promise<number> {
  const eventos = await prisma.eventoTarima.findMany({
    where: { tarimaId },
    select: { tipo: true, cantidad: true }
  })

  let inventario = 0

  for (const evento of eventos) {
    switch (evento.tipo) {
      // Eventos que SUMAN inventario
      // Nota: CREACION no se cuenta porque RECEPCION ya tiene el inventario inicial
      case 'RECEPCION':
      case 'ENTRADA':
      case 'AJUSTE_POSITIVO':
        inventario += evento.cantidad || 0
        break
      // Eventos que RESTAN inventario
      case 'SALIDA':
      case 'PICK':
      case 'MERMA':
      case 'AJUSTE_NEGATIVO':
        inventario -= evento.cantidad || 0
        break
      case 'AJUSTE':
        // Los ajustes pueden ser positivos o negativos (viene con signo)
        inventario += evento.cantidad || 0
        break
      // CREACION, REUBICACION, CIERRE_TARIMA, ASIGNACION_PICK son eventos de auditoría, no afectan inventario
    }
  }

  return Math.max(0, inventario)
}
