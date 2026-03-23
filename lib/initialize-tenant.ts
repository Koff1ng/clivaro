import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Client } from 'pg'
import { TENANT_SQL_STATEMENTS } from './tenant-sql-statements'
import { getSchemaName } from './tenant-utils'
import { initializePUC } from './accounting/service'
import { updateAccountingConfig } from './accounting/config-service'

function stripSchemaParam(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl)
    url.searchParams.delete('schema')
    return url.toString()
  } catch {
    return databaseUrl.replace(/([?&])schema=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
  }
}

function withSchemaParam(databaseUrl: string, schema: string): string {
  try {
    const url = new URL(databaseUrl)
    url.searchParams.delete('schema')
    url.searchParams.set('schema', schema)
    return url.toString()
  } catch {
    const separator = databaseUrl.includes('?') ? '&' : '?'
    const cleaned = databaseUrl.replace(/([?&])schema=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
    return `${cleaned}${separator}schema=${encodeURIComponent(schema)}`
  }
}

/**
 * Initializes a PostgreSQL tenant database.
 * Uses embedded SQL statements (no file I/O, no child_process) for full
 * compatibility with serverless environments like Vercel Lambda.
 */
async function initializePostgresTenant(databaseUrl: string, tenantId: string, tenantName: string) {
  const baseUrl = stripSchemaParam(databaseUrl)
  // CRITICAL: Use getSchemaName() — same function used at runtime by withTenantTx
  // This ensures the schema created here exactly matches the schema queried at runtime
  const schemaName = getSchemaName(tenantId)

  // Use DIRECT_DATABASE_URL or DIRECT_URL for DDL operations if available (avoids PgBouncer issues)
  const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DIRECT_URL || baseUrl
  const directUrlForSchema = stripSchemaParam(directUrl)

  console.log('='.repeat(60))
  console.log('[TENANT INIT] Iniciando inicialización de tenant PostgreSQL')
  console.log(`[TENANT INIT] ID: ${tenantId}`)
  console.log(`[TENANT INIT] Empresa: ${tenantName}`)
  console.log(`[TENANT INIT] Schema: ${schemaName}`)
  console.log('='.repeat(60))

  // Step 1: Create schema using a plain pg Client (no schema param yet)
  const baseClient = new Client({ connectionString: directUrlForSchema })
  try {
    await baseClient.connect()
    console.log(`[STEP 1/4] CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)
    await baseClient.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)
    console.log('[STEP 1/4] ✓ Schema creado')
  } catch (schemaError: any) {
    throw new Error(`Error creando schema "${schemaName}": ${schemaError?.message || schemaError}`)
  } finally {
    await baseClient.end()
  }

  // Step 2: Connect to the tenant schema and execute all CREATE TABLE / INDEX / FK statements
  console.log(`[STEP 2/4] Creando tablas en schema "${schemaName}" (${TENANT_SQL_STATEMENTS.length} statements)...`)
  const tenantSchemaUrl = withSchemaParam(directUrlForSchema, schemaName)
  const ddlClient = new Client({ connectionString: tenantSchemaUrl })

  try {
    await ddlClient.connect()
    // Set search_path so all unqualified names resolve to the tenant schema
    await ddlClient.query(`SET search_path TO "${schemaName}"`)

    let executed = 0
    let skipped = 0
    for (const stmt of TENANT_SQL_STATEMENTS) {
      try {
        await ddlClient.query(stmt)
        executed++
      } catch (stmtErr: any) {
        const msg: string = stmtErr?.message || ''
        // Ignore "already exists" errors — makes the init idempotent
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          skipped++
        } else {
          throw new Error(`Error en statement: ${msg}\nStatement: ${stmt.substring(0, 200)}`)
        }
      }
    }
    console.log(`[STEP 2/4] ✓ ${executed} statements ejecutados, ${skipped} ignorados (ya existían)`)
  } finally {
    await ddlClient.end()
  }

  // Step 2.5: Ensure critical schema sync for existing tables
  // This handles the case where reinit is run on an outdated schema
  console.log(`[STEP 2.5/4] Sincronizando columnas legales en "${schemaName}"...`)
  const syncClient = new Client({ connectionString: tenantSchemaUrl })
  try {
    await syncClient.connect()
    await syncClient.query(`SET search_path TO "${schemaName}"`)
    await syncClient.query(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "legalAccepted" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "legalAcceptedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "legalVersion" TEXT,
      ADD COLUMN IF NOT EXISTS "marketingAccepted" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "acceptanceIp" TEXT;
    `)
    console.log('[STEP 2.5/4] ✓ Columnas sincronizadas')
  } catch (syncErr: any) {
    console.warn(`[TENANT INIT] Warning during schema sync: ${syncErr.message}`)
  } finally {
    await syncClient.end()
  }

  // Step 2.6: Sync SoftRestaurant / Professional / AI features
  console.log(`[STEP 2.6/4] Sincronizando campos avanzados en "${schemaName}"...`)
  const srClient = new Client({ connectionString: tenantSchemaUrl })
  try {
    await srClient.connect()
    await srClient.query(`SET search_path TO "${schemaName}"`)

    // Product columns
    await srClient.query(`
      ALTER TABLE "Product" 
      ADD COLUMN IF NOT EXISTS "barcode" TEXT,
      ADD COLUMN IF NOT EXISTS "brand" TEXT,
      ADD COLUMN IF NOT EXISTS "category" TEXT,
      ADD COLUMN IF NOT EXISTS "unitOfMeasure" TEXT NOT NULL DEFAULT 'UNIT',
      ADD COLUMN IF NOT EXISTS "productType" TEXT NOT NULL DEFAULT 'RETAIL',
      ADD COLUMN IF NOT EXISTS "enableRecipeConsumption" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "percentageMerma" DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "stockAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "trackStock" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "description" TEXT,
      ADD COLUMN IF NOT EXISTS "createdById" TEXT,
      ADD COLUMN IF NOT EXISTS "updatedById" TEXT;
    `)

    // ProductVariant columns
    await srClient.query(`
      ALTER TABLE "ProductVariant" 
      ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "yieldFactor" DOUBLE PRECISION NOT NULL DEFAULT 1;
    `)
    // Ensure all item tables have zoneId for location tracking
    await srClient.query(`
      ALTER TABLE "PhysicalInventoryItem" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
      ALTER TABLE "StockLevel" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
      ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
      ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "preferredZoneId" TEXT;
      ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
      ALTER TABLE "SalesOrderItem" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
      ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
      ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
      ALTER TABLE "GoodsReceiptItem" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
      ALTER TABLE "ReturnItem" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
      ALTER TABLE "CreditNoteItem" ADD COLUMN IF NOT EXISTS "zoneId" TEXT;
    `)

    console.log('[STEP 2.6/4] ✓ Campos sincronizados')
  } catch (srErr: any) {
    console.warn(`[TENANT INIT] Warning during SR sync: ${srErr.message}`)
  } finally {
    await srClient.end()
  }

  // Step 2.7: Sync restaurant module columns (rate-limiting, fiscal)
  console.log(`[STEP 2.7/4] Sincronizando campos de restaurante y fiscal en "${schemaName}"...`)
  const restClient = new Client({ connectionString: tenantSchemaUrl })
  try {
    await restClient.connect()
    await restClient.query(`SET search_path TO "${schemaName}"`)

    // WaiterProfile rate-limiting columns
    await restClient.query(`
      DO $$ BEGIN
        ALTER TABLE "WaiterProfile" ADD COLUMN IF NOT EXISTS "failedAttempts" INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE "WaiterProfile" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
      EXCEPTION WHEN undefined_table THEN NULL;
      END $$;
    `)

    // Customer fiscal field
    await restClient.query(`
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "isRetentionAgent" BOOLEAN NOT NULL DEFAULT false;
    `)

    // Invoice tip amount
    await restClient.query(`
      ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "tipAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
    `)

    // Invoice / CreditNote — campos Alegra (deben coincidir con prisma/schema.prisma)
    await restClient.query(`
      ALTER TABLE "Invoice"
        ADD COLUMN IF NOT EXISTS "alegraId" TEXT,
        ADD COLUMN IF NOT EXISTS "alegraNumber" TEXT,
        ADD COLUMN IF NOT EXISTS "alegraStatus" TEXT DEFAULT 'DRAFT',
        ADD COLUMN IF NOT EXISTS "alegraUrl" TEXT;
    `)
    await restClient.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_alegraId_key" ON "Invoice" ("alegraId");
    `)
    await restClient.query(`
      ALTER TABLE "CreditNote"
        ADD COLUMN IF NOT EXISTS "alegraId" TEXT,
        ADD COLUMN IF NOT EXISTS "alegraNumber" TEXT,
        ADD COLUMN IF NOT EXISTS "alegraStatus" TEXT DEFAULT 'DRAFT',
        ADD COLUMN IF NOT EXISTS "alegraUrl" TEXT;
    `)
    await restClient.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "CreditNote_alegraId_key" ON "CreditNote" ("alegraId");
    `)

    // Drop pin uniqueness if it exists (two waiters CAN have same PIN)
    await restClient.query(`
      DO $$ BEGIN
        DROP INDEX IF EXISTS "WaiterProfile_tenantId_pin_key";
      END $$;
    `)

    console.log('[STEP 2.7/4] ✓ Campos de restaurante sincronizados')
  } catch (restErr: any) {
    console.warn(`[TENANT INIT] Warning during restaurant sync: ${restErr.message}`)
  } finally {
    await restClient.end()
  }

  // Step 3: Seed initial data (admin user, warehouse) via PrismaClient
  console.log('[STEP 3/4] Creando datos iniciales (admin, roles, almacén)...')

  const tenantPrisma = new PrismaClient({
    datasources: { db: { url: tenantSchemaUrl } },
  })

  try {
    const adminUsername = 'admin'
    const defaultPassword = 'Admin123!'
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)

    // CRITICAL: Seed the Tenant record in the tenant schema's local Tenant table.
    // The Employee, PayrollPeriod, etc. tables have a tenantId FK that references this
    // local Tenant table (not the public schema's Tenant table). Without this, creating
    // employees/payrolls fails with "Foreign key constraint violated: Employee_tenantId_fkey".
    await tenantPrisma.tenant.upsert({
      where: { id: tenantId },
      update: { name: tenantName, slug: tenantId, active: true },
      create: {
        id: tenantId,
        name: tenantName,
        slug: tenantId,
        databaseUrl: '',
        active: true,
      },
    })

    // Warehouse — upsert so reinit doesn't fail if it already exists
    await tenantPrisma.warehouse.upsert({
      where: { name: 'Almacén Principal' },
      update: {},
      create: {
        name: 'Almacén Principal',
        address: 'Sede Principal',
        active: true,
      },
    })

    // Admin user — upsert so reinit doesn't create duplicates
    const user = await tenantPrisma.user.upsert({
      where: { username: adminUsername },
      update: {}, // keep existing password if already set
      create: {
        username: adminUsername,
        password: hashedPassword,
        name: 'Administrador',
        active: true,
        isSuperAdmin: false,
      },
    })

    // Default Payment Methods
    await tenantPrisma.paymentMethod.upsert({
      where: { name: 'Efectivo' },
      update: {},
      create: { name: 'Efectivo', type: 'CASH', active: true, color: '#10b981', icon: 'banknote' }
    })
    await tenantPrisma.paymentMethod.upsert({
      where: { name: 'Tarjeta' },
      update: {},
      create: { name: 'Tarjeta', type: 'CARD', active: true, color: '#f59e0b', icon: 'credit-card' }
    })
    await tenantPrisma.paymentMethod.upsert({
      where: { name: 'Transferencia' },
      update: {},
      create: { name: 'Transferencia', type: 'TRANSFER', active: true, color: '#3b82f6', icon: 'smartphone' }
    })
    await tenantPrisma.paymentMethod.upsert({
      where: { name: 'ABONO' },
      update: {},
      create: { name: 'ABONO', type: 'CREDIT', active: true, color: '#ef4444', icon: 'hand-coins' }
    })


    // Core permissions every tenant admin needs (All modules)
    const corePermissions = [
      'view_reports',
      'manage_sales',
      'manage_products',
      'manage_inventory',
      'manage_customers',
      'manage_suppliers',
      'manage_purchases',
      'manage_users',
      'manage_settings',
      'view_dashboard',
      'manage_pos',
      'manage_accounting',
      'manage_payroll',
      'manage_crm',
      'manage_cash',
      'manage_returns',
      'void_invoices',
      'apply_discounts',
      'manage_restaurant',
    ]

    // Define all default roles with descriptions and permissions
    const defaultRoles = [
      {
        name: 'ADMIN',
        description: 'Administrador total con acceso a todos los módulos y configuraciones.',
        permissions: corePermissions,
      },
      {
        name: 'CAJERO_POS',
        description: 'Cajero de punto de venta. Puede realizar ventas, devoluciones, manejar caja y cierres de turno.',
        permissions: ['view_dashboard', 'manage_pos', 'manage_sales', 'manage_cash', 'manage_returns', 'void_invoices', 'apply_discounts', 'manage_customers', 'manage_restaurant'],
      },
      {
        name: 'VENDEDOR_COMERCIAL',
        description: 'Asesor comercial. Enfocado en gestión de clientes (CRM), cotizaciones y pedidos de venta.',
        permissions: ['view_dashboard', 'manage_sales', 'manage_customers', 'manage_crm'],
      },
      {
        name: 'ALMACENISTA',
        description: 'Gestión de almacén. Control de inventarios, recepción de mercancía y traslados.',
        permissions: ['view_dashboard', 'manage_products', 'manage_inventory', 'manage_suppliers', 'manage_purchases'],
      },
      {
        name: 'CONTADOR',
        description: 'Gestor contable y financiero. Acceso a reportes, balances y libros contables.',
        permissions: ['view_dashboard', 'view_reports', 'manage_accounting'],
      },
      {
        name: 'RECURSOS_HUMANOS',
        description: 'Gestión de personal y nómina. Manejo de empleados y liquidaciones.',
        permissions: ['view_dashboard', 'manage_payroll', 'manage_users'],
      },
      {
        name: 'REST_MESERO',
        description: 'Mesero (Restaurantes). Toma de pedidos y atención en mesa.',
        permissions: ['view_dashboard', 'manage_pos', 'manage_restaurant'],
      },
    ]

    let adminRoleId = ''

    for (const roleDef of defaultRoles) {
      const role = await tenantPrisma.role.upsert({
        where: { name: roleDef.name },
        update: { description: roleDef.description },
        create: { name: roleDef.name, description: roleDef.description },
      })

      if (roleDef.name === 'ADMIN') adminRoleId = role.id

      // Sync permissions for this role
      for (const permName of roleDef.permissions) {
        const perm = await tenantPrisma.permission.upsert({
          where: { name: permName },
          update: {},
          create: { name: permName, description: permName },
        })

        await tenantPrisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        })
      }
    }

    // Assign ADMIN role to admin user (if not already)
    const existingAssignment = await tenantPrisma.userRole.findFirst({
      where: { userId: user.id, roleId: adminRoleId },
    })
    if (!existingAssignment && adminRoleId) {
      await tenantPrisma.userRole.create({
        data: { userId: user.id, roleId: adminRoleId },
      })
    }
    console.log('[STEP 3/4] ✓ Roles y permisos configurados')

    // Step 4: Accounting Setup
    console.log('[STEP 4/4] Configurando contabilidad (PUC y Config)...')
    try {
      await initializePUC(tenantId, tenantPrisma)
      
      const accounts = await tenantPrisma.accountingAccount.findMany()
      const findId = (code: string) => accounts.find(a => a.code === code)?.id

      const configData = {
        cashAccountId: findId('110505'),
        bankAccountId: findId('111005'),
        accountsReceivableId: findId('130505'),
        accountsPayableId: findId('2205'),
        inventoryAccountId: findId('1435'),
        salesRevenueId: findId('4135'),
        vatGeneratedId: findId('240805'),
        vatDeductibleId: findId('240810'),
        costOfSalesId: findId('6135'),
      }

      await updateAccountingConfig(tenantId, configData, tenantPrisma)
      console.log('[STEP 4/4] ✓ Contabilidad configurada')
    } catch (accErr: any) {
      console.warn(`[TENANT INIT] Warning during accounting setup: ${accErr.message}`)
    }

    return { adminUsername, adminPassword: defaultPassword }
  } catch (dataError: any) {
    // Log the error for better server-side debugging
    console.error(`[TENANT_INIT] Error creating initial data:`, dataError)
    throw new Error(`Error creando datos iniciales: ${dataError?.message || dataError}`)
  } finally {
    await tenantPrisma.$disconnect()
  }
}

/**
 * Main entry point for tenant database initialization.
 */
export async function initializeTenantDatabase(
  databaseUrl: string,
  tenantName: string,
  tenantSlug: string,
  tenantId?: string
) {
  const identifier = tenantId || tenantSlug
  const isPostgres =
    databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')

  if (isPostgres) {
    return await initializePostgresTenant(databaseUrl, identifier, tenantName)
  } else {
    throw new Error('SQLite initialization is not supported in this environment.')
  }
}
