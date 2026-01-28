import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        // 1. Verify Authentication & Permissions
        const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
        if (session instanceof NextResponse) {
            return session
        }

        const user = session.user as any
        const tenantId = user.tenantId

        // 2. Get Tenant Prisma Client
        const prisma = (await getPrismaForRequest(request, session)) as any

        if (!tenantId) {
            // Safety check: Don't allow reset on master DB if somehow routed here without tenant context
            // Unless it's intended for super admin on a specific tenant? 
            // For now, assume this is tenant-specific logic.
            return NextResponse.json(
                { error: 'Action not allowed on master database or without tenant context' },
                { status: 403 }
            )
        }

        logger.warn(`[DATABASE RESET] Initiated by user ${user.id} (${user.email}) for tenant ${tenantId}`)

        // 3. Execute Transaction
        // Order is critical to avoid Foreign Key Constraint errors
        await prisma.$transaction([
            // --- Sales & Returns ---
            prisma.returnPayment.deleteMany(),
            prisma.returnItem.deleteMany(),
            prisma.return.deleteMany(),
            prisma.payment.deleteMany(),
            prisma.invoiceItem.deleteMany(),
            prisma.invoice.deleteMany(),

            // --- Orders & Quotes ---
            prisma.salesOrderItem.deleteMany(),
            prisma.salesOrder.deleteMany(),
            prisma.quotationItem.deleteMany(),
            prisma.quotation.deleteMany(),

            // --- Purchases & Inventory ---
            prisma.goodsReceiptItem.deleteMany(),
            prisma.goodsReceipt.deleteMany(),
            prisma.purchaseOrderItem.deleteMany(),
            prisma.purchaseOrder.deleteMany(),
            prisma.physicalInventoryItem.deleteMany(),
            prisma.physicalInventory.deleteMany(),
            prisma.stockLevel.deleteMany(),
            prisma.stockMovement.deleteMany(),

            // --- Cash ---
            prisma.cashMovement.deleteMany(),
            prisma.cashShift.deleteMany(),

            // --- Marketing & CRM ---
            prisma.marketingCampaignRecipient.deleteMany(),
            prisma.marketingCampaign.deleteMany(),
            prisma.activity.deleteMany(),
            prisma.leadStageHistory.deleteMany(),
            prisma.lead.deleteMany(),

            // --- Master Data ---
            prisma.priceListItem.deleteMany(),

            // --- Restaurant Mode ---
            // Must be deleted before products due to foreign keys
            prisma.recipeItem.deleteMany(),
            prisma.recipe.deleteMany(),
            prisma.unitConversion.deleteMany(),
            prisma.unit.deleteMany(),

            // Products (Variants should cascade delete or be deleted first if not)
            // Explicitly deleting variants just in case
            prisma.productVariant.deleteMany(),
            prisma.product.deleteMany(),

            prisma.customer.deleteMany(),
            prisma.supplier.deleteMany(),
        ])

        logger.info(`[DATABASE RESET] Completed successfully for tenant ${tenantId}`)

        return NextResponse.json({ success: true, message: 'Base de datos reseteada correctamente' })

    } catch (error: any) {
        logger.error('[DATABASE RESET] Error:', error)
        return NextResponse.json(
            { error: 'Failed to reset database', details: error?.message || String(error) },
            { status: 500 }
        )
    }
}
