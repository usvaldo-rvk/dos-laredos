import { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { prisma } from '../../app.js'
import crypto from 'crypto'

// Schemas de validación
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres')
})

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido')
})

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6, 'Contraseña debe tener al menos 6 caracteres')
})

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/login
  app.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body)

      // Buscar usuario
      const usuario = await prisma.usuario.findUnique({
        where: { email: body.email },
        include: {
          almacenes: {
            include: { almacen: true }
          }
        }
      })

      if (!usuario || !usuario.activo) {
        return reply.status(401).send({ error: 'Credenciales inválidas' })
      }

      // Verificar contraseña
      const validPassword = await bcrypt.compare(body.password, usuario.passwordHash)
      if (!validPassword) {
        return reply.status(401).send({ error: 'Credenciales inválidas' })
      }

      // Generar JWT
      const token = app.jwt.sign({
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        almacenes: usuario.almacenes.map(ua => ({
          id: ua.almacen.id,
          codigo: ua.almacen.codigo,
          nombre: ua.almacen.nombre
        }))
      })

      return {
        token,
        usuario: {
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre,
          rol: usuario.rol,
          almacenes: usuario.almacenes.map(ua => ({
            id: ua.almacen.id,
            codigo: ua.almacen.codigo,
            nombre: ua.almacen.nombre
          }))
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // POST /auth/forgot-password
  app.post('/forgot-password', async (request, reply) => {
    try {
      const body = forgotPasswordSchema.parse(request.body)

      const usuario = await prisma.usuario.findUnique({
        where: { email: body.email }
      })

      // Siempre responder OK para no revelar si el email existe
      if (!usuario) {
        return { message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña' }
      }

      // Generar token
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = await bcrypt.hash(token, 10)

      // Guardar token (expira en 1 hora)
      await prisma.passwordResetToken.create({
        data: {
          usuarioId: usuario.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000)
        }
      })

      // TODO: Enviar email con el token
      // En desarrollo, lo mostramos en consola
      console.log(`Token de recuperación para ${body.email}: ${token}`)

      return { message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña' }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // POST /auth/reset-password
  app.post('/reset-password', async (request, reply) => {
    try {
      const body = resetPasswordSchema.parse(request.body)

      // Buscar tokens válidos (no usados y no expirados)
      const tokens = await prisma.passwordResetToken.findMany({
        where: {
          usedAt: null,
          expiresAt: { gt: new Date() }
        },
        include: { usuario: true }
      })

      // Verificar el token
      let validToken = null
      for (const t of tokens) {
        const isValid = await bcrypt.compare(body.token, t.tokenHash)
        if (isValid) {
          validToken = t
          break
        }
      }

      if (!validToken) {
        return reply.status(400).send({ error: 'Token inválido o expirado' })
      }

      // Actualizar contraseña
      const passwordHash = await bcrypt.hash(body.password, 10)
      await prisma.usuario.update({
        where: { id: validToken.usuarioId },
        data: { passwordHash }
      })

      // Marcar token como usado
      await prisma.passwordResetToken.update({
        where: { id: validToken.id },
        data: { usedAt: new Date() }
      })

      return { message: 'Contraseña actualizada correctamente' }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors })
      }
      throw error
    }
  })

  // GET /auth/me - Obtener usuario actual
  app.get('/me', {
    preHandler: [app.authenticate]
  }, async (request) => {
    const user = request.user as any

    const usuario = await prisma.usuario.findUnique({
      where: { id: user.id },
      include: {
        almacenes: {
          include: { almacen: true }
        }
      }
    })

    if (!usuario) {
      throw new Error('Usuario no encontrado')
    }

    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      almacenes: usuario.almacenes.map(ua => ({
        id: ua.almacen.id,
        codigo: ua.almacen.codigo,
        nombre: ua.almacen.nombre
      }))
    }
  })

  // POST /auth/verify-pin - Verificar PIN de supervisor/admin
  app.post('/verify-pin', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { pin } = request.body as { pin: string }

    if (!pin || pin.length < 4) {
      return reply.status(400).send({ error: 'PIN inválido' })
    }

    // Buscar todos los admins y supervisores que tengan PIN configurado
    const usuariosConPin = await prisma.usuario.findMany({
      where: {
        rol: { in: ['ADMIN', 'SUPERVISOR'] },
        pinHash: { not: null },
        activo: true
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        pinHash: true
      }
    })

    if (usuariosConPin.length === 0) {
      return reply.status(400).send({ error: 'No hay supervisores con PIN configurado' })
    }

    // Intentar verificar el PIN contra cada usuario
    for (const usuario of usuariosConPin) {
      const validPin = await bcrypt.compare(pin, usuario.pinHash!)
      if (validPin) {
        return { valid: true, supervisor: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } }
      }
    }

    return reply.status(401).send({ error: 'PIN incorrecto' })
  })

  // POST /auth/set-pin - Configurar PIN del usuario
  app.post('/set-pin', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { pin, currentPassword } = request.body as { pin: string; currentPassword: string }
    const user = request.user as any

    // Solo supervisores y admins pueden tener PIN
    if (user.rol === 'OPERARIO') {
      return reply.status(403).send({ error: 'Solo supervisores y administradores pueden configurar PIN' })
    }

    // Validar PIN (4-6 dígitos)
    if (!/^\d{4,6}$/.test(pin)) {
      return reply.status(400).send({ error: 'El PIN debe ser de 4 a 6 dígitos numéricos' })
    }

    // Verificar contraseña actual
    const usuario = await prisma.usuario.findUnique({
      where: { id: user.id }
    })

    if (!usuario) {
      return reply.status(404).send({ error: 'Usuario no encontrado' })
    }

    const validPassword = await bcrypt.compare(currentPassword, usuario.passwordHash)
    if (!validPassword) {
      return reply.status(401).send({ error: 'Contraseña incorrecta' })
    }

    // Guardar PIN hasheado
    const pinHash = await bcrypt.hash(pin, 10)
    await prisma.usuario.update({
      where: { id: user.id },
      data: { pinHash }
    })

    return { message: 'PIN configurado correctamente' }
  })

  // DELETE /auth/pin - Eliminar PIN del usuario
  app.delete('/pin', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { currentPassword } = request.body as { currentPassword: string }
    const user = request.user as any

    const usuario = await prisma.usuario.findUnique({
      where: { id: user.id }
    })

    if (!usuario) {
      return reply.status(404).send({ error: 'Usuario no encontrado' })
    }

    const validPassword = await bcrypt.compare(currentPassword, usuario.passwordHash)
    if (!validPassword) {
      return reply.status(401).send({ error: 'Contraseña incorrecta' })
    }

    await prisma.usuario.update({
      where: { id: user.id },
      data: { pinHash: null }
    })

    return { message: 'PIN eliminado correctamente' }
  })

  // GET /auth/has-pin - Verificar si el usuario tiene PIN configurado
  app.get('/has-pin', {
    preHandler: [app.authenticate]
  }, async (request) => {
    const user = request.user as any

    const usuario = await prisma.usuario.findUnique({
      where: { id: user.id },
      select: { pinHash: true, rol: true }
    })

    return {
      hasPin: !!usuario?.pinHash,
      canHavePin: usuario?.rol !== 'OPERARIO'
    }
  })
}
