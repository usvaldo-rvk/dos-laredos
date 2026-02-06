import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { prisma } from '../../app.js'

const crearUsuarioSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  pin: z.string().length(4).optional(),
  rol: z.enum(['OPERARIO', 'SUPERVISOR', 'ADMIN']),
  almacenesIds: z.array(z.string()).min(1)
})

const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  pin: z.string().length(4).optional(),
  rol: z.enum(['OPERARIO', 'SUPERVISOR', 'ADMIN']).optional(),
  almacenesIds: z.array(z.string()).optional(),
  activo: z.boolean().optional()
})

export async function usuariosRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /usuarios
  app.get('/', async (request) => {
    const user = request.user as any

    // Solo admin puede ver todos los usuarios
    if (user.rol !== 'ADMIN') {
      return { error: 'No autorizado' }
    }

    const usuarios = await prisma.usuario.findMany({
      include: {
        almacenes: {
          include: { almacen: true }
        }
      },
      orderBy: { nombre: 'asc' }
    })

    return usuarios.map(u => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      tienePin: !!u.pinHash,
      almacenes: u.almacenes.map(ua => ({
        id: ua.almacen.id,
        codigo: ua.almacen.codigo,
        nombre: ua.almacen.nombre
      })),
      createdAt: u.createdAt
    }))
  })

  // GET /usuarios/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        almacenes: {
          include: { almacen: true }
        }
      }
    })

    if (!usuario) {
      return reply.status(404).send({ error: 'Usuario no encontrado' })
    }

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      activo: usuario.activo,
      tienePin: !!usuario.pinHash,
      almacenes: usuario.almacenes.map(ua => ({
        id: ua.almacen.id,
        codigo: ua.almacen.codigo,
        nombre: ua.almacen.nombre
      })),
      createdAt: usuario.createdAt
    }
  })

  // POST /usuarios
  app.post('/', async (request, reply) => {
    const user = request.user as any
    if (user.rol !== 'ADMIN') {
      return reply.status(403).send({ error: 'Solo administradores pueden crear usuarios' })
    }

    try {
      const body = crearUsuarioSchema.parse(request.body)

      const passwordHash = await bcrypt.hash(body.password, 10)
      const pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : null

      const usuario = await prisma.usuario.create({
        data: {
          nombre: body.nombre,
          email: body.email,
          passwordHash,
          pinHash,
          rol: body.rol,
          almacenes: {
            create: body.almacenesIds.map(almacenId => ({ almacenId }))
          }
        },
        include: {
          almacenes: {
            include: { almacen: true }
          }
        }
      })

      return reply.status(201).send({
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        almacenes: usuario.almacenes.map(ua => ({
          id: ua.almacen.id,
          codigo: ua.almacen.codigo,
          nombre: ua.almacen.nombre
        }))
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // PATCH /usuarios/:id
  app.patch('/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as { id: string }

    // Solo admin o el propio usuario pueden editar
    if (user.rol !== 'ADMIN' && user.id !== id) {
      return reply.status(403).send({ error: 'No autorizado' })
    }

    try {
      const body = actualizarUsuarioSchema.parse(request.body)

      const data: any = {}
      if (body.nombre) data.nombre = body.nombre
      if (body.email) data.email = body.email
      if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10)
      if (body.pin) data.pinHash = await bcrypt.hash(body.pin, 10)
      if (body.rol && user.rol === 'ADMIN') data.rol = body.rol
      if (typeof body.activo === 'boolean' && user.rol === 'ADMIN') data.activo = body.activo

      const usuario = await prisma.usuario.update({
        where: { id },
        data,
        include: {
          almacenes: {
            include: { almacen: true }
          }
        }
      })

      // Actualizar almacenes si se proporcionaron
      if (body.almacenesIds && user.rol === 'ADMIN') {
        await prisma.usuarioAlmacen.deleteMany({ where: { usuarioId: id } })
        await prisma.usuarioAlmacen.createMany({
          data: body.almacenesIds.map(almacenId => ({ usuarioId: id, almacenId }))
        })
      }

      return {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        activo: usuario.activo
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })
}
