import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Singleton pattern that works in both dev and production (Vercel serverless)
// In serverless, globalThis persists across invocations within the same container
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Always cache in globalThis to prevent multiple instances in serverless
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma
}

