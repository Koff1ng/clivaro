import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const user = session.user as any

    if (!tenantId) {
        return NextResponse.json({ error: 'Tenant context required' }, { status: 403 })
    }

    logger.warn(`[DATABASE RESET] Initiated by user ${user.id} for tenant ${tenantId}`)

    try {
        await withTenantTx(tenantId, async (prisma) => {
            // Note: withTenantTx already wraps in a transaction
            await prisma.returnPayment.deleteMany()
            await prisma.returnItem.deleteMany()
            await prisma.return.deleteMany()
            await prisma.payment.deleteMany()
            await prisma.invoiceItem.deleteMany()
            await prisma.invoice.deleteMany()
            await prisma.salesOrderItem.deleteMany()
            await prisma.salesOrder.deleteMany()
            await prisma.quotationItem.deleteMany()
            await prisma.quotation.deleteMany()
            await prisma.goodsReceiptItem.deleteMany()
            await prisma.goodsReceipt.deleteMany()
            await prisma.purchaseOrderItem.deleteMany()
            await prisma.purchaseOrder.deleteMany()
            await prisma.physicalInventoryItem.deleteMany()
            await prisma.physicalInventory.deleteMany()
            await prisma.stockLevel.deleteMany()
            await prisma.stockMovement.deleteMany()
            await prisma.cashMovement.deleteMany()
            await prisma.cashShift.deleteMany()
            await prisma.marketingCampaignRecipient.deleteMany()
            await prisma.marketingCampaign.deleteMany()
            await prisma.activity.deleteMany()
            await prisma.leadStageHistory.deleteMany()
            await prisma.lead.deleteMany()
            await prisma.priceListItem.deleteMany()
            await prisma.recipeItem.deleteMany()
            await prisma.recipe.deleteMany()
            await prisma.unitConversion.deleteMany()
            await prisma.unit.deleteMany()
            await prisma.productVariant.deleteMany()
            await prisma.product.deleteMany()
            await prisma.customer.deleteMany()
            await prisma.supplier.deleteMany()
        })

        return NextResponse.json({ success: true, message: 'Base de datos reseteada correctamente' })
    } catch (error: any) {
        logger.error('[DATABASE RESET] Error:', error)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}
