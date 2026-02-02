import { PrismaClient, Prisma } from '@prisma/client'
import { prisma as masterPrisma } from './db'

export class TenancyError extends Error {
    constructor(message: string, public code: number = 401) {
        super(message)
        this.name = 'TenancyError'
    }
}

/**
 * Runs a set of operations within a tenant-scoped transaction.
 * Strictly enforces schema-per-tenant isolation using search_path.
 */
export async function withTenantTx<T>(
    tenantId: string | null | undefined,
    callback: (txPrisma: Prisma.TransactionClient) => Promise<T>,
    options: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel } = {}
): Promise<T> {
    if (!tenantId) {
        throw new TenancyError('Tenant context is missing. Database access denied.', 401)
    }

    // Validate tenantId format to prevent SQL injection in search_path
    // Since we use it in SET LOCAL search_path, it must be safe.
    // We expect CUID or similar alphanumeric strings.
    if (!/^[a-z0-9_-]+$/i.test(tenantId)) {
        throw new TenancyError('Invalid tenant ID format.', 400)
    }

    const schemaName = `tenant_${tenantId}`

    return await masterPrisma.$transaction(
        async (tx) => {
            // MANDATORY: Set schema context before any query
            try {
                await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schemaName}", public;`)
            } catch (error) {
                console.error(`Failed to set search_path to ${schemaName}:`, error)
                throw new TenancyError(`Forbidden: Schema context "${schemaName}" could not be established.`, 403)
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
 * Helper to ensure a tenant schema exists (used in provisioning)
 */
export async function schemaExists(tenantId: string): Promise<boolean> {
    const schemaName = `tenant_${tenantId}`
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
