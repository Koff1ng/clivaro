import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getSchemaName } from '@/lib/tenant-utils'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/tenants/schema-sizes
 * Returns the disk usage (in bytes and pretty-printed) for each tenant schema.
 * Only super admins can access this.
 */
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as any

        if (!user?.isSuperAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch all tenants
        const tenants = await prisma.tenant.findMany({
            select: { id: true, name: true, slug: true },
            orderBy: { name: 'asc' },
        })

        // Query size for each tenant schema
        const results: Array<{ tenantId: string; slug: string; name: string; bytes: number; pretty: string }> = []

        for (const tenant of tenants) {
            const schemaName = getSchemaName(tenant.id)
            try {
                const sizeResult = await prisma.$queryRaw<{ bytes: bigint; pretty: string }[]>`
          SELECT 
            COALESCE(
              SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))),
              0
            ) AS bytes,
            pg_size_pretty(
              COALESCE(
                SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename))),
                0
              )
            ) AS pretty
          FROM pg_tables
          WHERE schemaname = ${schemaName}
        `
                const row = sizeResult[0]
                results.push({
                    tenantId: tenant.id,
                    slug: tenant.slug,
                    name: tenant.name,
                    bytes: Number(row?.bytes ?? 0),
                    pretty: row?.pretty ?? '0 bytes',
                })
            } catch {
                results.push({ tenantId: tenant.id, slug: tenant.slug, name: tenant.name, bytes: 0, pretty: 'N/A' })
            }
        }

        // Sort by size descending
        results.sort((a, b) => b.bytes - a.bytes)

        return NextResponse.json({ sizes: results })
    } catch (error: any) {
        logger.error('[SCHEMA-SIZES]', error)
        return NextResponse.json({ error: 'Error fetching schema sizes', details: error?.message }, { status: 500 })
    }
}
