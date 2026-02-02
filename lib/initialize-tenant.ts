import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'
import { Client } from 'pg'

/**
 * Derives the standardized schema name from a tenant ID.
 * Standard: tenant_[CUID]
 */
function getTenantSchemaName(tenantId: string): string {
  // Use the tenant ID (CUID) for the schema name to ensure uniqueness and stability
  return `tenant_${tenantId}`
}

function withSchemaParam(databaseUrl: string, schema: string): string {
  try {
    const url = new URL(databaseUrl)
    url.searchParams.set('schema', schema)
    return url.toString()
  } catch {
    const separator = databaseUrl.includes('?') ? '&' : '?'
    return `${databaseUrl}${separator}schema=${encodeURIComponent(schema)}`
  }
}

function stripSchemaParam(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl)
    url.searchParams.delete('schema')
    return url.toString()
  } catch {
    return databaseUrl.replace(/([?&])schema=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
  }
}

/**
 * Initializes a PostgreSQL tenant database.
 */
async function initializePostgresTenant(databaseUrl: string, tenantId: string, tenantName: string) {
  const baseUrl = stripSchemaParam(databaseUrl)
  const schemaName = getTenantSchemaName(tenantId)

  // Use DIRECT_DATABASE_URL for DDL operations if available (avoids PgBouncer issues)
  const directUrl = process.env.DIRECT_DATABASE_URL || baseUrl
  const directUrlForSchema = stripSchemaParam(directUrl)

  console.log('='.repeat(60))
  console.log('[TENANT INIT] Iniciando inicialización de tenant PostgreSQL')
  console.log(`[TENANT INIT] ID: ${tenantId}`)
  console.log(`[TENANT INIT] Empresa: ${tenantName}`)
  console.log(`[TENANT INIT] Schema: ${schemaName}`)
  console.log('='.repeat(60))

  // Step 1: Create schema 
  const adminPrisma = new PrismaClient({
    datasources: { db: { url: directUrlForSchema } },
  })

  try {
    console.log(`[STEP 1/4] Ejecutando: CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)
    await adminPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)
  } catch (schemaError: any) {
    throw new Error(`Error creando schema "${schemaName}": ${schemaError?.message || schemaError}`)
  } finally {
    await adminPrisma.$disconnect()
  }

  // Step 2: Connect to tenant schema for DDL
  const tenantSchemaUrl = withSchemaParam(directUrlForSchema, schemaName)
  const tenantPrisma = new PrismaClient({
    datasources: { db: { url: tenantSchemaUrl } },
  })

  // Step 3: Execute initialization SQL
  console.log('[STEP 3/4] Ejecutando scripts SQL de inicialización...')
  const startTime = Date.now()

  try {
    const sqlPath = path.join(process.cwd(), 'prisma', 'supabase-init.sql')
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`No se encontró el archivo SQL en ${sqlPath}`)
    }

    let sql = fs.readFileSync(sqlPath, 'utf8')

    // Ensure the SQL runs in the correct schema
    sql = `SET search_path TO "${schemaName}";\n\n${sql}`

    const client = new Client({
      connectionString: tenantSchemaUrl,
    })

    await client.connect()
    try {
      await client.query(sql)
      console.log(`[STEP 3/4] ✓ SQL base ejecutado exitosamente`)

      // Optional: Restaurant mode additions
      const restaurantSqlPath = path.join(process.cwd(), 'prisma', 'supabase-init-restaurant.sql')
      if (fs.existsSync(restaurantSqlPath)) {
        const rSql = fs.readFileSync(restaurantSqlPath, 'utf8')
        await client.query(rSql)
        console.log(`[STEP 3/4] ✓ SQL de Restaurante ejecutado`)
      }
    } finally {
      await client.end()
    }
  } catch (sqlError: any) {
    throw new Error(`Error de inicialización SQL: ${sqlError?.message || sqlError}`)
  }

  // Step 4: Create default admin user and essential data
  console.log('[STEP 4/4] Creando datos iniciales (admin, roles, almacén)...')

  try {
    const adminUsername = 'admin'
    const defaultPassword = 'Admin123!'
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)

    // Essential Data Seeding
    // 1. Permissions & Roles (Simplified for Init, matches seed scripts)
    // 2. Warehouse
    const warehouse = await tenantPrisma.warehouse.create({
      data: {
        name: `Almacén Principal`,
        address: 'Sede Principal',
        active: true,
      }
    })

    // 3. Admin User
    const user = await tenantPrisma.user.create({
      data: {
        username: adminUsername,
        password: hashedPassword,
        name: 'Administrador',
        active: true,
        isSuperAdmin: false, // MANDATORY: Isolated tenants don't have super admins
      }
    })

    // 4. Role Assignment (Simplification: just create the user, roles can be managed later if not in SQL)
    // Note: The supabase-init.sql should ideally create the roles. Here we focus on the user and core data.

    return {
      adminUsername,
      adminPassword: defaultPassword,
    }
  } catch (dataError: any) {
    throw new Error(`Error creando datos iniciales: ${dataError?.message || dataError}`)
  } finally {
    await tenantPrisma.$disconnect()
  }
}

/**
 * Main entry point for tenant database initialization
 */
export async function initializeTenantDatabase(
  databaseUrl: string,
  tenantName: string,
  tenantSlug: string,
  tenantId?: string
) {
  // Use tenantId as primary identifier for schema naming
  const identifier = tenantId || tenantSlug

  const isPostgres = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')

  if (isPostgres) {
    return await initializePostgresTenant(databaseUrl, identifier, tenantName)
  } else {
    throw new Error('SQLite initialization is deprecated in this project environment.')
  }
}
