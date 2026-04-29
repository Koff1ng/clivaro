import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { safeErrorMessage } from '@/lib/safe-error'

export const dynamic = 'force-dynamic'

const updateOpportunitySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  value: z.number().nonnegative().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  source: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  stageId: z.string().optional(),
  order: z.number().int().optional(),
})

// Resolves the params object regardless of whether Next passes it as a plain
// object (Next 14) or a Promise (Next 15+).
async function resolveId(params: { id: string } | Promise<{ id: string }>): Promise<string> {
  const resolved = typeof params === 'object' && 'then' in params ? await params : params as { id: string }
  return resolved.id
}

// GET /api/marketing/opportunities/[id]
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

    const opportunity = await withTenantRead(tenantId, async (prisma: any) => {
      return prisma.opportunity.findUnique({
        where: { id },
        include: {
          pipelineStage: true,
          customer: { select: { id: true, name: true, phone: true, email: true, taxId: true } },
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 50,
          },
        }
      })
    })

    if (!opportunity) {
      return NextResponse.json({ error: 'Oportunidad no encontrada' }, { status: 404 })
    }

    return NextResponse.json(opportunity)
  } catch (error: any) {
    logger.error('Error fetching opportunity', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Failed to fetch opportunity') }, { status: 500 })
  }
}

// PATCH /api/marketing/opportunities/[id]
export async function PATCH(
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
    const data = updateOpportunitySchema.parse(body)

    const result = await withTenantTx(tenantId, async (prisma: any) => {
      const existing = await prisma.opportunity.findUnique({
        where: { id },
        include: { pipelineStage: true }
      })
      if (!existing) throw new Error('Oportunidad no encontrada')

      // Build update data (whitelist approach)
      const updateData: any = {}
      if (data.title !== undefined) updateData.title = data.title
      if (data.description !== undefined) updateData.description = data.description
      if (data.value !== undefined) updateData.value = data.value
      if (data.probability !== undefined) updateData.probability = data.probability
      if (data.expectedCloseDate !== undefined) {
        updateData.expectedCloseDate = data.expectedCloseDate ? new Date(data.expectedCloseDate) : null
      }
      if (data.priority !== undefined) updateData.priority = data.priority
      if (data.source !== undefined) updateData.source = data.source
      if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone
      if (data.notes !== undefined) updateData.notes = data.notes
      if (data.customerId !== undefined) updateData.customerId = data.customerId || null
      if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null
      if (data.order !== undefined) updateData.order = data.order

      // Stage change — log activity
      if (data.stageId && data.stageId !== existing.stageId) {
        updateData.stageId = data.stageId

        const newStage = await prisma.pipelineStage.findUnique({ where: { id: data.stageId } })

        // If moving to won/lost, set closedDate
        if (newStage?.isWon || newStage?.isLost) {
          updateData.closedDate = new Date()
          updateData.stage = newStage.isWon ? 'CLOSED_WON' : 'CLOSED_LOST'
        } else if (existing.closedDate) {
          updateData.closedDate = null // reopen
        }

        // Sync pipeline stage name to legacy `stage` field
        if (newStage) {
          const stageMap: Record<string, string> = {
            'Nuevo': 'LEAD',
            'Contactado': 'QUALIFIED',
            'En Negociación': 'NEGOTIATION',
            'Propuesta Enviada': 'PROPOSAL',
            'Cerrado Ganado': 'CLOSED_WON',
            'Cerrado Perdido': 'CLOSED_LOST',
          }
          updateData.stage = stageMap[newStage.name] || existing.stage
        }

        await prisma.opportunityActivity.create({
          data: {
            type: 'STAGE_CHANGE',
            content: `Movida de "${existing.pipelineStage?.name || existing.stage}" a "${newStage?.name || 'Nueva etapa'}"`,
            metadata: JSON.stringify({ fromStageId: existing.stageId, toStageId: data.stageId }),
            opportunityId: id,
            createdById: (session.user as any).id,
          }
        })
      }

      return prisma.opportunity.update({
        where: { id },
        data: updateData,
        include: {
          pipelineStage: true,
          customer: { select: { id: true, name: true, phone: true, email: true } },
        }
      })
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    logger.error('Error updating opportunity', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Failed to update opportunity') }, { status: 500 })
  }
}

// DELETE /api/marketing/opportunities/[id]
export async function DELETE(
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

    await withTenantTx(tenantId, async (prisma: any) => {
      await prisma.opportunity.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Error deleting opportunity', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Failed to delete opportunity') }, { status: 500 })
  }
}
