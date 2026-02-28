import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { initializeTenantDatabase } from '@/lib/initialize-tenant'
import { logger } from '@/lib/logger'

/**
 * POST /api/admin/tenants/[id]/reinit
 * Re-initializes the schema for an existing tenant.
 * Idempotent — safe to run on already-initialized tenants.
 */
export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requireAuth(request)
        if (session instanceof NextResponse) return session

        const user = session.user as any
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { isSuperAdmin: true },
        })

        if (!dbUser?.isSuperAdmin) {
            return NextResponse.json({ error: 'Unauthorized - Super admin required' }, { status: 403 })
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: params.id },
            select: { id: true, name: true, slug: true, databaseUrl: true, active: true },
        })

        if (!tenant) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })
        }

        logger.info('Re-initializing tenant schema', { tenantId: tenant.id })

        const result = await initializeTenantDatabase(
            tenant.databaseUrl || process.env.DATABASE_URL!,
            tenant.name,
            tenant.slug,
            tenant.id
        )

        logger.info('Tenant schema re-initialized successfully', { tenantId: tenant.id })

        return NextResponse.json({
            success: true,
            message: 'Schema re-inicializado correctamente.',
            credentials: result,
        })
    } catch (error: any) {
        logger.error('Error re-initializing tenant', error)
        return NextResponse.json(
            { error: 'Error al re-inicializar el tenant', details: error.message },
            { status: 500 }
        )
    }
}
