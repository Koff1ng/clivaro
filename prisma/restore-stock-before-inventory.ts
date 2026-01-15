import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const inventoryNumber = 'INV-000002'
  
  console.log(`Buscando inventario físico ${inventoryNumber}...`)

  // Find the physical inventory
  const inventory = await prisma.physicalInventory.findUnique({
    where: { number: inventoryNumber },
    include: {
      items: true,
    },
  })

  if (!inventory) {
    console.error(`❌ No se encontró el inventario ${inventoryNumber}`)
    process.exit(1)
  }

  console.log(`✅ Inventario encontrado: ${inventory.id}`)
  console.log(`Estado: ${inventory.status}`)
  console.log(`Items: ${inventory.items.length}`)

  if (inventory.status !== 'COMPLETED') {
    console.log('⚠️  El inventario no está completado, no hay ajustes que revertir')
    process.exit(0)
  }

  // Find all stock movements related to this inventory
  const stockMovements = await prisma.stockMovement.findMany({
    where: {
      reference: inventoryNumber,
    },
  })

  console.log(`\nEncontrados ${stockMovements.length} movimientos de stock relacionados`)

  if (stockMovements.length === 0) {
    console.log('⚠️  No se encontraron movimientos de stock para revertir')
    process.exit(0)
  }

  // Revert stock adjustments
  console.log('\nRevirtiendo ajustes de stock...')

  await prisma.$transaction(async (tx) => {
    for (const movement of stockMovements) {
      // Calculate the reverse adjustment (opposite sign)
      const reverseQuantity = movement.type === 'IN' ? -movement.quantity : movement.quantity

      console.log(`  - Revertiendo ${movement.type} de ${movement.quantity} para producto ${movement.productId || movement.variantId}`)

      // Update stock level (reverse the adjustment)
      const stockLevel = await tx.stockLevel.findFirst({
        where: {
          warehouseId: movement.warehouseId,
          productId: movement.productId || undefined,
          variantId: movement.variantId || undefined,
        },
      })

      if (stockLevel) {
        await tx.stockLevel.update({
          where: { id: stockLevel.id },
          data: {
            quantity: {
              increment: reverseQuantity, // Reverse the adjustment
            },
          },
        })
        console.log(`    ✓ Stock actualizado: ${stockLevel.quantity} -> ${stockLevel.quantity + reverseQuantity}`)
      } else {
        console.log(`    ⚠️  No se encontró nivel de stock para revertir`)
      }

      // Delete the stock movement
      await tx.stockMovement.delete({
        where: { id: movement.id },
      })
      console.log(`    ✓ Movimiento eliminado`)
    }

    // Mark inventory as CANCELLED instead of COMPLETED
    await tx.physicalInventory.update({
      where: { id: inventory.id },
      data: {
        status: 'CANCELLED',
      },
    })
    console.log(`\n✓ Inventario marcado como CANCELLED`)
  })

  console.log('\n✅ Stock restaurado exitosamente')
  console.log(`   - ${stockMovements.length} movimientos revertidos`)
  console.log(`   - Inventario ${inventoryNumber} marcado como CANCELLED`)
}

main()
  .catch((e) => {
    console.error('❌ Error al restaurar stock:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

