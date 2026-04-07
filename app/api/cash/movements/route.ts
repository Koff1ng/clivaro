import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

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

  const tenantId = (session.user as any).tenantId

  try {
    const { searchParams } = new URL(request.url)
    const cashShiftId = searchParams.get('cashShiftId')

    if (!cashShiftId) {
      return NextResponse.json(
        { error: 'cashShiftId is required' },
        { status: 400 }
      )
    }

    const result = await withTenantRead(tenantId, async (prisma) => {
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
      return { movements }
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error fetching cash movements:', error)
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

  const tenantId = (session.user as any).tenantId

  try {
    const body = await request.json()
    const data = createMovementSchema.parse(body)

    const result = await withTenantTx(tenantId, async (prisma) => {
      // Verify shift exists and is open
      const shift = await prisma.cashShift.findUnique({
        where: { id: data.cashShiftId },
      })

      if (!shift) {
        throw new Error('Cash shift not found')
      }

      if (shift.status !== 'OPEN') {
        throw new Error('Cash shift is not open')
      }

      const currentUser = session.user as any
      const canManageAllShifts =
        currentUser?.isSuperAdmin ||
        (currentUser?.permissions || []).includes(PERMISSIONS.MANAGE_SALES)

      if (!canManageAllShifts && shift.userId !== currentUser.id) {
        throw new Error('You cannot register movements on another user\'s open shift')
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

      return movement
    })

    return NextResponse.json({ movement: result }, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error creating cash movement:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create cash movement' },
      { status: 500 }
    )
  }
}



