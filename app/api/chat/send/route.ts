import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { prisma as masterPrisma } from '@/lib/db'
import { withTenantTx, withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function POST(req: NextRequest) {
    const session = await requirePermission(req as any, PERMISSIONS.MANAGE_CRM);
    if (session instanceof NextResponse) return session;

    const tenantId = getTenantIdFromSession(session);
    if (!tenantId) {
        return NextResponse.json({ error: "Tenant context required" }, { status: 403 });
    }

    try {
        const { leadId, content, channel = 'WHATSAPP' } = await req.json()

        return await withTenantTx(tenantId, async (tx) => {
            // 1. Get Lead from tenant context
            const lead = await tx.lead.findUnique({
                where: { id: leadId }
            })

            if (!lead || !lead.phone) {
                return new NextResponse('Lead not found or missing phone', { status: 400 })
            }

            // 2. Fetch tenant settings from master DB
            const settings = await masterPrisma.tenantSettings.findUnique({
                where: { tenantId }
            })

            if (!settings?.metaAccessToken || !settings?.whatsappPhoneNumberId) {
                return new NextResponse('Meta credentials not configured', { status: 400 })
            }

            // 3. Send to Meta API
            const url = `https://graph.facebook.com/v18.0/${settings.whatsappPhoneNumberId}/messages`

            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: lead.phone.replace(/[^0-9]/g, ''),
                type: "text",
                text: { preview_url: false, body: content }
            }

            const metaRes = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.metaAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })

            const metaData = await metaRes.json()

            if (!metaRes.ok) {
                throw new Error(JSON.stringify(metaData))
            }

            // 4. Save Outbound Message to tenant context
            const newMessage = await tx.chatMessage.create({
                data: {
                    leadId,
                    direction: 'OUTBOUND',
                    channel,
                    content,
                    externalId: metaData.messages?.[0]?.id || `out_${Date.now()}`,
                    status: 'SENT'
                }
            })

            return NextResponse.json(newMessage)
        })

    } catch (error: any) {
        logger.error('Send message error:', error)
        return new NextResponse(safeErrorMessage(error, 'Internal Error'), { status: 500 })
    }
}
