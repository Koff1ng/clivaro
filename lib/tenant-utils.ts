/**
 * tenant-utils.ts
 * Single source of truth for all tenant schema name derivation.
 * Every part of the codebase that needs a tenant schema name MUST use this.
 */

/**
 * Derives the standardized PostgreSQL schema name for a given tenant ID.
 * CRITICAL: Always lowercases the tenantId — CUIDs are case-sensitive but
 * PostgreSQL schema names created with CREATE SCHEMA use lowercase.
 */
export function getSchemaName(tenantId: string): string {
    if (!tenantId) throw new Error('tenantId is required to derive schema name')
    // Replace any characters that aren't alphanumeric or underscore with underscore
    // CUIDs only contain alphanumeric chars, but this makes it safe and consistent
    return `tenant_${tenantId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
}

/**
 * Builds a database URL with the tenant schema as the Prisma `schema` parameter.
 * This creates a fully-isolated connection for the tenant.
 */
export function withTenantSchemaUrl(baseUrl: string, tenantId: string): string {
    const schemaName = getSchemaName(tenantId)
    try {
        const url = new URL(baseUrl)
        // Remove any existing schema param to avoid conflicts
        url.searchParams.delete('schema')
        url.searchParams.set('schema', schemaName)
        return url.toString()
    } catch {
        const separator = baseUrl.includes('?') ? '&' : '?'
        const cleaned = baseUrl.replace(/([?&])schema=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
        return `${cleaned}${separator}schema=${encodeURIComponent(schemaName)}`
    }
}
