/**
 * @deprecated This utility is NO LONGER USED in the business logic of this application.
 * All API routes and server components have been migrated to the unified tenancy pattern:
 * - withTenantTx(tenantId, callback) for write operations and transactions
 * - withTenantRead(tenantId, callback) for read-only operations
 *
 * This file is kept temporarily empty to avoid breaking build if any stray imports remain,
 * but should be deleted once the migration is confirmed stable.
 */

export async function getPrismaForRequest(): Promise<never> {
  throw new Error(
    'getPrismaForRequest is deprecated and has been removed. ' +
    'Please use withTenantTx or withTenantRead from @/lib/tenancy instead.'
  )
}
