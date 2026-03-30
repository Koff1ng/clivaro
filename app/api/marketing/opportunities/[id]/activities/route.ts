import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

// GET /api/marketing/opportunities/[id]/activities
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const { searchParams } = new URL(request.url)
  const take = parseInt(searchParams.get('take') || '50')
  const skip = parseInt(searchParams.get('skip') || '0')

  const activities = await withTenantRead(tenantId, async (prisma: any) => {
    return prisma.opportunityActivity.findMany({
      where: { opportunityId: params.id },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    })
  })

  return NextResponse.json(activities)
}

// POST /api/marketing/opportunities/[id]/activities
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const body = await request.json()

  const activity = await withTenantTx(tenantId, async (prisma: any) => {
    // Verify opportunity exists
    const opp = await prisma.opportunity.findUnique({ where: { id: params.id } })
    if (!opp) throw new Error('Oportunidad no encontrada')

    return prisma.opportunityActivity.create({
      data: {
        type: body.type || 'NOTE',
        content: body.content,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        opportunityId: params.id,
        createdById: (session.user as any).id,
      }
    })
  })

  return NextResponse.json(activity, { status: 201 })
}
