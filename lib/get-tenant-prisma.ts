import { PrismaClient } from '@prisma/client'
import { prisma as masterPrisma } from './db'
import { getSchemaName } from './tenant-utils'

// Cache one PrismaClient per tenant schema to avoid recreating on every request.
// Each client has its own connection pool pointing to the correct tenant schema.
const tenantPrismaCache = new Map<string, PrismaClient>()

function getTenantPrismaClient(tenantId: string): PrismaClient {
  const schemaName = getSchemaName(tenantId)

  if (tenantPrismaCache.has(schemaName)) {
    return tenantPrismaCache.get(schemaName)!
  }

  // Build a URL pointing directly to the tenant schema.
  // Using DIRECT_URL bypasses PgBouncer so ?schema=xxx works reliably.
  const baseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || ''

  let schemaUrl: string
  try {
    const url = new URL(baseUrl)
    url.searchParams.delete('schema')
    url.searchParams.delete('pgbouncer')
    url.searchParams.set('schema', schemaName)
    schemaUrl = url.toString()
  } catch {
    const cleaned = baseUrl.replace(/([?&])schema=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
    const sep = cleaned.includes('?') ? '&' : '?'
    schemaUrl = `${cleaned}${sep}schema=${encodeURIComponent(schemaName)}`
  }

  console.log(`[TenantPrisma] Creating dedicated PrismaClient for schema: ${schemaName}`)
  const client = new PrismaClient({
    datasources: { db: { url: schemaUrl } },
    log: [],
  })

  tenantPrismaCache.set(schemaName, client)
  return client
}

/**
 * Returns a Prisma client scoped to the tenant's schema.
 * Super admins get the master DB client.
 * 
 * @deprecated Prefer using withTenantTx(tenantId, callback) directly in new code.
 */
export async function getPrismaForRequest(_request?: Request, session?: any): Promise<any> {
  const user = session?.user ?? (session as any)

  if (user?.isSuperAdmin) {
    return masterPrisma
  }

  const tenantId: string | null | undefined = user?.tenantId

  if (!tenantId) {
    console.warn('[getPrismaForRequest] No tenantId in session — returning master prisma')
    return masterPrisma
  }

  // Return a dedicated PrismaClient for this tenant's schema
  return getTenantPrismaClient(tenantId)
}
