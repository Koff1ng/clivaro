import { NextResponse } from 'next/server'
import { getRestaurantEventBus } from '@/lib/events'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [
    PERMISSIONS.MANAGE_RESTAURANT,
    PERMISSIONS.MANAGE_SALES,
  ])
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  const responseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  }

  const bus = getRestaurantEventBus(tenantId)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const onEvent = (event: any) => {
        if (['ORDER_SENT_TO_KITCHEN', 'ORDER_STATUS_UPDATED', 'ITEM_STATUS_UPDATED'].includes(event.type)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }
      }

      bus.on('event', onEvent)

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, 30000)

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        bus.off('event', onEvent)
        controller.close()
      })
    },
  })

  return new Response(stream, { headers: responseHeaders })
}
