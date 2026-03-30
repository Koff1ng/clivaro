import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

const BRIDGE_URL = process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:3001'
const BRIDGE_SECRET = process.env.WHATSAPP_BRIDGE_SECRET || 'dev-secret-change-me'

// POST /api/whatsapp/send — send a WhatsApp message
export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const body = await request.json()
  const { to, message } = body

  if (!to || !message) {
    return NextResponse.json({ error: 'to and message required' }, { status: 400 })
  }

  try {
    const res = await fetch(`${BRIDGE_URL}/api/sessions/${tenantId}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bridge-secret': BRIDGE_SECRET,
      },
      body: JSON.stringify({ to, message }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Bridge offline' }, { status: 503 })
  }
}
