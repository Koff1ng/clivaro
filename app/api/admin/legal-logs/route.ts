import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Client } from 'pg'
import { getSchemaName } from '@/lib/tenant-utils'

export const dynamic = 'force-dynamic'

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

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !(session.user as any).isSuperAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const search = searchParams.get('search') || ''

        // 1. Get all tenants
        const tenants = await prisma.tenant.findMany({
            select: { id: true, name: true, slug: true }
        })

        const allLogs: any[] = []
        const connString = getDirectPostgresUrl()
        const client = new Client({ connectionString: connString })

        await client.connect()

        try {
            // 2. Fetch from Master (Public)
            const masterUsers = await client.query(`
        SELECT id, name, email, username, "legalAccepted", "legalAcceptedAt", "legalVersion", "acceptanceIp", "marketingAccepted"
        FROM public."User"
        WHERE "legalAccepted" = true
        ${search ? `AND (name ILIKE $1 OR email ILIKE $1 OR username ILIKE $1)` : ''}
      `, search ? [`%${search}%`] : [])

            masterUsers.rows.forEach(u => {
                allLogs.push({
                    ...u,
                    tenantName: 'Master / Super Admin',
                    tenantSlug: 'master'
                })
            })

            // 3. Fetch from each Tenant
            for (const tenant of tenants) {
                const schemaName = getSchemaName(tenant.id)
                try {
                    const tenantUsers = await client.query(`
            SELECT id, name, email, username, "legalAccepted", "legalAcceptedAt", "legalVersion", "acceptanceIp", "marketingAccepted"
            FROM "${schemaName}"."User"
            WHERE "legalAccepted" = true
            ${search ? `AND (name ILIKE $1 OR email ILIKE $1 OR username ILIKE $1)` : ''}
          `, search ? [`%${search}%`] : [])

                    tenantUsers.rows.forEach(u => {
                        allLogs.push({
                            ...u,
                            tenantName: tenant.name,
                            tenantSlug: tenant.slug
                        })
                    })
                } catch (err) {
                    console.error(`Error fetching logs for tenant ${tenant.slug}:`, err)
                    // Continue with next tenant even if one fails
                }
            }
        } finally {
            await client.end()
        }

        // Sort by date descending
        allLogs.sort((a, b) => {
            const dateA = a.legalAcceptedAt ? new Date(a.legalAcceptedAt).getTime() : 0
            const dateB = b.legalAcceptedAt ? new Date(b.legalAcceptedAt).getTime() : 0
            return dateB - dateA
        })

        return NextResponse.json({ logs: allLogs })
    } catch (error: any) {
        console.error('[ADMIN_LEGAL_LOGS] Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
