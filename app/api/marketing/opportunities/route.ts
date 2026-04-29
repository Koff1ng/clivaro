import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { safeErrorMessage } from '@/lib/safe-error'

export const dynamic = 'force-dynamic'

const createOpportunitySchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional().nullable(),
  value: z.number().nonnegative().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedClose: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  source: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  stageId: z.string().optional(),
  customerId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
})

// GET /api/marketing/opportunities
export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const isSuper = (session.user as any).isSuperAdmin

  const planCheck = await requirePlanFeature(tenantId, 'marketing', isSuper)
  if (planCheck) return planCheck

  const { searchParams } = new URL(request.url)
  const stageId = searchParams.get('stageId')
  const search = searchParams.get('search')

  try {
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
  } catch (error: any) {
    logger.error('Error fetching opportunities', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Failed to fetch opportunities') }, { status: 500 })
  }
}

// POST /api/marketing/opportunities
export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const isSuper = (session.user as any).isSuperAdmin

  const planCheck = await requirePlanFeature(tenantId, 'marketing', isSuper)
  if (planCheck) return planCheck

  try {
    const body = await request.json()
    const data = createOpportunitySchema.parse(body)

    const opportunity = await withTenantTx(tenantId, async (prisma: any) => {
      // Get default stage if not provided
      let stageId = data.stageId
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
          title: data.title,
          description: data.description || null,
          value: data.value ?? 0,
          probability: data.probability ?? 50,
          expectedCloseDate: data.expectedClose ? new Date(data.expectedClose) : null,
          priority: data.priority || 'MEDIUM',
          source: data.source || null,
          contactPhone: data.contactPhone || null,
          notes: data.notes || null,
          order: (maxOrder._max.order ?? -1) + 1,
          stageId,
          stage: 'LEAD', // legacy field
          customerId: data.customerId || null,
          assignedToId: data.assignedToId || null,
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    logger.error('Error creating opportunity', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Failed to create opportunity') }, { status: 500 })
  }
}
