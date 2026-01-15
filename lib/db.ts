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
  
  // Añadir connection_limit=1 para usar solo 1 conexión del pool de Supabase
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}connection_limit=1`
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

