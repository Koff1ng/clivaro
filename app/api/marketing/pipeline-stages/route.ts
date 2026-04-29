import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { safeErrorMessage } from '@/lib/safe-error'

export const dynamic = 'force-dynamic'

const createStageSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  color: z.string().optional(),
  isDefault: z.boolean().optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
})

// GET /api/marketing/pipeline-stages
export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const isSuper = (session.user as any).isSuperAdmin

  const planCheck = await requirePlanFeature(tenantId, 'marketing', isSuper)
  if (planCheck) return planCheck

  try {
    const stages = await withTenantRead(tenantId, async (prisma) => {
      return prisma.pipelineStage.findMany({
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { opportunities: true } }
        }
      })
    })

    return NextResponse.json(stages)
  } catch (error: any) {
    logger.error('Error fetching pipeline stages', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Failed to fetch pipeline stages') }, { status: 500 })
  }
}

// POST /api/marketing/pipeline-stages
export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const isSuper = (session.user as any).isSuperAdmin

  const planCheck = await requirePlanFeature(tenantId, 'marketing', isSuper)
  if (planCheck) return planCheck

  try {
    const body = await request.json()
    const data = createStageSchema.parse(body)

    const stage = await withTenantTx(tenantId, async (prisma) => {
      const maxOrder = await prisma.pipelineStage.aggregate({ _max: { order: true } })
      return prisma.pipelineStage.create({
        data: {
          name: data.name,
          color: data.color || '#6366f1',
          order: (maxOrder._max.order ?? -1) + 1,
          isDefault: data.isDefault || false,
          isWon: data.isWon || false,
          isLost: data.isLost || false,
        }
      })
    })

    return NextResponse.json(stage, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    logger.error('Error creating pipeline stage', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Failed to create pipeline stage') }, { status: 500 })
  }
}
