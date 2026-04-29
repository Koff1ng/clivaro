import { logger } from './logger'

/**
 * Resolves the absolute public URL of the app for inclusion in transactional
 * content (emails, webhooks, OAuth callbacks, payment receipts, …).
 *
 * Lookup order:
 *   1. `NEXT_PUBLIC_APP_URL` — preferred, set explicitly per-environment.
 *   2. `NEXTAUTH_URL` — already required by NextAuth, almost always set.
 *   3. `VERCEL_URL` — automatic on Vercel deploys (no protocol).
 *   4. Throws when running on the server with no env var set, instead of
 *      silently falling back to `http://localhost:3000` and shipping broken
 *      links to customers.
 *
 * The returned URL has no trailing slash.
 */
export function getPublicUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  ]

  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.replace(/\/+$/, '')
    }
  }

  // In development we tolerate the localhost fallback so the app still runs
  // without the env var, but we make a lot of noise about it.
  if (process.env.NODE_ENV !== 'production') {
    logger.warn(
      '[public-url] No NEXT_PUBLIC_APP_URL/NEXTAUTH_URL/VERCEL_URL set — defaulting to http://localhost:3000. Configure one of these envs before deploying.',
    )
    return 'http://localhost:3000'
  }

  throw new Error(
    'Public URL is not configured. Set NEXT_PUBLIC_APP_URL (preferred) or NEXTAUTH_URL in your environment.',
  )
}

/**
 * Builds an absolute URL by joining the given path onto the public URL.
 * The path may or may not start with a slash.
 */
export function buildPublicUrl(path: string): string {
  const base = getPublicUrl()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}
