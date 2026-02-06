import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Importar rutas
import { authRoutes } from './modules/auth/auth.routes.js'
import { usuariosRoutes } from './modules/usuarios/usuarios.routes.js'
import { almacenesRoutes } from './modules/almacenes/almacenes.routes.js'
import { productosRoutes } from './modules/productos/productos.routes.js'
import { proveedoresRoutes } from './modules/proveedores/proveedores.routes.js'
import { clientesRoutes } from './modules/clientes/clientes.routes.js'
import { tarimasRoutes } from './modules/tarimas/tarimas.routes.js'
import { eventosRoutes } from './modules/eventos/eventos.routes.js'
import { pedidosRoutes } from './modules/pedidos/pedidos.routes.js'
import { pickingRoutes } from './modules/picking/picking.routes.js'
import { reportesRoutes } from './modules/reportes/reportes.routes.js'
import { notificacionesRoutes } from './modules/notificaciones/notificaciones.routes.js'
import { tvRoutes } from './modules/tv/tv.routes.js'
import { pagosRoutes } from './modules/pagos/pagos.routes.js'
import { creditosRoutes } from './modules/creditos/creditos.routes.js'
import { comprobantesRoutes } from './modules/comprobantes/comprobantes.routes.js'

// Inicializar Prisma
export const prisma = new PrismaClient()

// Crear servidor Fastify
const app = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname'
      }
    }
  }
})

// Registrar plugins
await app.register(cors, {
  origin: true,
  credentials: true
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET || 'desarrollo-secret-cambiar'
})

// Registrar multipart para subir archivos
await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  }
})

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, '..', 'uploads', 'comprobantes')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Servir archivos estáticos de uploads
await app.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'uploads'),
  prefix: '/uploads/',
  decorateReply: false
})

// Decorador para verificar JWT
app.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'No autorizado' })
  }
})

// Ruta de salud
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

// Registrar rutas
app.register(authRoutes, { prefix: '/auth' })
app.register(usuariosRoutes, { prefix: '/usuarios' })
app.register(almacenesRoutes, { prefix: '/almacenes' })
app.register(productosRoutes, { prefix: '/productos' })
app.register(proveedoresRoutes, { prefix: '/proveedores' })
app.register(clientesRoutes, { prefix: '/clientes' })
app.register(tarimasRoutes, { prefix: '/tarimas' })
app.register(eventosRoutes, { prefix: '/eventos' })
app.register(pedidosRoutes, { prefix: '/pedidos' })
app.register(pickingRoutes, { prefix: '/picking' })
app.register(reportesRoutes, { prefix: '/reportes' })
app.register(notificacionesRoutes, { prefix: '/notificaciones' })
app.register(tvRoutes, { prefix: '/tv' })
app.register(pagosRoutes, { prefix: '/pagos' })
app.register(creditosRoutes, { prefix: '/creditos' })
app.register(comprobantesRoutes, { prefix: '/comprobantes' })

// Iniciar servidor
const start = async () => {
  try {
    const port = parseInt(process.env.API_PORT || '3000')
    const host = process.env.API_HOST || '0.0.0.0'

    await app.listen({ port, host })
    console.log(`
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║     DOS LAREDOS - API Server                              ║
    ║     Servidor iniciado en http://${host}:${port}             ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
    `)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// Manejo de cierre
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  await app.close()
  process.exit(0)
})

start()
