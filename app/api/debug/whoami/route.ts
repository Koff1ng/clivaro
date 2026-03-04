import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/db'
import { getSchemaName } from '@/lib/tenant-utils'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/whoami
 * Returns the current session/token data so we can diagnose tenant isolation issues.
 * This endpoint is intentionally verbose for debugging.
 */
export async function GET(request: Request) {
    try {
        // Get both session and raw token for comparison
        const session = await getServerSession(authOptions)
        const secret = process.env.NEXTAUTH_SECRET
        const token = await getToken({ req: request as any, secret })

        // Resolve tenant info from master DB if we have a tenantId
        let tenantInfo: any = null
        const tenantId = (session?.user as any)?.tenantId || (token?.tenantId as string)

        if (tenantId) {
            try {
                const tenant = await prisma.tenant.findUnique({
                    where: { id: tenantId },
                    select: { id: true, name: true, slug: true, active: true },
                })
                tenantInfo = tenant
            } catch (e: any) {
                tenantInfo = { error: e?.message }
            }
        }

        // Check what schemas actually exist in the database
        let existingSchemas: string[] = []
        try {
            const schemaResult = await prisma.$queryRaw<{ schema_name: string }[]>`
        SELECT schema_name FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
        ORDER BY schema_name
      `
            existingSchemas = schemaResult.map((r) => r.schema_name)
        } catch (e: any) {
            existingSchemas = [`ERROR: ${e?.message}`]
        }

        const expectedSchemaName = tenantId ? getSchemaName(tenantId) : null

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            session: {
                userId: (session?.user as any)?.id,
                name: session?.user?.name,
                email: session?.user?.email,
                isSuperAdmin: (session?.user as any)?.isSuperAdmin,
                tenantId: (session?.user as any)?.tenantId,
                tenantSlug: (session?.user as any)?.tenantSlug,
                roles: (session?.user as any)?.roles,
                permissions: ((session?.user as any)?.permissions || []).slice(0, 5),
                permissionsCount: ((session?.user as any)?.permissions || []).length,
            },
            token: token ? {
                sub: token.sub,
                isSuperAdmin: token.isSuperAdmin,
                tenantId: token.tenantId,
                tenantSlug: token.tenantSlug,
                roles: token.roles,
            } : null,
            tenantInfo,
            schemaResolution: {
                tenantId,
                expectedSchemaName,
                schemaExists: expectedSchemaName
                    ? existingSchemas.includes(expectedSchemaName)
                    : false,
            },
            existingTenantSchemas: existingSchemas,
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: 'Debug endpoint error', details: error?.message },
            { status: 500 }
        )
    }
}
