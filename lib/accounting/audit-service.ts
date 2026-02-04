
import { prisma } from '@/lib/db'

/**
 * Log accounting action for audit trail
 */
export async function logAction(
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    userId: string,
    changes?: any
) {
    await prisma.accountingAuditLog.create({
        data: {
            tenantId,
            entityType,
            entityId,
            action,
            userId,
            changes: changes ? JSON.stringify(changes) : null
        }
    })
}

/**
 * Get audit log with filters
 */
export async function getAuditLog(
    tenantId: string,
    filters?: {
        entityType?: string
        entityId?: string
        startDate?: Date
        endDate?: Date
    }
) {
    const where: any = { tenantId }

    if (filters?.entityType) where.entityType = filters.entityType
    if (filters?.entityId) where.entityId = filters.entityId

    if (filters?.startDate || filters?.endDate) {
        where.createdAt = {}
        if (filters.startDate) where.createdAt.gte = filters.startDate
        if (filters.endDate) where.createdAt.lte = filters.endDate
    }

    return await prisma.accountingAuditLog.findMany({
        where,
        include: {
            user: {
                select: { name: true, email: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })
}
