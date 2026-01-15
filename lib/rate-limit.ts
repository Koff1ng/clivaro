/**
 * Rate limiting utility for API routes
 * In-memory rate limiter with optional Upstash Redis backend (recommended for Vercel/serverless)
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  max: number // Maximum number of requests per window
  message?: string // Custom error message
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
}

export type RateLimitContext = {
  tenantId?: string | null
  userId?: string | null
  /** Optional extra discriminator (e.g. endpoint group) */
  scope?: string
}

type RateLimitResult = {
  success: boolean
  message?: string
  retryAfter?: number
  limit?: number
  remaining?: number
  reset?: number
}

function getIpFromRequest(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  return (forwarded?.split(',')[0] || realIp || 'unknown').trim()
}

function getLimiterKey(req: Request, windowMs: number, ctx?: RateLimitContext): { key: string; reset: number } {
  const now = Date.now()
  const windowSeconds = Math.max(1, Math.floor(windowMs / 1000))
  const nowSeconds = Math.floor(now / 1000)
  const windowStart = Math.floor(nowSeconds / windowSeconds)
  const reset = (windowStart + 1) * windowSeconds // unix seconds

  const ip = getIpFromRequest(req)
  const tenant = (ctx?.tenantId || 'public').toString()
  const user = (ctx?.userId || 'anon').toString()
  const scope = (ctx?.scope || 'global').toString()

  const key = `rl:${scope}:${tenant}:${user}:${ip}:${windowStart}`
  return { key, reset }
}

async function upstashIncrWithExpire(key: string, windowSeconds: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, windowSeconds],
      ]),
    })

    if (!res.ok) return null
    const json = (await res.json()) as any[]
    const incrResult = json?.[0]?.result
    const count = typeof incrResult === 'number' ? incrResult : Number(incrResult)
    return Number.isFinite(count) ? count : null
  } catch {
    return null
  }
}

export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 100, // 100 requests default
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options

  return async (req: Request, ctx?: RateLimitContext): Promise<RateLimitResult> => {
    const now = Date.now()
    const windowSeconds = Math.max(1, Math.floor(windowMs / 1000))
    const { key, reset } = getLimiterKey(req, windowMs, ctx)

    // Clean up old entries (simple cleanup, in production use Redis TTL)
    if (Object.keys(store).length > 10000) {
      const cutoff = now - windowMs * 2
      Object.keys(store).forEach((k) => {
        if (store[k].resetTime < cutoff) {
          delete store[k]
        }
      })
    }

    // Prefer Upstash Redis for distributed rate limiting
    const redisCount = await upstashIncrWithExpire(key, windowSeconds)
    if (redisCount !== null) {
      const remaining = Math.max(0, max - redisCount)
      if (redisCount > max) {
        const retryAfter = Math.max(1, reset - Math.floor(now / 1000))
        return { success: false, message, retryAfter, limit: max, remaining: 0, reset }
      }
      return { success: true, limit: max, remaining, reset }
    }

    // Fallback: local in-memory (OK for dev, NOT reliable on serverless)
    let entry = store[key]
    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + windowMs }
      store[key] = entry
    }

    // Check limit
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
      return {
        success: false,
        message,
        retryAfter,
        limit: max,
        remaining: 0,
        reset: Math.ceil(entry.resetTime / 1000),
      }
    }

    // Increment count (will be decremented if request fails and skipFailedRequests is true)
    entry.count++

    return {
      success: true,
      limit: max,
      remaining: Math.max(0, max - entry.count),
      reset: Math.ceil(entry.resetTime / 1000),
    }
  }
}

/**
 * Pre-configured rate limiters for different use cases
 */
export const rateLimiters = {
  // Strict rate limiter for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    message: 'Too many authentication attempts, please try again later.',
  }),

  // Standard rate limiter for API endpoints
  api: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per 15 minutes (general bucket)
    message: 'Too many requests, please try again later.',
  }),

  // Lenient rate limiter for read-only endpoints
  read: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 180, // 180 requests per minute (dashboard polling, lists, etc.)
    message: 'Too many read requests, please slow down.',
  }),

  // Strict rate limiter for write operations
  write: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 write operations per minute
    message: 'Too many write operations, please slow down.',
  }),
}

