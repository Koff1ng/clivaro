import { getTenantIdFromSession } from '@/lib/tenancy'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantBus, RESTAURANT_EVENTS } from '@/lib/events'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET: Mantiene una conexión SSE abierta para recibir actualizaciones en tiempo real.
 */
export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_RESTAURANT)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const bus = getTenantBus(tenantId)

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        start(controller) {
            // Function to send data
            const sendEvent = (event: string, data: any) => {
                const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
                controller.enqueue(encoder.encode(message))
            }

            // Listen to events on the bus
            const onTableUpdated = (data: any) => sendEvent(RESTAURANT_EVENTS.TABLE_UPDATED, data)
            const onSessionUpdated = (data: any) => sendEvent(RESTAURANT_EVENTS.SESSION_UPDATED, data)
            const onOrderCreated = (data: any) => sendEvent(RESTAURANT_EVENTS.ORDER_CREATED, data)
            const onKdsUpdate = (data: any) => sendEvent(RESTAURANT_EVENTS.KDS_UPDATE, data)

            bus.on(RESTAURANT_EVENTS.TABLE_UPDATED, onTableUpdated)
            bus.on(RESTAURANT_EVENTS.SESSION_UPDATED, onSessionUpdated)
            bus.on(RESTAURANT_EVENTS.ORDER_CREATED, onOrderCreated)
            bus.on(RESTAURANT_EVENTS.KDS_UPDATE, onKdsUpdate)

            // Keep-alive heartbeat (every 30 seconds)
            const heartbeat = setInterval(() => {
                controller.enqueue(encoder.encode(': heartbeat\n\n'))
            }, 30000)

            // Cleanup on close
            request.signal.addEventListener('abort', () => {
                bus.off(RESTAURANT_EVENTS.TABLE_UPDATED, onTableUpdated)
                bus.off(RESTAURANT_EVENTS.SESSION_UPDATED, onSessionUpdated)
                bus.off(RESTAURANT_EVENTS.ORDER_CREATED, onOrderCreated)
                bus.off(RESTAURANT_EVENTS.KDS_UPDATE, onKdsUpdate)
                clearInterval(heartbeat)
                controller.close()
            })

            // Initial success message
            sendEvent('connected', { success: true, timestamp: new Date().toISOString() })
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
}
