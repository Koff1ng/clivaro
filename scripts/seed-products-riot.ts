/**
 * Seed: Productos de Ferretería para tenant "riot"
 * Ejecutar: npx tsx scripts/seed-products-riot.ts
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
  // ─────────────────────────────────────────
  // HERRAMIENTAS MANUALES
  // ─────────────────────────────────────────
  { sku: 'HM-001', barcode: '7702001000011', name: 'Martillo Carpintero 16oz', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 28000, price: 45900, taxRate: 19, description: 'Martillo carpintero con mango de fibra de vidrio 16oz', trackStock: true },
  { sku: 'HM-002', barcode: '7702001000028', name: 'Destornillador Phillips #2', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 8500, price: 14900, taxRate: 19, description: 'Destornillador Phillips punta #2 mango ergonómico', trackStock: true },
  { sku: 'HM-003', barcode: '7702001000035', name: 'Destornillador Pala 1/4"', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 7800, price: 13900, taxRate: 19, description: 'Destornillador pala 1/4 pulgada', trackStock: true },
  { sku: 'HM-004', barcode: '7702001000042', name: 'Destornillador Estrella #1', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 7200, price: 12900, taxRate: 19, description: 'Destornillador estrella punta #1', trackStock: true },
  { sku: 'HM-005', barcode: '7702001000059', name: 'Alicate Universal 8"', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 15000, price: 24900, taxRate: 19, description: 'Alicate universal 8 pulgadas con aislamiento 1000V', trackStock: true },
  { sku: 'HM-006', barcode: '7702001000066', name: 'Alicate de Corte 6"', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 13500, price: 22900, taxRate: 19, description: 'Alicate de corte diagonal 6 pulgadas', trackStock: true },
  { sku: 'HM-007', barcode: '7702001000073', name: 'Llave Ajustable 10"', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 22000, price: 38900, taxRate: 19, description: 'Llave ajustable cromada 10 pulgadas', trackStock: true },
  { sku: 'HM-008', barcode: '7702001000080', name: 'Llave Ajustable 12"', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 28000, price: 46900, taxRate: 19, description: 'Llave ajustable cromada 12 pulgadas', trackStock: true },
  { sku: 'HM-009', barcode: '7702001000097', name: 'Flexómetro 5m', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 12000, price: 21900, taxRate: 19, description: 'Flexómetro profesional 5 metros con freno y clip', trackStock: true },
  { sku: 'HM-010', barcode: '7702001000103', name: 'Flexómetro 8m', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 18000, price: 31900, taxRate: 19, description: 'Flexómetro profesional 8 metros', trackStock: true },
  { sku: 'HM-011', barcode: '7702001000110', name: 'Sierra Manual 20"', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 18000, price: 32900, taxRate: 19, description: 'Sierra manual para madera 20 pulgadas', trackStock: true },
  { sku: 'HM-012', barcode: '7702001000127', name: 'Juego Llaves Allen 9pcs', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'SET', cost: 14000, price: 24900, taxRate: 19, description: 'Juego de 9 llaves Allen métricas 1.5-10mm', trackStock: true },
  { sku: 'HM-013', barcode: '7702001000134', name: 'Juego Llaves Mixtas 8pcs', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'SET', cost: 45000, price: 74900, taxRate: 19, description: 'Juego de 8 llaves mixtas 8-19mm', trackStock: true },
  { sku: 'HM-014', barcode: '7702001000141', name: 'Nivel de Burbuja 24"', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 25000, price: 39900, taxRate: 19, description: 'Nivel de burbuja aluminio 24 pulgadas 3 vistas', trackStock: true },
  { sku: 'HM-015', barcode: '7702001000158', name: 'Cincel 1" con Mango', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 9500, price: 16900, taxRate: 19, description: 'Cincel 1 pulgada con mango de goma', trackStock: true },
  { sku: 'HM-016', barcode: '7702001000165', name: 'Juego Destornilladores 6pcs', brand: 'Stanley', category: 'Herramientas Manuales', unitOfMeasure: 'SET', cost: 25000, price: 42900, taxRate: 19, description: 'Juego 3 pala + 3 Phillips mango acolchado', trackStock: true },
  { sku: 'HM-017', barcode: '7702001000172', name: 'Caja de Herramientas Plástica 20"', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 32000, price: 54900, taxRate: 19, description: 'Caja organizadora plástica 20 pulgadas con bandeja', trackStock: true },
  { sku: 'HM-018', barcode: '7702001000189', name: 'Prensa de Banco 4"', brand: 'Truper', category: 'Herramientas Manuales', unitOfMeasure: 'UNIT', cost: 55000, price: 89900, taxRate: 19, description: 'Prensa de banco giratoria 4 pulgadas base fija', trackStock: true },

  // ─────────────────────────────────────────
  // HERRAMIENTAS ELÉCTRICAS
  // ─────────────────────────────────────────
  { sku: 'HE-001', barcode: '7702002000018', name: 'Taladro Percutor 1/2" 700W', brand: 'DeWalt', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 185000, price: 289900, taxRate: 19, description: 'Taladro percutor 1/2 pulgada 700W velocidad variable reversible', trackStock: true },
  { sku: 'HE-002', barcode: '7702002000025', name: 'Taladro Percutor 1/2" 550W', brand: 'Black+Decker', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 125000, price: 199900, taxRate: 19, description: 'Taladro percutor 1/2 pulgada 550W con maletín', trackStock: true },
  { sku: 'HE-003', barcode: '7702002000032', name: 'Pulidora Angular 4-1/2" 850W', brand: 'DeWalt', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 165000, price: 259900, taxRate: 19, description: 'Pulidora angular 4-1/2 pulgadas 850W 11000RPM', trackStock: true },
  { sku: 'HE-004', barcode: '7702002000049', name: 'Pulidora Angular 7" 2200W', brand: 'Bosch', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 285000, price: 429900, taxRate: 19, description: 'Pulidora angular 7 pulgadas 2200W profesional', trackStock: true },
  { sku: 'HE-005', barcode: '7702002000056', name: 'Caladora 500W', brand: 'Black+Decker', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 120000, price: 189900, taxRate: 19, description: 'Caladora eléctrica 500W con guía láser y soplador', trackStock: true },
  { sku: 'HE-006', barcode: '7702002000063', name: 'Atornillador Inalámbrico 12V', brand: 'Black+Decker', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 95000, price: 159900, taxRate: 19, description: 'Atornillador inalámbrico 12V con batería litio y cargador', trackStock: true },
  { sku: 'HE-007', barcode: '7702002000070', name: 'Taladro Inalámbrico 20V', brand: 'DeWalt', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 220000, price: 349900, taxRate: 19, description: 'Taladro inalámbrico 20V 2 baterías + cargador + maletín', trackStock: true },
  { sku: 'HE-008', barcode: '7702002000087', name: 'Disco Corte Metal 4-1/2" (x25)', brand: 'DeWalt', category: 'Herramientas Eléctricas', unitOfMeasure: 'BOX', cost: 35000, price: 59900, taxRate: 19, description: 'Discos de corte para metal 4-1/2 pulgadas caja x25', trackStock: true },
  { sku: 'HE-009', barcode: '7702002000094', name: 'Disco Corte Concreto 4-1/2" (x10)', brand: 'Norton', category: 'Herramientas Eléctricas', unitOfMeasure: 'BOX', cost: 28000, price: 47900, taxRate: 19, description: 'Discos diamantados corte concreto 4-1/2 caja x10', trackStock: true },
  { sku: 'HE-010', barcode: '7702002000100', name: 'Sierra Circular 7-1/4" 1500W', brand: 'DeWalt', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 320000, price: 499900, taxRate: 19, description: 'Sierra circular 7-1/4 pulgadas 1500W 5000RPM', trackStock: true },
  { sku: 'HE-011', barcode: '7702002000117', name: 'Sopladora Aspiradora 600W', brand: 'Black+Decker', category: 'Herramientas Eléctricas', unitOfMeasure: 'UNIT', cost: 85000, price: 139900, taxRate: 19, description: 'Sopladora y aspiradora eléctrica 600W', trackStock: true },

  // ─────────────────────────────────────────
  // PINTURAS Y ACCESORIOS
  // ─────────────────────────────────────────
  { sku: 'PT-001', barcode: '7702003000015', name: 'Pintura Vinilo Tipo 1 Blanco Galón', brand: 'Pintuco', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 48000, price: 72900, taxRate: 19, description: 'Pintura vinilo tipo 1 blanco para interiores lavable', trackStock: true },
  { sku: 'PT-002', barcode: '7702003000022', name: 'Pintura Vinilo Tipo 1 Blanco Cuñete', brand: 'Pintuco', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 195000, price: 289900, taxRate: 19, description: 'Pintura vinilo tipo 1 blanco cuñete 5 galones', trackStock: true },
  { sku: 'PT-003', barcode: '7702003000039', name: 'Esmalte Sintético Negro 1/4 Gal', brand: 'Pintuco', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 22000, price: 34900, taxRate: 19, description: 'Esmalte sintético negro brillante 1/4 galón para metal y madera', trackStock: true },
  { sku: 'PT-004', barcode: '7702003000046', name: 'Esmalte Sintético Blanco Galón', brand: 'Pintuco', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 48000, price: 74900, taxRate: 19, description: 'Esmalte sintético blanco brillante galón', trackStock: true },
  { sku: 'PT-005', barcode: '7702003000053', name: 'Pintura Anticorrosiva Roja Galón', brand: 'Pintuco', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 55000, price: 84900, taxRate: 19, description: 'Pintura anticorrosiva roja óxido galón para metal', trackStock: true },
  { sku: 'PT-006', barcode: '7702003000060', name: 'Brocha 2" Profesional', brand: 'Tigre', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 6500, price: 11900, taxRate: 19, description: 'Brocha profesional cerda natural 2 pulgadas', trackStock: true },
  { sku: 'PT-007', barcode: '7702003000077', name: 'Brocha 3" Profesional', brand: 'Tigre', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 8500, price: 14900, taxRate: 19, description: 'Brocha profesional cerda natural 3 pulgadas', trackStock: true },
  { sku: 'PT-008', barcode: '7702003000084', name: 'Rodillo 9" con Bandeja', brand: 'Tigre', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 12000, price: 19900, taxRate: 19, description: 'Rodillo lana 9 pulgadas con bandeja plástica incluida', trackStock: true },
  { sku: 'PT-009', barcode: '7702003000091', name: 'Rodillo 4" Mini', brand: 'Tigre', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 5500, price: 9900, taxRate: 19, description: 'Mini rodillo espuma 4 pulgadas para esquinas', trackStock: true },
  { sku: 'PT-010', barcode: '7702003000107', name: 'Thinner Corriente (Galón)', brand: 'Sherwin', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 18000, price: 28900, taxRate: 19, description: 'Thinner corriente para dilución de esmaltes y limpieza', trackStock: true },
  { sku: 'PT-011', barcode: '7702003000114', name: 'Lija #100 (Pliego)', brand: 'Norton', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 1200, price: 2500, taxRate: 19, description: 'Lija al agua #100 grano medio por pliego', trackStock: true },
  { sku: 'PT-012', barcode: '7702003000121', name: 'Lija #220 (Pliego)', brand: 'Norton', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 1500, price: 2900, taxRate: 19, description: 'Lija al agua #220 grano fino por pliego', trackStock: true },
  { sku: 'PT-013', barcode: '7702003000138', name: 'Estuco Plástico (Galón)', brand: 'Pintuco', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 25000, price: 39900, taxRate: 19, description: 'Estuco plástico listo para usar galón', trackStock: true },
  { sku: 'PT-014', barcode: '7702003000145', name: 'Cinta Enmascarar 18mm x 30m', brand: 'Pegatanke', category: 'Pinturas', unitOfMeasure: 'UNIT', cost: 3500, price: 6900, taxRate: 19, description: 'Cinta de enmascarar crepé 18mm x 30 metros', trackStock: true },

  // ─────────────────────────────────────────
  // MATERIALES DE CONSTRUCCIÓN
  // ─────────────────────────────────────────
  { sku: 'MC-001', barcode: '7702004000012', name: 'Cemento Gris 50kg', brand: 'Argos', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 28000, price: 38900, taxRate: 5, description: 'Cemento portland gris uso general 50kg', trackStock: true },
  { sku: 'MC-002', barcode: '7702004000029', name: 'Cemento Blanco 25kg', brand: 'Argos', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 25000, price: 36500, taxRate: 5, description: 'Cemento blanco estructural 25kg', trackStock: true },
  { sku: 'MC-003', barcode: '7702004000036', name: 'Varilla Corrugada 3/8" x 6m', brand: 'Diaco', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 12500, price: 19900, taxRate: 5, description: 'Varilla corrugada 3/8 pulgada por 6 metros', trackStock: true },
  { sku: 'MC-004', barcode: '7702004000043', name: 'Varilla Corrugada 1/2" x 6m', brand: 'Diaco', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 18500, price: 27900, taxRate: 5, description: 'Varilla corrugada 1/2 pulgada por 6 metros', trackStock: true },
  { sku: 'MC-005', barcode: '7702004000050', name: 'Alambre Negro Cal 18 (kg)', brand: 'Proalco', category: 'Materiales de Construcción', unitOfMeasure: 'KG', cost: 4500, price: 7900, taxRate: 5, description: 'Alambre negro recocido calibre 18 por kg', trackStock: true },
  { sku: 'MC-006', barcode: '7702004000067', name: 'Bloque #4 (10x20x40)', brand: 'Ladrillera', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 1200, price: 2100, taxRate: 5, description: 'Bloque estructural #4 10x20x40cm', trackStock: true },
  { sku: 'MC-007', barcode: '7702004000074', name: 'Ladrillo Prensado (unidad)', brand: 'Ladrillera', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 800, price: 1400, taxRate: 5, description: 'Ladrillo prensado macizo para mampostería', trackStock: true },
  { sku: 'MC-008', barcode: '7702004000081', name: 'Arena Lavada (Bulto 40kg)', brand: 'Cantera', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 5000, price: 8900, taxRate: 5, description: 'Arena lavada para pegado y revoque bulto 40kg', trackStock: true },
  { sku: 'MC-009', barcode: '7702004000098', name: 'Tritura 3/4 (Bulto 40kg)', brand: 'Cantera', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 4000, price: 7500, taxRate: 5, description: 'Triturado 3/4 pulgada para concreto bulto 40kg', trackStock: true },
  { sku: 'MC-010', barcode: '7702004000104', name: 'Teja Ondulada Eternit #6 (1.83m)', brand: 'Eternit', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 25000, price: 39900, taxRate: 19, description: 'Teja ondulada fibrocemento #6 1.83m x 0.92m', trackStock: true },
  { sku: 'MC-011', barcode: '7702004000111', name: 'Teja Traslúcida #6 (1.83m)', brand: 'AcrylTecho', category: 'Materiales de Construcción', unitOfMeasure: 'UNIT', cost: 38000, price: 59900, taxRate: 19, description: 'Teja traslúcida plástica #6 1.83m', trackStock: true },
  { sku: 'MC-012', barcode: '7702004000128', name: 'Puntilla 2" (Libra)', brand: 'Proalco', category: 'Materiales de Construcción', unitOfMeasure: 'LB', cost: 3500, price: 5900, taxRate: 19, description: 'Puntilla con cabeza 2 pulgadas por libra', trackStock: true },

  // ─────────────────────────────────────────
  // TUBERÍA Y PLOMERÍA
  // ─────────────────────────────────────────
  { sku: 'TP-001', barcode: '7702005000019', name: 'Tubo PVC 1/2" x 6m Presión', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 8500, price: 14900, taxRate: 19, description: 'Tubo PVC presión 1/2 pulgada por 6 metros', trackStock: true },
  { sku: 'TP-002', barcode: '7702005000026', name: 'Tubo PVC 2" x 6m Sanitario', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 22000, price: 34900, taxRate: 19, description: 'Tubo PVC sanitario 2 pulgadas por 6 metros', trackStock: true },
  { sku: 'TP-003', barcode: '7702005000033', name: 'Codo PVC 1/2" x 90°', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 800, price: 1900, taxRate: 19, description: 'Codo PVC presión 1/2 pulgada 90 grados', trackStock: true },
  { sku: 'TP-004', barcode: '7702005000040', name: 'Tee PVC 1/2" Presión', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 900, price: 2100, taxRate: 19, description: 'Te PVC presión 1/2 pulgada', trackStock: true },
  { sku: 'TP-005', barcode: '7702005000057', name: 'Registro Bola 1/2" PVC', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 4500, price: 8900, taxRate: 19, description: 'Registro de bola PVC 1/2 pulgada soldable', trackStock: true },
  { sku: 'TP-006', barcode: '7702005000064', name: 'Registro Bola 2" PVC', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 18000, price: 29900, taxRate: 19, description: 'Registro de bola PVC 2 pulgadas soldable', trackStock: true },
  { sku: 'TP-007', barcode: '7702005000071', name: 'Teflón Rollo Grande', brand: 'Super Teflón', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 1200, price: 2900, taxRate: 19, description: 'Cinta teflón para roscas rollo grande 12m', trackStock: true },
  { sku: 'TP-008', barcode: '7702005000088', name: 'Soldadura PVC 1/4 Gal', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 8500, price: 15900, taxRate: 19, description: 'Soldadura líquida PVC 1/4 galón', trackStock: true },
  { sku: 'TP-009', barcode: '7702005000095', name: 'Limpiador PVC 1/4 Gal', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 6500, price: 12900, taxRate: 19, description: 'Limpiador PVC 1/4 galón para preparación de uniones', trackStock: true },
  { sku: 'TP-010', barcode: '7702005000101', name: 'Sifón Lavamanos 1-1/4"', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 7500, price: 13900, taxRate: 19, description: 'Sifón flexible para lavamanos 1-1/4 pulgadas', trackStock: true },
  { sku: 'TP-011', barcode: '7702005000118', name: 'Unión PVC 1/2" Presión', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 600, price: 1500, taxRate: 19, description: 'Unión PVC presión 1/2 pulgada', trackStock: true },
  { sku: 'TP-012', barcode: '7702005000125', name: 'Adaptador Macho PVC 1/2"', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 700, price: 1600, taxRate: 19, description: 'Adaptador macho PVC presión 1/2 pulgada', trackStock: true },
  { sku: 'TP-013', barcode: '7702005000132', name: 'Tubo CPVC 1/2" x 3m Agua Caliente', brand: 'Pavco', category: 'Tubería y Plomería', unitOfMeasure: 'UNIT', cost: 18500, price: 29900, taxRate: 19, description: 'Tubo CPVC para agua caliente 1/2 pulgada x 3 metros', trackStock: true },

  // ─────────────────────────────────────────
  // ELÉCTRICOS
  // ─────────────────────────────────────────
  { sku: 'EL-001', barcode: '7702006000016', name: 'Cable THW #12 AWG (metro)', brand: 'Centelsa', category: 'Eléctricos', unitOfMeasure: 'METER', cost: 2200, price: 3900, taxRate: 19, description: 'Cable THW calibre 12 AWG cobre por metro', trackStock: true },
  { sku: 'EL-002', barcode: '7702006000023', name: 'Cable THW #14 AWG (metro)', brand: 'Centelsa', category: 'Eléctricos', unitOfMeasure: 'METER', cost: 1600, price: 2900, taxRate: 19, description: 'Cable THW calibre 14 AWG cobre por metro', trackStock: true },
  { sku: 'EL-003', barcode: '7702006000030', name: 'Cable THW #10 AWG (metro)', brand: 'Centelsa', category: 'Eléctricos', unitOfMeasure: 'METER', cost: 3500, price: 5900, taxRate: 19, description: 'Cable THW calibre 10 AWG cobre por metro', trackStock: true },
  { sku: 'EL-004', barcode: '7702006000047', name: 'Interruptor Sencillo', brand: 'Legrand', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 4500, price: 8900, taxRate: 19, description: 'Interruptor sencillo línea doméstica blanco', trackStock: true },
  { sku: 'EL-005', barcode: '7702006000054', name: 'Toma Doble con Polo a Tierra', brand: 'Legrand', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 5500, price: 9900, taxRate: 19, description: 'Toma doble con polo a tierra blanco', trackStock: true },
  { sku: 'EL-006', barcode: '7702006000061', name: 'Bombillo LED 9W Luz Fría', brand: 'Sylvania', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 5000, price: 8900, taxRate: 19, description: 'Bombillo LED A60 9W E27 luz fría 6500K', trackStock: true },
  { sku: 'EL-007', barcode: '7702006000078', name: 'Bombillo LED 12W Luz Cálida', brand: 'Sylvania', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 6000, price: 9900, taxRate: 19, description: 'Bombillo LED A60 12W E27 luz cálida 3000K', trackStock: true },
  { sku: 'EL-008', barcode: '7702006000085', name: 'Cinta Aislante 3M 18m', brand: '3M', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 3500, price: 6900, taxRate: 19, description: 'Cinta aislante Temflex 3M negra 18 metros', trackStock: true },
  { sku: 'EL-009', barcode: '7702006000092', name: 'Breaker 1x20A Riel DIN', brand: 'Schneider', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 12000, price: 19900, taxRate: 19, description: 'Breaker monopolar 20 amperios riel DIN', trackStock: true },
  { sku: 'EL-010', barcode: '7702006000108', name: 'Breaker 1x32A Riel DIN', brand: 'Schneider', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 14000, price: 22900, taxRate: 19, description: 'Breaker monopolar 32 amperios', trackStock: true },
  { sku: 'EL-011', barcode: '7702006000115', name: 'Caja Breaker 4 Polos Empotrar', brand: 'Legrand', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 8500, price: 15900, taxRate: 19, description: 'Caja para breakers 4 polos empotrable plástica', trackStock: true },
  { sku: 'EL-012', barcode: '7702006000122', name: 'Tubo Conduit PVC 3/4" x 3m', brand: 'Pavco', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 4500, price: 8900, taxRate: 19, description: 'Tubo conduit PVC 3/4 pulgada x 3 metros', trackStock: true },
  { sku: 'EL-013', barcode: '7702006000139', name: 'Curva Conduit PVC 3/4"', brand: 'Pavco', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 1200, price: 2500, taxRate: 19, description: 'Curva conduit PVC 3/4 pulgada 90 grados', trackStock: true },
  { sku: 'EL-014', barcode: '7702006000146', name: 'Cinta Reflectiva Roja (Rollo 10m)', brand: '3M', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 12000, price: 19900, taxRate: 19, description: 'Cinta reflectiva roja rollo 10 metros', trackStock: true },
  { sku: 'EL-015', barcode: '7702006000153', name: 'Extensión Eléctrica 5m 3 Tomas', brand: 'Veto', category: 'Eléctricos', unitOfMeasure: 'UNIT', cost: 18000, price: 29900, taxRate: 19, description: 'Extensión eléctrica 3 tomas calibre 16 5 metros', trackStock: true },

  // ─────────────────────────────────────────
  // CERRADURAS Y SEGURIDAD
  // ─────────────────────────────────────────
  { sku: 'CS-001', barcode: '7702007000013', name: 'Candado 40mm Laminado', brand: 'Yale', category: 'Cerraduras y Seguridad', unitOfMeasure: 'UNIT', cost: 18000, price: 29900, taxRate: 19, description: 'Candado laminado 40mm con 3 llaves', trackStock: true },
  { sku: 'CS-002', barcode: '7702007000020', name: 'Candado 60mm Alta Seguridad', brand: 'Yale', category: 'Cerraduras y Seguridad', unitOfMeasure: 'UNIT', cost: 32000, price: 49900, taxRate: 19, description: 'Candado alta seguridad 60mm cuerpo acero endurecido', trackStock: true },
  { sku: 'CS-003', barcode: '7702007000037', name: 'Cerradura de Pomo Baño', brand: 'Yale', category: 'Cerraduras y Seguridad', unitOfMeasure: 'UNIT', cost: 28000, price: 45900, taxRate: 19, description: 'Cerradura de pomo para baño cromada', trackStock: true },
  { sku: 'CS-004', barcode: '7702007000044', name: 'Cerradura Principal 3 Golpes', brand: 'Schlage', category: 'Cerraduras y Seguridad', unitOfMeasure: 'UNIT', cost: 65000, price: 99900, taxRate: 19, description: 'Cerradura principal 3 golpes alta seguridad', trackStock: true },
  { sku: 'CS-005', barcode: '7702007000051', name: 'Bisagra Puerta 3" x 3" (Par)', brand: 'Genérica', category: 'Cerraduras y Seguridad', unitOfMeasure: 'UNIT', cost: 4500, price: 8900, taxRate: 19, description: 'Bisagra metálica reforzada 3x3 pulgadas por par', trackStock: true },
  { sku: 'CS-006', barcode: '7702007000068', name: 'Pasador Puerta 6" Cromado', brand: 'Yale', category: 'Cerraduras y Seguridad', unitOfMeasure: 'UNIT', cost: 5500, price: 9900, taxRate: 19, description: 'Pasador de puerta cromado 6 pulgadas', trackStock: true },
  { sku: 'CS-007', barcode: '7702007000075', name: 'Cadena Seguridad 1m Eslabón 6mm', brand: 'Yale', category: 'Cerraduras y Seguridad', unitOfMeasure: 'UNIT', cost: 15000, price: 24900, taxRate: 19, description: 'Cadena de seguridad 1 metro eslabón 6mm', trackStock: true },

  // ─────────────────────────────────────────
  // FIJACIÓN Y TORNILLERÍA
  // ─────────────────────────────────────────
  { sku: 'FT-001', barcode: '7702008000010', name: 'Tornillo Drywall 6x1" (Caja 100)', brand: 'Fix', category: 'Fijación y Tornillería', unitOfMeasure: 'BOX', cost: 5500, price: 9900, taxRate: 19, description: 'Tornillos drywall cabeza bugle 6x1 pulgada caja x100', trackStock: true },
  { sku: 'FT-002', barcode: '7702008000027', name: 'Tornillo Drywall 8x2" (Caja 50)', brand: 'Fix', category: 'Fijación y Tornillería', unitOfMeasure: 'BOX', cost: 6000, price: 10900, taxRate: 19, description: 'Tornillos drywall cabeza bugle 8x2 pulgadas caja x50', trackStock: true },
  { sku: 'FT-003', barcode: '7702008000034', name: 'Tornillo Madera 8x1-1/2" (Caja 100)', brand: 'Fix', category: 'Fijación y Tornillería', unitOfMeasure: 'BOX', cost: 7000, price: 12900, taxRate: 19, description: 'Tornillos para madera cabeza avellanada 8x1-1/2 caja x100', trackStock: true },
  { sku: 'FT-004', barcode: '7702008000041', name: 'Chazo Plástico 1/4" (Bolsa 100)', brand: 'Fischer', category: 'Fijación y Tornillería', unitOfMeasure: 'BAG', cost: 4000, price: 7900, taxRate: 19, description: 'Chazos plásticos de expansión 1/4 pulgada bolsa x100', trackStock: true },
  { sku: 'FT-005', barcode: '7702008000058', name: 'Chazo Plástico 3/8" (Bolsa 50)', brand: 'Fischer', category: 'Fijación y Tornillería', unitOfMeasure: 'BAG', cost: 5000, price: 8900, taxRate: 19, description: 'Chazos plásticos de expansión 3/8 pulgada bolsa x50', trackStock: true },
  { sku: 'FT-006', barcode: '7702008000065', name: 'Silicona Transparente 280ml', brand: 'Sika', category: 'Fijación y Tornillería', unitOfMeasure: 'UNIT', cost: 8000, price: 14900, taxRate: 19, description: 'Silicona acética transparente 280ml para sellado', trackStock: true },
  { sku: 'FT-007', barcode: '7702008000072', name: 'Silicona Blanca 280ml', brand: 'Sika', category: 'Fijación y Tornillería', unitOfMeasure: 'UNIT', cost: 8000, price: 14900, taxRate: 19, description: 'Silicona acética blanca 280ml para baños y cocinas', trackStock: true },
  { sku: 'FT-008', barcode: '7702008000089', name: 'Clavos 2-1/2" (Libra)', brand: 'Proalco', category: 'Fijación y Tornillería', unitOfMeasure: 'LB', cost: 3500, price: 5900, taxRate: 19, description: 'Clavos con cabeza 2-1/2 pulgadas por libra', trackStock: true },
  { sku: 'FT-009', barcode: '7702008000096', name: 'Abrazadera Metálica 1/2"', brand: 'Genérica', category: 'Fijación y Tornillería', unitOfMeasure: 'UNIT', cost: 500, price: 1200, taxRate: 19, description: 'Abrazadera metálica tipo omega 1/2 pulgada', trackStock: true },
  { sku: 'FT-010', barcode: '7702008000102', name: 'Anclaje Expansión 3/8" (Caja 50)', brand: 'Fischer', category: 'Fijación y Tornillería', unitOfMeasure: 'BOX', cost: 15000, price: 24900, taxRate: 19, description: 'Anclajes metálicos de expansión 3/8 pulgada caja x50', trackStock: true },

  // ─────────────────────────────────────────
  // JARDINERÍA Y AGRO
  // ─────────────────────────────────────────
  { sku: 'JR-001', barcode: '7702009000017', name: 'Manguera 1/2" x 20m', brand: 'Tramontina', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 35000, price: 54900, taxRate: 19, description: 'Manguera para riego 1/2 pulgada por 20 metros reforzada', trackStock: true },
  { sku: 'JR-002', barcode: '7702009000024', name: 'Manguera Premium 5/8" x 25m', brand: 'Tramontina', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 48000, price: 74900, taxRate: 19, description: 'Manguera premium 5/8 pulgada x 25 metros 6 capas', trackStock: true },
  { sku: 'JR-003', barcode: '7702009000031', name: 'Pala Redonda Mango Largo', brand: 'Truper', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 22000, price: 36900, taxRate: 19, description: 'Pala punta redonda con mango de madera largo', trackStock: true },
  { sku: 'JR-004', barcode: '7702009000048', name: 'Machete 18" con Funda', brand: 'Collins', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 18000, price: 29900, taxRate: 19, description: 'Machete 18 pulgadas acero con funda protectora', trackStock: true },
  { sku: 'JR-005', barcode: '7702009000055', name: 'Rastrillo Metálico 14 Dientes', brand: 'Truper', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 15000, price: 26900, taxRate: 19, description: 'Rastrillo metálico 14 dientes mango madera', trackStock: true },
  { sku: 'JR-006', barcode: '7702009000062', name: 'Azadón con Mango', brand: 'Truper', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 17000, price: 28900, taxRate: 19, description: 'Azadón forjado con mango de madera 54 pulgadas', trackStock: true },
  { sku: 'JR-007', barcode: '7702009000079', name: 'Tijera Podadora 8"', brand: 'Tramontina', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 12000, price: 21900, taxRate: 19, description: 'Tijera podadora 8 pulgadas bypass profesional', trackStock: true },
  { sku: 'JR-008', barcode: '7702009000086', name: 'Fumigadora Manual 5L', brand: 'Truper', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 28000, price: 45900, taxRate: 19, description: 'Fumigadora manual de espalda 5 litros', trackStock: true },
  { sku: 'JR-009', barcode: '7702009000093', name: 'Sustrato Tierra Negra (Bulto 25kg)', brand: 'Nutriplant', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 8000, price: 13900, taxRate: 5, description: 'Sustrato tierra negra abonada bulto 25kg', trackStock: true },
  { sku: 'JR-010', barcode: '7702009000109', name: 'Abono NPK 15-15-15 (Bulto 50kg)', brand: 'Nutriplant', category: 'Jardinería', unitOfMeasure: 'UNIT', cost: 45000, price: 65900, taxRate: 5, description: 'Fertilizante NPK 15-15-15 granulado bulto 50kg', trackStock: true },

  // ─────────────────────────────────────────
  // SEGURIDAD INDUSTRIAL
  // ─────────────────────────────────────────
  { sku: 'SI-001', barcode: '7702010000010', name: 'Casco Seguridad Blanco', brand: '3M', category: 'Seguridad Industrial', unitOfMeasure: 'UNIT', cost: 15000, price: 24900, taxRate: 19, description: 'Casco de seguridad blanco ratchet ajustable', trackStock: true },
  { sku: 'SI-002', barcode: '7702010000027', name: 'Gafas Seguridad Transparente', brand: '3M', category: 'Seguridad Industrial', unitOfMeasure: 'UNIT', cost: 6500, price: 11900, taxRate: 19, description: 'Gafas de seguridad lente transparente antirrayaduras', trackStock: true },
  { sku: 'SI-003', barcode: '7702010000034', name: 'Guantes de Nitrilo (Par)', brand: 'SteelPro', category: 'Seguridad Industrial', unitOfMeasure: 'UNIT', cost: 8500, price: 14900, taxRate: 19, description: 'Guantes de nitrilo recubierto antideslizante por par', trackStock: true },
  { sku: 'SI-004', barcode: '7702010000041', name: 'Guantes de Carnaza (Par)', brand: 'Truper', category: 'Seguridad Industrial', unitOfMeasure: 'UNIT', cost: 9500, price: 16900, taxRate: 19, description: 'Guantes de carnaza reforzados para trabajo pesado', trackStock: true },
  { sku: 'SI-005', barcode: '7702010000058', name: 'Tapabocas N95 (Caja 20)', brand: '3M', category: 'Seguridad Industrial', unitOfMeasure: 'BOX', cost: 25000, price: 39900, taxRate: 19, description: 'Respirador N95 partículas sin válvula caja x20 und', trackStock: true },
  { sku: 'SI-006', barcode: '7702010000065', name: 'Protector Auditivo Copa', brand: '3M', category: 'Seguridad Industrial', unitOfMeasure: 'UNIT', cost: 18000, price: 29900, taxRate: 19, description: 'Protector auditivo tipo copa NRR 25dB', trackStock: true },
  { sku: 'SI-007', barcode: '7702010000072', name: 'Arnés Cuerpo Completo', brand: 'SteelPro', category: 'Seguridad Industrial', unitOfMeasure: 'UNIT', cost: 85000, price: 129900, taxRate: 19, description: 'Arnés de seguridad cuerpo completo 5 puntos anclaje dorsal', trackStock: true },
  { sku: 'SI-008', barcode: '7702010000089', name: 'Línea de Vida 1.8m', brand: 'SteelPro', category: 'Seguridad Industrial', unitOfMeasure: 'UNIT', cost: 35000, price: 54900, taxRate: 19, description: 'Línea de vida con absorbedor de impacto 1.8 metros', trackStock: true },
  { sku: 'SI-009', barcode: '7702010000096', name: 'Señalización Cinta Peligro (Rollo)', brand: '3M', category: 'Seguridad Industrial', unitOfMeasure: 'UNIT', cost: 8000, price: 13900, taxRate: 19, description: 'Cinta de señalización peligro amarillo/negro rollo 100m', trackStock: true },
  { sku: 'SI-010', barcode: '7702010000102', name: 'Botas de Caucho Negras (Par)', brand: 'Croydon', category: 'Seguridad Industrial', unitOfMeasure: 'UNIT', cost: 35000, price: 54900, taxRate: 19, description: 'Botas de caucho negras con plantilla por par', trackStock: true },

  // ─────────────────────────────────────────
  // FERRETERÍA GENERAL
  // ─────────────────────────────────────────
  { sku: 'FG-001', barcode: '7702011000017', name: 'Cuerda Nylon 5mm (Rollo 50m)', brand: 'Genérica', category: 'Ferretería General', unitOfMeasure: 'UNIT', cost: 12000, price: 21900, taxRate: 19, description: 'Cuerda nylon trenzada 5mm rollo 50 metros', trackStock: true },
  { sku: 'FG-002', barcode: '7702011000024', name: 'Lija de Agua #80 (Pliego)', brand: 'Norton', category: 'Ferretería General', unitOfMeasure: 'UNIT', cost: 1000, price: 2200, taxRate: 19, description: 'Lija de agua #80 grano grueso por pliego', trackStock: true },
  { sku: 'FG-003', barcode: '7702011000031', name: 'Lija de Agua #150 (Pliego)', brand: 'Norton', category: 'Ferretería General', unitOfMeasure: 'UNIT', cost: 1200, price: 2500, taxRate: 19, description: 'Lija de agua #150 grano medio-fino por pliego', trackStock: true },
  { sku: 'FG-004', barcode: '7702011000048', name: 'Espátula 3"', brand: 'Truper', category: 'Ferretería General', unitOfMeasure: 'UNIT', cost: 4500, price: 8900, taxRate: 19, description: 'Espátula metálica 3 pulgadas mango plástico', trackStock: true },
  { sku: 'FG-005', barcode: '7702011000055', name: 'Llana Lisa 11x26cm', brand: 'Truper', category: 'Ferretería General', unitOfMeasure: 'UNIT', cost: 8500, price: 14900, taxRate: 19, description: 'Llana lisa metálica 11x26cm para pañete y estuco', trackStock: true },
  { sku: 'FG-006', barcode: '7702011000062', name: 'Cincel Punta Plana 12"', brand: 'Truper', category: 'Ferretería General', unitOfMeasure: 'UNIT', cost: 11000, price: 18900, taxRate: 19, description: 'Cincel punta plana 12 pulgadas para demolición', trackStock: true },
  { sku: 'FG-007', barcode: '7702011000079', name: 'Maceta 4lb con Mango', brand: 'Truper', category: 'Ferretería General', unitOfMeasure: 'UNIT', cost: 16000, price: 27900, taxRate: 19, description: 'Maceta 4 libras con mango de fibra de vidrio', trackStock: true },
  { sku: 'FG-008', barcode: '7702011000086', name: 'Escuadra Metálica 30cm', brand: 'Stanley', category: 'Ferretería General', unitOfMeasure: 'UNIT', cost: 9500, price: 16900, taxRate: 19, description: 'Escuadra metálica combinada 30cm', trackStock: true },
  { sku: 'FG-009', barcode: '7702011000093', name: 'Lima Plana Bastarda 10"', brand: 'Truper', category: 'Ferretería General', unitOfMeasure: 'UNIT', cost: 8500, price: 14900, taxRate: 19, description: 'Lima plana bastarda 10 pulgadas con mango', trackStock: true },
  { sku: 'FG-010', barcode: '7702011000109', name: 'Juego Brocas Metal (13pcs 1-6.5mm)', brand: 'DeWalt', category: 'Ferretería General', unitOfMeasure: 'SET', cost: 22000, price: 39900, taxRate: 19, description: 'Juego brocas HSS para metal 13 piezas 1mm a 6.5mm', trackStock: true },
  { sku: 'FG-011', barcode: '7702011000116', name: 'Juego Brocas Concreto (5pcs)', brand: 'DeWalt', category: 'Ferretería General', unitOfMeasure: 'SET', cost: 28000, price: 47900, taxRate: 19, description: 'Juego brocas SDS para concreto 5 piezas 5-10mm', trackStock: true },
  { sku: 'FG-012', barcode: '7702011000123', name: 'Aceite Multiusos WD-40 300ml', brand: 'WD-40', category: 'Ferretería General', unitOfMeasure: 'UNIT', cost: 12000, price: 19900, taxRate: 19, description: 'Aceite multiusos WD-40 spray 300ml', trackStock: true },
]

async function main() {
  console.log('Conectando a tenant_riot...')
  
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
      console.log(`  ${p.sku} — ${p.name}`)
      created++
    } catch (err: any) {
      if (err.code === 'P2002') {
        console.log(`  ${p.sku} — ya existe (barcode/sku duplicado), skipping`)
        skipped++
      } else {
        console.error(`  ${p.sku} — ERROR: ${err.message}`)
      }
    }
  }
  
  console.log(`\nSeed completado: ${created} creados/actualizados, ${skipped} omitidos`)
  console.log(`Total productos definidos: ${products.length}`)
}

main()
  .catch(e => {
    console.error('Error fatal:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
