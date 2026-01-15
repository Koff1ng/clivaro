import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const createMovementSchema = z.object({
  cashShiftId: z.string(),
  type: z.enum(['IN', 'OUT']),
  amount: z.number().positive(),
  reason: z.string().optional(),
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CASH)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const cashShiftId = searchParams.get('cashShiftId')

    if (!cashShiftId) {
      return NextResponse.json(
        { error: 'cashShiftId is required' },
        { status: 400 }
      )
    }

    const movements = await prisma.cashMovement.findMany({
      where: { cashShiftId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ movements })
  } catch (error) {
    console.error('Error fetching cash movements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cash movements' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CASH)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = createMovementSchema.parse(body)

    // Verify shift exists and is open
    const shift = await prisma.cashShift.findUnique({
      where: { id: data.cashShiftId },
    })

    if (!shift) {
      return NextResponse.json(
        { error: 'Cash shift not found' },
        { status: 404 }
      )
    }

    if (shift.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Cash shift is not open' },
        { status: 400 }
      )
    }

    // Create movement
    const movement = await prisma.cashMovement.create({
      data: {
        cashShiftId: data.cashShiftId,
        type: data.type,
        amount: data.amount,
        reason: data.reason || null,
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

    // Update expected cash in shift
    const amountChange = data.type === 'IN' ? data.amount : -data.amount
    await prisma.cashShift.update({
      where: { id: data.cashShiftId },
      data: {
        expectedCash: shift.expectedCash + amountChange,
      },
    })

    return NextResponse.json({ movement }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating cash movement:', error)
    return NextResponse.json(
      { error: 'Failed to create cash movement' },
      { status: 500 }
    )
  }
}

