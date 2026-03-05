import { prisma as masterPrisma } from './db'
import { withTenantTx } from './tenancy'

/**
 * Returns a Prisma-like proxy that routes all model queries through withTenantTx.
 *
 * WHY NOT dedicated PrismaClient + ?schema=xxx:
 *   Supabase's DIRECT_URL does not reliably honor the ?schema=xxx connection parameter
 *   when using Prisma — the search_path is not set at session initialization.
 *   The only verified working approach (confirmed via /api/debug/whoami) is withTenantTx
 *   which uses SET LOCAL search_path inside a BEGIN/COMMIT transaction on masterPrisma.
 *
 * @deprecated Prefer using withTenantTx(tenantId, callback) directly in new code.
 */
export async function getPrismaForRequest(_request?: Request, session?: any): Promise<any> {
  const user = session?.user ?? (session as any)

  // Super admins always use the master DB (public schema)
  if (user?.isSuperAdmin) {
    return masterPrisma
  }

  const tenantId: string | null | undefined = user?.tenantId

  if (!tenantId) {
    console.warn('[getPrismaForRequest] No tenantId in session — falling back to master prisma')
    return masterPrisma
  }

  // Return a Proxy that wraps every model.method(...) call inside withTenantTx.
  // withTenantTx uses SET LOCAL search_path inside a transaction on the master pool —
  // this is the ONLY approach confirmed to work correctly on Supabase.
  return new Proxy({} as any, {
    get(_target, modelName: string) {
      // Pass $ methods ($queryRaw, $executeRaw, $transaction) to master prisma directly.
      // These should be avoided in tenant routes — use withTenantTx directly instead.
      if (typeof modelName !== 'string' || modelName.startsWith('$') || modelName === 'then') {
        return (masterPrisma as any)[modelName]
      }

      return new Proxy({} as any, {
        get(_modelTarget, methodName: string) {
          if (typeof methodName !== 'string' || methodName === 'then') {
            return undefined
          }
          return (...args: any[]) =>
            withTenantTx(tenantId, (tx: any) => tx[modelName][methodName](...args))
        },
      })
    },
  })
}
