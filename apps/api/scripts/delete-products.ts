import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteAllProducts() {
  console.log('🗑️  Eliminando todos los productos...\n')

  try {
    // 1. Eliminar eventos de tarima (referencias a tarimas que serán eliminadas)
    const eventos = await prisma.eventoTarima.deleteMany({})
    console.log(`   ✓ ${eventos.count} eventos de tarima eliminados`)

    // 2. Eliminar asignaciones de pick
    const asignaciones = await prisma.asignacionPick.deleteMany({})
    console.log(`   ✓ ${asignaciones.count} asignaciones eliminadas`)

    // 3. Eliminar abonos
    const abonos = await prisma.abono.deleteMany({})
    console.log(`   ✓ ${abonos.count} abonos eliminados`)

    // 4. Eliminar créditos
    const creditos = await prisma.credito.deleteMany({})
    console.log(`   ✓ ${creditos.count} créditos eliminados`)

    // 5. Eliminar pagos
    const pagos = await prisma.pago.deleteMany({})
    console.log(`   ✓ ${pagos.count} pagos eliminados`)

    // 6. Eliminar líneas de pedido
    const lineas = await prisma.pedidoLinea.deleteMany({})
    console.log(`   ✓ ${lineas.count} líneas de pedido eliminadas`)

    // 7. Eliminar pedidos
    const pedidos = await prisma.pedido.deleteMany({})
    console.log(`   ✓ ${pedidos.count} pedidos eliminados`)

    // 8. Eliminar tarimas
    const tarimas = await prisma.tarima.deleteMany({})
    console.log(`   ✓ ${tarimas.count} tarimas eliminadas`)

    // 9. Eliminar relaciones producto-proveedor
    const prodProv = await prisma.productoProveedor.deleteMany({})
    console.log(`   ✓ ${prodProv.count} relaciones producto-proveedor eliminadas`)

    // 10. Finalmente eliminar productos
    const productos = await prisma.producto.deleteMany({})
    console.log(`   ✓ ${productos.count} productos eliminados`)

    console.log('\n✅ Todos los productos y datos relacionados han sido eliminados.')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

deleteAllProducts()
