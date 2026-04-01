import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { publishFullCampaign, getMetaCampaigns } from '@/lib/marketing/meta-ads-service'

export const dynamic = 'force-dynamic'

// GET: List all Meta Ads campaigns for this tenant
export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId

  try {
    const campaigns = await getMetaCampaigns(tenantId)
    return NextResponse.json(campaigns)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST: Publish a new full campaign (async — returns tracking ID immediately)
export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId
  const userId = (session.user as any).id
  const body = await request.json()

  try {
    const result = await publishFullCampaign(tenantId, userId, body)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
