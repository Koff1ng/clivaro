import { Prisma } from '@prisma/client'
import { prisma as masterPrisma } from './db'
import { getSchemaName } from './tenant-utils'

export class TenancyError extends Error {
    constructor(message: string, public code: number = 401) {
        super(message)
        this.name = 'TenancyError'
    }
}

// Simple in-memory cache to avoid repeated information_schema lookups
// Use a Map<schemaName, timestamp> so we can expire stale entries
const schemaCache = new Map<string, number>()
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Runs a set of operations within a tenant-scoped transaction.
 * Uses SET LOCAL so the search_path ONLY affects this specific transaction
 * and is automatically reset when the transaction commits or rolls back.
 */
export async function withTenantTx<T>(
    tenantId: string | null | undefined,
    callback: (txPrisma: Prisma.TransactionClient) => Promise<T>,
    options: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel; allowPublicFallback?: boolean } = {}
): Promise<T> {
    if (!tenantId) {
        throw new TenancyError('Tenant context is missing. Database access denied.', 401)
    }

    // Use unified schema name derivation — always lowercase, consistent with creation
    const schemaName = getSchemaName(tenantId)

    // Validate the derived schemaName format to prevent SQL injection
    if (!/^[a-z0-9_]+$/.test(schemaName)) {
        throw new TenancyError(`Invalid schema name derived: ${schemaName}`, 400)
    }

    // Ensure schema exists (with TTL-based cache to avoid stale hits)
    const cachedAt = schemaCache.get(schemaName)
    if (!cachedAt || Date.now() - cachedAt > SCHEMA_CACHE_TTL_MS) {
        const exists = await schemaExists(tenantId)
        if (!exists) {
            schemaCache.delete(schemaName) // Remove stale entry if any
            console.error(`CRITICAL: Schema "${schemaName}" does not exist in the database.`)
            throw new TenancyError(`Forbidden: Account is not properly initialized (${schemaName}).`, 403)
        }
        schemaCache.set(schemaName, Date.now())
    }

    // Build the search_path string — properly quoted to handle any chars
    const path = options.allowPublicFallback
        ? `"${schemaName}", public`
        : `"${schemaName}"`

    return await masterPrisma.$transaction(
        async (tx) => {
            // SET LOCAL: strictly scoped to THIS transaction only.
            // PostgreSQL automatically resets to the connection default when
            // the transaction ends (commit or rollback).
            try {
                await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${path};`)
            } catch (error) {
                console.error(`Failed to set search_path to ${path}:`, error)
                throw new TenancyError(`Forbidden: Schema context could not be established.`, 403)
            }

            try {
                return await callback(tx)
            } catch (callbackError) {
                // Let the transaction naturally roll back, which resets SET LOCAL
                throw callbackError
            }
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
