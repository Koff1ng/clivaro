import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Client } from 'pg'
import { getSchemaName } from '@/lib/tenant-utils'

// Helper to get direct DB URL
function getDirectPostgresUrl(): string {
    const base = process.env.DIRECT_URL || process.env.DATABASE_URL || ''
    try {
        const url = new URL(base)
        url.searchParams.delete('schema')
        url.searchParams.delete('pgbouncer')
        return url.toString()
    } catch {
        return base
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !(session.user as any).isSuperAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get all tenants
        const tenants = await prisma.tenant.findMany({
            select: { id: true, name: true, slug: true }
        })

        const connString = getDirectPostgresUrl()
        const client = new Client({
            connectionString: connString,
            ssl: connString.includes('localhost') ? false : { rejectUnauthorized: false }
        })

        await client.connect()

        const results: { tenant: string, status: string, message?: string }[] = []

        try {
            for (const tenant of tenants) {
                const schemaName = getSchemaName(tenant.id)
                console.log(`[MIGRATE] Updating schema: ${schemaName} (${tenant.slug})`)

                try {
                    // Update User table with missing legal columns
                    await client.query(`
                        ALTER TABLE "${schemaName}"."User" 
                        ADD COLUMN IF NOT EXISTS "legalAccepted" BOOLEAN DEFAULT false,
                        ADD COLUMN IF NOT EXISTS "legalAcceptedAt" TIMESTAMP WITH TIME ZONE,
                        ADD COLUMN IF NOT EXISTS "legalVersion" TEXT,
                        ADD COLUMN IF NOT EXISTS "marketingAccepted" BOOLEAN DEFAULT false,
                        ADD COLUMN IF NOT EXISTS "acceptanceIp" TEXT;
                    `)

                    // Update Product table with SoftRestaurant features
                    await client.query(`
                        ALTER TABLE "${schemaName}"."Product" 
                        ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS "percentageMerma" DOUBLE PRECISION DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS "useScale" BOOLEAN NOT NULL DEFAULT false,
                        ADD COLUMN IF NOT EXISTS "stockAlertEnabled" BOOLEAN NOT NULL DEFAULT true;
                    `)

                    // Update ProductVariant table with SoftRestaurant features
                    await client.query(`
                        ALTER TABLE "${schemaName}"."ProductVariant" 
                        ADD COLUMN IF NOT EXISTS "lastCost" DOUBLE PRECISION DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS "averageCost" DOUBLE PRECISION DEFAULT 0,
                        ADD COLUMN IF NOT EXISTS "yieldFactor" DOUBLE PRECISION NOT NULL DEFAULT 1;
                    `)

                    results.push({ tenant: tenant.slug, status: 'success' })
                } catch (err: any) {
                    console.error(`[MIGRATE] Error updating ${schemaName}:`, err.message)
                    results.push({ tenant: tenant.slug, status: 'error', message: err.message })
                }
            }
        } finally {
            await client.end()
        }

        return NextResponse.json({
            message: 'Migration completed',
            details: results,
            summary: {
                total: results.length,
                success: results.filter(r => r.status === 'success').length,
                error: results.filter(r => r.status === 'error').length
            }
        })
    } catch (error: any) {
        console.error('[ADMIN_TENANT_MIGRATE] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
    }
}
