import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// This would typically be an environment variable
const VERIFY_TOKEN = 'clivaro_meta_verify_token'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return new NextResponse(challenge, { status: 200 })
    }

    return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // Handle incoming messages
        if (body.object === 'whatsapp_business_account' || body.object === 'instagram') {
            const entry = body.entry?.[0]
            const changes = entry?.changes?.[0]
            const value = changes?.value

            if (value?.messages?.[0]) {
                const message = value.messages[0]
                const from = message.from
                const text = message.text?.body || '[Multimedia]'
                const msgId = message.id
                const timestamp = message.timestamp

                // Determine channel
                const channel = body.object === 'whatsapp_business_account' ? 'WHATSAPP' : 'INSTAGRAM'

                // 1. Find Lead by Phone or metadata
                // Note: For WhatsApp 'from' is the phone number. For IG it's an ID.
                // Simplified Logic: Try to find a lead with this phone/instagram ID
                // In production, we'd need more robust matching (e.g. IG Scoped ID vs Username)

                let lead = await prisma.lead.findFirst({
                    where: {
                        OR: [
                            { phone: { contains: from } }, // Simple matching
                            { instagram: { contains: from } }
                        ]
                    }
                })

                // If no lead found, we might create one or ignore. 
                // For this demo, we'll only attach if lead exists, or create a "New Lead" if phone is provided
                if (!lead && channel === 'WHATSAPP') {
                    lead = await prisma.lead.create({
                        data: {
                            name: `Lead WA ${from}`,
                            phone: from,
                            stage: 'NEW',
                            source: 'WhatsApp Inbound'
                        }
                    })
                }

                if (lead) {
                    // Check if message already exists (deduplication)
                    const existing = await prisma.chatMessage.findUnique({
                        where: { externalId: msgId }
                    })

                    if (!existing) {
                        await prisma.chatMessage.create({
                            data: {
                                leadId: lead.id,
                                direction: 'INBOUND',
                                channel,
                                content: text,
                                externalId: msgId,
                                status: 'RECEIVED',
                                createdAt: new Date(Number(timestamp) * 1000)
                            }
                        })
                    }
                }
            }
        }

        return new NextResponse('EVENT_RECEIVED', { status: 200 })
    } catch (error) {
        console.error('Webhook error:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
