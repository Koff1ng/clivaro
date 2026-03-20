/**
 * Seed: Restaurante de Comida de Mar
 * Ejecuta SOLO en el tenant "prueba".
 * 
 * Run: npx tsx prisma/seed-seafood.ts
 * 
 * Creates a full seafood restaurant catalog with:
 * - Categories (Entradas, Ceviches, Cocteles, Pescados, Mariscos, Sopas, Bebidas, Postres)
 * - Raw ingredients (camarón, pescado, pulpo, etc.) with costs
 * - Finished products with prices and tax rates
 * - Recipes linking finished products to raw ingredients
 * - Units (kg, pieza, litro, manojo)
 * - A default warehouse with stock levels
 */

import { PrismaClient } from '@prisma/client'

const TENANT_SLUG = 'prueba'

const masterPrisma = new PrismaClient()

function getSchemaName(tenantId: string): string {
  return `tenant_${tenantId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
}

function buildTenantUrl(schema: string): string {
  const baseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || ''
  if (!baseUrl.startsWith('postgresql://') && !baseUrl.startsWith('postgres://')) {
    return baseUrl
  }
  const urlObj = new URL(baseUrl)
  urlObj.searchParams.set('schema', schema)
  urlObj.searchParams.set('pgbouncer', 'true')
  if (!urlObj.searchParams.has('connection_limit')) {
    urlObj.searchParams.set('connection_limit', '3')
  }
  return urlObj.toString()
}

async function getTenantClient(): Promise<PrismaClient> {
  const tenant = await masterPrisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) {
    throw new Error(`Tenant con slug "${TENANT_SLUG}" no encontrado. Asegurate de que exista.`)
  }
  console.log(`  Tenant encontrado: "${tenant.name}" (${tenant.id})`)
  const schema = getSchemaName(tenant.id)
  console.log(`  Schema: ${schema}\n`)
  const url = buildTenantUrl(schema)
  return new PrismaClient({ datasources: { db: { url } } })
}

let prisma: PrismaClient

// ─── Units ───────────────────────────────────────────────────────────────────

const UNITS = [
  { name: 'Kilogramo', symbol: 'kg' },
  { name: 'Gramo', symbol: 'g' },
  { name: 'Litro', symbol: 'L' },
  { name: 'Mililitro', symbol: 'ml' },
  { name: 'Pieza', symbol: 'pza' },
  { name: 'Manojo', symbol: 'mjo' },
  { name: 'Docena', symbol: 'doc' },
  { name: 'Porcion', symbol: 'por' },
]

// ─── Raw Ingredients ─────────────────────────────────────────────────────────

interface RawIngredient {
  sku: string
  name: string
  unitOfMeasure: string
  cost: number
  category: string
}

const RAW_INGREDIENTS: RawIngredient[] = [
  { sku: 'ING-001', name: 'Camaron crudo (grande)', unitOfMeasure: 'KG', cost: 180, category: 'Ingredientes Mariscos' },
  { sku: 'ING-002', name: 'Camaron mediano', unitOfMeasure: 'KG', cost: 140, category: 'Ingredientes Mariscos' },
  { sku: 'ING-003', name: 'Filete de pescado blanco', unitOfMeasure: 'KG', cost: 120, category: 'Ingredientes Mariscos' },
  { sku: 'ING-004', name: 'Filete de robalo', unitOfMeasure: 'KG', cost: 220, category: 'Ingredientes Mariscos' },
  { sku: 'ING-005', name: 'Pulpo fresco', unitOfMeasure: 'KG', cost: 250, category: 'Ingredientes Mariscos' },
  { sku: 'ING-006', name: 'Calamar limpio', unitOfMeasure: 'KG', cost: 130, category: 'Ingredientes Mariscos' },
  { sku: 'ING-007', name: 'Ostion fresco', unitOfMeasure: 'UNIT', cost: 15, category: 'Ingredientes Mariscos' },
  { sku: 'ING-008', name: 'Almejas frescas', unitOfMeasure: 'KG', cost: 110, category: 'Ingredientes Mariscos' },
  { sku: 'ING-009', name: 'Jaiba entera', unitOfMeasure: 'KG', cost: 160, category: 'Ingredientes Mariscos' },
  { sku: 'ING-010', name: 'Mojarra entera', unitOfMeasure: 'KG', cost: 90, category: 'Ingredientes Mariscos' },
  { sku: 'ING-011', name: 'Filete de salmon', unitOfMeasure: 'KG', cost: 380, category: 'Ingredientes Mariscos' },
  { sku: 'ING-012', name: 'Limon verde', unitOfMeasure: 'KG', cost: 30, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-013', name: 'Cebolla morada', unitOfMeasure: 'KG', cost: 25, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-014', name: 'Jitomate bola', unitOfMeasure: 'KG', cost: 28, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-015', name: 'Pepino', unitOfMeasure: 'KG', cost: 18, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-016', name: 'Cilantro', unitOfMeasure: 'UNIT', cost: 5, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-017', name: 'Chile serrano', unitOfMeasure: 'KG', cost: 35, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-018', name: 'Chile habanero', unitOfMeasure: 'KG', cost: 80, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-019', name: 'Aguacate Hass', unitOfMeasure: 'UNIT', cost: 20, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-020', name: 'Ajo', unitOfMeasure: 'KG', cost: 60, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-021', name: 'Chile guajillo seco', unitOfMeasure: 'KG', cost: 90, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-022', name: 'Chile chipotle adobado', unitOfMeasure: 'KG', cost: 70, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-023', name: 'Aceite vegetal', unitOfMeasure: 'UNIT', cost: 45, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-024', name: 'Aceite de oliva', unitOfMeasure: 'UNIT', cost: 120, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-025', name: 'Mantequilla', unitOfMeasure: 'KG', cost: 110, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-026', name: 'Harina de trigo', unitOfMeasure: 'KG', cost: 15, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-027', name: 'Pan molido', unitOfMeasure: 'KG', cost: 40, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-028', name: 'Arroz blanco', unitOfMeasure: 'KG', cost: 22, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-029', name: 'Clamato', unitOfMeasure: 'UNIT', cost: 25, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-030', name: 'Salsa inglesa', unitOfMeasure: 'UNIT', cost: 35, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-031', name: 'Salsa valentina', unitOfMeasure: 'UNIT', cost: 12, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-032', name: 'Salsa tabasco', unitOfMeasure: 'UNIT', cost: 45, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-033', name: 'Ketchup', unitOfMeasure: 'UNIT', cost: 30, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-034', name: 'Mayonesa', unitOfMeasure: 'KG', cost: 55, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-035', name: 'Tostadas de maiz', unitOfMeasure: 'UNIT', cost: 18, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-036', name: 'Tortillas de maiz', unitOfMeasure: 'KG', cost: 20, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-037', name: 'Queso parmesano', unitOfMeasure: 'KG', cost: 280, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-038', name: 'Crema acida', unitOfMeasure: 'UNIT', cost: 30, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-039', name: 'Galletas saltin', unitOfMeasure: 'UNIT', cost: 15, category: 'Ingredientes Abarrotes' },
  { sku: 'ING-040', name: 'Papa', unitOfMeasure: 'KG', cost: 20, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-041', name: 'Lechuga romana', unitOfMeasure: 'UNIT', cost: 12, category: 'Ingredientes Frutas y Verduras' },
  { sku: 'ING-042', name: 'Col morada', unitOfMeasure: 'UNIT', cost: 15, category: 'Ingredientes Frutas y Verduras' },
]

// ─── Finished Products (Menu Items) ──────────────────────────────────────────

interface MenuItem {
  sku: string
  name: string
  category: string
  price: number
  taxRate: number
  description: string
  printerStation: string
  ingredients: { sku: string; quantity: number; unit: string }[]
}

const MENU_ITEMS: MenuItem[] = [
  // ─── ENTRADAS ──
  {
    sku: 'ENT-001', name: 'Tostada de Ceviche', category: 'Entradas', price: 65, taxRate: 16,
    description: 'Tostada de maiz con ceviche de pescado, aguacate y salsa', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-003', quantity: 0.08, unit: 'kg' }, { sku: 'ING-012', quantity: 0.03, unit: 'kg' },
      { sku: 'ING-013', quantity: 0.02, unit: 'kg' }, { sku: 'ING-014', quantity: 0.03, unit: 'kg' },
      { sku: 'ING-016', quantity: 0.1, unit: 'pza' }, { sku: 'ING-019', quantity: 0.25, unit: 'pza' },
      { sku: 'ING-035', quantity: 0.1, unit: 'pza' },
    ],
  },
  {
    sku: 'ENT-002', name: 'Tostada de Camaron', category: 'Entradas', price: 75, taxRate: 16,
    description: 'Tostada con camaron cocido, mayonesa, aguacate y salsa', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-002', quantity: 0.08, unit: 'kg' }, { sku: 'ING-034', quantity: 0.02, unit: 'kg' },
      { sku: 'ING-019', quantity: 0.25, unit: 'pza' }, { sku: 'ING-035', quantity: 0.1, unit: 'pza' },
      { sku: 'ING-031', quantity: 0.01, unit: 'pza' },
    ],
  },
  {
    sku: 'ENT-003', name: 'Tostada de Pulpo', category: 'Entradas', price: 85, taxRate: 16,
    description: 'Tostada con pulpo al mojo de ajo, aguacate y chipotle', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-005', quantity: 0.08, unit: 'kg' }, { sku: 'ING-020', quantity: 0.01, unit: 'kg' },
      { sku: 'ING-024', quantity: 0.01, unit: 'pza' }, { sku: 'ING-019', quantity: 0.25, unit: 'pza' },
      { sku: 'ING-035', quantity: 0.1, unit: 'pza' },
    ],
  },
  {
    sku: 'ENT-004', name: 'Ostiones Frescos (6 pzas)', category: 'Entradas', price: 120, taxRate: 16,
    description: '6 ostiones frescos en su concha con limon y salsa', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-007', quantity: 6, unit: 'pza' }, { sku: 'ING-012', quantity: 0.05, unit: 'kg' },
      { sku: 'ING-032', quantity: 0.01, unit: 'pza' },
    ],
  },
  {
    sku: 'ENT-005', name: 'Empanadas de Camaron (3 pzas)', category: 'Entradas', price: 95, taxRate: 16,
    description: 'Empanadas rellenas de camaron con queso, fritas', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-002', quantity: 0.1, unit: 'kg' }, { sku: 'ING-026', quantity: 0.08, unit: 'kg' },
      { sku: 'ING-037', quantity: 0.03, unit: 'kg' }, { sku: 'ING-023', quantity: 0.05, unit: 'pza' },
    ],
  },

  // ─── CEVICHES ──
  {
    sku: 'CEV-001', name: 'Ceviche de Pescado', category: 'Ceviches', price: 145, taxRate: 16,
    description: 'Filete de pescado blanco curtido en limon con cebolla, jitomate, cilantro y chile', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-003', quantity: 0.2, unit: 'kg' }, { sku: 'ING-012', quantity: 0.06, unit: 'kg' },
      { sku: 'ING-013', quantity: 0.04, unit: 'kg' }, { sku: 'ING-014', quantity: 0.05, unit: 'kg' },
      { sku: 'ING-016', quantity: 0.2, unit: 'pza' }, { sku: 'ING-017', quantity: 0.01, unit: 'kg' },
      { sku: 'ING-019', quantity: 0.5, unit: 'pza' }, { sku: 'ING-039', quantity: 0.1, unit: 'pza' },
    ],
  },
  {
    sku: 'CEV-002', name: 'Ceviche de Camaron', category: 'Ceviches', price: 175, taxRate: 16,
    description: 'Camaron fresco en limon con pepino, cebolla morada, cilantro y chile', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.2, unit: 'kg' }, { sku: 'ING-012', quantity: 0.06, unit: 'kg' },
      { sku: 'ING-013', quantity: 0.04, unit: 'kg' }, { sku: 'ING-015', quantity: 0.05, unit: 'kg' },
      { sku: 'ING-016', quantity: 0.2, unit: 'pza' }, { sku: 'ING-017', quantity: 0.01, unit: 'kg' },
      { sku: 'ING-019', quantity: 0.5, unit: 'pza' }, { sku: 'ING-039', quantity: 0.1, unit: 'pza' },
    ],
  },
  {
    sku: 'CEV-003', name: 'Ceviche Mixto', category: 'Ceviches', price: 195, taxRate: 16,
    description: 'Pescado, camaron y pulpo en limon con vegetales frescos', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-003', quantity: 0.1, unit: 'kg' }, { sku: 'ING-002', quantity: 0.1, unit: 'kg' },
      { sku: 'ING-005', quantity: 0.08, unit: 'kg' }, { sku: 'ING-012', quantity: 0.08, unit: 'kg' },
      { sku: 'ING-013', quantity: 0.04, unit: 'kg' }, { sku: 'ING-014', quantity: 0.05, unit: 'kg' },
      { sku: 'ING-016', quantity: 0.3, unit: 'pza' }, { sku: 'ING-019', quantity: 0.5, unit: 'pza' },
    ],
  },
  {
    sku: 'CEV-004', name: 'Ceviche Negro (Tinta de Calamar)', category: 'Ceviches', price: 185, taxRate: 16,
    description: 'Ceviche de pescado con tinta de calamar, cebolla morada y habanero', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-003', quantity: 0.2, unit: 'kg' }, { sku: 'ING-006', quantity: 0.05, unit: 'kg' },
      { sku: 'ING-012', quantity: 0.06, unit: 'kg' }, { sku: 'ING-013', quantity: 0.04, unit: 'kg' },
      { sku: 'ING-018', quantity: 0.005, unit: 'kg' }, { sku: 'ING-019', quantity: 0.5, unit: 'pza' },
    ],
  },

  // ─── AGUACHILES ──
  {
    sku: 'AGU-001', name: 'Aguachile Verde', category: 'Ceviches', price: 195, taxRate: 16,
    description: 'Camaron crudo en jugo verde de chile serrano, limon, pepino y cebolla morada', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.2, unit: 'kg' }, { sku: 'ING-012', quantity: 0.08, unit: 'kg' },
      { sku: 'ING-015', quantity: 0.08, unit: 'kg' }, { sku: 'ING-013', quantity: 0.04, unit: 'kg' },
      { sku: 'ING-017', quantity: 0.02, unit: 'kg' }, { sku: 'ING-016', quantity: 0.3, unit: 'pza' },
      { sku: 'ING-019', quantity: 0.5, unit: 'pza' },
    ],
  },
  {
    sku: 'AGU-002', name: 'Aguachile Rojo', category: 'Ceviches', price: 195, taxRate: 16,
    description: 'Camaron crudo en salsa roja de chile guajillo con pepino y cebolla', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.2, unit: 'kg' }, { sku: 'ING-012', quantity: 0.06, unit: 'kg' },
      { sku: 'ING-015', quantity: 0.06, unit: 'kg' }, { sku: 'ING-013', quantity: 0.04, unit: 'kg' },
      { sku: 'ING-021', quantity: 0.02, unit: 'kg' }, { sku: 'ING-019', quantity: 0.5, unit: 'pza' },
    ],
  },
  {
    sku: 'AGU-003', name: 'Aguachile Negro (Habanero)', category: 'Ceviches', price: 210, taxRate: 16,
    description: 'Camaron crudo en salsa negra de habanero y soya', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.2, unit: 'kg' }, { sku: 'ING-012', quantity: 0.06, unit: 'kg' },
      { sku: 'ING-015', quantity: 0.06, unit: 'kg' }, { sku: 'ING-013', quantity: 0.04, unit: 'kg' },
      { sku: 'ING-018', quantity: 0.01, unit: 'kg' },
    ],
  },

  // ─── COCTELES ──
  {
    sku: 'COC-001', name: 'Coctel de Camaron', category: 'Cocteles de Mariscos', price: 165, taxRate: 16,
    description: 'Coctel clasico con clamato, cebolla, cilantro, aguacate y limon', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.2, unit: 'kg' }, { sku: 'ING-029', quantity: 0.15, unit: 'pza' },
      { sku: 'ING-013', quantity: 0.03, unit: 'kg' }, { sku: 'ING-016', quantity: 0.2, unit: 'pza' },
      { sku: 'ING-019', quantity: 0.5, unit: 'pza' }, { sku: 'ING-012', quantity: 0.04, unit: 'kg' },
      { sku: 'ING-033', quantity: 0.02, unit: 'pza' }, { sku: 'ING-030', quantity: 0.01, unit: 'pza' },
    ],
  },
  {
    sku: 'COC-002', name: 'Coctel de Pulpo', category: 'Cocteles de Mariscos', price: 185, taxRate: 16,
    description: 'Pulpo cocido en clamato con aguacate y vegetales', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-005', quantity: 0.18, unit: 'kg' }, { sku: 'ING-029', quantity: 0.15, unit: 'pza' },
      { sku: 'ING-013', quantity: 0.03, unit: 'kg' }, { sku: 'ING-016', quantity: 0.2, unit: 'pza' },
      { sku: 'ING-019', quantity: 0.5, unit: 'pza' }, { sku: 'ING-012', quantity: 0.04, unit: 'kg' },
    ],
  },
  {
    sku: 'COC-003', name: 'Campechana Mixta', category: 'Cocteles de Mariscos', price: 210, taxRate: 16,
    description: 'Coctel con camaron, pulpo, ostion y almeja en clamato especial', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.1, unit: 'kg' }, { sku: 'ING-005', quantity: 0.08, unit: 'kg' },
      { sku: 'ING-007', quantity: 3, unit: 'pza' }, { sku: 'ING-008', quantity: 0.06, unit: 'kg' },
      { sku: 'ING-029', quantity: 0.2, unit: 'pza' }, { sku: 'ING-019', quantity: 0.5, unit: 'pza' },
    ],
  },
  {
    sku: 'COC-004', name: 'Vuelve a la Vida', category: 'Cocteles de Mariscos', price: 235, taxRate: 16,
    description: 'El clasico coctel con todo: camaron, pulpo, ostion, almeja, calamar y jaiba', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.08, unit: 'kg' }, { sku: 'ING-005', quantity: 0.06, unit: 'kg' },
      { sku: 'ING-006', quantity: 0.06, unit: 'kg' }, { sku: 'ING-007', quantity: 2, unit: 'pza' },
      { sku: 'ING-008', quantity: 0.05, unit: 'kg' }, { sku: 'ING-009', quantity: 0.05, unit: 'kg' },
      { sku: 'ING-029', quantity: 0.2, unit: 'pza' }, { sku: 'ING-019', quantity: 0.5, unit: 'pza' },
    ],
  },

  // ─── PESCADOS ──
  {
    sku: 'PES-001', name: 'Filete a la Plancha', category: 'Pescados', price: 185, taxRate: 16,
    description: 'Filete de pescado blanco a la plancha con guarnicion de ensalada y papas', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-003', quantity: 0.25, unit: 'kg' }, { sku: 'ING-024', quantity: 0.02, unit: 'pza' },
      { sku: 'ING-020', quantity: 0.01, unit: 'kg' }, { sku: 'ING-040', quantity: 0.1, unit: 'kg' },
      { sku: 'ING-041', quantity: 0.1, unit: 'pza' },
    ],
  },
  {
    sku: 'PES-002', name: 'Filete Empanizado', category: 'Pescados', price: 185, taxRate: 16,
    description: 'Filete empanizado con pan molido, acompanado de papas fritas y ensalada', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-003', quantity: 0.25, unit: 'kg' }, { sku: 'ING-027', quantity: 0.05, unit: 'kg' },
      { sku: 'ING-026', quantity: 0.03, unit: 'kg' }, { sku: 'ING-023', quantity: 0.05, unit: 'pza' },
      { sku: 'ING-040', quantity: 0.1, unit: 'kg' },
    ],
  },
  {
    sku: 'PES-003', name: 'Filete a la Diabla', category: 'Pescados', price: 195, taxRate: 16,
    description: 'Filete banado en salsa diabla de chile guajillo y chipotle', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-003', quantity: 0.25, unit: 'kg' }, { sku: 'ING-021', quantity: 0.03, unit: 'kg' },
      { sku: 'ING-022', quantity: 0.02, unit: 'kg' }, { sku: 'ING-023', quantity: 0.03, unit: 'pza' },
      { sku: 'ING-020', quantity: 0.01, unit: 'kg' }, { sku: 'ING-028', quantity: 0.08, unit: 'kg' },
    ],
  },
  {
    sku: 'PES-004', name: 'Filete al Mojo de Ajo', category: 'Pescados', price: 195, taxRate: 16,
    description: 'Filete en mantequilla y ajo dorado con arroz y ensalada', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-003', quantity: 0.25, unit: 'kg' }, { sku: 'ING-025', quantity: 0.04, unit: 'kg' },
      { sku: 'ING-020', quantity: 0.02, unit: 'kg' }, { sku: 'ING-028', quantity: 0.08, unit: 'kg' },
    ],
  },
  {
    sku: 'PES-005', name: 'Robalo a la Veracruzana', category: 'Pescados', price: 285, taxRate: 16,
    description: 'Filete de robalo en salsa veracruzana con aceitunas, alcaparras y jitomate', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-004', quantity: 0.3, unit: 'kg' }, { sku: 'ING-014', quantity: 0.1, unit: 'kg' },
      { sku: 'ING-013', quantity: 0.04, unit: 'kg' }, { sku: 'ING-024', quantity: 0.03, unit: 'pza' },
      { sku: 'ING-028', quantity: 0.08, unit: 'kg' },
    ],
  },
  {
    sku: 'PES-006', name: 'Mojarra Frita Entera', category: 'Pescados', price: 175, taxRate: 16,
    description: 'Mojarra entera frita dorada con arroz, ensalada y tortillas', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-010', quantity: 0.4, unit: 'kg' }, { sku: 'ING-023', quantity: 0.1, unit: 'pza' },
      { sku: 'ING-028', quantity: 0.08, unit: 'kg' }, { sku: 'ING-036', quantity: 0.05, unit: 'kg' },
    ],
  },
  {
    sku: 'PES-007', name: 'Salmon a la Parrilla', category: 'Pescados', price: 345, taxRate: 16,
    description: 'Filete de salmon a la parrilla con vegetales asados y salsa de mango', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-011', quantity: 0.25, unit: 'kg' }, { sku: 'ING-024', quantity: 0.02, unit: 'pza' },
      { sku: 'ING-040', quantity: 0.08, unit: 'kg' },
    ],
  },

  // ─── MARISCOS ──
  {
    sku: 'MAR-001', name: 'Camarones al Mojo de Ajo', category: 'Mariscos', price: 225, taxRate: 16,
    description: 'Camarones jumbo en mantequilla de ajo con arroz', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.25, unit: 'kg' }, { sku: 'ING-025', quantity: 0.04, unit: 'kg' },
      { sku: 'ING-020', quantity: 0.02, unit: 'kg' }, { sku: 'ING-028', quantity: 0.08, unit: 'kg' },
    ],
  },
  {
    sku: 'MAR-002', name: 'Camarones a la Diabla', category: 'Mariscos', price: 225, taxRate: 16,
    description: 'Camarones en salsa diabla picante con arroz rojo', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.25, unit: 'kg' }, { sku: 'ING-021', quantity: 0.03, unit: 'kg' },
      { sku: 'ING-022', quantity: 0.02, unit: 'kg' }, { sku: 'ING-023', quantity: 0.03, unit: 'pza' },
      { sku: 'ING-028', quantity: 0.08, unit: 'kg' },
    ],
  },
  {
    sku: 'MAR-003', name: 'Camarones Empanizados', category: 'Mariscos', price: 215, taxRate: 16,
    description: 'Camarones empanizados crujientes con papas fritas y ensalada', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.25, unit: 'kg' }, { sku: 'ING-027', quantity: 0.05, unit: 'kg' },
      { sku: 'ING-026', quantity: 0.03, unit: 'kg' }, { sku: 'ING-023', quantity: 0.08, unit: 'pza' },
      { sku: 'ING-040', quantity: 0.12, unit: 'kg' },
    ],
  },
  {
    sku: 'MAR-004', name: 'Pulpo a las Brasas', category: 'Mariscos', price: 295, taxRate: 16,
    description: 'Tentaculo de pulpo asado a las brasas con chimichurri y papa al horno', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-005', quantity: 0.3, unit: 'kg' }, { sku: 'ING-024', quantity: 0.03, unit: 'pza' },
      { sku: 'ING-020', quantity: 0.015, unit: 'kg' }, { sku: 'ING-016', quantity: 0.2, unit: 'pza' },
      { sku: 'ING-040', quantity: 0.15, unit: 'kg' },
    ],
  },
  {
    sku: 'MAR-005', name: 'Calamares a la Romana', category: 'Mariscos', price: 175, taxRate: 16,
    description: 'Aros de calamar rebozados con salsa tartara', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-006', quantity: 0.25, unit: 'kg' }, { sku: 'ING-026', quantity: 0.05, unit: 'kg' },
      { sku: 'ING-023', quantity: 0.08, unit: 'pza' }, { sku: 'ING-034', quantity: 0.03, unit: 'kg' },
    ],
  },
  {
    sku: 'MAR-006', name: 'Torre de Mariscos', category: 'Mariscos', price: 395, taxRate: 16,
    description: 'Espectacular torre con camaron, pulpo, ceviche, aguacate y tostadas', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.15, unit: 'kg' }, { sku: 'ING-005', quantity: 0.1, unit: 'kg' },
      { sku: 'ING-003', quantity: 0.1, unit: 'kg' }, { sku: 'ING-019', quantity: 1, unit: 'pza' },
      { sku: 'ING-012', quantity: 0.05, unit: 'kg' }, { sku: 'ING-035', quantity: 0.2, unit: 'pza' },
    ],
  },
  {
    sku: 'MAR-007', name: 'Arroz a la Tumbada', category: 'Mariscos', price: 265, taxRate: 16,
    description: 'Arroz caldoso estilo Veracruz con camaron, pulpo, calamar y almeja', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-028', quantity: 0.15, unit: 'kg' }, { sku: 'ING-002', quantity: 0.1, unit: 'kg' },
      { sku: 'ING-005', quantity: 0.08, unit: 'kg' }, { sku: 'ING-006', quantity: 0.06, unit: 'kg' },
      { sku: 'ING-008', quantity: 0.06, unit: 'kg' }, { sku: 'ING-014', quantity: 0.08, unit: 'kg' },
      { sku: 'ING-020', quantity: 0.01, unit: 'kg' },
    ],
  },
  {
    sku: 'MAR-008', name: 'Tacos Gobernador (3 pzas)', category: 'Mariscos', price: 155, taxRate: 16,
    description: 'Tacos de camaron con queso gratinado, chile poblano y crema', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-002', quantity: 0.15, unit: 'kg' }, { sku: 'ING-037', quantity: 0.04, unit: 'kg' },
      { sku: 'ING-036', quantity: 0.05, unit: 'kg' }, { sku: 'ING-038', quantity: 0.03, unit: 'pza' },
    ],
  },

  // ─── SOPAS ──
  {
    sku: 'SOP-001', name: 'Caldo de Camaron', category: 'Sopas', price: 165, taxRate: 16,
    description: 'Caldo rojo con camarones enteros, papa, zanahoria y chile guajillo', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-001', quantity: 0.2, unit: 'kg' }, { sku: 'ING-014', quantity: 0.08, unit: 'kg' },
      { sku: 'ING-021', quantity: 0.02, unit: 'kg' }, { sku: 'ING-040', quantity: 0.08, unit: 'kg' },
      { sku: 'ING-013', quantity: 0.03, unit: 'kg' },
    ],
  },
  {
    sku: 'SOP-002', name: 'Sopa de Mariscos', category: 'Sopas', price: 195, taxRate: 16,
    description: 'Sopa con camaron, calamar, pescado y vegetales en caldo de tomate', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-002', quantity: 0.1, unit: 'kg' }, { sku: 'ING-006', quantity: 0.08, unit: 'kg' },
      { sku: 'ING-003', quantity: 0.1, unit: 'kg' }, { sku: 'ING-014', quantity: 0.08, unit: 'kg' },
      { sku: 'ING-013', quantity: 0.03, unit: 'kg' }, { sku: 'ING-040', quantity: 0.06, unit: 'kg' },
    ],
  },
  {
    sku: 'SOP-003', name: 'Crema de Camaron', category: 'Sopas', price: 145, taxRate: 16,
    description: 'Crema suave de camaron con toque de chipotle', printerStation: 'KITCHEN',
    ingredients: [
      { sku: 'ING-002', quantity: 0.12, unit: 'kg' }, { sku: 'ING-038', quantity: 0.08, unit: 'pza' },
      { sku: 'ING-025', quantity: 0.03, unit: 'kg' }, { sku: 'ING-022', quantity: 0.01, unit: 'kg' },
    ],
  },

  // ─── BEBIDAS ──
  {
    sku: 'BEB-001', name: 'Agua Natural 600ml', category: 'Bebidas', price: 25, taxRate: 16,
    description: 'Agua embotellada natural', printerStation: 'BAR',
    ingredients: [],
  },
  {
    sku: 'BEB-002', name: 'Agua Mineral 600ml', category: 'Bebidas', price: 30, taxRate: 16,
    description: 'Agua mineral con gas', printerStation: 'BAR',
    ingredients: [],
  },
  {
    sku: 'BEB-003', name: 'Refresco de Lata', category: 'Bebidas', price: 35, taxRate: 16,
    description: 'Coca-Cola, Sprite, Fanta, 7-Up', printerStation: 'BAR',
    ingredients: [],
  },
  {
    sku: 'BEB-004', name: 'Limonada Natural', category: 'Bebidas', price: 45, taxRate: 16,
    description: 'Limonada fresca con hierbabuena', printerStation: 'BAR',
    ingredients: [{ sku: 'ING-012', quantity: 0.08, unit: 'kg' }],
  },
  {
    sku: 'BEB-005', name: 'Agua de Horchata', category: 'Bebidas', price: 45, taxRate: 16,
    description: 'Agua de horchata casera', printerStation: 'BAR',
    ingredients: [],
  },
  {
    sku: 'BEB-006', name: 'Cerveza Nacional', category: 'Bebidas', price: 55, taxRate: 16,
    description: 'Corona, Victoria, Modelo, Pacifico', printerStation: 'BAR',
    ingredients: [],
  },
  {
    sku: 'BEB-007', name: 'Cerveza Importada', category: 'Bebidas', price: 75, taxRate: 16,
    description: 'Heineken, Stella Artois', printerStation: 'BAR',
    ingredients: [],
  },
  {
    sku: 'BEB-008', name: 'Michelada', category: 'Bebidas', price: 85, taxRate: 16,
    description: 'Michelada con clamato, salsa y limon', printerStation: 'BAR',
    ingredients: [
      { sku: 'ING-029', quantity: 0.08, unit: 'pza' }, { sku: 'ING-012', quantity: 0.02, unit: 'kg' },
      { sku: 'ING-030', quantity: 0.01, unit: 'pza' },
    ],
  },
  {
    sku: 'BEB-009', name: 'Margarita de Limon', category: 'Bebidas', price: 110, taxRate: 16,
    description: 'Margarita clasica con tequila, limon y triple sec', printerStation: 'BAR',
    ingredients: [{ sku: 'ING-012', quantity: 0.05, unit: 'kg' }],
  },
  {
    sku: 'BEB-010', name: 'Cafe Americano', category: 'Bebidas', price: 40, taxRate: 16,
    description: 'Cafe americano caliente o frio', printerStation: 'BAR',
    ingredients: [],
  },

  // ─── POSTRES ──
  {
    sku: 'POS-001', name: 'Flan Napolitano', category: 'Postres', price: 65, taxRate: 16,
    description: 'Flan casero con caramelo', printerStation: 'KITCHEN',
    ingredients: [],
  },
  {
    sku: 'POS-002', name: 'Pastel de Chocolate', category: 'Postres', price: 75, taxRate: 16,
    description: 'Rebanada de pastel de chocolate con helado de vainilla', printerStation: 'KITCHEN',
    ingredients: [],
  },
  {
    sku: 'POS-003', name: 'Pay de Limon', category: 'Postres', price: 70, taxRate: 16,
    description: 'Pay de limon con merengue', printerStation: 'KITCHEN',
    ingredients: [{ sku: 'ING-012', quantity: 0.04, unit: 'kg' }],
  },
  {
    sku: 'POS-004', name: 'Churros con Chocolate (6 pzas)', category: 'Postres', price: 65, taxRate: 16,
    description: 'Churros calientes con chocolate para mojar', printerStation: 'KITCHEN',
    ingredients: [],
  },
]

// ─── Seed Function ───────────────────────────────────────────────────────────

async function main() {
  console.log('🐟 Iniciando seed de restaurante de comida de mar...')
  console.log(`  Buscando tenant: "${TENANT_SLUG}"...\n`)

  prisma = await getTenantClient()

  // 1. Create units
  console.log('📏 Creando unidades...')
  const unitMap: Record<string, string> = {}
  for (const u of UNITS) {
    const unit = await prisma.unit.upsert({
      where: { id: u.symbol },
      update: { name: u.name, symbol: u.symbol },
      create: { name: u.name, symbol: u.symbol },
    }).catch(async () => {
      const existing = await prisma.unit.findFirst({ where: { symbol: u.symbol } })
      if (existing) return existing
      return prisma.unit.create({ data: { name: u.name, symbol: u.symbol } })
    })
    unitMap[u.symbol] = unit.id
  }
  console.log(`   ✓ ${Object.keys(unitMap).length} unidades\n`)

  // 2. Create raw ingredients
  console.log('🥩 Creando ingredientes...')
  const ingredientMap: Record<string, string> = {}
  for (const ing of RAW_INGREDIENTS) {
    const product = await prisma.product.upsert({
      where: { sku: ing.sku },
      update: {
        name: ing.name,
        cost: ing.cost,
        lastCost: ing.cost,
        averageCost: ing.cost,
        unitOfMeasure: ing.unitOfMeasure,
        category: ing.category,
        productType: 'RAW',
        price: 0,
        taxRate: 0,
        trackStock: true,
        active: true,
      },
      create: {
        sku: ing.sku,
        name: ing.name,
        cost: ing.cost,
        lastCost: ing.cost,
        averageCost: ing.cost,
        unitOfMeasure: ing.unitOfMeasure,
        category: ing.category,
        productType: 'RAW',
        price: 0,
        taxRate: 0,
        trackStock: true,
        active: true,
      },
    })
    ingredientMap[ing.sku] = product.id
  }
  console.log(`   ✓ ${RAW_INGREDIENTS.length} ingredientes\n`)

  // 3. Create finished products and recipes
  console.log('🍽️  Creando productos del menu...')
  let recipeCount = 0
  for (const item of MENU_ITEMS) {
    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {
        name: item.name,
        category: item.category,
        price: item.price,
        taxRate: item.taxRate,
        description: item.description,
        printerStation: item.printerStation,
        productType: 'PREPARED',
        enableRecipeConsumption: item.ingredients.length > 0,
        trackStock: false,
        active: true,
      },
      create: {
        sku: item.sku,
        name: item.name,
        category: item.category,
        price: item.price,
        taxRate: item.taxRate,
        description: item.description,
        printerStation: item.printerStation,
        productType: 'PREPARED',
        enableRecipeConsumption: item.ingredients.length > 0,
        trackStock: false,
        active: true,
      },
    })

    if (item.ingredients.length > 0) {
      await prisma.recipe.upsert({
        where: { productId: product.id },
        update: { yield: 1, active: true },
        create: {
          productId: product.id,
          yield: 1,
          active: true,
        },
      })

      const recipe = await prisma.recipe.findUnique({ where: { productId: product.id } })
      if (recipe) {
        await prisma.recipeItem.deleteMany({ where: { recipeId: recipe.id } })
        for (const ing of item.ingredients) {
          const ingredientId = ingredientMap[ing.sku]
          if (ingredientId) {
            const unitId = unitMap[ing.unit] || null
            await prisma.recipeItem.create({
              data: {
                recipeId: recipe.id,
                ingredientId,
                quantity: ing.quantity,
                unitId,
              },
            })
          }
        }
        recipeCount++
      }
    }
  }
  console.log(`   ✓ ${MENU_ITEMS.length} productos del menu`)
  console.log(`   ✓ ${recipeCount} recetas con ingredientes\n`)

  // 4. Create a default warehouse and stock levels for ingredients
  console.log('🏪 Creando almacen y stock inicial...')
  const warehouse = await prisma.warehouse.upsert({
    where: { name: 'Almacen Principal' },
    update: {},
    create: { name: 'Almacen Principal', address: 'Cocina principal' },
  })

  let stockCount = 0
  for (const ing of RAW_INGREDIENTS) {
    const productId = ingredientMap[ing.sku]
    if (!productId) continue

    const existing = await prisma.stockLevel.findFirst({
      where: { productId, warehouseId: warehouse.id, variantId: null },
    })

    if (!existing) {
      await prisma.stockLevel.create({
        data: {
          productId,
          warehouseId: warehouse.id,
          quantity: 10,
          minStock: 2,
        },
      })
      stockCount++
    }
  }
  console.log(`   ✓ Almacen: ${warehouse.name}`)
  console.log(`   ✓ ${stockCount} niveles de stock creados\n`)

  // Summary
  console.log('═══════════════════════════════════════════════')
  console.log('  SEED COMPLETADO - RESTAURANTE DE MARISCOS')
  console.log('═══════════════════════════════════════════════')
  console.log(`  Unidades:     ${UNITS.length}`)
  console.log(`  Ingredientes: ${RAW_INGREDIENTS.length}`)
  console.log(`  Menu items:   ${MENU_ITEMS.length}`)
  console.log(`  Recetas:      ${recipeCount}`)
  console.log(`  Categorias:   ${[...new Set(MENU_ITEMS.map((m) => m.category))].length}`)
  console.log('')
  console.log('  Categorias del menu:')
  const cats = [...new Set(MENU_ITEMS.map((m) => m.category))]
  for (const cat of cats) {
    const count = MENU_ITEMS.filter((m) => m.category === cat).length
    console.log(`    - ${cat}: ${count} productos`)
  }
  console.log('═══════════════════════════════════════════════\n')
}

main()
  .catch((e) => {
    console.error('Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect()
    await masterPrisma.$disconnect()
  })
