import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
    try {
        const { leadId, content, channel = 'WHATSAPP' } = await req.json()

        // 1. Get Lead and System Settings
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: {
                // Assuming Tenant is linked via User or we pick the first tenant for single-tenant
                // Simplified: We'll fetch the first tenant settings found (Multi-tenant needs context)
            }
        })

        if (!lead || !lead.phone) {
            return new NextResponse('Lead not found or missing phone', { status: 400 })
        }

        // Fetch settings (simplified to first tenant for demo)
        const settings = await prisma.tenantSettings.findFirst()

        if (!settings?.metaAccessToken || !settings?.whatsappPhoneNumberId) {
            return new NextResponse('Meta credentials not configured', { status: 400 })
        }

        // 2. Send to Meta API
        const url = `https://graph.facebook.com/v18.0/${settings.whatsappPhoneNumberId}/messages`

        // Simplified Text Message Payload
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

        // 3. Save Outbound Message
        const newMessage = await prisma.chatMessage.create({
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

    } catch (error: any) {
        console.error('Send message error:', error)
        return new NextResponse(error.message || 'Internal Error', { status: 500 })
    }
}
