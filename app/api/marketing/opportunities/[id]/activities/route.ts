import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { safeErrorMessage } from '@/lib/safe-error'

export const dynamic = 'force-dynamic'

const createActivitySchema = z.object({
  type: z.string().optional(),
  content: z.string().min(1, 'El contenido es requerido'),
  metadata: z.any().optional(),
})

async function resolveId(params: { id: string } | Promise<{ id: string }>): Promise<string> {
  const resolved = typeof params === 'object' && 'then' in params ? await params : params as { id: string }
  return resolved.id
}

// GET /api/marketing/opportunities/[id]/activities
export async function GET(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const isSuper = (session.user as any).isSuperAdmin

  const planCheck = await requirePlanFeature(tenantId, 'marketing', isSuper)
  if (planCheck) return planCheck

  try {
    const id = await resolveId(params)
    const { searchParams } = new URL(request.url)
    const take = Math.min(200, Math.max(1, parseInt(searchParams.get('take') || '50') || 50))
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0)

    const activities = await withTenantRead(tenantId, async (prisma: any) => {
      return prisma.opportunityActivity.findMany({
        where: { opportunityId: id },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      })
    })

    return NextResponse.json(activities)
  } catch (error: any) {
    logger.error('Error fetching activities', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Failed to fetch activities') }, { status: 500 })
  }
}

// POST /api/marketing/opportunities/[id]/activities
export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const isSuper = (session.user as any).isSuperAdmin

  const planCheck = await requirePlanFeature(tenantId, 'marketing', isSuper)
  if (planCheck) return planCheck

  try {
    const id = await resolveId(params)
    const body = await request.json()
    const data = createActivitySchema.parse(body)

    const activity = await withTenantTx(tenantId, async (prisma: any) => {
      const opp = await prisma.opportunity.findUnique({ where: { id } })
      if (!opp) throw new Error('Oportunidad no encontrada')

      return prisma.opportunityActivity.create({
        data: {
          type: data.type || 'NOTE',
          content: data.content,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          opportunityId: id,
          createdById: (session.user as any).id,
        }
      })
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    logger.error('Error creating activity', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Failed to create activity') }, { status: 500 })
  }
}
