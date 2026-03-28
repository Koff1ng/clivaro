import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/migrations/wompi
 * Temporary migration endpoint — adds Wompi columns to Subscription table
 * DELETE THIS ROUTE AFTER MIGRATION SUCCEEDS
 */
export async function GET() {
  const results: string[] = []

  const columns = [
    { name: 'wompiTransactionId', type: 'TEXT' },
    { name: 'wompiReference', type: 'TEXT' },
    { name: 'wompiStatus', type: 'TEXT' },
    { name: 'wompiPaymentMethod', type: 'TEXT' },
    { name: 'wompiResponse', type: 'TEXT' },
  ]

  for (const col of columns) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`
      )
      results.push(`✅ ${col.name} — added`)
    } catch (error: any) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate column')) {
        results.push(`⏩ ${col.name} — already exists`)
      } else {
        results.push(`❌ ${col.name} — ${error.message}`)
      }
    }
  }

  return NextResponse.json({ 
    success: true, 
    message: 'Wompi migration complete',
    results 
  })
}
