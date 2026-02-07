import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { prisma as masterPrisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Endpoint de depuración para verificar qué base de datos está siendo usada
 * y qué stock tiene el tenant
 */
export async function GET(request: Request) {
    try {
        const session = await requireAuth(request)

        if (session instanceof NextResponse) {
            return session
        }

        const user = session.user as any

        // Información del usuario
        const userInfo = {
            id: user.id,
            username: user.username,
            isSuperAdmin: user.isSuperAdmin,
            tenantId: user.tenantId,
        }

        // Obtener información del tenant desde la base de datos maestra
        let tenantInfo = null
        if (user.tenantId) {
            tenantInfo = await masterPrisma.tenant.findUnique({
                where: { id: user.tenantId },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    databaseUrl: true,
                    active: true,
                }
            })
        }

        // Obtener el cliente Prisma que se está usando
        const prisma = await getPrismaForRequest(request, session)

        // Verificar si estamos usando la base de datos correcta
        // contando productos y niveles de stock
        const productsCount = await prisma.product.count()
        const stockLevelsCount = await prisma.stockLevel.count()
        const warehousesCount = await prisma.warehouse.count()

        // Obtener algunos productos de ejemplo con su stock
        const sampleProducts = await prisma.product.findMany({
            take: 5,
            where: { active: true },
            include: {
                stockLevels: {
                    select: {
                        warehouseId: true,
                        quantity: true,
                        warehouse: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        })

        // Análisis de la configuración
        const analysis = {
            usingCorrectDatabase: !user.isSuperAdmin && user.tenantId ? 'TENANT_DB' : 'MASTER_DB',
            databaseType: tenantInfo?.databaseUrl.startsWith('file:') ? 'SQLite' :
                tenantInfo?.databaseUrl.startsWith('postgres') ? 'PostgreSQL' : 'Unknown',
            possibleIssue: null as string | null,
        }

        // Detectar problemas potenciales
        if (user.tenantId && tenantInfo) {
            const isPostgresEnv = (process.env.DATABASE_URL || '').startsWith('postgresql://')
            const isSQLiteTenant = tenantInfo.databaseUrl.startsWith('file:')

            if (isPostgresEnv && isSQLiteTenant) {
                analysis.possibleIssue = 'FALLBACK_TO_MASTER: El tenant tiene una BD SQLite pero el entorno usa PostgreSQL. Se está usando la BD maestra.'
            } else if (productsCount === 0 || stockLevelsCount === 0) {
                analysis.possibleIssue = 'NO_DATA: La base de datos del tenant está vacía o no tiene productos/stock.'
            } else if (stockLevelsCount === 0 && productsCount > 0) {
                analysis.possibleIssue = 'NO_STOCK_LEVELS: Hay productos pero no hay registros de stock.'
            }
        }

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            user: userInfo,
            tenant: tenantInfo,
            database: {
                productsCount,
                stockLevelsCount,
                warehousesCount,
                envDatabaseUrl: process.env.DATABASE_URL?.substring(0, 50) + '...',
            },
            sampleProducts: sampleProducts.map(p => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                trackStock: p.trackStock,
                stockLevels: p.stockLevels,
            })),
            analysis,
        })
    } catch (error: any) {
        return NextResponse.json(
            {
                error: error.message || 'Error en diagnóstico',
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            { status: 500 }
        )
    }
}
