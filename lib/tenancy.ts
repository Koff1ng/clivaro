import { Prisma, PrismaClient } from '@prisma/client'
import { prisma as masterPrisma } from './db'
import { getSchemaName } from './tenant-utils'

export class TenancyError extends Error {
    constructor(message: string, public code: number = 401) {
        super(message)
        this.name = 'TenancyError'
    }
}

// Simple in-memory cache to avoid repeated information_schema lookups
const schemaCache = new Map<string, number>()
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// Cache of initialized Prisma Clients per tenant schema
const tenantPrismaClients = new Map<string, PrismaClient>()

function addConnectionLimit(url: string, schema: string): string {
    if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
        return url
    }
    let newUrl = url

    if (!newUrl.includes('connection_limit=')) {
        const sep = newUrl.includes('?') ? '&' : '?'
        newUrl = `${newUrl}${sep}connection_limit=5`
    }
    if (!newUrl.includes('pool_timeout=')) {
        const sep = newUrl.includes('?') ? '&' : '?'
        newUrl = `${newUrl}${sep}pool_timeout=20`
    }
    if (!newUrl.toLowerCase().includes('pgbouncer=')) {
        const sep = newUrl.includes('?') ? '&' : '?'
        newUrl = `${newUrl}${sep}pgbouncer=true`
    }

    // Replace schema or add it
    const urlObj = new URL(newUrl)
    urlObj.searchParams.set('schema', schema)
    return urlObj.toString()
}

/**
 * Runs a set of operations within a tenant-scoped transaction.
 * Uses a dynamically instantiated and cached PrismaClient specifically 
 * assigned to the tenant schema, bypassing the Prisma 5 "public" prefix issue.
 */
export async function withTenantTx<T>(
    tenantId: string | null | undefined,
    callback: (txPrisma: Prisma.TransactionClient) => Promise<T>,
    options: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel; allowPublicFallback?: boolean } = {}
): Promise<T> {
    if (!tenantId) {
        throw new TenancyError('Tenant context is missing. Database access denied.', 401)
    }

    const schemaName = getSchemaName(tenantId)

    if (!/^[a-z0-9_]+$/.test(schemaName)) {
        throw new TenancyError(`Invalid schema name derived: ${schemaName}`, 400)
    }

    // Ensure schema exists dynamically
    const cachedAt = schemaCache.get(schemaName)
    if (!cachedAt || Date.now() - cachedAt > SCHEMA_CACHE_TTL_MS) {
        const exists = await schemaExists(tenantId)
        if (!exists) {
            schemaCache.delete(schemaName)
            console.error(`CRITICAL: Schema "${schemaName}" does not exist in the database.`)
            throw new TenancyError(`Forbidden: Account is not properly initialized (${schemaName}).`, 403)
        }
        schemaCache.set(schemaName, Date.now())
    }

    // Get or create Prisma Client for this schema
    // Prefer DIRECT_URL (bypasses PgBouncer) to avoid prepared-statement errors
    // in PgBouncer transaction-mode pooling (error code 26000)
    let tenantPrisma = tenantPrismaClients.get(schemaName)
    if (!tenantPrisma) {
        const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || ''
        const schemaUrl = addConnectionLimit(databaseUrl, schemaName)

        tenantPrisma = new PrismaClient({
            datasources: { db: { url: schemaUrl } },
        })
        tenantPrismaClients.set(schemaName, tenantPrisma)
    }

    // Execute the user's callback inside a transaction using the tenant-specific client
    return await tenantPrisma.$transaction(
        async (tx) => {
            return await callback(tx)
        },
        {
            timeout: options.timeout || 15000,
            isolationLevel: options.isolationLevel,
        }
    )
}

/**
 * Checks if a tenant's schema exists in the database.
 */
export async function schemaExists(tenantId: string): Promise<boolean> {
    const schemaName = getSchemaName(tenantId)
    const result = await masterPrisma.$queryRaw<any[]>`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = ${schemaName}
    `
    return result.length > 0
}

/**
 * Enforce that the request is running in a valid tenant context from session.
 */
export function getTenantIdFromSession(session: any): string {
    if (!session?.user?.tenantId) {
        throw new TenancyError('Unauthorized: Missing tenant context in session.', 401)
    }
    return session.user.tenantId
}
