import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import { parseDateOnlyToDate } from '@/lib/date-only'

export const dynamic = 'force-dynamic'

const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.string().optional(),
  stage: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST']).optional(),
  expectedRevenue: z.number().min(0).optional(),
  value: z.number().min(0).optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const lead = await withTenantRead(tenantId, async (prisma) => {
      return await prisma.lead.findUnique({
        where: { id: params.id },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
          activities: {
            include: { createdBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
          quotations: {
            include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
            orderBy: { createdAt: 'desc' },
          },
          stageHistory: {
            include: { changedBy: { select: { id: true, name: true } } },
            orderBy: { changedAt: 'desc' },
          },
        },
      })
    })

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    return NextResponse.json(lead)
  } catch (error) {
    logger.error('Error fetching lead:', error)
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const user = session.user as any

  try {
    const body = await request.json()
    const data = updateLeadSchema.parse(body)

    const lead = await withTenantTx(tenantId, async (prisma) => {
      const currentLead = await prisma.lead.findUnique({
        where: { id: params.id },
        select: { stage: true, name: true, email: true, phone: true },
      })

      if (!currentLead) throw new Error('Lead not found')

      const updateData: any = {
        ...data,
        email: data.email !== undefined ? (data.email || null) : undefined,
        phone: data.phone !== undefined ? (data.phone || null) : undefined,
        company: data.company !== undefined ? (data.company || null) : undefined,
        source: data.source !== undefined ? (data.source || null) : undefined,
        expectedCloseDate: data.expectedCloseDate !== undefined ? parseDateOnlyToDate(data.expectedCloseDate) : undefined,
        assignedToId: data.assignedToId !== undefined ? data.assignedToId : undefined,
        notes: data.notes !== undefined ? (data.notes || null) : undefined,
      }

      if (data.stage && data.stage !== currentLead.stage) {
        updateData.stageHistory = {
          create: {
            fromStage: currentLead.stage,
            toStage: data.stage,
            changedById: user.id,
            notes: `Estado cambiado de ${currentLead.stage} a ${data.stage}`,
          },
        }
      }

      if (data.stage === 'WON' && data.stage !== currentLead.stage) {
        const email = currentLead.email?.trim().toLowerCase()
        const phone = currentLead.phone?.trim()
        let customerId: string | null = null

        const existingCustomer = await prisma.customer.findFirst({
          where: { OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
        })

        if (existingCustomer) {
          customerId = existingCustomer.id
        } else if (email || phone || currentLead.name) {
          const newCustomer = await prisma.customer.create({
            data: {
              name: currentLead.name,
              email: email || null,
              phone: phone || null,
              notes: `Cliente creado automáticamente desde oportunidad ganada: ${currentLead.name}`,
              createdById: user.id,
            },
          })
          customerId = newCustomer.id
        }

        if (customerId) updateData.customerId = customerId
      }

      return await prisma.lead.update({
        where: { id: params.id },
        data: updateData,
        include: {
          assignedTo: { select: { id: true, name: true } },
          stageHistory: {
            include: { changedBy: { select: { id: true, name: true } } },
            orderBy: { changedAt: 'desc' },
            take: 10,
          },
        },
      })
    })

    return NextResponse.json(lead)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    if (error.message === 'Lead not found') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    logger.error('Error updating lead:', error)
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    await withTenantTx(tenantId, async (prisma) => {
      await prisma.lead.delete({
        where: { id: params.id },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting lead:', error)
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 })
  }
}

