import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const createActivitySchema = z.object({
  leadId: z.string().optional(),
  customerId: z.string().optional(),
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE']),
  subject: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  completed: z.boolean().default(false),
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const leadId = searchParams.get('leadId')
    const customerId = searchParams.get('customerId')
    const type = searchParams.get('type')
    const completed = searchParams.get('completed')

    const where: any = {}

    if (leadId) {
      where.leadId = leadId
    }

    if (customerId) {
      where.customerId = customerId
    }

    if (type) {
      where.type = type
    }

    if (completed !== null) {
      where.completed = completed === 'true'
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(activities)
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = createActivitySchema.parse(body)

    const activity = await prisma.activity.create({
      data: {
        ...data,
        leadId: data.leadId || null,
        customerId: data.customerId || null,
        description: data.description || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        createdById: (session.user as any).id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating activity:', error)
    return NextResponse.json(
      { error: 'Failed to create activity' },
      { status: 500 }
    )
  }
}

