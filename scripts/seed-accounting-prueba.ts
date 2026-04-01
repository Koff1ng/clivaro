/**
 * Seed: Datos de Contabilidad para tenant "prueba"
 * Ejecutar: npx tsx scripts/seed-accounting-prueba.ts
 * 
 * Crea:
 * - Plan Único de Cuentas (PUC) colombiano completo con jerarquía
 * - Configuración contable (AccountingConfig) vinculada a cuentas clave
 * - Terceros contables de ejemplo
 * - Períodos contables 2025 y 2026
 * - Asientos de diario de ejemplo (apertura, ventas, compras, gastos)
 */

import { PrismaClient } from '@prisma/client'

const DATABASE_URL = process.env.DATABASE_URL || process.env.DIRECT_URL || ''
if (!DATABASE_URL) { console.error('❌ DATABASE_URL no encontrada'); process.exit(1) }

// Master prisma to get tenant ID
const masterPrisma = new PrismaClient()

function buildTenantUrl(schema: string): string {
  const urlObj = new URL(DATABASE_URL)
  urlObj.searchParams.set('schema', schema)
  return urlObj.toString()
}

// Tenant prisma: accounting data goes to the tenant's isolated schema
const tenantPrisma = new PrismaClient({
  datasources: { db: { url: buildTenantUrl('tenant_prueba') } },
})

// ── PUC (Plan Único de Cuentas) ──
// Estructura jerárquica: Class > Group > Account > Sub-account > Auxiliary
interface PUCEntry {
  code: string
  name: string
  type: string
  nature: string
  level: number
  tags?: string[]
  requiresThirdParty?: boolean
}

const pucAccounts: PUCEntry[] = [
  // ── CLASE 1: ACTIVOS ──
  { code: '1', name: 'ACTIVOS', type: 'ASSET', nature: 'DEBIT', level: 1 },
  { code: '11', name: 'Disponible', type: 'ASSET', nature: 'DEBIT', level: 2 },
  { code: '1105', name: 'Caja', type: 'ASSET', nature: 'DEBIT', level: 3 },
  { code: '110505', name: 'Caja General', type: 'ASSET', nature: 'DEBIT', level: 4, tags: ['CASH'] },
  { code: '110510', name: 'Caja Menor', type: 'ASSET', nature: 'DEBIT', level: 4, tags: ['CASH'] },
  { code: '1110', name: 'Bancos', type: 'ASSET', nature: 'DEBIT', level: 3 },
  { code: '111005', name: 'Banco Nacionales', type: 'ASSET', nature: 'DEBIT', level: 4, tags: ['BANK'] },
  { code: '111010', name: 'Banco de Bogotá', type: 'ASSET', nature: 'DEBIT', level: 4, tags: ['BANK'] },
  { code: '111015', name: 'Bancolombia', type: 'ASSET', nature: 'DEBIT', level: 4, tags: ['BANK'] },
  { code: '12', name: 'Inversiones', type: 'ASSET', nature: 'DEBIT', level: 2 },
  { code: '1205', name: 'Acciones', type: 'ASSET', nature: 'DEBIT', level: 3 },
  { code: '13', name: 'Deudores', type: 'ASSET', nature: 'DEBIT', level: 2 },
  { code: '1305', name: 'Clientes', type: 'ASSET', nature: 'DEBIT', level: 3, requiresThirdParty: true },
  { code: '130505', name: 'Clientes Nacionales', type: 'ASSET', nature: 'DEBIT', level: 4, requiresThirdParty: true },
  { code: '1355', name: 'Anticipos y Avances', type: 'ASSET', nature: 'DEBIT', level: 3 },
  { code: '1380', name: 'Deudores Varios', type: 'ASSET', nature: 'DEBIT', level: 3 },
  { code: '14', name: 'Inventarios', type: 'ASSET', nature: 'DEBIT', level: 2 },
  { code: '1435', name: 'Mercancías no Fabricadas', type: 'ASSET', nature: 'DEBIT', level: 3 },
  { code: '143505', name: 'Mercancía en Almacén', type: 'ASSET', nature: 'DEBIT', level: 4 },
  { code: '15', name: 'Propiedad, Planta y Equipo', type: 'ASSET', nature: 'DEBIT', level: 2 },
  { code: '1524', name: 'Equipo de Oficina', type: 'ASSET', nature: 'DEBIT', level: 3 },
  { code: '1528', name: 'Equipo de Computación', type: 'ASSET', nature: 'DEBIT', level: 3 },
  { code: '1592', name: 'Depreciación Acumulada', type: 'ASSET', nature: 'CREDIT', level: 3 },

  // ── CLASE 2: PASIVOS ──
  { code: '2', name: 'PASIVOS', type: 'LIABILITY', nature: 'CREDIT', level: 1 },
  { code: '21', name: 'Obligaciones Financieras', type: 'LIABILITY', nature: 'CREDIT', level: 2 },
  { code: '2105', name: 'Bancos Nacionales', type: 'LIABILITY', nature: 'CREDIT', level: 3 },
  { code: '22', name: 'Proveedores', type: 'LIABILITY', nature: 'CREDIT', level: 2 },
  { code: '2205', name: 'Proveedores Nacionales', type: 'LIABILITY', nature: 'CREDIT', level: 3, requiresThirdParty: true },
  { code: '220505', name: 'Proveedores Nacionales', type: 'LIABILITY', nature: 'CREDIT', level: 4, requiresThirdParty: true },
  { code: '23', name: 'Cuentas por Pagar', type: 'LIABILITY', nature: 'CREDIT', level: 2 },
  { code: '2335', name: 'Costos y Gastos por Pagar', type: 'LIABILITY', nature: 'CREDIT', level: 3 },
  { code: '2365', name: 'Retención en la Fuente', type: 'LIABILITY', nature: 'CREDIT', level: 3, tags: ['RETENTION_SOURCE'] },
  { code: '2367', name: 'Impuesto a las Ventas Retenido', type: 'LIABILITY', nature: 'CREDIT', level: 3, tags: ['RETENTION_IVA'] },
  { code: '2368', name: 'Impuesto de Industria y Comercio Retenido', type: 'LIABILITY', nature: 'CREDIT', level: 3, tags: ['RETENTION_ICA'] },
  { code: '24', name: 'Impuestos, Gravámenes y Tasas', type: 'LIABILITY', nature: 'CREDIT', level: 2 },
  { code: '2404', name: 'Impuesto de Renta', type: 'LIABILITY', nature: 'CREDIT', level: 3 },
  { code: '2408', name: 'IVA por Pagar', type: 'LIABILITY', nature: 'CREDIT', level: 3, tags: ['VAT_GENERATED'] },
  { code: '240805', name: 'IVA Generado 19%', type: 'LIABILITY', nature: 'CREDIT', level: 4, tags: ['VAT_GENERATED'] },
  { code: '25', name: 'Obligaciones Laborales', type: 'LIABILITY', nature: 'CREDIT', level: 2 },
  { code: '2505', name: 'Salarios por Pagar', type: 'LIABILITY', nature: 'CREDIT', level: 3 },
  { code: '2510', name: 'Cesantías Consolidadas', type: 'LIABILITY', nature: 'CREDIT', level: 3 },
  { code: '2515', name: 'Intereses sobre Cesantías', type: 'LIABILITY', nature: 'CREDIT', level: 3 },
  { code: '2520', name: 'Prima de Servicios', type: 'LIABILITY', nature: 'CREDIT', level: 3 },
  { code: '2525', name: 'Vacaciones Consolidadas', type: 'LIABILITY', nature: 'CREDIT', level: 3 },

  // ── CLASE 3: PATRIMONIO ──
  { code: '3', name: 'PATRIMONIO', type: 'EQUITY', nature: 'CREDIT', level: 1 },
  { code: '31', name: 'Capital Social', type: 'EQUITY', nature: 'CREDIT', level: 2 },
  { code: '3105', name: 'Capital Suscrito y Pagado', type: 'EQUITY', nature: 'CREDIT', level: 3 },
  { code: '33', name: 'Reservas', type: 'EQUITY', nature: 'CREDIT', level: 2 },
  { code: '3305', name: 'Reserva Legal', type: 'EQUITY', nature: 'CREDIT', level: 3 },
  { code: '36', name: 'Resultados del Ejercicio', type: 'EQUITY', nature: 'CREDIT', level: 2 },
  { code: '3605', name: 'Utilidad del Ejercicio', type: 'EQUITY', nature: 'CREDIT', level: 3 },
  { code: '3610', name: 'Pérdida del Ejercicio', type: 'EQUITY', nature: 'DEBIT', level: 3 },
  { code: '37', name: 'Resultados de Ejercicios Anteriores', type: 'EQUITY', nature: 'CREDIT', level: 2 },
  { code: '3705', name: 'Utilidades Acumuladas', type: 'EQUITY', nature: 'CREDIT', level: 3 },

  // ── CLASE 4: INGRESOS ──
  { code: '4', name: 'INGRESOS', type: 'INCOME', nature: 'CREDIT', level: 1 },
  { code: '41', name: 'Ingresos Operacionales', type: 'INCOME', nature: 'CREDIT', level: 2 },
  { code: '4135', name: 'Comercio al por Mayor y al por Menor', type: 'INCOME', nature: 'CREDIT', level: 3 },
  { code: '413505', name: 'Venta de Mercancías', type: 'INCOME', nature: 'CREDIT', level: 4 },
  { code: '413510', name: 'Venta de Productos Ferreteros', type: 'INCOME', nature: 'CREDIT', level: 4 },
  { code: '42', name: 'Ingresos No Operacionales', type: 'INCOME', nature: 'CREDIT', level: 2 },
  { code: '4210', name: 'Financieros', type: 'INCOME', nature: 'CREDIT', level: 3 },

  // ── CLASE 5: GASTOS ──
  { code: '5', name: 'GASTOS', type: 'EXPENSE', nature: 'DEBIT', level: 1 },
  { code: '51', name: 'Gastos Operacionales de Administración', type: 'EXPENSE', nature: 'DEBIT', level: 2 },
  { code: '5105', name: 'Gastos de Personal', type: 'EXPENSE', nature: 'DEBIT', level: 3 },
  { code: '510506', name: 'Sueldos', type: 'EXPENSE', nature: 'DEBIT', level: 4 },
  { code: '510515', name: 'Horas Extras', type: 'EXPENSE', nature: 'DEBIT', level: 4 },
  { code: '510527', name: 'Auxilio de Transporte', type: 'EXPENSE', nature: 'DEBIT', level: 4 },
  { code: '510530', name: 'Cesantías', type: 'EXPENSE', nature: 'DEBIT', level: 4 },
  { code: '510533', name: 'Intereses sobre Cesantías', type: 'EXPENSE', nature: 'DEBIT', level: 4 },
  { code: '510536', name: 'Prima de Servicios', type: 'EXPENSE', nature: 'DEBIT', level: 4 },
  { code: '510539', name: 'Vacaciones', type: 'EXPENSE', nature: 'DEBIT', level: 4 },
  { code: '5110', name: 'Honorarios', type: 'EXPENSE', nature: 'DEBIT', level: 3 },
  { code: '5115', name: 'Impuestos', type: 'EXPENSE', nature: 'DEBIT', level: 3 },
  { code: '5120', name: 'Arrendamientos', type: 'EXPENSE', nature: 'DEBIT', level: 3 },
  { code: '5135', name: 'Servicios (Agua, Luz, Tel)', type: 'EXPENSE', nature: 'DEBIT', level: 3 },
  { code: '5140', name: 'Gastos Legales', type: 'EXPENSE', nature: 'DEBIT', level: 3 },
  { code: '5145', name: 'Mantenimiento y Reparaciones', type: 'EXPENSE', nature: 'DEBIT', level: 3 },
  { code: '5195', name: 'Gastos Diversos', type: 'EXPENSE', nature: 'DEBIT', level: 3 },
  { code: '52', name: 'Gastos Operacionales de Ventas', type: 'EXPENSE', nature: 'DEBIT', level: 2 },
  { code: '5205', name: 'Gastos de Personal de Ventas', type: 'EXPENSE', nature: 'DEBIT', level: 3 },
  { code: '5210', name: 'Honorarios de Ventas', type: 'EXPENSE', nature: 'DEBIT', level: 3 },
  { code: '5215', name: 'Publicidad y Propaganda', type: 'EXPENSE', nature: 'DEBIT', level: 3 },
  { code: '53', name: 'Gastos No Operacionales', type: 'EXPENSE', nature: 'DEBIT', level: 2 },
  { code: '5305', name: 'Gastos Financieros', type: 'EXPENSE', nature: 'DEBIT', level: 3 },

  // ── CLASE 6: COSTO DE VENTAS ──
  { code: '6', name: 'COSTO DE VENTAS', type: 'COST_SALES', nature: 'DEBIT', level: 1 },
  { code: '61', name: 'Costo de Ventas y Prestación de Servicios', type: 'COST_SALES', nature: 'DEBIT', level: 2 },
  { code: '6135', name: 'Comercio al por Mayor y Menor', type: 'COST_SALES', nature: 'DEBIT', level: 3 },
  { code: '613505', name: 'Costo de Mercancías Vendidas', type: 'COST_SALES', nature: 'DEBIT', level: 4 },

  // ── IVA Descontable (Activo) ──
  { code: '2405', name: 'IVA Descontable', type: 'ASSET', nature: 'DEBIT', level: 3, tags: ['VAT_DEDUCTIBLE'] },
  { code: '240505', name: 'IVA en Compras 19%', type: 'ASSET', nature: 'DEBIT', level: 4, tags: ['VAT_DEDUCTIBLE'] },
]

async function main() {
  console.log('🏗️  Conectando a tenant_prueba para seed contable...\n')

  // 1. Get tenant ID
  const tenant = await masterPrisma.tenant.findFirst({ where: { slug: 'prueba' }, select: { id: true } })
  if (!tenant) {
    console.error('❌ Tenant "prueba" no encontrado en master DB')
    process.exit(1)
  }
  const tenantId = tenant.id
  console.log(`✅ Tenant ID: ${tenantId}\n`)

  // 2. Create PUC accounts with hierarchy
  console.log('📊 Creando Plan de Cuentas (PUC)...')
  const accountMap = new Map<string, string>() // code → id

  // Sort by code length to ensure parents are created first
  const sorted = [...pucAccounts].sort((a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code))

  for (const acc of sorted) {
    // Find parent: longest matching prefix
    let parentId: string | null = null
    let parentCode = acc.code.slice(0, -1)
    while (parentCode.length > 0) {
      if (accountMap.has(parentCode)) {
        parentId = accountMap.get(parentCode)!
        break
      }
      // Try removing one more char (e.g., 110505 → 1105)
      if (parentCode.length > 2) {
        const altParent = acc.code.slice(0, acc.code.length - 2)
        if (accountMap.has(altParent)) {
          parentId = accountMap.get(altParent)!
          break
        }
      }
      parentCode = parentCode.slice(0, -1)
    }

    try {
      const created = await tenantPrisma.accountingAccount.upsert({
        where: { tenantId_code: { tenantId, code: acc.code } },
        update: {
          name: acc.name,
          type: acc.type,
          nature: acc.nature,
          level: acc.level,
          tags: acc.tags || [],
          requiresThirdParty: acc.requiresThirdParty || false,
          parentId,
          active: true,
        },
        create: {
          tenantId,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          nature: acc.nature,
          level: acc.level,
          tags: acc.tags || [],
          requiresThirdParty: acc.requiresThirdParty || false,
          parentId,
          active: true,
        },
      })
      accountMap.set(acc.code, created.id)
      console.log(`  ✅ ${acc.code} — ${acc.name}`)
    } catch (err: any) {
      console.error(`  ❌ ${acc.code} — ${err.message}`)
    }
  }
  console.log(`\n📊 Total cuentas: ${accountMap.size}\n`)

  // 3. Create AccountingConfig
  console.log('⚙️  Configurando cuentas predeterminadas...')
  try {
    await tenantPrisma.accountingConfig.upsert({
      where: { tenantId },
      update: {
        cashAccountId: accountMap.get('110505') || null,
        bankAccountId: accountMap.get('111015') || null,
        accountsReceivableId: accountMap.get('130505') || null,
        accountsPayableId: accountMap.get('220505') || null,
        inventoryAccountId: accountMap.get('143505') || null,
        salesRevenueId: accountMap.get('413505') || null,
        vatGeneratedId: accountMap.get('240805') || null,
        vatDeductibleId: accountMap.get('240505') || null,
        costOfSalesId: accountMap.get('613505') || null,
      },
      create: {
        tenantId,
        cashAccountId: accountMap.get('110505') || null,
        bankAccountId: accountMap.get('111015') || null,
        accountsReceivableId: accountMap.get('130505') || null,
        accountsPayableId: accountMap.get('220505') || null,
        inventoryAccountId: accountMap.get('143505') || null,
        salesRevenueId: accountMap.get('413505') || null,
        vatGeneratedId: accountMap.get('240805') || null,
        vatDeductibleId: accountMap.get('240505') || null,
        costOfSalesId: accountMap.get('613505') || null,
      },
    })
    console.log('  ✅ AccountingConfig creada/actualizada\n')
  } catch (err: any) {
    console.error(`  ❌ AccountingConfig error: ${err.message}\n`)
  }

  // 4. Create Third Parties
  console.log('👤 Creando terceros contables...')
  const thirdParties = [
    { type: 'OTHER', documentType: 'NIT', documentNumber: '900123456-1', name: 'Distribuidora Nacional de Herramientas S.A.S', email: 'ventas@dnherramientas.com', phone: '3001234567' },
    { type: 'OTHER', documentType: 'NIT', documentNumber: '800456789-2', name: 'Pintuco S.A.', email: 'pedidos@pintuco.com', phone: '3012345678' },
    { type: 'OTHER', documentType: 'NIT', documentNumber: '900789012-3', name: 'Pavco S.A.', email: 'ventas@pavco.com', phone: '3023456789' },
    { type: 'OTHER', documentType: 'NIT', documentNumber: '800111222-4', name: 'Centelsa S.A.', email: 'comercial@centelsa.com', phone: '3034567890' },
    { type: 'OTHER', documentType: 'CC', documentNumber: '1098765432', name: 'Juan Carlos Rodríguez (Empleado)', email: 'jcrodriguez@email.com', phone: '3101234567' },
    { type: 'DIAN', documentType: 'NIT', documentNumber: '800197268-4', name: 'DIAN - Dirección de Impuestos', email: 'contacto@dian.gov.co' },
    { type: 'BANK', documentType: 'NIT', documentNumber: '890903938-8', name: 'Bancolombia S.A.', email: 'empresas@bancolombia.com' },
    { type: 'PARTNER', documentType: 'CC', documentNumber: '79543210', name: 'Carlos Andrés Mejía (Socio)', email: 'carlos.mejia@email.com' },
  ]

  for (const tp of thirdParties) {
    try {
      await tenantPrisma.accountingThirdParty.upsert({
        where: { tenantId_documentNumber: { tenantId, documentNumber: tp.documentNumber } },
        update: { name: tp.name, email: tp.email, phone: tp.phone, active: true },
        create: { tenantId, ...tp, active: true },
      })
      console.log(`  ✅ ${tp.documentNumber} — ${tp.name}`)
    } catch (err: any) {
      console.error(`  ❌ ${tp.documentNumber} — ${err.message}`)
    }
  }
  console.log('')

  // 5. Create Accounting Periods (2025 + 2026)
  console.log('📅 Creando períodos contables...')
  for (const year of [2025, 2026]) {
    for (let month = 1; month <= 12; month++) {
      try {
        await tenantPrisma.accountingPeriod.upsert({
          where: { tenantId_year_month: { tenantId, year, month } },
          update: {},
          create: { tenantId, year, month, isClosed: year === 2025 },
        })
      } catch {}
    }
  }
  console.log('  ✅ Períodos 2025 (cerrados) y 2026 (abiertos) creados\n')

  // 6. Create Sample Journal Entries (2026)
  console.log('📝 Creando asientos contables de ejemplo...')

  const entries = [
    {
      number: 'AP-2026-001',
      date: new Date('2026-01-01'),
      period: '2026-01',
      type: 'OPENING',
      description: 'Asiento de apertura – Inicio ejercicio 2026',
      status: 'APPROVED',
      lines: [
        { code: '110505', debit: 5000000, credit: 0, desc: 'Saldo inicial Caja General' },
        { code: '111015', debit: 25000000, credit: 0, desc: 'Saldo inicial Bancolombia' },
        { code: '143505', debit: 18000000, credit: 0, desc: 'Saldo inicial Inventario Mercancía' },
        { code: '1528', debit: 4500000, credit: 0, desc: 'Saldo inicial Equipo de Computo' },
        { code: '3105', debit: 0, credit: 50000000, desc: 'Capital Social' },
        { code: '3705', debit: 0, credit: 2500000, desc: 'Utilidades Acumuladas' },
      ],
    },
    {
      number: 'VT-2026-001',
      date: new Date('2026-01-15'),
      period: '2026-01',
      type: 'INCOME',
      description: 'Venta de mercancía factura #FE-001 — Herramientas y pinturas',
      status: 'APPROVED',
      lines: [
        { code: '110505', debit: 1190000, credit: 0, desc: 'Entrada de efectivo por venta' },
        { code: '413505', debit: 0, credit: 1000000, desc: 'Ingreso por venta de mercancías' },
        { code: '240805', debit: 0, credit: 190000, desc: 'IVA Generado 19%' },
      ],
    },
    {
      number: 'VT-2026-002',
      date: new Date('2026-02-03'),
      period: '2026-02',
      type: 'INCOME',
      description: 'Venta de materiales de construcción FE-002',
      status: 'APPROVED',
      lines: [
        { code: '130505', debit: 2380000, credit: 0, desc: 'Cuenta por cobrar cliente' },
        { code: '413510', debit: 0, credit: 2000000, desc: 'Venta productos ferreteros' },
        { code: '240805', debit: 0, credit: 380000, desc: 'IVA Generado 19%' },
      ],
    },
    {
      number: 'CP-2026-001',
      date: new Date('2026-01-20'),
      period: '2026-01',
      type: 'EXPENSE',
      description: 'Compra mercancía a Distribuidora Nacional — FC proveedor #P-4521',
      status: 'APPROVED',
      lines: [
        { code: '143505', debit: 3000000, credit: 0, desc: 'Ingreso mercancía al inventario' },
        { code: '240505', debit: 570000, credit: 0, desc: 'IVA Descontable 19%' },
        { code: '220505', debit: 0, credit: 3570000, desc: 'Cuenta por pagar proveedor' },
      ],
    },
    {
      number: 'GS-2026-001',
      date: new Date('2026-01-31'),
      period: '2026-01',
      type: 'EXPENSE',
      description: 'Gastos operacionales enero — arriendo, servicios, personal',
      status: 'APPROVED',
      lines: [
        { code: '5120', debit: 2500000, credit: 0, desc: 'Arriendo local comercial' },
        { code: '5135', debit: 450000, credit: 0, desc: 'Servicios públicos (agua, luz, internet)' },
        { code: '510506', debit: 1800000, credit: 0, desc: 'Sueldos empleados' },
        { code: '510527', debit: 162000, credit: 0, desc: 'Auxilio de transporte' },
        { code: '111015', debit: 0, credit: 4912000, desc: 'Pago desde Bancolombia' },
      ],
    },
    {
      number: 'GS-2026-002',
      date: new Date('2026-02-28'),
      period: '2026-02',
      type: 'EXPENSE',
      description: 'Gastos operacionales febrero — arriendo y servicios',
      status: 'APPROVED',
      lines: [
        { code: '5120', debit: 2500000, credit: 0, desc: 'Arriendo local comercial' },
        { code: '5135', debit: 480000, credit: 0, desc: 'Servicios públicos' },
        { code: '111015', debit: 0, credit: 2980000, desc: 'Pago desde Bancolombia' },
      ],
    },
    {
      number: 'CV-2026-001',
      date: new Date('2026-01-15'),
      period: '2026-01',
      type: 'EXPENSE',
      description: 'Costo de ventas — mercancía vendida FE-001',
      status: 'APPROVED',
      lines: [
        { code: '613505', debit: 600000, credit: 0, desc: 'Costo mercancía vendida' },
        { code: '143505', debit: 0, credit: 600000, desc: 'Salida de inventario' },
      ],
    },
    {
      number: 'CV-2026-002',
      date: new Date('2026-02-03'),
      period: '2026-02',
      type: 'EXPENSE',
      description: 'Costo de ventas — mercancía vendida FE-002',
      status: 'APPROVED',
      lines: [
        { code: '613505', debit: 1200000, credit: 0, desc: 'Costo mercancía vendida' },
        { code: '143505', debit: 0, credit: 1200000, desc: 'Salida de inventario' },
      ],
    },
    {
      number: 'VT-2026-003',
      date: new Date('2026-03-10'),
      period: '2026-03',
      type: 'INCOME',
      description: 'Venta mostrador efectivo — productos eléctricos y plomería',
      status: 'APPROVED',
      lines: [
        { code: '110505', debit: 595000, credit: 0, desc: 'Efectivo recibido' },
        { code: '413510', debit: 0, credit: 500000, desc: 'Ventas productos ferreteros' },
        { code: '240805', debit: 0, credit: 95000, desc: 'IVA Generado 19%' },
      ],
    },
    {
      number: 'PG-2026-001',
      date: new Date('2026-02-10'),
      period: '2026-02',
      type: 'JOURNAL',
      description: 'Pago parcial a proveedor Distribuidora Nacional',
      status: 'APPROVED',
      lines: [
        { code: '220505', debit: 2000000, credit: 0, desc: 'Abono a cuenta por pagar' },
        { code: '111015', debit: 0, credit: 2000000, desc: 'Transferencia Bancolombia' },
      ],
    },
  ]

  for (const entry of entries) {
    try {
      const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
      const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)

      // Verify balance
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        console.error(`  ⚠️  ${entry.number} — DESBALANCEADO: D=${totalDebit} C=${totalCredit} — SKIPPING`)
        continue
      }

      const je = await tenantPrisma.journalEntry.upsert({
        where: { tenantId_number: { tenantId, number: entry.number } },
        update: {
          date: entry.date,
          period: entry.period,
          type: entry.type,
          description: entry.description,
          status: entry.status,
          totalDebit,
          totalCredit,
        },
        create: {
          tenantId,
          number: entry.number,
          date: entry.date,
          period: entry.period,
          type: entry.type,
          description: entry.description,
          status: entry.status,
          totalDebit,
          totalCredit,
        },
      })

      // Delete existing lines and recreate
      await tenantPrisma.journalEntryLine.deleteMany({ where: { journalEntryId: je.id } })

      for (const line of entry.lines) {
        const accountId = accountMap.get(line.code)
        if (!accountId) {
          console.error(`    ⚠️  Cuenta ${line.code} no encontrada — saltando línea`)
          continue
        }
        await tenantPrisma.journalEntryLine.create({
          data: {
            journalEntryId: je.id,
            accountId,
            description: line.desc,
            debit: line.debit,
            credit: line.credit,
          },
        })
      }

      console.log(`  ✅ ${entry.number} — ${entry.description.slice(0, 60)}... (D:$${totalDebit.toLocaleString()} C:$${totalCredit.toLocaleString()})`)
    } catch (err: any) {
      console.error(`  ❌ ${entry.number} — ${err.message}`)
    }
  }

  console.log('\n🎉 Seed contable completado exitosamente!')
  console.log(`   📊 ${accountMap.size} cuentas PUC`)
  console.log(`   👤 ${thirdParties.length} terceros`)
  console.log(`   📅 24 períodos (2025-2026)`)
  console.log(`   📝 ${entries.length} asientos contables`)
}

main()
  .catch(e => { console.error('Error fatal:', e); process.exit(1) })
  .finally(async () => {
    await tenantPrisma.$disconnect()
    await masterPrisma.$disconnect()
  })
