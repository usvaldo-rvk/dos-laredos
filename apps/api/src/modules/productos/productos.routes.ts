import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../app.js'

const crearProductoSchema = z.object({
  sku: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  presentacion: z.string().min(1),
  unidadMedida: z.string().min(1),
  tipoEnvase: z.enum(['LATA', 'BOTELLA', 'OTRO']).optional().nullable(),
  capacidadMl: z.number().int().positive().optional().nullable(),
  unidadesPorCarton: z.number().int().positive().optional().nullable(),
  esRetornable: z.boolean().default(false),
  precioPublico: z.number().positive().optional().nullable()
})

const actualizarProductoSchema = crearProductoSchema.partial()

const agregarProveedorSchema = z.object({
  proveedorId: z.string(),
  precioCompra: z.number().positive(),
  valorDeposito: z.number().positive().optional().nullable()
})

export async function productosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /productos - Listar productos
  app.get('/', async (request) => {
    const { search, activo, esRetornable, page = '1', limit = '50' } = request.query as any

    const where: any = {}

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Por defecto solo mostrar productos activos, a menos que se pida explícitamente ver inactivos
    if (activo === 'false') {
      where.activo = false
    } else if (activo === 'all') {
      // No filtrar por activo - mostrar todos
    } else {
      // Por defecto: solo activos
      where.activo = true
    }

    if (esRetornable !== undefined) {
      where.esRetornable = esRetornable === 'true'
    }

    const [productos, total] = await Promise.all([
      prisma.producto.findMany({
        where,
        include: {
          productosProveedor: {
            include: { proveedor: true },
            where: { activo: true }
          },
          _count: {
            select: { tarimas: true }
          }
        },
        orderBy: { nombre: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.producto.count({ where })
    ])

    return {
      data: productos,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  })

  // GET /productos/:id - Obtener producto por ID
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const producto = await prisma.producto.findUnique({
      where: { id },
      include: {
        productosProveedor: {
          where: { activo: true },
          include: { proveedor: true }
        }
      }
    })

    if (!producto) {
      return reply.status(404).send({ error: 'Producto no encontrado' })
    }

    return producto
  })

  // POST /productos - Crear producto
  app.post('/', async (request, reply) => {
    try {
      const body = crearProductoSchema.parse(request.body)

      // Verificar SKU único
      const existente = await prisma.producto.findUnique({
        where: { sku: body.sku }
      })

      if (existente) {
        return reply.status(400).send({ error: 'Ya existe un producto con ese SKU' })
      }

      const producto = await prisma.producto.create({
        data: body as any,
        include: {
          productosProveedor: {
            include: { proveedor: true }
          }
        }
      })

      return reply.status(201).send(producto)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // PATCH /productos/:id - Actualizar producto
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const body = actualizarProductoSchema.parse(request.body)

      // Si se actualiza SKU, verificar que no exista
      if (body.sku) {
        const existente = await prisma.producto.findFirst({
          where: {
            sku: body.sku,
            NOT: { id }
          }
        })

        if (existente) {
          return reply.status(400).send({ error: 'Ya existe otro producto con ese SKU' })
        }
      }

      const producto = await prisma.producto.update({
        where: { id },
        data: body as any,
        include: {
          productosProveedor: {
            include: { proveedor: true }
          }
        }
      })

      return producto
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // DELETE /productos/:id - Desactivar producto
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    // Verificar si tiene tarimas activas
    const tarimasActivas = await prisma.tarima.count({
      where: {
        productoId: id,
        estado: { in: ['ACTIVA', 'RESERVADA'] }
      }
    })

    if (tarimasActivas > 0) {
      return reply.status(400).send({
        error: 'No se puede eliminar el producto porque tiene tarimas activas',
        tarimasActivas
      })
    }

    await prisma.producto.update({
      where: { id },
      data: { activo: false }
    })

    return { success: true }
  })

  // GET /productos/:id/inventario - Obtener inventario del producto
  app.get('/:id/inventario', async (request) => {
    const { id } = request.params as { id: string }
    const { almacenId } = request.query as any

    const where: any = {
      productoId: id,
      estado: { in: ['ACTIVA', 'RESERVADA'] }
    }
    if (almacenId) where.almacenId = almacenId

    const tarimas = await prisma.tarima.findMany({
      where,
      include: { almacen: true }
    })

    const inventarioPorAlmacen: Record<string, number> = {}

    for (const tarima of tarimas) {
      const eventos = await prisma.eventoTarima.findMany({
        where: { tarimaId: tarima.id },
        select: { tipo: true, cantidad: true }
      })

      let inv = 0
      for (const e of eventos) {
        if (e.tipo === 'RECEPCION') inv += e.cantidad || 0
        if (e.tipo === 'PICK' || e.tipo === 'MERMA') inv -= e.cantidad || 0
        if (e.tipo === 'AJUSTE') inv += e.cantidad || 0
      }

      const key = tarima.almacen.codigo
      inventarioPorAlmacen[key] = (inventarioPorAlmacen[key] || 0) + Math.max(0, inv)
    }

    return {
      productoId: id,
      inventarioPorAlmacen,
      total: Object.values(inventarioPorAlmacen).reduce((a, b) => a + b, 0)
    }
  })

  // POST /productos/:id/proveedores - Agregar/actualizar proveedor al producto
  app.post('/:id/proveedores', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const body = agregarProveedorSchema.parse(request.body)

      const relacion = await prisma.productoProveedor.upsert({
        where: {
          productoId_proveedorId: {
            productoId: id,
            proveedorId: body.proveedorId
          }
        },
        update: {
          precioCompra: body.precioCompra,
          valorDeposito: body.valorDeposito,
          activo: true
        },
        create: {
          productoId: id,
          proveedorId: body.proveedorId,
          precioCompra: body.precioCompra,
          valorDeposito: body.valorDeposito
        },
        include: {
          proveedor: true,
          producto: true
        }
      })

      return reply.status(201).send(relacion)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // DELETE /productos/:id/proveedores/:proveedorId - Quitar proveedor del producto
  app.delete('/:id/proveedores/:proveedorId', async (request, reply) => {
    const { id, proveedorId } = request.params as { id: string; proveedorId: string }

    await prisma.productoProveedor.update({
      where: {
        productoId_proveedorId: {
          productoId: id,
          proveedorId
        }
      },
      data: { activo: false }
    })

    return { success: true }
  })
}
