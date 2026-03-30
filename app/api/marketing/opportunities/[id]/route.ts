import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

// GET /api/marketing/opportunities/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  const opportunity = await withTenantRead(tenantId, async (prisma: any) => {
    return prisma.opportunity.findUnique({
      where: { id: params.id },
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
}

// PATCH /api/marketing/opportunities/[id]
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const body = await request.json()

  const result = await withTenantTx(tenantId, async (prisma: any) => {
    const existing = await prisma.opportunity.findUnique({
      where: { id: params.id },
      include: { pipelineStage: true }
    })
    if (!existing) throw new Error('Oportunidad no encontrada')

    // Build update data (whitelist approach)
    const updateData: any = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.value !== undefined) updateData.value = body.value
    if (body.probability !== undefined) updateData.probability = body.probability
    if (body.expectedCloseDate !== undefined) updateData.expectedCloseDate = body.expectedCloseDate ? new Date(body.expectedCloseDate) : null
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.source !== undefined) updateData.source = body.source
    if (body.contactPhone !== undefined) updateData.contactPhone = body.contactPhone
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.customerId !== undefined) updateData.customerId = body.customerId || null
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId || null
    if (body.order !== undefined) updateData.order = body.order

    // Stage change — log activity
    if (body.stageId && body.stageId !== existing.stageId) {
      updateData.stageId = body.stageId

      const newStage = await prisma.pipelineStage.findUnique({ where: { id: body.stageId } })

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
          metadata: JSON.stringify({ fromStageId: existing.stageId, toStageId: body.stageId }),
          opportunityId: params.id,
          createdById: (session.user as any).id,
        }
      })
    }

    return prisma.opportunity.update({
      where: { id: params.id },
      data: updateData,
      include: {
        pipelineStage: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
      }
    })
  })

  return NextResponse.json(result)
}

// DELETE /api/marketing/opportunities/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  await withTenantTx(tenantId, async (prisma: any) => {
    await prisma.opportunity.delete({ where: { id: params.id } })
  })

  return NextResponse.json({ success: true })
}
