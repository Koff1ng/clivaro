import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

// GET /api/marketing/pipeline-stages
export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  const stages = await withTenantRead(tenantId, async (prisma) => {
    return prisma.pipelineStage.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { opportunities: true } }
      }
    })
  })

  return NextResponse.json(stages)
}

// POST /api/marketing/pipeline-stages
export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const body = await request.json()

  const stage = await withTenantTx(tenantId, async (prisma) => {
    const maxOrder = await prisma.pipelineStage.aggregate({ _max: { order: true } })
    return prisma.pipelineStage.create({
      data: {
        name: body.name,
        color: body.color || '#6366f1',
        order: (maxOrder._max.order ?? -1) + 1,
        isDefault: body.isDefault || false,
        isWon: body.isWon || false,
        isLost: body.isLost || false,
      }
    })
  })

  return NextResponse.json(stage, { status: 201 })
}
