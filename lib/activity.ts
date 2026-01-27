
import { PrismaClient } from '@prisma/client'

type ActivityType =
    | 'SYSTEM'
    | 'PRODUCT_CREATE'
    | 'PRODUCT_UPDATE'
    | 'PRODUCT_DELETE'
    | 'INVENTORY_ADJUSTMENT'
    | 'LOGIN'
    | 'LOGOUT'
    | 'SETTINGS_UPDATE'

interface LogActivityOptions {
    prisma: any // Accepts transaction client or regular client
    type: ActivityType | string
    subject: string
    description?: string
    userId: string
    customerId?: string
    leadId?: string
    metadata?: any // Can be stringified into description if needed
}

/**
 * Logs a system activity to the Activity table.
 * Since Activity is primarily for CRM, we use specific types to distinguish system logs.
 */
export async function logActivity({
    prisma,
    type,
    subject,
    description,
    userId,
    customerId,
    leadId,
    metadata
}: LogActivityOptions) {
    try {
        let finalDescription = description || ''

        if (metadata) {
            const metaString = JSON.stringify(metadata, null, 2)
            finalDescription = finalDescription
                ? `${finalDescription}\n\nMetadata: ${metaString}`
                : `Metadata: ${metaString}`
        }

        await prisma.activity.create({
            data: {
                type,
                subject,
                description: finalDescription,
                createdById: userId,
                customerId: customerId || null,
                leadId: leadId || null,
            }
        })
    } catch (error) {
        console.error('Failed to log activity:', error)
        // Don't throw, we don't want to break the main flow if logging fails
    }
}
