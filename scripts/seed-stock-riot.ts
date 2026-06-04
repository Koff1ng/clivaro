/**
 * Seed: Stock inicial para productos del tenant "riot"
 * Ejecutar: npx tsx scripts/seed-stock-riot.ts
 */

import { PrismaClient } from '@prisma/client'

const DATABASE_URL = process.env.DATABASE_URL || process.env.DIRECT_URL || ''

if (!DATABASE_URL) {
  console.error('DATABASE_URL no encontrada en .env')
  process.exit(1)
}

function buildTenantUrl(schema: string): string {
  const urlObj = new URL(DATABASE_URL)
  urlObj.searchParams.set('schema', schema)
  return urlObj.toString()
}

const prisma = new PrismaClient({
  datasources: { db: { url: buildTenantUrl('tenant_riot') } },
})

// Cantidades realistas de stock por SKU para ferretería
const stockBySku: Record<string, number> = {
  // Herramientas Manuales
  'HM-001': 25, 'HM-002': 50, 'HM-003': 45, 'HM-004': 40, 'HM-005': 30,
  'HM-006': 28, 'HM-007': 22, 'HM-008': 18, 'HM-009': 35, 'HM-010': 20,
  'HM-011': 15, 'HM-012': 25, 'HM-013': 12, 'HM-014': 18, 'HM-015': 20,
  'HM-016': 22, 'HM-017': 15, 'HM-018': 8,
  // Herramientas Eléctricas
  'HE-001': 8, 'HE-002': 10, 'HE-003': 6, 'HE-004': 3, 'HE-005': 8,
  'HE-006': 12, 'HE-007': 5, 'HE-008': 30, 'HE-009': 25, 'HE-010': 4,
  'HE-011': 7,
  // Pinturas
  'PT-001': 40, 'PT-002': 15, 'PT-003': 35, 'PT-004': 28, 'PT-005': 18,
  'PT-006': 60, 'PT-007': 55, 'PT-008': 45, 'PT-009': 40, 'PT-010': 35,
  'PT-011': 100, 'PT-012': 90, 'PT-013': 30, 'PT-014': 80,
  // Materiales de Construcción
  'MC-001': 50, 'MC-002': 20, 'MC-003': 80, 'MC-004': 65, 'MC-005': 100,
  'MC-006': 200, 'MC-007': 500, 'MC-008': 40, 'MC-009': 35, 'MC-010': 15,
  'MC-011': 10, 'MC-012': 150,
  // Tubería y Plomería
  'TP-001': 60, 'TP-002': 40, 'TP-003': 120, 'TP-004': 100, 'TP-005': 50,
  'TP-006': 25, 'TP-007': 200, 'TP-008': 45, 'TP-009': 40, 'TP-010': 35,
  'TP-011': 90, 'TP-012': 85, 'TP-013': 30,
  // Eléctricos
  'EL-001': 200, 'EL-002': 250, 'EL-003': 150, 'EL-004': 60, 'EL-005': 55,
  'EL-006': 80, 'EL-007': 70, 'EL-008': 120, 'EL-009': 40, 'EL-010': 35,
  'EL-011': 30, 'EL-012': 50, 'EL-013': 60, 'EL-014': 25, 'EL-015': 35,
  // Cerraduras y Seguridad
  'CS-001': 30, 'CS-002': 18, 'CS-003': 22, 'CS-004': 12, 'CS-005': 40,
  'CS-006': 35, 'CS-007': 20,
  // Fijación y Tornillería
  'FT-001': 80, 'FT-002': 60, 'FT-003': 75, 'FT-004': 90, 'FT-005': 70,
  'FT-006': 50, 'FT-007': 45, 'FT-008': 120, 'FT-009': 200, 'FT-010': 40,
  // Jardinería
  'JR-001': 18, 'JR-002': 10, 'JR-003': 20, 'JR-004': 25, 'JR-005': 18,
  'JR-006': 22, 'JR-007': 30, 'JR-008': 10, 'JR-009': 35, 'JR-010': 15,
  // Seguridad Industrial
  'SI-001': 25, 'SI-002': 60, 'SI-003': 80, 'SI-004': 55, 'SI-005': 40,
  'SI-006': 30, 'SI-007': 8, 'SI-008': 12, 'SI-009': 35, 'SI-010': 28,
  // Ferretería General
  'FG-001': 20, 'FG-002': 150, 'FG-003': 130, 'FG-004': 40, 'FG-005': 30,
  'FG-006': 25, 'FG-007': 18, 'FG-008': 22, 'FG-009': 22, 'FG-010': 18,
  'FG-011': 15, 'FG-012': 50,
}

async function main() {
  console.log('Conectando a tenant_riot...')

  // 1. Encontrar la bodega principal
  const warehouse = await prisma.warehouse.findFirst()
  if (!warehouse) {
    console.error('No se encontró ninguna bodega en tenant_riot. Crea una primero.')
    process.exit(1)
  }
  console.log(`Bodega: ${warehouse.name} (${warehouse.id})`)

  // 2. Buscar zona default
  const zone = await prisma.warehouseZone.findFirst({
    where: { warehouseId: warehouse.id },
  })
  console.log(`Zona: ${zone?.name || 'ninguna (se usará sin zona)'} (${zone?.id || 'N/A'})`)

  // 3. Buscar usuario admin para los movimientos
  const adminUser = await prisma.user.findFirst({
    select: { id: true },
  })
  console.log(`Usuario: ${adminUser?.id || 'no encontrado'}`)

  // 4. Cargar todos los productos activos
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, sku: true, name: true, cost: true },
  })
  console.log(`Productos encontrados: ${products.length}`)

  let stockCreated = 0
  let stockSkipped = 0
  let movementsCreated = 0

  for (const product of products) {
    const qty = stockBySku[product.sku] ?? 10 // default 10 si no está definido

    try {
      // Verificar si ya existe stock level
      const existing = await prisma.stockLevel.findFirst({
        where: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      })

      if (existing) {
        console.log(`  SKIP ${product.sku} — ya tiene stock (${existing.quantity})`)
        stockSkipped++
        continue
      }

      // Crear stock level
      await prisma.stockLevel.create({
        data: {
          warehouseId: warehouse.id,
          zoneId: zone?.id || null,
          productId: product.id,
          quantity: qty,
          minStock: Math.max(1, Math.floor(qty * 0.2)),
          maxStock: qty * 2,
        },
      })

      // Crear movimiento de entrada inicial (solo si hay usuario)
      if (adminUser) {
        try {
          await prisma.stockMovement.create({
            data: {
              warehouseId: warehouse.id,
              productId: product.id,
              type: 'IN',
              quantity: qty,
              cost: product.cost,
              reason: 'Stock inicial demo',
              reference: 'INIT-RIOT',
              createdById: adminUser.id,
            },
          })
          movementsCreated++
        } catch {
          // Silencioso - el movimiento es opcional para el seed
        }
      }

      console.log(`  ${product.sku} — ${product.name} → ${qty} und`)
      stockCreated++
      movementsCreated++
    } catch (err: any) {
      console.error(`  ERROR ${product.sku} — ${err.message}`)
    }
  }

  console.log(`\nStock creado: ${stockCreated} | Saltados (ya existían): ${stockSkipped}`)
  console.log(`Movimientos de entrada: ${movementsCreated}`)
  console.log(`Total productos: ${products.length}`)
}

main()
  .catch(e => {
    console.error('Error fatal:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
