import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma as masterPrisma } from '@/lib/db'
import { Client } from 'pg'
import { getSchemaNameAsync } from '@/lib/tenant-utils'

export const dynamic = 'force-dynamic'

/**
 * Gets a direct Postgres URL suitable for raw SQL (no pgbouncer, no schema param).
 */
function getDirectPostgresUrl(): string {
    const base = process.env.DIRECT_URL || process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || ''
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
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const tenantId = (session.user as any).tenantId
        const userId = (session.user as any).id
        const { marketingAccepted, version, ip } = await req.json()
        const clientIp = ip || req.headers.get('x-forwarded-for') || '127.0.0.1'
        const legalVersion = version || 'v1.0 - Marzo 2026'

        if (!tenantId) {
            // Super admin — update in public schema via raw SQL
            // (legalAccepted columns may not be in Prisma schema either)
            try {
                await masterPrisma.$executeRawUnsafe(
                    `UPDATE "User" SET "legalAccepted" = true, "legalAcceptedAt" = NOW(), "legalVersion" = $1, "marketingAccepted" = $2, "acceptanceIp" = $3 WHERE "id" = $4`,
                    legalVersion, !!marketingAccepted, clientIp, userId
                )
            } catch (masterErr: any) {
                // If columns don't exist in public schema, just log and continue
                logger.warn('[LEGAL_API] Could not update legal fields in public schema:', masterErr.message)
            }
        } else {
            // Tenant user — update in their schema via raw pg Client
            // NOTE: We use raw SQL because legalAccepted/legalAcceptedAt/etc. are NOT
            // in the Prisma schema. They exist only as raw columns added via ALTER TABLE
            // during tenant initialization. Prisma silently ignores unknown fields even
            // with `as any` casts, so `prisma.user.update()` would be a no-op.
            const schemaName = await getSchemaNameAsync(tenantId)
            const connString = getDirectPostgresUrl()
            const client = new Client({
                connectionString: connString,
                ssl: connString.includes('localhost') || connString.includes('127.0.0.1')
                    ? false
                    : { rejectUnauthorized: false },
            })

            try {
                await client.connect()
                await client.query(`SET search_path TO "${schemaName}", public`)
                await client.query(
                    `UPDATE "User" 
                     SET "legalAccepted" = true, 
                         "legalAcceptedAt" = NOW(), 
                         "legalVersion" = $1, 
                         "marketingAccepted" = $2, 
                         "acceptanceIp" = $3 
                     WHERE "id" = $4`,
                    [legalVersion, !!marketingAccepted, clientIp, userId]
                )
            } finally {
                await client.end().catch(() => {})
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        logger.error('[LEGAL_API] Error saving acceptance:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
