import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../app.js'

const crearProveedorSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(2),
  contacto: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional().nullable(),
  rfc: z.string().optional(),
  direccion: z.string().optional(),
  notas: z.string().optional()
})

const actualizarProveedorSchema = crearProveedorSchema.partial()

export async function proveedoresRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /proveedores - Listar proveedores
  app.get('/', async (request) => {
    const { search, activo, page = '1', limit = '50' } = request.query as any

    const where: any = {}

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
        { contacto: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (activo !== undefined) {
      where.activo = activo === 'true'
    } else {
      where.activo = true // Por defecto solo activos
    }

    const [proveedores, total] = await Promise.all([
      prisma.proveedor.findMany({
        where,
        include: {
          _count: {
            select: {
              tarimas: true,
              productosProveedor: true
            }
          }
        },
        orderBy: { nombre: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.proveedor.count({ where })
    ])

    return {
      data: proveedores,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }
  })

  // GET /proveedores/:id - Obtener proveedor por ID
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const proveedor = await prisma.proveedor.findUnique({
      where: { id },
      include: {
        productosProveedor: {
          include: { producto: true },
          where: { activo: true }
        },
        _count: {
          select: { tarimas: true }
        }
      }
    })

    if (!proveedor) {
      return reply.status(404).send({ error: 'Proveedor no encontrado' })
    }

    return proveedor
  })

  // POST /proveedores - Crear proveedor
  app.post('/', async (request, reply) => {
    try {
      const body = crearProveedorSchema.parse(request.body)

      // Verificar código único
      const existente = await prisma.proveedor.findUnique({
        where: { codigo: body.codigo }
      })

      if (existente) {
        return reply.status(400).send({ error: 'Ya existe un proveedor con ese código' })
      }

      const proveedor = await prisma.proveedor.create({
        data: body
      })

      return reply.status(201).send(proveedor)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // PATCH /proveedores/:id - Actualizar proveedor
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    try {
      const body = actualizarProveedorSchema.parse(request.body)

      // Si se actualiza código, verificar que no exista
      if (body.codigo) {
        const existente = await prisma.proveedor.findFirst({
          where: {
            codigo: body.codigo,
            NOT: { id }
          }
        })

        if (existente) {
          return reply.status(400).send({ error: 'Ya existe otro proveedor con ese código' })
        }
      }

      const proveedor = await prisma.proveedor.update({
        where: { id },
        data: body
      })

      return proveedor
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // DELETE /proveedores/:id - Desactivar proveedor
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    // Verificar si tiene tarimas activas
    const tarimasActivas = await prisma.tarima.count({
      where: {
        proveedorId: id,
        estado: { in: ['ACTIVA', 'RESERVADA'] }
      }
    })

    if (tarimasActivas > 0) {
      return reply.status(400).send({
        error: 'No se puede eliminar el proveedor porque tiene tarimas activas',
        tarimasActivas
      })
    }

    await prisma.proveedor.update({
      where: { id },
      data: { activo: false }
    })

    return { success: true }
  })

  // GET /proveedores/:id/productos - Listar productos del proveedor
  app.get('/:id/productos', async (request, reply) => {
    const { id } = request.params as { id: string }

    const productos = await prisma.productoProveedor.findMany({
      where: {
        proveedorId: id,
        activo: true
      },
      include: {
        producto: true
      },
      orderBy: {
        producto: { nombre: 'asc' }
      }
    })

    return productos
  })
}
