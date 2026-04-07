import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { parseDateOnlyToDate } from '@/lib/date-only'

export const dynamic = 'force-dynamic'

const createLeadSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  company: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.string().optional(),
  stage: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST']).default('NEW'),
  expectedRevenue: z.number().min(0).optional(),
  value: z.number().min(0).optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().optional(),
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)

  if (session instanceof NextResponse) {
    return session
  }

  const user = session.user as any
  const tenantId = user.tenantId

  // Verificar feature del plan
  const planCheck = await requirePlanFeature(tenantId, 'leads', user.isSuperAdmin)
  if (planCheck) {
    return planCheck
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const stage = searchParams.get('stage')
    const assignedToId = searchParams.get('assignedToId')
    const skip = (page - 1) * limit

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (stage) {
      where.stage = stage
    }

    if (assignedToId) {
      where.assignedToId = assignedToId
    }

    return await withTenantRead(tenantId, async (prisma) => {
      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          skip,
          take: limit,
          include: {
            assignedTo: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.lead.count({ where }),
      ])

      return NextResponse.json({
        leads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    })
  } catch (error) {
    logger.error('Error fetching leads', error, { endpoint: '/api/leads', method: 'GET' })
    return NextResponse.json(
      { error: 'Failed to fetch leads', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)

  if (session instanceof NextResponse) {
    return session
  }

  const user = session.user as any
  const tenantId = user.tenantId

  // Verificar feature del plan
  const planCheck = await requirePlanFeature(tenantId, 'leads', user.isSuperAdmin)
  if (planCheck) {
    return planCheck
  }

  try {
    const body = await request.json()
    const data = createLeadSchema.parse(body)

    return await withTenantTx(tenantId, async (prisma) => {
      const lead = await prisma.lead.create({
        data: {
          ...data,
          email: data.email || null,
          phone: data.phone || null,
          company: data.company || null,
          source: data.source || null,
          value: data.expectedRevenue || data.value || 0,
          expectedRevenue: data.expectedRevenue || data.value || 0,
          probability: data.probability || 0,
          expectedCloseDate: data.expectedCloseDate ? parseDateOnlyToDate(data.expectedCloseDate) : null,
          assignedToId: data.assignedToId || null,
          notes: data.notes || null,
          createdById: (session.user as any).id,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      // Crear historial
      await prisma.leadStageHistory.create({
        data: {
          leadId: lead.id,
          toStage: data.stage || 'NEW',
          changedById: (session.user as any).id,
          notes: 'Oportunidad creada',
        },
      })

      logger.info('Lead created', { leadId: lead.id, tenantId: user.tenantId })
      return NextResponse.json(lead, { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error creating lead', error, { endpoint: '/api/leads', method: 'POST' })
    return NextResponse.json(
      { error: 'Failed to create lead', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
