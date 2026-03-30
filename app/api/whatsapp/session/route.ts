import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

const BRIDGE_URL = process.env.WHATSAPP_BRIDGE_URL || 'http://localhost:3001'
const BRIDGE_SECRET = process.env.WHATSAPP_BRIDGE_SECRET || 'dev-secret-change-me'

async function bridgeFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-bridge-secret': BRIDGE_SECRET,
      ...options.headers,
    },
  })
  return res.json()
}

// GET /api/whatsapp/session — get session status
export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const data = await bridgeFetch(`/api/sessions/${tenantId}`)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ status: 'bridge_offline', qr: null, phone: null })
  }
}

// POST /api/whatsapp/session — start session
export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const data = await bridgeFetch(`/api/sessions/${tenantId}/start`, { method: 'POST' })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Bridge offline' }, { status: 503 })
  }
}

// DELETE /api/whatsapp/session — stop session
export async function DELETE(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const data = await bridgeFetch(`/api/sessions/${tenantId}/stop`, { method: 'POST' })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Bridge offline' }, { status: 503 })
  }
}
