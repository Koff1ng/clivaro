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
  
  // Si ya tiene connection_limit, no hacer nada
  if (url.includes('connection_limit=')) {
    return url
  }
  
  // Añadir connection_limit y pool_timeout para optimizar el pool de Supabase
  // connection_limit=5 permite paralelismo sin exceder límites de Supabase
  const separator = url.includes('?') ? '&' : '?'
  // Usar connection_limit=5 y pool_timeout=20 para mejor rendimiento
  let newUrl = url
  if (!newUrl.includes('connection_limit=')) {
    newUrl = `${newUrl}${separator}connection_limit=5`
  }
  if (!newUrl.includes('pool_timeout=')) {
    const sep = newUrl.includes('?') ? '&' : '?'
    newUrl = `${newUrl}${sep}pool_timeout=20`
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

