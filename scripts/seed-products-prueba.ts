/**
 * Seed: Productos de Ferretería para tenant "prueba"
 * Ejecutar: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seed-products-prueba.ts
 * O con tsx: npx tsx scripts/seed-products-prueba.ts
 */

import { PrismaClient } from '@prisma/client'

const DATABASE_URL = process.env.DATABASE_URL || process.env.DIRECT_URL || ''

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL no encontrada en .env')
  process.exit(1)
}

// Build tenant URL
function buildTenantUrl(schema: string): string {
  const urlObj = new URL(DATABASE_URL)
  urlObj.searchParams.set('schema', schema)
  return urlObj.toString()
}

const prisma = new PrismaClient({
  datasources: { db: { url: buildTenantUrl('tenant_prueba') } },
})

interface SeedProduct {
  sku: string
  barcode?: string
  name: string
  brand?: string
  category: string
  unitOfMeasure: string
  cost: number
  price: number
  taxRate: number
  description?: string
  trackStock: boolean
}

const products: SeedProduct[] = [
  // ── HERRAMIENTAS MANUALES ──
  { sku: 'HM-001', barcode: '7701001000011', name: 'Martillo Carpintero 16oz', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 28000, price: 45900, taxRate: 19, description: 'Martillo carpintero con mango de fibra de vidrio 16oz', trackStock: true },
  { sku: 'HM-002', barcode: '7701001000028', name: 'Destornillador Phillips #2', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 8500, price: 14900, taxRate: 19, description: 'Destornillador Phillips punta #2 mango ergonómico', trackStock: true },
  { sku: 'HM-003', barcode: '7701001000035', name: 'Destornillador Pala 1/4"', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 7800, price: 13900, taxRate: 19, description: 'Destornillador pala 1/4 pulgada', trackStock: true },
  { sku: 'HM-004', barcode: '7701001000042', name: 'Alicate Universal 8"', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 15000, price: 24900, taxRate: 19, description: 'Alicate universal 8 pulgadas con aislamiento', trackStock: true },
  { sku: 'HM-005', barcode: '7701001000059', name: 'Llave Ajustable 10"', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 22000, price: 38900, taxRate: 19, description: 'Llave ajustable cromada 10 pulgadas', trackStock: true },
  { sku: 'HM-006', barcode: '7701001000066', name: 'Flexómetro 5m', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 12000, price: 21900, taxRate: 19, description: 'Flexómetro profesional 5 metros con freno', trackStock: true },
  { sku: 'HM-007', barcode: '7701001000073', name: 'Sierra Manual 20"', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 18000, price: 32900, taxRate: 19, description: 'Sierra manual para madera 20 pulgadas', trackStock: true },
  { sku: 'HM-008', barcode: '7701001000080', name: 'Juego Llaves Allen 9pcs', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 14000, price: 24900, taxRate: 19, description: 'Juego de 9 llaves Allen métricas', trackStock: true },

  // ── HERRAMIENTAS ELÉCTRICAS ──
  { sku: 'HE-001', barcode: '7701002000018', name: 'Taladro Percutor 1/2" 700W', brand: 'DeWalt', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 185000, price: 289900, taxRate: 19, description: 'Taladro percutor 1/2 pulgada 700W velocidad variable', trackStock: true },
  { sku: 'HE-002', barcode: '7701002000025', name: 'Pulidora Angular 4-1/2" 850W', brand: 'DeWalt', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 165000, price: 259900, taxRate: 19, description: 'Pulidora angular 4-1/2 pulgadas 850W', trackStock: true },
  { sku: 'HE-003', barcode: '7701002000032', name: 'Caladora 500W', brand: 'Black+Decker', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 120000, price: 189900, taxRate: 19, description: 'Caladora eléctrica 500W con guía láser', trackStock: true },
  { sku: 'HE-004', barcode: '7701002000049', name: 'Atornillador Inalámbrico 12V', brand: 'Black+Decker', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 95000, price: 159900, taxRate: 19, description: 'Atornillador inalámbrico 12V con batería de litio', trackStock: true },

  // ── PINTURAS ──
  { sku: 'PT-001', barcode: '7701003000015', name: 'Pintura Vinilo Tipo 1 Blanco (Galón)', brand: 'Pintuco', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 48000, price: 72900, taxRate: 19, description: 'Pintura vinilo tipo 1 blanco para interiores y exteriores', trackStock: true },
  { sku: 'PT-002', barcode: '7701003000022', name: 'Pintura Vinilo Tipo 1 Blanco (Cuñete)', brand: 'Pintuco', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 195000, price: 289900, taxRate: 19, description: 'Pintura vinilo tipo 1 blanco cuñete 5 galones', trackStock: true },
  { sku: 'PT-003', barcode: '7701003000039', name: 'Esmalte Sintético Negro (1/4 Gal)', brand: 'Pintuco', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 22000, price: 34900, taxRate: 19, description: 'Esmalte sintético negro brillante 1/4 de galón', trackStock: true },
  { sku: 'PT-004', barcode: '7701003000046', name: 'Brocha 3" Profesional', brand: 'Tigre', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 8500, price: 14900, taxRate: 19, description: 'Brocha profesional cerda natural 3 pulgadas', trackStock: true },
  { sku: 'PT-005', barcode: '7701003000053', name: 'Rodillo 9" con Bandeja', brand: 'Tigre', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 12000, price: 19900, taxRate: 19, description: 'Rodillo 9 pulgadas con bandeja plástica incluida', trackStock: true },
  { sku: 'PT-006', barcode: '7701003000060', name: 'Thinner Corriente (Galón)', brand: 'Sherwin', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 18000, price: 28900, taxRate: 19, description: 'Thinner corriente para dilución de esmaltes', trackStock: true },

  // ── MATERIALES DE CONSTRUCCIÓN ──
  { sku: 'MC-001', barcode: '7701004000012', name: 'Cemento Gris 50kg', brand: 'Argos', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 28000, price: 38900, taxRate: 5, description: 'Cemento portland gris uso general 50kg', trackStock: true },
  { sku: 'MC-002', barcode: '7701004000029', name: 'Varilla Corrugada 1/2" x 6m', brand: 'Diaco', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 18500, price: 27900, taxRate: 5, description: 'Varilla corrugada de acero 1/2 pulgada por 6 metros', trackStock: true },
  { sku: 'MC-003', barcode: '7701004000036', name: 'Alambre Negro Cal 18 (kg)', brand: 'Proalco', category: 'Materiales de Construcción', unitOfMeasure: 'KG', cost: 4500, price: 7900, taxRate: 5, description: 'Alambre negro recocido calibre 18 por kg', trackStock: true },
  { sku: 'MC-004', barcode: '7701004000043', name: 'Bloque #4 (10x20x40)', brand: 'Ladrillera', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 1200, price: 2100, taxRate: 5, description: 'Bloque estructural #4 10x20x40cm', trackStock: true },
  { sku: 'MC-005', barcode: '7701004000050', name: 'Arena Lavada (Bulto 40kg)', brand: 'Cantera', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 5000, price: 8900, taxRate: 5, description: 'Arena lavada para pegado y revoque', trackStock: true },

  // ── TUBERÍA Y PLOMERÍA ──
  { sku: 'TP-001', barcode: '7701005000019', name: 'Tubo PVC 1/2" x 6m Presión', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 8500, price: 14900, taxRate: 19, description: 'Tubo PVC presión 1/2 pulgada por 6 metros', trackStock: true },
  { sku: 'TP-002', barcode: '7701005000026', name: 'Tubo PVC 2" x 6m Sanitario', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 22000, price: 34900, taxRate: 19, description: 'Tubo PVC sanitario 2 pulgadas por 6 metros', trackStock: true },
  { sku: 'TP-003', barcode: '7701005000033', name: 'Codo PVC 1/2" x 90°', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 800, price: 1900, taxRate: 19, description: 'Codo PVC presión 1/2 pulgada 90 grados', trackStock: true },
  { sku: 'TP-004', barcode: '7701005000040', name: 'Tee PVC 1/2" Presión', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 900, price: 2100, taxRate: 19, description: 'Te PVC presión 1/2 pulgada', trackStock: true },
  { sku: 'TP-005', barcode: '7701005000057', name: 'Registro Bola 1/2" PVC', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 4500, price: 8900, taxRate: 19, description: 'Registro de bola PVC 1/2 pulgada', trackStock: true },
  { sku: 'TP-006', barcode: '7701005000064', name: 'Teflón Rollo Grande', brand: 'Super Teflón', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 1200, price: 2900, taxRate: 19, description: 'Cinta teflón para roscas de tubería rollo grande', trackStock: true },

  // ── ELÉCTRICOS ──
  { sku: 'EL-001', barcode: '7701006000016', name: 'Cable THW #12 AWG (metro)', brand: 'Centelsa', category: 'Eléctricos', unitOfMeasure: 'METER', cost: 2200, price: 3900, taxRate: 19, description: 'Cable THW calibre 12 AWG cobre por metro', trackStock: true },
  { sku: 'EL-002', barcode: '7701006000023', name: 'Cable THW #14 AWG (metro)', brand: 'Centelsa', category: 'Eléctricos', unitOfMeasure: 'METER', cost: 1600, price: 2900, taxRate: 19, description: 'Cable THW calibre 14 AWG cobre por metro', trackStock: true },
  { sku: 'EL-003', barcode: '7701006000030', name: 'Interruptor Sencillo', brand: 'Legrand', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 4500, price: 8900, taxRate: 19, description: 'Interruptor sencillo línea doméstica blanco', trackStock: true },
  { sku: 'EL-004', barcode: '7701006000047', name: 'Toma Doble con Polo a Tierra', brand: 'Legrand', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 5500, price: 9900, taxRate: 19, description: 'Toma doble con polo a tierra línea Arteor', trackStock: true },
  { sku: 'EL-005', barcode: '7701006000054', name: 'Bombillo LED 9W Luz Fría', brand: 'Sylvania', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 5000, price: 8900, taxRate: 19, description: 'Bombillo LED A60 9W E27 luz fría 6500K', trackStock: true },
  { sku: 'EL-006', barcode: '7701006000061', name: 'Cinta Aislante 3M 18m', brand: '3M', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 3500, price: 6900, taxRate: 19, description: 'Cinta aislante Temflex 3M negra 18 metros', trackStock: true },
  { sku: 'EL-007', barcode: '7701006000078', name: 'Breaker 1x20A', brand: 'Schneider', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 12000, price: 19900, taxRate: 19, description: 'Breaker monopolar 20 amperios riel DIN', trackStock: true },

  // ── CERRADURAS Y SEGURIDAD ──
  { sku: 'CS-001', barcode: '7701007000013', name: 'Candado 40mm Laminado', brand: 'Yale', category: 'Cerraduras y Seguridad', unitOfMeasure: 'UNIT', cost: 18000, price: 29900, taxRate: 19, description: 'Candado laminado 40mm con 3 llaves', trackStock: true },
  { sku: 'CS-002', barcode: '7701007000020', name: 'Cerradura de Pomo Baño', brand: 'Yale', category: 'Cerraduras y Seguridad', unitOfMeasure: 'UNIT', cost: 28000, price: 45900, taxRate: 19, description: 'Cerradura de pomo para baño cromada', trackStock: true },
  { sku: 'CS-003', barcode: '7701007000037', name: 'Cerradura Principal 3 Golpes', brand: 'Schlage', category: 'Cerraduras y Seguridad', unitOfMeasure: 'UNIT', cost: 65000, price: 99900, taxRate: 19, description: 'Cerradura principal 3 golpes alta seguridad', trackStock: true },

  // ── FIJACIÓN Y TORNILLERÍA ──
  { sku: 'FT-001', barcode: '7701008000010', name: 'Tornillo Drywall 6x1" (Caja 100)', brand: 'Fix', category: 'Fijación y Tornillería', unitOfMeasure: 'BOX', cost: 5500, price: 9900, taxRate: 19, description: 'Tornillos drywall cabeza bugle 6x1 pulgada caja x100', trackStock: true },
  { sku: 'FT-002', barcode: '7701008000027', name: 'Tornillo Madera 8x1-1/2" (Caja 100)', brand: 'Fix', category: 'Fijación y Tornillería', unitOfMeasure: 'BOX', cost: 7000, price: 12900, taxRate: 19, description: 'Tornillos para madera cabeza avellanada 8x1-1/2 caja x100', trackStock: true },
  { sku: 'FT-003', barcode: '7701008000034', name: 'Chazo Plástico 1/4" (Bolsa 100)', brand: 'Fischer', category: 'Fijación y Tornillería', unitOfMeasure: 'BAG', cost: 4000, price: 7900, taxRate: 19, description: 'Chazos plásticos de expansión 1/4 pulgada bolsa x100', trackStock: true },
  { sku: 'FT-004', barcode: '7701008000041', name: 'Silicona Transparente 280ml', brand: 'Sika', category: 'Fijación y Tornillería', unitOfMeasure: 'UNIT', cost: 8000, price: 14900, taxRate: 19, description: 'Silicona acetica transparente 280ml para sellado', trackStock: true },
  { sku: 'FT-005', barcode: '7701008000058', name: 'Clavos 2-1/2" (Libra)', brand: 'Proalco', category: 'Fijación y Tornillería', unitOfMeasure: 'LB', cost: 3500, price: 5900, taxRate: 19, description: 'Clavos con cabeza 2-1/2 pulgadas por libra', trackStock: true },

  // ── JARDINERÍA ──
  { sku: 'JR-001', barcode: '7701009000017', name: 'Manguera 1/2" x 20m', brand: 'Tramontina', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 35000, price: 54900, taxRate: 19, description: 'Manguera para riego 1/2 pulgada por 20 metros', trackStock: true },
  { sku: 'JR-002', barcode: '7701009000024', name: 'Pala Redonda Mango Largo', brand: 'Truper', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 22000, price: 36900, taxRate: 19, description: 'Pala punta redonda con mango de madera largo', trackStock: true },
  { sku: 'JR-003', barcode: '7701009000031', name: 'Machete 18" con Funda', brand: 'Collins', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 18000, price: 29900, taxRate: 19, description: 'Machete 18 pulgadas acero con funda protectora', trackStock: true },
]

async function main() {
  console.log('🏗️  Conectando a tenant_prueba...')
  
  let created = 0
  let skipped = 0
  
  for (const p of products) {
    try {
      await prisma.product.upsert({
        where: { sku: p.sku },
        update: {
          name: p.name,
          brand: p.brand,
          category: p.category,
          unitOfMeasure: p.unitOfMeasure,
          cost: p.cost,
          lastCost: p.cost,
          averageCost: p.cost,
          price: p.price,
          taxRate: p.taxRate,
          description: p.description,
          trackStock: p.trackStock,
          active: true,
        },
        create: {
          sku: p.sku,
          barcode: p.barcode,
          name: p.name,
          brand: p.brand,
          category: p.category,
          unitOfMeasure: p.unitOfMeasure,
          cost: p.cost,
          lastCost: p.cost,
          averageCost: p.cost,
          price: p.price,
          taxRate: p.taxRate,
          description: p.description,
          trackStock: p.trackStock,
          active: true,
        },
      })
      console.log(`  ✅ ${p.sku} — ${p.name}`)
      created++
    } catch (err: any) {
      if (err.code === 'P2002') {
        console.log(`  ⏭️  ${p.sku} — ya existe (barcode duplicado), skipping`)
        skipped++
      } else {
        console.error(`  ❌ ${p.sku} — ${err.message}`)
      }
    }
  }
  
  console.log(`\n🎉 Seed completado: ${created} creados/actualizados, ${skipped} omitidos`)
  console.log(`📦 Total productos definidos: ${products.length}`)
}

main()
  .catch(e => {
    console.error('Error fatal:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
