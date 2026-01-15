import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

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
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        activities: {
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        quotations: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        stageHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { changedAt: 'desc' },
        },
      },
    })

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(lead)
  } catch (error) {
    console.error('Error fetching lead:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lead' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = updateLeadSchema.parse(body)

    // Obtener el lead actual para comparar el estado
    const currentLead = await prisma.lead.findUnique({
      where: { id: params.id },
      select: { stage: true, name: true, email: true, phone: true },
    })

    const updateData: any = {
      ...data,
      email: data.email !== undefined ? (data.email || null) : undefined,
      phone: data.phone !== undefined ? (data.phone || null) : undefined,
      company: data.company !== undefined ? (data.company || null) : undefined,
      source: data.source !== undefined ? (data.source || null) : undefined,
      expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
      assignedToId: data.assignedToId !== undefined ? data.assignedToId : undefined,
      notes: data.notes !== undefined ? (data.notes || null) : undefined,
    }

    // Si cambió el estado, crear registro en historial
    if (data.stage && currentLead && data.stage !== currentLead.stage) {
      updateData.stageHistory = {
        create: {
          fromStage: currentLead.stage,
          toStage: data.stage,
          changedById: (session.user as any).id,
          notes: `Estado cambiado de ${currentLead.stage} a ${data.stage}`,
        },
      }

      // Si la oportunidad se ganó, convertir automáticamente a cliente
      if (data.stage === 'WON' && currentLead) {
        const existingCustomer = await prisma.customer.findFirst({
          where: {
            OR: [
              ...(currentLead.email ? [{ email: currentLead.email }] : []),
              ...(currentLead.phone ? [{ phone: currentLead.phone }] : []),
            ],
          },
        })

        if (!existingCustomer && (currentLead.email || currentLead.phone)) {
          await prisma.customer.create({
            data: {
              name: currentLead.name,
              email: currentLead.email || null,
              phone: currentLead.phone || null,
              taxId: null,
              address: null,
              notes: `Cliente creado automáticamente desde oportunidad ganada: ${currentLead.name}`,
              createdById: (session.user as any).id,
            },
          })
        }
      }
    }

    const lead = await prisma.lead.update({
      where: { id: params.id },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        stageHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { changedAt: 'desc' },
          take: 10,
        },
      },
    })

    return NextResponse.json(lead)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating lead:', error)
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    await prisma.lead.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting lead:', error)
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    )
  }
}

