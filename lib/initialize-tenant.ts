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

  // Step 3: Use prisma db push to create the schema tables (avoids SQL file encoding issues)
  console.log('[STEP 3/4] Ejecutando prisma db push para crear tablas del tenant...')

  try {
    const { execSync } = require('child_process')

    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
    // Use local prisma binary instead of npx to avoid npm resolution in serverless environments
    const prismaBin = path.join(process.cwd(), 'node_modules', '.bin', 'prisma')

    execSync(`"${prismaBin}" db push --schema="${schemaPath}" --accept-data-loss --skip-generate`, {
      env: {
        ...process.env,
        DATABASE_URL: tenantSchemaUrl,
        DIRECT_URL: tenantSchemaUrl,
        // Vercel Lambda: /tmp is the only writable dir - npm needs HOME for cache
        HOME: process.env.HOME || '/tmp',
        npm_config_cache: '/tmp/.npm',
      },
      stdio: 'pipe',
      timeout: 120000,
    })

    console.log('[STEP 3/4] ✓ Tablas creadas exitosamente via prisma db push')
  } catch (sqlError: any) {
    const errorMsg = sqlError?.stdout?.toString() || sqlError?.stderr?.toString() || sqlError?.message || String(sqlError)
    throw new Error(`Error de inicialización SQL: ${errorMsg}`)
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

    // 4. Role Assignment
    // Find the ADMIN role created by the SQL script
    const adminRole = await tenantPrisma.role.findFirst({
      where: { name: 'ADMIN' }
    })

    if (adminRole) {
      await tenantPrisma.userRole.create({
        data: {
          userId: user.id,
          roleId: adminRole.id
        }
      })
      console.log(`[STEP 4/4] ✓ Rol ADMIN asignado a usuario ${adminUsername}`)
    } else {
      console.warn(`[STEP 4/4] ⚠ No se encontró el rol ADMIN para asignar al usuario`)
    }

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
