import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

// GET /api/marketing/opportunities
export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const { searchParams } = new URL(request.url)
  const stageId = searchParams.get('stageId')
  const search = searchParams.get('search')

  const opportunities = await withTenantRead(tenantId, async (prisma: any) => {
    return prisma.opportunity.findMany({
      where: {
        ...(stageId ? { stageId } : {}),
        ...(search ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { customer: { name: { contains: search, mode: 'insensitive' } } },
            { contactPhone: { contains: search } },
          ]
        } : {}),
      },
      include: {
        pipelineStage: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
        _count: { select: { activities: true } },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    })
  })

  return NextResponse.json(opportunities)
}

// POST /api/marketing/opportunities
export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const body = await request.json()

  const opportunity = await withTenantTx(tenantId, async (prisma: any) => {
    // Get default stage if not provided
    let stageId = body.stageId
    if (!stageId) {
      const defaultStage = await prisma.pipelineStage.findFirst({
        where: { isDefault: true },
        orderBy: { order: 'asc' }
      })
      if (!defaultStage) {
        const firstStage = await prisma.pipelineStage.findFirst({ orderBy: { order: 'asc' } })
        if (!firstStage) throw new Error('No hay etapas de pipeline configuradas')
        stageId = firstStage.id
      } else {
        stageId = defaultStage.id
      }
    }

    // Get max order within stage
    const maxOrder = await prisma.opportunity.aggregate({
      where: { stageId },
      _max: { order: true }
    })

    const opp = await prisma.opportunity.create({
      data: {
        title: body.title,
        description: body.description || null,
        value: body.value || 0,
        probability: body.probability || 50,
        expectedCloseDate: body.expectedClose ? new Date(body.expectedClose) : null,
        priority: body.priority || 'MEDIUM',
        source: body.source || null,
        contactPhone: body.contactPhone || null,
        notes: body.notes || null,
        order: (maxOrder._max.order ?? -1) + 1,
        stageId,
        stage: 'LEAD', // legacy field
        customerId: body.customerId || null,
        assignedToId: body.assignedToId || null,
        createdById: (session.user as any).id,
      },
      include: {
        pipelineStage: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
      }
    })

    // Log creation activity
    await prisma.opportunityActivity.create({
      data: {
        type: 'NOTE',
        content: `Oportunidad creada: ${opp.title}`,
        opportunityId: opp.id,
        createdById: (session.user as any).id,
      }
    })

    return opp
  })

  return NextResponse.json(opportunity, { status: 201 })
}
