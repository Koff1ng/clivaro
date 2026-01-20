import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Añade connection_limit a URLs de PostgreSQL para limitar el pool
 */
function addConnectionLimit(url: string): string {
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    return url
  }
  
  // Añadir parámetros para optimizar el uso de Supabase + PgBouncer
  // - connection_limit=5 permite paralelismo sin exceder límites de Supabase
  // - pool_timeout=20 aumenta el tiempo de espera del pool
  // - pgbouncer=true indica a Prisma que no use prepared statements (evita errores 42P05)
  let newUrl = url

  if (!newUrl.includes('connection_limit=')) {
    const sep = newUrl.includes('?') ? '&' : '?'
    newUrl = `${newUrl}${sep}connection_limit=5`
  }

  if (!newUrl.includes('pool_timeout=')) {
    const sep = newUrl.includes('?') ? '&' : '?'
    newUrl = `${newUrl}${sep}pool_timeout=20`
  }

  if (!newUrl.toLowerCase().includes('pgbouncer=')) {
    const sep = newUrl.includes('?') ? '&' : '?'
    newUrl = `${newUrl}${sep}pgbouncer=true`
  }

  return newUrl
}

// Singleton pattern that works in both dev and production (Vercel serverless)
// In serverless, globalThis persists across invocations within the same container
const databaseUrl = process.env.DATABASE_URL || ''
const limitedUrl = addConnectionLimit(databaseUrl)

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: limitedUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Always cache in globalThis to prevent multiple instances in serverless
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma
}

