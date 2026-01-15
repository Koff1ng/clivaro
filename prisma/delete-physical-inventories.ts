import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Eliminando todos los inventarios físicos...')

  // First, delete all physical inventory items (they have cascade delete, but being explicit)
  const deletedItems = await prisma.physicalInventoryItem.deleteMany({})
  console.log(`Eliminados ${deletedItems.count} items de inventario físico`)

  // Then delete all physical inventories
  const deletedInventories = await prisma.physicalInventory.deleteMany({})
  console.log(`Eliminados ${deletedInventories.count} inventarios físicos`)

  console.log('✅ Todos los inventarios físicos han sido eliminados')
}

main()
  .catch((e) => {
    console.error('Error al eliminar inventarios físicos:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

