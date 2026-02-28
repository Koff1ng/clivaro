import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { Client } from 'pg'
import { TENANT_SQL_STATEMENTS } from './tenant-sql-statements'

/**
 * Derives the standardized schema name from a tenant ID.
 */
function getTenantSchemaName(tenantId: string): string {
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
 * Uses embedded SQL statements (no file I/O, no child_process) for full
 * compatibility with serverless environments like Vercel Lambda.
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

  // Step 3: Seed initial data (admin user, warehouse) via PrismaClient
  console.log('[STEP 3/4] Creando datos iniciales (admin, roles, almacén)...')

  const tenantPrisma = new PrismaClient({
    datasources: { db: { url: tenantSchemaUrl } },
  })

  try {
    const adminUsername = 'admin'
    const defaultPassword = 'Admin123!'
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)

    // Warehouse
    await tenantPrisma.warehouse.create({
      data: {
        name: 'Almacén Principal',
        address: 'Sede Principal',
        active: true,
      },
    })

    // Admin user
    const user = await tenantPrisma.user.create({
      data: {
        username: adminUsername,
        password: hashedPassword,
        name: 'Administrador',
        active: true,
        isSuperAdmin: false,
      },
    })

    // Find ADMIN role created by the SQL statements
    const adminRole = await tenantPrisma.role.findFirst({ where: { name: 'ADMIN' } })
    if (adminRole) {
      await tenantPrisma.userRole.create({
        data: { userId: user.id, roleId: adminRole.id },
      })
      console.log('[STEP 3/4] ✓ Rol ADMIN asignado')
    } else {
      console.warn('[STEP 3/4] ⚠ No se encontró rol ADMIN')
    }

    console.log('[STEP 3/4] ✓ Datos iniciales creados')

    return { adminUsername, adminPassword: defaultPassword }
  } catch (dataError: any) {
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
