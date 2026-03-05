import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getSchemaName } from '@/lib/tenant-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        const token = session?.user as any
        const tenantId: string | null = token?.tenantId ?? null

        // 1. Basic session info
        const sessionInfo = {
            userId: token?.id,
            name: token?.name,
            isSuperAdmin: token?.isSuperAdmin ?? false,
            tenantId,
            tenantSlug: token?.tenantSlug,
            roles: token?.roles,
        }

        // 2. Env vars (masked)
        const directUrl = process.env.DIRECT_URL || ''
        const databaseUrl = process.env.DATABASE_URL || ''
        const maskUrl = (u: string) => {
            try { const url = new URL(u); return `${url.protocol}//**:**@${url.host}${url.pathname}?${url.searchParams.toString()}` } catch { return u.slice(0, 30) + '...' }
        }

        const envInfo = {
            DIRECT_URL_set: !!directUrl,
            DIRECT_URL_masked: maskUrl(directUrl),
            DATABASE_URL_set: !!databaseUrl,
            DATABASE_URL_masked: maskUrl(databaseUrl),
        }

        // 3. Actual schema the master prisma connection uses
        let masterCurrentSchema = 'unknown'
        try {
            const r = await prisma.$queryRaw<{ search_path: string }[]>`SHOW search_path`
            masterCurrentSchema = r[0]?.search_path ?? 'unknown'
        } catch (e: any) { masterCurrentSchema = `ERROR: ${e?.message}` }

        // 4. What schema would the tenant PrismaClient use?
        let tenantSchemaUrl = 'N/A (no tenantId)'
        let tenantCurrentSchema = 'N/A'
        if (tenantId) {
            const schemaName = getSchemaName(tenantId)
            const base = process.env.DIRECT_URL || process.env.DATABASE_URL || ''
            try {
                const url = new URL(base)
                url.searchParams.delete('schema')
                url.searchParams.delete('pgbouncer')
                url.searchParams.set('schema', schemaName)
                tenantSchemaUrl = maskUrl(url.toString())
            } catch { tenantSchemaUrl = `parse-error, schema=${schemaName}` }

            // Test search_path via withTenantTx
            try {
                const { withTenantTx } = await import('@/lib/tenancy')
                const result = await withTenantTx(tenantId, async (tx: any) => {
                    const r = await tx.$queryRaw<{ search_path: string; current_schema: string }[]>`
            SELECT current_setting('search_path') AS search_path, current_schema() AS current_schema
          `
                    return r[0]
                })
                tenantCurrentSchema = JSON.stringify(result)
            } catch (e: any) {
                tenantCurrentSchema = `ERROR: ${e?.message}`
            }
        }

        // 5. Tenant info from master DB
        let tenantInfo = null
        if (tenantId) {
            try {
                tenantInfo = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true, active: true } })
            } catch (e: any) { tenantInfo = { error: e?.message } }
        }

        // 6. Existing tenant schemas
        let existingSchemas: string[] = []
        try {
            const r = await prisma.$queryRaw<{ schema_name: string }[]>`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%' ORDER BY schema_name`
            existingSchemas = r.map(x => x.schema_name)
        } catch { existingSchemas = ['ERROR'] }

        // 7. Table count and product count in the expected tenant schema
        let tableCount = 'N/A'
        let productCountInTenantSchema = 'N/A'
        if (tenantId) {
            const schemaName = getSchemaName(tenantId)
            // Use pg_tables (parameterized, always safe) to count tables in the schema
            try {
                const r = await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count FROM pg_tables WHERE schemaname = ${schemaName}
        `
                tableCount = String(r[0]?.count ?? 0)
            } catch (e: any) { tableCount = `ERROR: ${e?.message?.slice(0, 100)}` }

            // Use $queryRawUnsafe to avoid parameterizing the schema name identifier
            try {
                const r = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
                    `SELECT COUNT(*) as count FROM "${schemaName}"."Product"`
                )
                productCountInTenantSchema = String(r[0]?.count ?? 0)
            } catch (e: any) { productCountInTenantSchema = `ERROR: ${e?.message?.slice(0, 100)}` }
        }

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            session: sessionInfo,
            tenantInfo,
            envInfo,
            masterCurrentSchema,
            tenantCurrentSchema,
            tenantSchemaUrl,
            tableCount,
            productCountInTenantSchema,
            existingTenantSchemas: existingSchemas,
        })
    } catch (e: any) {
        return NextResponse.json({ error: e?.message }, { status: 500 })
    }
}
