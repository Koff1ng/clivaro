import { PrismaClient } from '@prisma/client'
import { prisma } from './db'

/**
 * @deprecated Switching to Single Pooled Client with SET LOCAL search_path.
 * Use withTenantTx from @/lib/tenancy instead.
 */
export function getTenantPrisma(databaseUrl: string): PrismaClient {
  console.warn('[DEPRECATION] getTenantPrisma is deprecated. Use withTenantTx instead.')
  return prisma
}

/**
 * @deprecated Use Session-based tenant resolution.
 */
export async function getTenantFromRequest(request: Request) {
  return null
}
