import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Iniciando reset de datos de ventas y actualización de precios...')

  try {
    // 1. Eliminar todos los pagos (se eliminan en cascada con invoices, pero por si acaso)
    console.log('Eliminando pagos...')
    const deletedPayments = await prisma.payment.deleteMany({})
    console.log(`✅ ${deletedPayments.count} pagos eliminados`)

    // 2. Eliminar todos los items de facturas
    console.log('Eliminando items de facturas...')
    const deletedInvoiceItems = await prisma.invoiceItem.deleteMany({})
    console.log(`✅ ${deletedInvoiceItems.count} items de facturas eliminados`)

    // 3. Eliminar todas las facturas
    console.log('Eliminando facturas...')
    const deletedInvoices = await prisma.invoice.deleteMany({})
    console.log(`✅ ${deletedInvoices.count} facturas eliminadas`)

    // 4. Eliminar todos los items de órdenes de venta
    console.log('Eliminando items de órdenes de venta...')
    const deletedSalesOrderItems = await prisma.salesOrderItem.deleteMany({})
    console.log(`✅ ${deletedSalesOrderItems.count} items de órdenes eliminados`)

    // 5. Eliminar todas las órdenes de venta
    console.log('Eliminando órdenes de venta...')
    const deletedSalesOrders = await prisma.salesOrder.deleteMany({})
    console.log(`✅ ${deletedSalesOrders.count} órdenes de venta eliminadas`)

    // 6. Eliminar movimientos de stock de tipo SALE
    console.log('Eliminando movimientos de stock de ventas...')
    const deletedStockMovements = await prisma.stockMovement.deleteMany({
      where: {
        type: 'SALE'
      }
    })
    console.log(`✅ ${deletedStockMovements.count} movimientos de stock de ventas eliminados`)

    // 7. Eliminar cotizaciones y sus items
    console.log('Eliminando items de cotizaciones...')
    const deletedQuotationItems = await prisma.quotationItem.deleteMany({})
    console.log(`✅ ${deletedQuotationItems.count} items de cotizaciones eliminados`)

    console.log('Eliminando cotizaciones...')
    const deletedQuotations = await prisma.quotation.deleteMany({})
    console.log(`✅ ${deletedQuotations.count} cotizaciones eliminadas`)

    // 8. Eliminar turnos de caja y movimientos de caja
    console.log('Eliminando movimientos de caja...')
    const deletedCashMovements = await prisma.cashMovement.deleteMany({})
    console.log(`✅ ${deletedCashMovements.count} movimientos de caja eliminados`)

    console.log('Eliminando turnos de caja...')
    const deletedCashShifts = await prisma.cashShift.deleteMany({})
    console.log(`✅ ${deletedCashShifts.count} turnos de caja eliminados`)

    console.log('\n💰 Actualizando precios de productos...')

    // Precios estimados del mercado colombiano para ferretería (en COP)
    const productPrices: Record<string, { cost: number; price: number }> = {
      // Herramientas manuales
      'Martillo': { cost: 15000, price: 25000 },
      'Destornillador': { cost: 8000, price: 15000 },
      'Alicate': { cost: 12000, price: 22000 },
      'Llave Inglesa': { cost: 18000, price: 32000 },
      'Serrucho': { cost: 25000, price: 45000 },
      'Taladro Manual': { cost: 30000, price: 55000 },
      
      // Herramientas eléctricas
      'Taladro Eléctrico': { cost: 120000, price: 220000 },
      'Sierra Circular': { cost: 180000, price: 320000 },
      'Pulidora': { cost: 150000, price: 280000 },
      'Atornillador Eléctrico': { cost: 95000, price: 180000 },
      
      // Materiales de construcción
      'Cemento 50kg': { cost: 25000, price: 35000 },
      'Arena m3': { cost: 45000, price: 65000 },
      'Gravilla m3': { cost: 50000, price: 70000 },
      'Ladrillo': { cost: 500, price: 800 },
      'Bloque': { cost: 1200, price: 2000 },
      'Tubo PVC 1/2"': { cost: 8000, price: 15000 },
      'Tubo PVC 1"': { cost: 12000, price: 22000 },
      'Tubo PVC 2"': { cost: 25000, price: 45000 },
      
      // Pinturas y acabados
      'Pintura Blanca 1gal': { cost: 45000, price: 75000 },
      'Pintura Color 1gal': { cost: 50000, price: 85000 },
      'Brocha 4"': { cost: 8000, price: 15000 },
      'Rodillo': { cost: 12000, price: 22000 },
      'Masilla': { cost: 15000, price: 25000 },
      'Lija': { cost: 3000, price: 6000 },
      
      // Electricidad
      'Cable THW 12': { cost: 8000, price: 15000 },
      'Cable THW 14': { cost: 6000, price: 12000 },
      'Interruptor': { cost: 5000, price: 10000 },
      'Tomacorriente': { cost: 8000, price: 15000 },
      'Bombillo LED 9W': { cost: 8000, price: 15000 },
      'Bombillo LED 12W': { cost: 10000, price: 18000 },
      'Tubo Conduit 1/2"': { cost: 6000, price: 12000 },
      
      // Fontanería
      'Llave de Paso 1/2"': { cost: 15000, price: 28000 },
      'Llave de Paso 3/4"': { cost: 20000, price: 35000 },
      'Válvula de Baño': { cost: 25000, price: 45000 },
      'Sifón': { cost: 12000, price: 22000 },
      'Codo PVC 1/2"': { cost: 2000, price: 4000 },
      'Tee PVC 1/2"': { cost: 2500, price: 5000 },
      
      // Tornillería y fijación
      'Tornillo 1/2" x100': { cost: 8000, price: 15000 },
      'Tornillo 1" x100': { cost: 10000, price: 18000 },
      'Clavo 2" x1kg': { cost: 6000, price: 12000 },
      'Clavo 3" x1kg': { cost: 7000, price: 13000 },
      'Pernos M8 x10': { cost: 15000, price: 28000 },
      'Tuerca M8 x10': { cost: 8000, price: 15000 },
      
      // Seguridad
      'Candado': { cost: 15000, price: 28000 },
      'Cerradura': { cost: 25000, price: 45000 },
      'Bisagra': { cost: 5000, price: 10000 },
      'Manija': { cost: 8000, price: 15000 },
      
      // Otros
      'Escalera 6 escalones': { cost: 120000, price: 220000 },
      'Carretilla': { cost: 80000, price: 150000 },
      'Palustre': { cost: 12000, price: 22000 },
      'Nivel': { cost: 15000, price: 28000 },
      'Cinta Métrica 5m': { cost: 12000, price: 22000 },
      'Cinta Métrica 10m': { cost: 18000, price: 32000 },
    }

    // Obtener todos los productos
    const products = await prisma.product.findMany({
      where: { active: true }
    })

    console.log(`\nEncontrados ${products.length} productos para actualizar`)

    // Función para encontrar precio por palabras clave
    const findPriceByKeyword = (productName: string): { cost: number; price: number } | null => {
      const nameLower = productName.toLowerCase()
      
      // Buscar coincidencias por palabras clave
      for (const [key, priceInfo] of Object.entries(productPrices)) {
        if (nameLower.includes(key.toLowerCase())) {
          return priceInfo
        }
      }
      
      // Buscar por categorías comunes
      if (nameLower.includes('martillo')) return { cost: 15000, price: 25000 }
      if (nameLower.includes('destornillador')) return { cost: 8000, price: 15000 }
      if (nameLower.includes('clavo')) return { cost: 6000, price: 12000 }
      if (nameLower.includes('tubo') && nameLower.includes('pvc')) {
        if (nameLower.includes('1/2') || nameLower.includes('0.5')) return { cost: 8000, price: 15000 }
        if (nameLower.includes('1"')) return { cost: 12000, price: 22000 }
        if (nameLower.includes('2"')) return { cost: 25000, price: 45000 }
        return { cost: 8000, price: 15000 }
      }
      if (nameLower.includes('pintura')) {
        if (nameLower.includes('1l') || nameLower.includes('1 gal')) return { cost: 45000, price: 75000 }
        return { cost: 50000, price: 85000 }
      }
      if (nameLower.includes('cable') || nameLower.includes('eléctrico')) return { cost: 8000, price: 15000 }
      if (nameLower.includes('brocha')) return { cost: 8000, price: 15000 }
      if (nameLower.includes('tornillo')) return { cost: 8000, price: 15000 }
      if (nameLower.includes('cinta') && nameLower.includes('métrica')) {
        if (nameLower.includes('5')) return { cost: 12000, price: 22000 }
        if (nameLower.includes('10')) return { cost: 18000, price: 32000 }
        return { cost: 12000, price: 22000 }
      }
      if (nameLower.includes('lámpara') || nameLower.includes('led') || nameLower.includes('bombillo')) {
        if (nameLower.includes('9') || nameLower.includes('9w')) return { cost: 8000, price: 15000 }
        if (nameLower.includes('12') || nameLower.includes('12w')) return { cost: 10000, price: 18000 }
        return { cost: 10000, price: 18000 }
      }
      
      return null
    }

    let updated = 0
    for (const product of products) {
      let priceInfo: { cost: number; price: number } | null = productPrices[product.name] ?? null
      
      // Si no hay coincidencia exacta, buscar por palabras clave
      if (!priceInfo) {
        priceInfo = findPriceByKeyword(product.name)
      }
      
      if (priceInfo) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            cost: priceInfo.cost,
            price: priceInfo.price,
          }
        })
        updated++
        console.log(`✅ ${product.name}: Costo $${priceInfo.cost.toLocaleString('es-CO')} → Precio $${priceInfo.price.toLocaleString('es-CO')}`)
      } else {
        // Si no hay precio específico, aplicar un margen estándar del 60% con valores base realistas
        let baseCost = 10000 // Costo base en COP
        if (product.cost > 0 && product.cost < 1000000) {
          // Si el costo actual es razonable, usarlo
          baseCost = Math.round(product.cost)
        }
        const newPrice = Math.round(baseCost * 1.6)
        
        await prisma.product.update({
          where: { id: product.id },
          data: {
            cost: baseCost,
            price: newPrice,
          }
        })
        updated++
        console.log(`⚠️  ${product.name}: Precio estimado (margen 60%) - Costo $${baseCost.toLocaleString('es-CO')} → Precio $${newPrice.toLocaleString('es-CO')}`)
      }
    }

    console.log(`\n✅ ${updated} productos actualizados`)
    console.log('\n✨ Reset y actualización completados exitosamente!')
  } catch (error) {
    console.error('❌ Error durante el reset:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

