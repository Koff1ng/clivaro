import { prisma } from './db'
import { withTenantTx } from './tenancy'

/**
 * Returns a Prisma-like proxy object that runs every query inside withTenantTx,
 * ensuring strict schema isolation for all routes that still use this function.
 *
 * Previously this function returned the master Prisma client (no isolation).
 * Now it wraps each model call in a tenant-scoped transaction automatically.
 *
 * @deprecated Prefer using withTenantTx(tenantId, callback) directly in new code.
 */
export async function getPrismaForRequest(_request?: Request, session?: any): Promise<any> {
  const user = session?.user ?? (session as any)

  // Super admins use master DB (public schema) — no tenant schema
  if (user?.isSuperAdmin) {
    return prisma
  }

  const tenantId: string | null | undefined = user?.tenantId

  if (!tenantId) {
    // No tenant context → return master prisma (will query public schema, likely empty)
    console.warn('[getPrismaForRequest] No tenantId in session — returning master prisma (queries will hit public schema)')
    return prisma
  }

  // Return a Proxy that intercepts model access (e.g. prisma.product.findMany)
  // and runs each call inside withTenantTx so the correct search_path is always set.
  return new Proxy({} as any, {
    get(_target, modelName: string) {
      // Pass through non-model properties (e.g. $transaction, $queryRaw)
      if (modelName.startsWith('$')) {
        return (prisma as any)[modelName]
      }

      // For each model, return another proxy that intercepts method calls
      return new Proxy({} as any, {
        get(_modelTarget, methodName: string) {
          return async (...args: any[]) => {
            return withTenantTx(tenantId, async (tx: any) => {
              return tx[modelName][methodName](...args)
            })
          }
        }
      })
    }
  })
}
