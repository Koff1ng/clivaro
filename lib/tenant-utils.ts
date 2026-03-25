/**
 * tenant-utils.ts
 * Single source of truth for all tenant schema name derivation.
 * Every part of the codebase that needs a tenant schema name MUST use this.
 */

// In-memory cache of tenantId → slug mapping
let slugCache: Map<string, string> | null = null
let slugCacheExpiry = 0
const SLUG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Loads the tenantId → slug mapping from the database.
 * Lazily initialized and cached for performance.
 */
async function loadSlugCache(): Promise<Map<string, string>> {
  if (slugCache && Date.now() < slugCacheExpiry) return slugCache

  try {
    // Dynamic import to avoid circular dependencies
    const { prisma } = await import('./db')
    const tenants = await prisma.tenant.findMany({
      select: { id: true, slug: true }
    })
    slugCache = new Map(tenants.map(t => [t.id, t.slug]))
    slugCacheExpiry = Date.now() + SLUG_CACHE_TTL
  } catch {
    // If DB is not available, return empty map (will fallback to old format)
    if (!slugCache) slugCache = new Map()
  }

  return slugCache
}

/**
 * Derives the standardized PostgreSQL schema name for a given tenant ID.
 * Uses slug-based naming: tenant_slug (e.g., tenant_prueba)
 * Falls back to tenant_id if slug is not available.
 */
export function getSchemaName(tenantId: string, slug?: string): string {
    if (!tenantId) throw new Error('tenantId is required to derive schema name')
    
    // If slug is provided directly, use it
    if (slug) {
      return `tenant_${slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    }
    
    // Check cache synchronously (best effort)
    const cachedSlug = slugCache?.get(tenantId)
    if (cachedSlug) {
      return `tenant_${cachedSlug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    }
    
    // Fallback to old ID-based naming
    return `tenant_${tenantId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
}

/**
 * Async version that ensures slug cache is loaded before deriving schema name.
 * Preferred over getSchemaName when you can await.
 */
export async function getSchemaNameAsync(tenantId: string): Promise<string> {
    if (!tenantId) throw new Error('tenantId is required to derive schema name')
    
    const cache = await loadSlugCache()
    const slug = cache.get(tenantId)
    
    if (slug) {
      return `tenant_${slug.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
    }
    
    // Fallback to old ID-based naming
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
        url.searchParams.delete('schema')
        url.searchParams.set('schema', schemaName)
        return url.toString()
    } catch {
        const separator = baseUrl.includes('?') ? '&' : '?'
        const cleaned = baseUrl.replace(/([?&])schema=[^&]+(&|$)/, '$1').replace(/[?&]$/, '')
        return `${cleaned}${separator}schema=${encodeURIComponent(schemaName)}`
    }
}

