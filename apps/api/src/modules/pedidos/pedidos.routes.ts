import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../app.js'

const crearPedidoSchema = z.object({
  almacenId: z.string(),
  clienteId: z.string(),
  notas: z.string().optional(),
  fechaRequerida: z.string().datetime().optional(),
  // Tipo de entrega
  tipoEntrega: z.enum(['RECOLECCION', 'ENVIO']).optional().default('RECOLECCION'),
  direccionCalle: z.string().optional().nullable(),
  direccionNumero: z.string().optional().nullable(),
  direccionColonia: z.string().optional().nullable(),
  direccionCiudad: z.string().optional().nullable(),
  direccionEstado: z.string().optional().nullable(),
  direccionCp: z.string().optional().nullable(),
  direccionReferencia: z.string().optional().nullable(),
  // Campos de pago
  subtotal: z.number().optional(),
  descuento: z.number().optional(),
  total: z.number().optional(),
  lineas: z.array(z.object({
    productoId: z.string(),
    cantidadSolicitada: z.number().int().positive(),
    precioUnitario: z.number().optional(),      // Precio al público
    costoUnitario: z.number().optional(),       // Costo del proveedor
    subtotal: z.number().optional(),
    proveedorId: z.string().optional(),         // ID del proveedor que suministró
    proveedorNombre: z.string().optional(),     // Nombre del proveedor (snapshot)
    asignaciones: z.array(z.object({
      tarimaId: z.string(),
      cantidadAsignada: z.number().int().positive()
    })).optional()
  })).min(1),
  pagos: z.array(z.object({
    metodoPago: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'CREDITO']),
    monto: z.number().positive(),
    referencia: z.string().optional(),
    comprobante: z.string().optional(),
    notas: z.string().optional()
  })).optional()
})

export async function pedidosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /pedidos
  app.get('/', async (request) => {
    const { almacenId, estado, clienteId, page = '1', limit = '50' } = request.query as any

    const where: any = {}
    if (almacenId) where.almacenId = almacenId
    if (estado) where.estado = estado
    if (clienteId) where.clienteId = clienteId

    const [pedidos, total] = await Promise.all([
      prisma.pedido.findMany({
        where,
        include: {
          cliente: true,
          almacen: true,
          lineas: {
            include: { producto: true }
          },
          creadoPorRef: { select: { id: true, nombre: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.pedido.count({ where })
    ])

    return {
      data: pedidos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  })

  // GET /pedidos/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        cliente: true,
        almacen: true,
        lineas: {
          include: {
            producto: true,
            asignaciones: {
              include: {
                tarima: {
                  include: { ubicacion: true, proveedor: true }
                }
              }
            }
          }
        },
        creadoPorRef: { select: { id: true, nombre: true } },
        pagos: {
          include: { registradoPorRef: { select: { id: true, nombre: true } } }
        },
        creditos: {
          include: { abonos: true }
        }
      }
    })

    if (!pedido) {
      return reply.status(404).send({ error: 'Pedido no encontrado' })
    }

    return pedido
  })

  // POST /pedidos
  app.post('/', async (request, reply) => {
    const user = request.user as any

    try {
      const body = crearPedidoSchema.parse(request.body)

      // Generar número de pedido
      const count = await prisma.pedido.count()
      const numeroPedido = `PED-${String(count + 1).padStart(6, '0')}`

      // Verificar si hay asignaciones manuales
      const tieneAsignaciones = body.lineas.some(l => l.asignaciones && l.asignaciones.length > 0)

      // Calcular estado de pago
      const totalPedido = body.total || 0
      const totalPagos = body.pagos?.reduce((sum, p) => sum + p.monto, 0) || 0
      const totalCredito = body.pagos?.filter(p => p.metodoPago === 'CREDITO').reduce((sum, p) => sum + p.monto, 0) || 0

      let estadoPago: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'CREDITO' = 'PENDIENTE'
      if (totalPagos >= totalPedido && totalCredito === 0) {
        estadoPago = 'PAGADO'
      } else if (totalCredito > 0) {
        estadoPago = 'CREDITO'
      } else if (totalPagos > 0) {
        estadoPago = 'PARCIAL'
      }

      const pedido = await prisma.pedido.create({
        data: {
          almacenId: body.almacenId,
          clienteId: body.clienteId,
          numeroPedido,
          notas: body.notas,
          fechaRequerida: body.fechaRequerida ? new Date(body.fechaRequerida) : null,
          creadoPor: user.id,
          estado: tieneAsignaciones ? 'ENVIADO_BODEGA' : 'CREADO',
          // Tipo de entrega
          tipoEntrega: body.tipoEntrega || 'RECOLECCION',
          direccionCalle: body.direccionCalle,
          direccionNumero: body.direccionNumero,
          direccionColonia: body.direccionColonia,
          direccionCiudad: body.direccionCiudad,
          direccionEstado: body.direccionEstado,
          direccionCp: body.direccionCp,
          direccionReferencia: body.direccionReferencia,
          // Campos de pago
          subtotal: body.subtotal,
          descuento: body.descuento || 0,
          total: body.total,
          estadoPago,
          lineas: {
            create: body.lineas.map(l => ({
              productoId: l.productoId,
              cantidadSolicitada: l.cantidadSolicitada,
              precioUnitario: l.precioUnitario,       // Precio al público
              costoUnitario: l.costoUnitario,         // Costo del proveedor
              subtotal: l.subtotal,
              proveedorId: l.proveedorId,             // ID del proveedor
              proveedorNombre: l.proveedorNombre      // Nombre del proveedor (snapshot)
            }))
          }
        },
        include: {
          cliente: true,
          almacen: true,
          lineas: {
            include: { producto: true }
          }
        }
      })

      // Si hay asignaciones manuales, crearlas y descontar inventario
      if (tieneAsignaciones) {
        for (let i = 0; i < body.lineas.length; i++) {
          const lineaBody = body.lineas[i]
          const lineaCreada = pedido.lineas[i]

          if (lineaBody.asignaciones && lineaBody.asignaciones.length > 0) {
            let cantidadSurtidaLinea = 0

            for (const asig of lineaBody.asignaciones) {
              // Crear asignación (ya confirmada)
              await prisma.asignacionPick.create({
                data: {
                  pedidoLineaId: lineaCreada.id,
                  tarimaId: asig.tarimaId,
                  cantidadAsignada: asig.cantidadAsignada,
                  estado: 'CONFIRMADA' // Ya está confirmada porque se descuenta al crear
                }
              })

              cantidadSurtidaLinea += asig.cantidadAsignada

              // Registrar evento de SALIDA (descuenta inventario)
              await prisma.eventoTarima.create({
                data: {
                  tarimaId: asig.tarimaId,
                  almacenId: body.almacenId,
                  tipo: 'SALIDA',
                  usuarioId: user.id,
                  rolUsuario: user.rol,
                  cantidad: asig.cantidadAsignada,
                  pedidoId: pedido.id,
                  motivo: `Venta - Pedido ${numeroPedido}`,
                  timestampLocal: new Date()
                }
              })

              // Calcular inventario restante de la tarima
              const eventos = await prisma.eventoTarima.findMany({
                where: { tarimaId: asig.tarimaId }
              })

              let inventarioActual = 0
              for (const evento of eventos) {
                // Eventos que suman inventario
                // Nota: CREACION no se cuenta porque RECEPCION ya tiene el inventario inicial
                if (['RECEPCION', 'ENTRADA', 'AJUSTE_POSITIVO'].includes(evento.tipo)) {
                  inventarioActual += evento.cantidad
                }
                // Eventos que restan inventario
                else if (['SALIDA', 'PICK', 'MERMA', 'AJUSTE_NEGATIVO'].includes(evento.tipo)) {
                  inventarioActual -= evento.cantidad
                }
                // AJUSTE puede ser positivo o negativo según el contexto
                else if (evento.tipo === 'AJUSTE') {
                  // Si cantidad es positiva suma, si es negativa resta (ya viene con signo)
                  inventarioActual += evento.cantidad
                }
              }

              // Si el inventario llega a 0 o menos, marcar como AGOTADA
              if (inventarioActual <= 0) {
                await prisma.tarima.update({
                  where: { id: asig.tarimaId },
                  data: { estado: 'AGOTADA' }
                })
              }
              // Si aún tiene inventario, mantenerla ACTIVA
            }

            // Actualizar cantidad surtida en la línea del pedido
            await prisma.pedidoLinea.update({
              where: { id: lineaCreada.id },
              data: { cantidadSurtida: cantidadSurtidaLinea }
            })
          }
        }

        // El pedido ya está en ENVIADO_BODEGA con inventario descontado
      }

      // Crear registros de pago
      if (body.pagos && body.pagos.length > 0) {
        for (const pago of body.pagos) {
          if (pago.metodoPago === 'CREDITO') {
            // Crear registro de crédito
            await prisma.credito.create({
              data: {
                clienteId: body.clienteId,
                pedidoId: pedido.id,
                montoOriginal: pago.monto,
                montoPendiente: pago.monto,
                estado: 'PENDIENTE',
                notas: pago.notas
              }
            })
          } else {
            // Crear registro de pago normal
            await prisma.pago.create({
              data: {
                pedidoId: pedido.id,
                metodoPago: pago.metodoPago as any,
                monto: pago.monto,
                referencia: pago.referencia,
                comprobante: pago.comprobante,
                notas: pago.notas,
                registradoPor: user.id
              }
            })
          }
        }
      }

      // Obtener pedido completo con asignaciones y pagos
      const pedidoCompleto = await prisma.pedido.findUnique({
        where: { id: pedido.id },
        include: {
          cliente: true,
          almacen: true,
          lineas: {
            include: {
              producto: true,
              asignaciones: {
                include: {
                  tarima: {
                    include: { ubicacion: true, proveedor: true }
                  }
                }
              }
            }
          },
          pagos: true,
          creditos: true
        }
      })

      return reply.status(201).send(pedidoCompleto)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // POST /pedidos/:id/asignar - Asignar tarimas automáticamente
  app.post('/:id/asignar', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as any

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        lineas: {
          include: { producto: true }
        }
      }
    })

    if (!pedido) {
      return reply.status(404).send({ error: 'Pedido no encontrado' })
    }

    if (pedido.estado !== 'CREADO') {
      return reply.status(400).send({ error: 'El pedido ya fue asignado' })
    }

    const asignaciones: any[] = []
    const errores: any[] = []

    // Para cada línea del pedido
    for (const linea of pedido.lineas) {
      let cantidadPendiente = linea.cantidadSolicitada

      // Buscar tarimas disponibles (FIFO)
      const tarimas = await prisma.tarima.findMany({
        where: {
          almacenId: pedido.almacenId,
          productoId: linea.productoId,
          estado: 'ACTIVA'
        },
        orderBy: { fechaIngreso: 'asc' } // FIFO
      })

      for (const tarima of tarimas) {
        if (cantidadPendiente <= 0) break

        // Calcular inventario disponible de esta tarima
        const inventario = await calcularInventarioDisponible(tarima.id)

        if (inventario <= 0) continue

        const cantidadAsignar = Math.min(inventario, cantidadPendiente)

        // Crear asignación
        const asignacion = await prisma.asignacionPick.create({
          data: {
            pedidoLineaId: linea.id,
            tarimaId: tarima.id,
            cantidadAsignada: cantidadAsignar
          }
        })

        // Registrar evento
        await prisma.eventoTarima.create({
          data: {
            tarimaId: tarima.id,
            almacenId: pedido.almacenId,
            tipo: 'ASIGNACION_PICK',
            usuarioId: user.id,
            rolUsuario: user.rol,
            cantidad: cantidadAsignar,
            pedidoId: pedido.id,
            timestampLocal: new Date()
          }
        })

        // Cambiar estado de tarima a RESERVADA
        await prisma.tarima.update({
          where: { id: tarima.id },
          data: { estado: 'RESERVADA' }
        })

        asignaciones.push(asignacion)
        cantidadPendiente -= cantidadAsignar
      }

      if (cantidadPendiente > 0) {
        errores.push({
          productoId: linea.productoId,
          productoNombre: linea.producto.nombre,
          faltante: cantidadPendiente
        })
      }
    }

    // Actualizar estado del pedido
    await prisma.pedido.update({
      where: { id },
      data: { estado: errores.length > 0 ? 'EN_REVISION' : 'ENVIADO_BODEGA' }
    })

    return {
      asignaciones: asignaciones.length,
      errores,
      mensaje: errores.length > 0
        ? 'Asignación parcial - hay productos sin stock suficiente'
        : 'Asignación completa'
    }
  })

  // PATCH /pedidos/:id/estado
  app.patch('/:id/estado', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { estado } = request.body as { estado: string }

    const pedido = await prisma.pedido.update({
      where: { id },
      data: { estado: estado as any }
    })

    return pedido
  })

  // POST /pedidos/:id/cerrar
  app.post('/:id/cerrar', async (request, reply) => {
    const { id } = request.params as { id: string }

    // Verificar que todas las asignaciones estén confirmadas
    const asignacionesPendientes = await prisma.asignacionPick.count({
      where: {
        pedidoLinea: { pedidoId: id },
        estado: 'ABIERTA'
      }
    })

    if (asignacionesPendientes > 0) {
      return reply.status(400).send({
        error: 'No se puede cerrar el pedido',
        asignacionesPendientes
      })
    }

    const pedido = await prisma.pedido.update({
      where: { id },
      data: { estado: 'COMPLETADO' }
    })

    return pedido
  })

  // POST /pedidos/:id/revision - Enviar pedido a revisión (bodega reporta problema)
  app.post('/:id/revision', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { motivo } = request.body as { motivo: string }
    const user = request.user as any

    const pedido = await prisma.pedido.findUnique({
      where: { id }
    })

    if (!pedido) {
      return reply.status(404).send({ error: 'Pedido no encontrado' })
    }

    if (pedido.estado !== 'ENVIADO_BODEGA') {
      return reply.status(400).send({
        error: 'Solo se pueden enviar a revisión pedidos en estado ENVIADO_BODEGA'
      })
    }

    const pedidoActualizado = await prisma.pedido.update({
      where: { id },
      data: {
        estado: 'EN_REVISION',
        notas: pedido.notas
          ? `${pedido.notas}\n\n[REVISIÓN] ${motivo} - Reportado por: ${user.nombre}`
          : `[REVISIÓN] ${motivo} - Reportado por: ${user.nombre}`
      }
    })

    return {
      mensaje: 'Pedido enviado a revisión',
      pedido: pedidoActualizado
    }
  })

  // POST /pedidos/:id/resolver-revision - Resolver revisión y devolver a bodega
  app.post('/:id/resolver-revision', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { resolucion } = request.body as { resolucion: string }
    const user = request.user as any

    // Solo ADMIN o SUPERVISOR pueden resolver revisiones
    if (user.rol === 'OPERARIO') {
      return reply.status(403).send({ error: 'No tienes permisos para resolver revisiones' })
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id }
    })

    if (!pedido) {
      return reply.status(404).send({ error: 'Pedido no encontrado' })
    }

    if (pedido.estado !== 'EN_REVISION') {
      return reply.status(400).send({
        error: 'Solo se pueden resolver pedidos en estado EN_REVISION'
      })
    }

    const pedidoActualizado = await prisma.pedido.update({
      where: { id },
      data: {
        estado: 'ENVIADO_BODEGA',
        notas: pedido.notas
          ? `${pedido.notas}\n\n[RESUELTO] ${resolucion} - Por: ${user.nombre}`
          : `[RESUELTO] ${resolucion} - Por: ${user.nombre}`
      }
    })

    return {
      mensaje: 'Revisión resuelta, pedido devuelto a bodega',
      pedido: pedidoActualizado
    }
  })

  // POST /pedidos/:id/cancelar - Cancelar pedido (soft delete)
  // Disponible para ADMIN y SUPERVISOR
  app.post('/:id/cancelar', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { motivo } = request.body as { motivo?: string }
    const user = request.user as any

    // Solo ADMIN o SUPERVISOR pueden cancelar
    if (user.rol === 'OPERARIO') {
      return reply.status(403).send({ error: 'No tienes permisos para cancelar pedidos' })
    }

    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: {
        lineas: {
          include: {
            asignaciones: true
          }
        }
      }
    })

    if (!pedido) {
      return reply.status(404).send({ error: 'Pedido no encontrado' })
    }

    if (pedido.estado === 'COMPLETADO') {
      return reply.status(400).send({ error: 'No se puede cancelar un pedido completado' })
    }

    if (pedido.estado === 'CANCELADO') {
      return reply.status(400).send({ error: 'El pedido ya está cancelado' })
    }

    // Cancelar todas las asignaciones y revertir inventario si aplica
    for (const linea of pedido.lineas) {
      for (const asignacion of linea.asignaciones) {
        if (asignacion.estado === 'ABIERTA') {
          // Cancelar la asignación
          await prisma.asignacionPick.update({
            where: { id: asignacion.id },
            data: { estado: 'CANCELADA' }
          })

          // Liberar la tarima (cambiar de RESERVADA a ACTIVA)
          await prisma.tarima.update({
            where: { id: asignacion.tarimaId },
            data: { estado: 'ACTIVA' }
          })
        } else if (asignacion.estado === 'CONFIRMADA') {
          // Revertir inventario - crear evento ENTRADA para devolver las unidades
          await prisma.eventoTarima.create({
            data: {
              tarimaId: asignacion.tarimaId,
              almacenId: pedido.almacenId,
              tipo: 'ENTRADA',
              usuarioId: user.id,
              rolUsuario: user.rol,
              cantidad: asignacion.cantidadAsignada,
              pedidoId: pedido.id,
              motivo: `Cancelación de pedido ${pedido.numeroPedido}`,
              timestampLocal: new Date()
            }
          })

          // Cancelar la asignación
          await prisma.asignacionPick.update({
            where: { id: asignacion.id },
            data: { estado: 'CANCELADA' }
          })

          // Reactivar la tarima si estaba AGOTADA
          await prisma.tarima.update({
            where: { id: asignacion.tarimaId },
            data: { estado: 'ACTIVA' }
          })
        }
      }
    }

    // Actualizar estado del pedido a CANCELADO
    const pedidoActualizado = await prisma.pedido.update({
      where: { id },
      data: {
        estado: 'CANCELADO',
        notas: pedido.notas
          ? `${pedido.notas}\n\n[CANCELADO] ${motivo || 'Sin motivo'} - Por: ${user.nombre}`
          : `[CANCELADO] ${motivo || 'Sin motivo'} - Por: ${user.nombre}`
      }
    })

    return { mensaje: 'Pedido cancelado correctamente', pedido: pedidoActualizado }
  })

  // DELETE /pedidos/:id - Eliminar pedido completamente (hard delete)
  // Solo disponible para ADMIN
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const user = request.user as any

    // Solo ADMIN puede eliminar completamente
    if (user.rol !== 'ADMIN') {
      return reply.status(403).send({ error: 'Solo administradores pueden eliminar pedidos permanentemente' })
    }

    try {
      const pedido = await prisma.pedido.findUnique({
        where: { id },
        include: {
          lineas: {
            include: {
              asignaciones: true
            }
          },
          pagos: true,
          creditos: true
        }
      })

      if (!pedido) {
        return reply.status(404).send({ error: 'Pedido no encontrado' })
      }

      // Advertir si tiene pagos registrados
      if (pedido.pagos.length > 0 || pedido.creditos.length > 0) {
        const { confirmar } = request.query as { confirmar?: string }
        if (confirmar !== 'true') {
          return reply.status(400).send({
            error: 'Este pedido tiene pagos o créditos asociados',
            pagos: pedido.pagos.length,
            creditos: pedido.creditos.length,
            mensaje: 'Envía confirmar=true para eliminar de todos modos'
          })
        }
      }

      // Liberar tarimas reservadas
      for (const linea of pedido.lineas) {
        for (const asignacion of linea.asignaciones) {
          if (asignacion.estado === 'ABIERTA') {
            await prisma.tarima.update({
              where: { id: asignacion.tarimaId },
              data: { estado: 'ACTIVA' }
            })
          }
        }
      }

      // Eliminar en orden correcto por las relaciones
      // 1. Eliminar eventos de tarima relacionados
      await prisma.eventoTarima.deleteMany({
        where: { pedidoId: id }
      })

      // 2. Eliminar asignaciones
      await prisma.asignacionPick.deleteMany({
        where: { pedidoLinea: { pedidoId: id } }
      })

      // 3. Eliminar abonos de créditos
      for (const credito of pedido.creditos) {
        await prisma.abono.deleteMany({
          where: { creditoId: credito.id }
        })
      }

      // 4. Eliminar créditos
      await prisma.credito.deleteMany({
        where: { pedidoId: id }
      })

      // 5. Eliminar pagos
      await prisma.pago.deleteMany({
        where: { pedidoId: id }
      })

      // 6. Eliminar líneas del pedido
      await prisma.pedidoLinea.deleteMany({
        where: { pedidoId: id }
      })

      // 7. Finalmente eliminar el pedido
      await prisma.pedido.delete({
        where: { id }
      })

      return { mensaje: 'Pedido eliminado permanentemente', numeroPedido: pedido.numeroPedido }
    } catch (error: any) {
      console.error('Error al eliminar pedido:', error)
      return reply.status(500).send({
        error: 'Error al eliminar el pedido',
        detalle: error.message
      })
    }
  })
}

// Función auxiliar
async function calcularInventarioDisponible(tarimaId: string): Promise<number> {
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

  // Restar asignaciones pendientes
  const asignacionesPendientes = await prisma.asignacionPick.aggregate({
    where: {
      tarimaId,
      estado: 'ABIERTA'
    },
    _sum: { cantidadAsignada: true }
  })

  return Math.max(0, inventario - (asignacionesPendientes._sum.cantidadAsignada || 0))
}
