import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

export async function GET(request: Request) {
    // Only super-admins or high-level users should see full health
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)

    if (session instanceof NextResponse) return session

    const status = {
        timestamp: new Date().toISOString(),
        database: {
            status: 'pending',
            latency: 0
        },
        system: {
            env: process.env.NODE_ENV,
            memory: process.memoryUsage()
        }
    }

    try {
        const start = Date.now()
        await prisma.$queryRaw`SELECT 1`
        status.database.latency = Date.now() - start
        status.database.status = 'healthy'
    } catch (error) {
        status.database.status = 'unhealthy'
        logger.error('Health check failed', error)
    }

    return NextResponse.json(status)
}
