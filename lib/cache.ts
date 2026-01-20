/**
 * Cache utility with in-memory fallback and optional Redis/Upstash support
 * TTL-based expiration for server-side caching
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const memoryCache = new Map<string, CacheEntry<any>>()

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.expiresAt < now) {
        memoryCache.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

/**
 * Get value from cache (Redis if available, otherwise memory)
 */
export async function getCache<T>(key: string): Promise<T | null> {
  // Try Redis first if available
  const redisValue = await getFromRedis(key)
  if (redisValue !== null) {
    try {
      return JSON.parse(redisValue) as T
    } catch {
      return null
    }
  }

  // Fallback to memory cache
  const entry = memoryCache.get(key)
  if (!entry) return null

  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key)
    return null
  }

  return entry.data as T
}

/**
 * Set value in cache (Redis if available, otherwise memory)
 */
export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const expiresAt = Date.now() + ttlSeconds * 1000

  // Try Redis first if available
  const redisSuccess = await setInRedis(key, JSON.stringify(value), ttlSeconds)
  if (redisSuccess) {
    return
  }

  // Fallback to memory cache
  memoryCache.set(key, { data: value, expiresAt })
}

/**
 * Delete value from cache
 */
export async function deleteCache(key: string): Promise<void> {
  await deleteFromRedis(key)
  memoryCache.delete(key)
}

/**
 * Clear all cache entries matching a pattern (memory only, Redis requires SCAN)
 */
export function clearCachePattern(pattern: string): void {
  const regex = new RegExp(pattern.replace('*', '.*'))
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key)
    }
  }
}

// Redis/Upstash helpers
async function getFromRedis(key: string): Promise<string | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.result || null
  } catch {
    return null
  }
}

async function setInRedis(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return false

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['SET', key, value],
        ['EXPIRE', key, ttlSeconds],
      ]),
    })
    return res.ok
  } catch {
    return false
  }
}

async function deleteFromRedis(key: string): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return

  try {
    await fetch(`${url}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    // Ignore errors
  }
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  dashboard: (tenantId: string) => `dashboard:${tenantId}`,
  stats: (tenantId: string) => `stats:${tenantId}`,
  topClients: (tenantId: string) => `top-clients:${tenantId}`,
  last30Days: (tenantId: string) => `last-30-days:${tenantId}`,
  productCategories: (tenantId: string) => `product-categories:${tenantId}`,
  activityFeed: (tenantId: string, limit: number) => `activity-feed:${tenantId}:${limit}`,
}

