import { Prisma } from '@prisma/client'
import { prisma as masterPrisma } from './db'

export class TenancyError extends Error {
    constructor(message: string, public code: number = 401) {
        super(message)
        this.name = 'TenancyError'
    }
}

// Simple in-memory cache to avoid repeated information_schema lookups
const schemaCache = new Set<string>()

/**
 * Runs a set of operations within a tenant-scoped transaction.
 * Strictly enforces schema-per-tenant isolation using search_path.
 */
export async function withTenantTx<T>(
    tenantId: string | null | undefined,
    callback: (txPrisma: Prisma.TransactionClient) => Promise<T>,
    options: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel; allowPublicFallback?: boolean } = {}
): Promise<T> {
    if (!tenantId) {
        throw new TenancyError('Tenant context is missing. Database access denied.', 401)
    }

    // Validate tenantId format to prevent SQL injection in search_path
    if (!/^[a-z0-9_-]+$/i.test(tenantId)) {
        throw new TenancyError('Invalid tenant ID format.', 400)
    }

    const schemaName = `tenant_${tenantId.toLowerCase()}`

    // Ensure schema exists (with caching)
    if (!schemaCache.has(schemaName)) {
        const exists = await schemaExists(tenantId)
        if (!exists) {
            console.error(`CRITICAL: Schema "${schemaName}" does not exist in the database.`)
            throw new TenancyError(`Forbidden: Account is not properly initialized (${schemaName}).`, 403)
        }
        schemaCache.add(schemaName)
    }

    return await masterPrisma.$transaction(
        async (tx) => {
            // MANDATORY: Set schema context. 
            // We use SET LOCAL so it only affects THIS transaction.
            // By default, we do NOT include 'public' in business operations to prevent leakage.
            const path = options.allowPublicFallback ? `"${schemaName}", public` : `"${schemaName}"`

            try {
                await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${path};`)
            } catch (error) {
                console.error(`Failed to set search_path to ${path}:`, error)
                throw new TenancyError(`Forbidden: Schema context context could not be established.`, 403)
            }

            return await callback(tx)
        },
        {
            timeout: options.timeout || 15000,
            isolationLevel: options.isolationLevel,
        }
    )
}

/**
 * Helper to ensure a tenant schema exists
 */
export async function schemaExists(tenantId: string): Promise<boolean> {
    const schemaName = `tenant_${tenantId.toLowerCase()}`
    const result = await masterPrisma.$queryRaw<any[]>`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name = ${schemaName}
  `
    return result.length > 0
}

/**
 * Enforce that the request is running in a valid tenant context from session
 */
export function getTenantIdFromSession(session: any): string {
    if (!session?.user?.tenantId) {
        throw new TenancyError('Unauthorized: Missing tenant context in session.', 401)
    }
    return session.user.tenantId
}
