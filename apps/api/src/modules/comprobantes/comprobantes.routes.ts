import { FastifyInstance } from 'fastify'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function comprobantesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // POST /comprobantes/upload - Subir un comprobante
  app.post('/upload', async (request, reply) => {
    try {
      const data = await request.file()

      if (!data) {
        return reply.status(400).send({ error: 'No se envió ningún archivo' })
      }

      // Validar tipo de archivo (solo imágenes)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'Tipo de archivo no permitido. Solo se permiten imágenes (jpg, png, gif, webp)'
        })
      }

      // Generar nombre único para el archivo
      const ext = path.extname(data.filename) || '.jpg'
      const uniqueName = `${randomUUID()}${ext}`
      const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'comprobantes')
      const filePath = path.join(uploadsDir, uniqueName)

      // Guardar archivo
      await pipeline(data.file, createWriteStream(filePath))

      // Retornar URL del archivo
      const fileUrl = `/uploads/comprobantes/${uniqueName}`

      return {
        success: true,
        url: fileUrl,
        filename: uniqueName,
        originalName: data.filename,
        mimetype: data.mimetype
      }
    } catch (error: any) {
      app.log.error(error)
      return reply.status(500).send({ error: 'Error al subir el archivo' })
    }
  })

  // GET /comprobantes/info/:filename - Obtener info de un comprobante
  app.get('/info/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string }

    // Verificar que el archivo existe
    const uploadsDir = path.join(__dirname, '..', '..', '..', 'uploads', 'comprobantes')
    const filePath = path.join(uploadsDir, filename)

    try {
      const fs = await import('fs/promises')
      const stats = await fs.stat(filePath)

      return {
        filename,
        url: `/uploads/comprobantes/${filename}`,
        size: stats.size,
        createdAt: stats.birthtime
      }
    } catch {
      return reply.status(404).send({ error: 'Archivo no encontrado' })
    }
  })
}
