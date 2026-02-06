import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed de DOS LAREDOS...')

  // Crear almacenes
  const almacenLP = await prisma.almacen.upsert({
    where: { codigo: 'LP' },
    update: {},
    create: {
      codigo: 'LP',
      nombre: 'Laredo Poniente',
      direccion: 'Dirección Laredo Poniente'
    }
  })

  const almacenLM = await prisma.almacen.upsert({
    where: { codigo: 'LM' },
    update: {},
    create: {
      codigo: 'LM',
      nombre: 'Laredo México',
      direccion: 'Dirección Laredo México'
    }
  })

  console.log('Almacenes creados:', almacenLP.nombre, almacenLM.nombre)

  // Crear ubicaciones simples para cada almacén (A, B, C, D, E)
  const ubicaciones = [
    { codigo: 'A', tipo: 'FILA' as const, descripcion: 'Fila A' },
    { codigo: 'B', tipo: 'FILA' as const, descripcion: 'Fila B' },
    { codigo: 'C', tipo: 'FILA' as const, descripcion: 'Fila C' },
    { codigo: 'D', tipo: 'FILA' as const, descripcion: 'Fila D' },
    { codigo: 'E', tipo: 'FILA' as const, descripcion: 'Fila E' }
  ]

  for (const ub of ubicaciones) {
    await prisma.ubicacion.upsert({
      where: { almacenId_codigo: { almacenId: almacenLP.id, codigo: ub.codigo } },
      update: {},
      create: { almacenId: almacenLP.id, ...ub }
    })
    await prisma.ubicacion.upsert({
      where: { almacenId_codigo: { almacenId: almacenLM.id, codigo: ub.codigo } },
      update: {},
      create: { almacenId: almacenLM.id, ...ub }
    })
  }

  console.log('Ubicaciones creadas: A, B, C, D, E')

  // Crear tipos de notificación
  const tiposNotificacion = [
    { codigo: 'STOCK_CERO', nombre: 'Stock en ceros', descripcion: 'Cuando un producto llega a cero unidades' },
    { codigo: 'STOCK_BAJO', nombre: 'Stock bajo', descripcion: 'Cuando un producto baja del umbral mínimo' },
    { codigo: 'PRODUCTO_DISPONIBLE', nombre: 'Producto disponible', descripcion: 'Cuando un producto vuelve a tener stock' },
    { codigo: 'PEDIDO_ASIGNADO', nombre: 'Pedido asignado', descripcion: 'Cuando se asigna un nuevo pedido para picking' },
    { codigo: 'PEDIDO_PENDIENTE', nombre: 'Pedido pendiente', descripcion: 'Cuando un pedido lleva mucho tiempo pendiente' },
    { codigo: 'MERMA_REGISTRADA', nombre: 'Merma registrada', descripcion: 'Cuando se registra una merma' },
    { codigo: 'CONFLICTO_SYNC', nombre: 'Conflicto de sincronización', descripcion: 'Cuando hay un conflicto al sincronizar' }
  ]

  for (const tipo of tiposNotificacion) {
    await prisma.tipoNotificacion.upsert({
      where: { codigo: tipo.codigo },
      update: {},
      create: tipo
    })
  }

  console.log('Tipos de notificación creados')

  // =============================================
  // PROVEEDORES
  // =============================================
  const proveedorModelo = await prisma.proveedor.upsert({
    where: { codigo: 'GRUPO-MODELO' },
    update: {},
    create: {
      codigo: 'GRUPO-MODELO',
      nombre: 'Grupo Modelo',
      contacto: 'Juan Pérez',
      telefono: '956-123-4567',
      email: 'ventas@grupomodelo.com',
      direccion: 'Av. Principal 123, Nuevo Laredo'
    }
  })

  const proveedorHeineken = await prisma.proveedor.upsert({
    where: { codigo: 'HEINEKEN-MX' },
    update: {},
    create: {
      codigo: 'HEINEKEN-MX',
      nombre: 'Heineken México',
      contacto: 'María García',
      telefono: '956-987-6543',
      email: 'distribucion@heineken.mx',
      direccion: 'Blvd. Industrial 456, Nuevo Laredo'
    }
  })

  console.log('Proveedores creados: Grupo Modelo, Heineken México')

  // =============================================
  // PRODUCTOS - CERVEZAS
  // =============================================

  // Definición de productos con estructura clara
  const productos = [
    // ========== CORONA ==========
    { sku: 'COR-EXTRA-CUARTITO', nombre: 'Corona Extra Cuartito', presentacion: 'Botella 210ml', tipoEnvase: 'BOTELLA', capacidadMl: 210, unidadesPorCarton: 24, esRetornable: true, precioPublico: 18 },
    { sku: 'COR-EXTRA-MEDIA', nombre: 'Corona Extra Media', presentacion: 'Botella 355ml', tipoEnvase: 'BOTELLA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: true, precioPublico: 22 },
    { sku: 'COR-EXTRA-LATA', nombre: 'Corona Extra Lata', presentacion: 'Lata 355ml', tipoEnvase: 'LATA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: false, precioPublico: 20 },
    { sku: 'COR-EXTRA-LATON', nombre: 'Corona Extra Latón', presentacion: 'Lata 473ml', tipoEnvase: 'LATA', capacidadMl: 473, unidadesPorCarton: 12, esRetornable: false, precioPublico: 28 },
    { sku: 'COR-EXTRA-CAGUAMA', nombre: 'Corona Extra Caguama', presentacion: 'Botella 940ml', tipoEnvase: 'BOTELLA', capacidadMl: 940, unidadesPorCarton: 12, esRetornable: true, precioPublico: 38 },
    { sku: 'COR-EXTRA-MEGA', nombre: 'Corona Extra Mega', presentacion: 'Botella 1.2L', tipoEnvase: 'BOTELLA', capacidadMl: 1200, unidadesPorCarton: 12, esRetornable: true, precioPublico: 45 },
    { sku: 'COR-LIGHT-MEDIA', nombre: 'Corona Light Media', presentacion: 'Botella 355ml', tipoEnvase: 'BOTELLA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: true, precioPublico: 22 },
    { sku: 'COR-LIGHT-LATA', nombre: 'Corona Light Lata', presentacion: 'Lata 355ml', tipoEnvase: 'LATA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: false, precioPublico: 20 },
    { sku: 'COR-LIGHT-LATON', nombre: 'Corona Light Latón', presentacion: 'Lata 473ml', tipoEnvase: 'LATA', capacidadMl: 473, unidadesPorCarton: 12, esRetornable: false, precioPublico: 28 },
    { sku: 'COR-LIGHT-MEGA', nombre: 'Corona Light Mega', presentacion: 'Botella 1.2L', tipoEnvase: 'BOTELLA', capacidadMl: 1200, unidadesPorCarton: 12, esRetornable: true, precioPublico: 45 },
    { sku: 'COR-CERO-LATA', nombre: 'Corona Cero Lata', presentacion: 'Lata 355ml', tipoEnvase: 'LATA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: false, precioPublico: 22 },

    // ========== VICTORIA ==========
    { sku: 'VIC-CUARTITO', nombre: 'Victoria Cuartito', presentacion: 'Botella 210ml', tipoEnvase: 'BOTELLA', capacidadMl: 210, unidadesPorCarton: 24, esRetornable: true, precioPublico: 16 },
    { sku: 'VIC-MEDIA', nombre: 'Victoria Media', presentacion: 'Botella 355ml', tipoEnvase: 'BOTELLA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: true, precioPublico: 20 },
    { sku: 'VIC-LATA', nombre: 'Victoria Lata', presentacion: 'Lata 355ml', tipoEnvase: 'LATA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: false, precioPublico: 18 },
    { sku: 'VIC-LATON', nombre: 'Victoria Latón', presentacion: 'Lata 473ml', tipoEnvase: 'LATA', capacidadMl: 473, unidadesPorCarton: 12, esRetornable: false, precioPublico: 25 },
    { sku: 'VIC-CAGUAMA', nombre: 'Victoria Caguama', presentacion: 'Botella 940ml', tipoEnvase: 'BOTELLA', capacidadMl: 940, unidadesPorCarton: 12, esRetornable: true, precioPublico: 35 },
    { sku: 'VIC-MEGA', nombre: 'Victoria Mega', presentacion: 'Botella 1.2L', tipoEnvase: 'BOTELLA', capacidadMl: 1200, unidadesPorCarton: 12, esRetornable: true, precioPublico: 42 },

    // ========== MODELO ==========
    { sku: 'MOD-ESP-VIDRIO', nombre: 'Modelo Especial Vidrio', presentacion: 'Botella 355ml', tipoEnvase: 'BOTELLA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: true, precioPublico: 24 },
    { sku: 'MOD-ESP-LATA', nombre: 'Modelo Especial Lata', presentacion: 'Lata 355ml', tipoEnvase: 'LATA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: false, precioPublico: 22 },
    { sku: 'MOD-ESP-LATON', nombre: 'Modelo Especial Latón', presentacion: 'Lata 473ml', tipoEnvase: 'LATA', capacidadMl: 473, unidadesPorCarton: 12, esRetornable: false, precioPublico: 30 },
    { sku: 'MOD-ESP-CAGUAMA', nombre: 'Modelo Especial Caguama', presentacion: 'Botella 940ml', tipoEnvase: 'BOTELLA', capacidadMl: 940, unidadesPorCarton: 12, esRetornable: true, precioPublico: 40 },
    { sku: 'MOD-NEGRA-VIDRIO', nombre: 'Negra Modelo Vidrio', presentacion: 'Botella 355ml', tipoEnvase: 'BOTELLA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: true, precioPublico: 26 },
    { sku: 'MOD-NEGRA-LATA', nombre: 'Negra Modelo Lata', presentacion: 'Lata 355ml', tipoEnvase: 'LATA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: false, precioPublico: 24 },
    { sku: 'MOD-AMBAR', nombre: 'Modelo Ámbar', presentacion: 'Botella 355ml', tipoEnvase: 'BOTELLA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: true, precioPublico: 28 },
    { sku: 'MOD-TRIGO', nombre: 'Modelo Trigo', presentacion: 'Botella 355ml', tipoEnvase: 'BOTELLA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: true, precioPublico: 28 },

    // ========== PACÍFICO ==========
    { sku: 'PAC-CLARA-CUARTITO', nombre: 'Pacífico Clara Cuartito', presentacion: 'Botella 210ml', tipoEnvase: 'BOTELLA', capacidadMl: 210, unidadesPorCarton: 24, esRetornable: true, precioPublico: 16 },
    { sku: 'PAC-CLARA-MEDIA', nombre: 'Pacífico Clara Media', presentacion: 'Botella 355ml', tipoEnvase: 'BOTELLA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: true, precioPublico: 20 },
    { sku: 'PAC-CLARA-LATA', nombre: 'Pacífico Clara Lata', presentacion: 'Lata 355ml', tipoEnvase: 'LATA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: false, precioPublico: 18 },
    { sku: 'PAC-CLARA-LATON', nombre: 'Pacífico Clara Latón', presentacion: 'Lata 473ml', tipoEnvase: 'LATA', capacidadMl: 473, unidadesPorCarton: 12, esRetornable: false, precioPublico: 25 },
    { sku: 'PAC-CLARA-BALLENA', nombre: 'Pacífico Clara Ballena', presentacion: 'Botella 940ml', tipoEnvase: 'BOTELLA', capacidadMl: 940, unidadesPorCarton: 12, esRetornable: true, precioPublico: 35 },
    { sku: 'PAC-SUAVE-LATON', nombre: 'Pacífico Suave Latón', presentacion: 'Lata 473ml', tipoEnvase: 'LATA', capacidadMl: 473, unidadesPorCarton: 12, esRetornable: false, precioPublico: 25 },

    // ========== MICHELOB ULTRA ==========
    { sku: 'MICH-ULTRA-VIDRIO', nombre: 'Michelob Ultra Vidrio', presentacion: 'Botella 355ml', tipoEnvase: 'BOTELLA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: true, precioPublico: 28 },
    { sku: 'MICH-ULTRA-SLIM', nombre: 'Michelob Ultra Slim', presentacion: 'Lata Slim 355ml', tipoEnvase: 'LATA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: false, precioPublico: 26 },
    { sku: 'MICH-ULTRA-LATON', nombre: 'Michelob Ultra Latón', presentacion: 'Lata 473ml', tipoEnvase: 'LATA', capacidadMl: 473, unidadesPorCarton: 12, esRetornable: false, precioPublico: 32 },
    { sku: 'MICH-ULTRA-MEGA', nombre: 'Michelob Ultra Mega', presentacion: 'Botella 1.2L', tipoEnvase: 'BOTELLA', capacidadMl: 1200, unidadesPorCarton: 12, esRetornable: true, precioPublico: 48 },

    // ========== STELLA ARTOIS ==========
    { sku: 'STELLA-BOTELLA', nombre: 'Stella Artois Botella', presentacion: 'Botella 330ml', tipoEnvase: 'BOTELLA', capacidadMl: 330, unidadesPorCarton: 24, esRetornable: true, precioPublico: 32 },
    { sku: 'STELLA-GRANDE', nombre: 'Stella Artois Grande', presentacion: 'Botella 650ml', tipoEnvase: 'BOTELLA', capacidadMl: 650, unidadesPorCarton: 12, esRetornable: true, precioPublico: 45 },

    // ========== BUD LIGHT ==========
    { sku: 'BUD-LIGHT-MEDIA', nombre: 'Bud Light Media', presentacion: 'Botella 355ml', tipoEnvase: 'BOTELLA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: true, precioPublico: 22 },
    { sku: 'BUD-LIGHT-LATA', nombre: 'Bud Light Lata', presentacion: 'Lata 355ml', tipoEnvase: 'LATA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: false, precioPublico: 20 },
    { sku: 'BUD-LIGHT-LATON', nombre: 'Bud Light Latón', presentacion: 'Lata 473ml', tipoEnvase: 'LATA', capacidadMl: 473, unidadesPorCarton: 12, esRetornable: false, precioPublico: 28 },

    // ========== BUDWEISER ==========
    { sku: 'BUD-BOTELLA', nombre: 'Budweiser Botella', presentacion: 'Botella 355ml', tipoEnvase: 'BOTELLA', capacidadMl: 355, unidadesPorCarton: 24, esRetornable: true, precioPublico: 24 },
    { sku: 'BUD-LATON', nombre: 'Budweiser Latón', presentacion: 'Lata 473ml', tipoEnvase: 'LATA', capacidadMl: 473, unidadesPorCarton: 12, esRetornable: false, precioPublico: 30 },
  ]

  console.log(`Creando ${productos.length} productos...`)

  for (const prod of productos) {
    await prisma.producto.upsert({
      where: { sku: prod.sku },
      update: {
        nombre: prod.nombre,
        presentacion: prod.presentacion,
        tipoEnvase: prod.tipoEnvase as any,
        capacidadMl: prod.capacidadMl,
        unidadesPorCarton: prod.unidadesPorCarton,
        esRetornable: prod.esRetornable,
        precioPublico: prod.precioPublico
      },
      create: {
        sku: prod.sku,
        nombre: prod.nombre,
        presentacion: prod.presentacion,
        unidadMedida: 'Cartón',
        tipoEnvase: prod.tipoEnvase as any,
        capacidadMl: prod.capacidadMl,
        unidadesPorCarton: prod.unidadesPorCarton,
        esRetornable: prod.esRetornable,
        precioPublico: prod.precioPublico
      }
    })
  }

  console.log(`${productos.length} productos creados`)

  // =============================================
  // CLIENTES DE EJEMPLO
  // =============================================
  await prisma.cliente.upsert({
    where: { id: 'cliente-tienda-ejemplo' },
    update: {},
    create: {
      id: 'cliente-tienda-ejemplo',
      tipo: 'EMPRESA',
      nombreEmpresa: 'Abarrotes Don Pedro',
      nombreContacto: 'Pedro Martínez',
      telefono: '956-111-2222',
      email: 'donpedro@email.com',
      direccionCalle: 'Av. Reforma',
      direccionNumero: '456',
      direccionColonia: 'Centro',
      direccionCiudad: 'Nuevo Laredo',
      direccionEstado: 'Tamaulipas',
      direccionCp: '88000'
    }
  })

  await prisma.cliente.upsert({
    where: { id: 'cliente-restaurant-ejemplo' },
    update: {},
    create: {
      id: 'cliente-restaurant-ejemplo',
      tipo: 'EMPRESA',
      nombreEmpresa: 'Restaurant La Frontera',
      nombreContacto: 'María López',
      telefono: '956-333-4444',
      email: 'lafrontera@email.com',
      direccionCalle: 'Blvd. Colosio',
      direccionNumero: '789',
      direccionColonia: 'Las Torres',
      direccionCiudad: 'Nuevo Laredo',
      direccionEstado: 'Tamaulipas',
      direccionCp: '88100'
    }
  })

  await prisma.cliente.upsert({
    where: { id: 'cliente-persona-ejemplo' },
    update: {},
    create: {
      id: 'cliente-persona-ejemplo',
      tipo: 'PERSONA',
      nombreContacto: 'Juan García',
      telefono: '956-555-6666',
      direccionCalle: 'Calle Hidalgo',
      direccionNumero: '123',
      direccionColonia: 'Guerrero',
      direccionCiudad: 'Nuevo Laredo',
      direccionEstado: 'Tamaulipas',
      direccionCp: '88200'
    }
  })

  console.log('Clientes de ejemplo creados: Abarrotes Don Pedro, Restaurant La Frontera, Juan García')

  // =============================================
  // USUARIOS
  // =============================================
  const passwordHash = await bcrypt.hash('admin123', 10)
  const pinHash = await bcrypt.hash('1234', 10)

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@doslaredos.com' },
    update: {},
    create: {
      nombre: 'Administrador',
      email: 'admin@doslaredos.com',
      passwordHash,
      pinHash,
      rol: 'ADMIN'
    }
  })

  // Asignar admin a ambos almacenes
  await prisma.usuarioAlmacen.upsert({
    where: { usuarioId_almacenId: { usuarioId: admin.id, almacenId: almacenLP.id } },
    update: {},
    create: { usuarioId: admin.id, almacenId: almacenLP.id }
  })
  await prisma.usuarioAlmacen.upsert({
    where: { usuarioId_almacenId: { usuarioId: admin.id, almacenId: almacenLM.id } },
    update: {},
    create: { usuarioId: admin.id, almacenId: almacenLM.id }
  })

  console.log('Usuario admin creado: admin@doslaredos.com / admin123 / PIN: 1234')

  // Crear supervisor de ejemplo
  const supervisorHash = await bcrypt.hash('super123', 10)
  const supervisorPinHash = await bcrypt.hash('5678', 10)

  const supervisor = await prisma.usuario.upsert({
    where: { email: 'supervisor@doslaredos.com' },
    update: {},
    create: {
      nombre: 'Supervisor LP',
      email: 'supervisor@doslaredos.com',
      passwordHash: supervisorHash,
      pinHash: supervisorPinHash,
      rol: 'SUPERVISOR'
    }
  })

  await prisma.usuarioAlmacen.upsert({
    where: { usuarioId_almacenId: { usuarioId: supervisor.id, almacenId: almacenLP.id } },
    update: {},
    create: { usuarioId: supervisor.id, almacenId: almacenLP.id }
  })

  console.log('Usuario supervisor creado: supervisor@doslaredos.com / super123 / PIN: 5678')

  // Crear operario de ejemplo
  const operarioHash = await bcrypt.hash('oper123', 10)

  const operario = await prisma.usuario.upsert({
    where: { email: 'operario@doslaredos.com' },
    update: {},
    create: {
      nombre: 'Operario 1',
      email: 'operario@doslaredos.com',
      passwordHash: operarioHash,
      rol: 'OPERARIO'
    }
  })

  await prisma.usuarioAlmacen.upsert({
    where: { usuarioId_almacenId: { usuarioId: operario.id, almacenId: almacenLP.id } },
    update: {},
    create: { usuarioId: operario.id, almacenId: almacenLP.id }
  })

  console.log('Usuario operario creado: operario@doslaredos.com / oper123')

  // Crear pantalla TV para cada almacén
  await prisma.pantallaTv.upsert({
    where: { token: 'tv-lp-principal' },
    update: {},
    create: {
      almacenId: almacenLP.id,
      token: 'tv-lp-principal',
      nombre: 'Pantalla Principal LP'
    }
  })

  await prisma.pantallaTv.upsert({
    where: { token: 'tv-lm-principal' },
    update: {},
    create: {
      almacenId: almacenLM.id,
      token: 'tv-lm-principal',
      nombre: 'Pantalla Principal LM'
    }
  })

  console.log('Pantallas TV creadas')
  console.log('')
  console.log('=========================================')
  console.log('SEED COMPLETADO')
  console.log('=========================================')
  console.log('')
  console.log('Almacenes:')
  console.log('  - Laredo Poniente (LP)')
  console.log('  - Laredo México (LM)')
  console.log('  - Ubicaciones: A, B, C, D, E')
  console.log('')
  console.log('Proveedores:')
  console.log('  - Grupo Modelo')
  console.log('  - Heineken México')
  console.log('')
  console.log(`Productos: ${productos.length} cervezas`)
  console.log('  - Corona (Extra, Light, Cero)')
  console.log('  - Victoria')
  console.log('  - Modelo (Especial, Negra, Ámbar, Trigo)')
  console.log('  - Pacífico (Clara, Suave)')
  console.log('  - Michelob Ultra')
  console.log('  - Stella Artois')
  console.log('  - Bud Light')
  console.log('  - Budweiser')
  console.log('')
  console.log('Clientes de ejemplo:')
  console.log('  - Abarrotes Don Pedro (Empresa)')
  console.log('  - Restaurant La Frontera (Empresa)')
  console.log('  - Juan García (Persona)')
  console.log('')
  console.log('Usuarios:')
  console.log('  Admin:      admin@doslaredos.com / admin123 / PIN: 1234')
  console.log('  Supervisor: supervisor@doslaredos.com / super123 / PIN: 5678')
  console.log('  Operario:   operario@doslaredos.com / oper123')
  console.log('')
  console.log('URLs de TV:')
  console.log('  LP: /tv/pedidos/tv-lp-principal')
  console.log('  LM: /tv/pedidos/tv-lm-principal')
  console.log('')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
