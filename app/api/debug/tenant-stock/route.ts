import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/api-middleware'
import { withTenantRead, getTenantIdFromSession, TenancyError } from '@/lib/tenancy'
import { prisma as masterPrisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const session = await requireAuth(request)
        if (session instanceof NextResponse) return session

        const user = session.user as any
        const userInfo = { id: user.id, username: user.username, isSuperAdmin: user.isSuperAdmin, tenantId: user.tenantId }

        let tenantInfo: any = null
        if (user.tenantId) {
            tenantInfo = await masterPrisma.tenant.findUnique({
                where: { id: user.tenantId },
                select: { id: true, name: true, slug: true, databaseUrl: true, active: true }
            })
        }

        let dbStats = { productsCount: 0, stockLevelsCount: 0, warehousesCount: 0, sampleProducts: [] as any[] }

        if (user.tenantId) {
            try {
                dbStats = await withTenantRead(user.tenantId, async (prisma) => {
                    const [pCount, slCount, wCount, samples] = await Promise.all([
                        prisma.product.count(),
                        prisma.stockLevel.count(),
                        prisma.warehouse.count(),
                        prisma.product.findMany({
                            take: 5,
                            where: { active: true },
                            include: {
                                stockLevels: {
                                    select: { quantity: true, warehouse: { select: { name: true } } }
                                }
                            }
                        })
                    ])
                    return { productsCount: pCount, stockLevelsCount: slCount, warehousesCount: wCount, sampleProducts: samples }
                })
            } catch (te: any) {
                logger.error('Tenancy access error in debug', te)
            }
        } else {
            // Master DB fallback for superadmin
            const [pCount, slCount, wCount, samples] = await Promise.all([
                masterPrisma.product.count(),
                masterPrisma.stockLevel.count(),
                masterPrisma.warehouse.count(),
                masterPrisma.product.findMany({
                    take: 5,
                    where: { active: true },
                    include: {
                        stockLevels: {
                            select: { quantity: true, warehouse: { select: { name: true } } }
                        }
                    }
                })
            ])
            dbStats = { productsCount: pCount, stockLevelsCount: slCount, warehousesCount: wCount, sampleProducts: samples }
        }

        const analysis = {
            usingCorrectDatabase: user.tenantId ? 'TENANT_DB' : 'MASTER_DB',
            databaseType: tenantInfo?.databaseUrl.startsWith('file:') ? 'SQLite' : tenantInfo?.databaseUrl.startsWith('postgres') ? 'PostgreSQL' : 'Unknown',
            possibleIssue: null as string | null,
        }

        if (user.tenantId && tenantInfo) {
            if (dbStats.productsCount === 0 || dbStats.stockLevelsCount === 0) analysis.possibleIssue = 'NO_DATA'
        }

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            user: userInfo,
            tenant: tenantInfo,
            database: {
                productsCount: dbStats.productsCount,
                stockLevelsCount: dbStats.stockLevelsCount,
                warehousesCount: dbStats.warehousesCount,
                envDatabaseUrl: process.env.DATABASE_URL?.substring(0, 50) + '...',
            },
            sampleProducts: dbStats.sampleProducts,
            analysis,
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
