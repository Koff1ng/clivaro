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

/**
 * Builds a database URL for the given tenant schema.
 * - Prefers DIRECT_URL (bypasses PgBouncer, supports prepared statements)
 * - Falls back to DATABASE_URL with pgbouncer=true for compatibility
 */
function buildTenantUrl(schema: string): string {
    const directUrl = process.env.DIRECT_URL
    const poolerUrl = process.env.DATABASE_URL || ''

    // Prefer the direct connection — no PgBouncer issues
    if (directUrl && (directUrl.startsWith('postgresql://') || directUrl.startsWith('postgres://'))) {
        const urlObj = new URL(directUrl)
        // Remove pgbouncer flag if somehow present in DIRECT_URL
        urlObj.searchParams.delete('pgbouncer')
        urlObj.searchParams.set('schema', schema)
        // Direct connections can use a small pool per-tenant
        if (!urlObj.searchParams.has('connection_limit')) {
            urlObj.searchParams.set('connection_limit', '3')
        }
        return urlObj.toString()
    }

    // Fallback: pooler URL requires pgbouncer=true for Prisma compatibility
    if (poolerUrl.startsWith('postgresql://') || poolerUrl.startsWith('postgres://')) {
        const urlObj = new URL(poolerUrl)
        urlObj.searchParams.set('schema', schema)
        urlObj.searchParams.set('pgbouncer', 'true')
        if (!urlObj.searchParams.has('connection_limit')) {
            urlObj.searchParams.set('connection_limit', '3')
        }
        return urlObj.toString()
    }

    return poolerUrl
}

/**
 * Returns (or creates and caches) a PrismaClient for the given tenant schema.
 * Safe for both reads and writes.
 */
async function getTenantPrismaClient(tenantId: string): Promise<PrismaClient> {
    if (!tenantId) {
        throw new TenancyError('Tenant context is missing. Database access denied.', 401)
    }

    const schemaName = getSchemaName(tenantId)

    if (!/^[a-z0-9_]+$/.test(schemaName)) {
        throw new TenancyError(`Invalid schema name derived: ${schemaName}`, 400)
    }

    // Ensure schema exists dynamically (cached for 5 min)
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

    let tenantPrisma = tenantPrismaClients.get(schemaName)
    if (!tenantPrisma) {
        const schemaUrl = buildTenantUrl(schemaName)
        tenantPrisma = new PrismaClient({
            datasources: { db: { url: schemaUrl } },
        })
        tenantPrismaClients.set(schemaName, tenantPrisma)
    }

    return tenantPrisma
}

/**
 * Runs a set of operations within a tenant-scoped transaction.
 * Uses a dynamically instantiated and cached PrismaClient specifically
 * assigned to the tenant schema.
 */
export async function withTenantTx<T>(
    tenantId: string | null | undefined,
    callback: (txPrisma: Prisma.TransactionClient) => Promise<T>,
    options: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel } = {}
): Promise<T> {
    if (!tenantId) {
        throw new TenancyError('Tenant context is missing. Database access denied.', 401)
    }

    const tenantPrisma = await getTenantPrismaClient(tenantId)

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
 * Runs a read-only operation against the tenant schema WITHOUT a transaction.
 * Prefer this for GET endpoints — faster and avoids transaction overhead.
 */
export async function withTenantRead<T>(
    tenantId: string | null | undefined,
    callback: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
    if (!tenantId) {
        throw new TenancyError('Tenant context is missing. Database access denied.', 401)
    }

    const tenantPrisma = await getTenantPrismaClient(tenantId)
    return await callback(tenantPrisma)
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
