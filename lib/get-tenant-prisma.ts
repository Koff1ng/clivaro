import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth'
import { prisma } from './db'

/**
 * @deprecated Use withTenantTx(tenantId, callback) from @/lib/tenancy instead.
 * This helper is kept for backwards compatibility during migration but DOES NOT 
 * enforce schema isolation on its own.
 */
export async function getPrismaForRequest(request?: Request, session?: any) {
  console.warn('[DEPRECATION] getPrismaForRequest is deprecated. Use withTenantTx instead to ensure strict schema isolation.')

  try {
    let userSession = session
    if (!userSession) {
      userSession = await getServerSession(authOptions)
    }

    // Super admins use master DB (public schema)
    if (userSession?.user?.isSuperAdmin) {
      return prisma
    }

    // For everyone else, we still return the master prisma client,
    // but the caller MUST use withTenantTx to set the search_path.
    // If they don't, they will be querying the public schema (which should be empty of tenant data).
    return prisma
  } catch (error) {
    console.error('Error in getPrismaForRequest:', error)
    return prisma
  }
}
