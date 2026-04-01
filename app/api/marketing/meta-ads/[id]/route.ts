import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getMetaCampaignByTrackingId, toggleCampaignStatus } from '@/lib/marketing/meta-ads-service'

export const dynamic = 'force-dynamic'

// GET: Get campaign status by tracking ID
export async function GET(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(params)
  const trackingId = resolvedParams.id

  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId

  try {
    const campaign = await getMetaCampaignByTrackingId(tenantId, trackingId)
    if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
    return NextResponse.json(campaign)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH: Pause or resume campaign
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(params)
  const trackingId = resolvedParams.id

  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId
  const body = await request.json()

  try {
    const result = await toggleCampaignStatus(tenantId, trackingId, body.action)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
