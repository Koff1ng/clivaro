import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import { logActivity } from '@/lib/activity'

// Helper function to safely serialize dates
function serializeDate(date: Date | null | undefined): string | null {
  if (!date) return null
  try {
    if (date instanceof Date) {
      return date.toISOString()
    }
    return null
  } catch {
    return null
  }
}

// Helper function to safely serialize a shift
function serializeShift(shift: any) {
  try {
    return {
      id: String(shift.id || ''),
      userId: String(shift.userId || ''),
      openedAt: serializeDate(shift.openedAt),
      closedAt: serializeDate(shift.closedAt),
      startingCash: Number(shift.startingCash || 0),
      expectedCash: Number(shift.expectedCash || 0),
      countedCash: shift.countedCash !== null && shift.countedCash !== undefined ? Number(shift.countedCash) : null,
      difference: shift.difference !== null && shift.difference !== undefined ? Number(shift.difference) : null,
      status: String(shift.status || 'OPEN'),
      notes: shift.notes ? String(shift.notes) : null,
      createdAt: serializeDate(shift.createdAt),
      updatedAt: serializeDate(shift.updatedAt || shift.createdAt),
      user: shift.user ? {
        id: String(shift.user.id || ''),
        name: String(shift.user.name || ''),
      } : null,
      movements: Array.isArray(shift.movements) ? shift.movements.map((m: any) => ({
        id: String(m.id || ''),
        cashShiftId: String(m.cashShiftId || ''),
        type: String(m.type || ''),
        amount: Number(m.amount || 0),
        reason: m.reason ? String(m.reason) : null,
        createdAt: serializeDate(m.createdAt),
        createdById: String(m.createdById || ''),
      })) : [],
      summaryItems: Array.isArray(shift.summaryItems) ? shift.summaryItems.map((s: any) => ({
        paymentMethodId: s.paymentMethodId,
        paymentMethodName: s.paymentMethod?.name || 'Unknown',
        expectedAmount: Number(s.expectedAmount || 0),
        actualAmount: s.actualAmount !== null ? Number(s.actualAmount) : null,
      })) : [],
    }
  } catch (error) {
    console.error('Error serializing shift:', error)
    throw new Error('Failed to serialize shift data')
  }
}

const openShiftSchema = z.object({
  startingCash: z.number().min(0).default(0),
})

const closeShiftSchema = z.object({
  countedCash: z.number().min(0),
  notes: z.string().optional(),
})

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_CASH, PERMISSIONS.MANAGE_SALES])
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const user = session.user as any
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || user.id
    const active = searchParams.get('active')
    const status = searchParams.get('status')

    const shifts = await withTenantTx(tenantId, async (tx: any) => {
      const where: any = { userId }
      if (active === 'true') {
        where.status = 'OPEN'
      } else if (status) {
        where.status = status
      }

      return await tx.cashShift.findMany({
        where,
        include: {
          user: { select: { id: true, name: true } },
          movements: { orderBy: { createdAt: 'desc' } },
          summaryItems: { include: { paymentMethod: true } }
        },
        orderBy: { openedAt: 'desc' },
        take: active === 'true' ? 1 : 50,
      })
    })

    const serializedShifts = shifts.map(serializeShift)
    return NextResponse.json({ shifts: serializedShifts })
  } catch (error: any) {
    console.error('Error fetching cash shifts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_CASH, PERMISSIONS.MANAGE_SALES])
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const user = session.user as any
  const userId = user.id

  try {
    const body = await request.json()
    const { action, ...data } = body

    if (action === 'open') {
      const { startingCash } = openShiftSchema.parse(data)

      const result = await withTenantTx(tenantId, async (tx: any) => {
        const existingShift = await tx.cashShift.findFirst({
          where: { userId, status: 'OPEN' },
        })

        if (existingShift) {
          throw new Error('Ya tienes un turno de caja abierto')
        }

        const shift = await tx.cashShift.create({
          data: {
            userId,
            startingCash: Number(startingCash),
            expectedCash: Number(startingCash),
            status: 'OPEN',
          },
          include: {
            user: { select: { id: true, name: true } },
            movements: { orderBy: { createdAt: 'desc' } },
            summaryItems: { include: { paymentMethod: true } }
          },
        })

        await logActivity({
          prisma: tx,
          type: 'CASH_SHIFT_OPEN',
          subject: `Turno de caja abierto`,
          description: `Base inicial: ${startingCash}`,
          userId,
          metadata: { shiftId: shift.id, startingCash }
        })

        return shift
      })

      return NextResponse.json({ shift: serializeShift(result) }, { status: 201 })
    }

    if (action === 'close') {
      const { countedCash, notes } = closeShiftSchema.parse(data)

      const result = await withTenantTx(tenantId, async (tx: any) => {
        const openShift = await tx.cashShift.findFirst({
          where: { userId, status: 'OPEN' },
          include: { movements: true, summaryItems: true },
        })

        if (!openShift) {
          throw new Error('No hay un turno de caja abierto')
        }

        const totalMovements = openShift.movements.reduce((sum: number, m: any) => {
          const amount = Number(m.amount || 0)
          return sum + (m.type === 'IN' ? amount : -amount)
        }, 0)

        const expectedCash = Number(openShift.startingCash || 0) + totalMovements
        const difference = Number(countedCash) - expectedCash

        const shift = await tx.cashShift.update({
          where: { id: openShift.id },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            countedCash: Number(countedCash),
            expectedCash,
            difference,
            notes: notes ? String(notes) : null,
          },
          include: {
            user: { select: { id: true, name: true } },
            movements: { orderBy: { createdAt: 'desc' } },
            summaryItems: { include: { paymentMethod: true } }
          },
        })

        // Update ShiftSummary actual amounts
        // For CASH, the actual amount of sales is (counted - starting - movements)
        // For others, we assume expected = actual for now unless there was a manual input
        for (const item of shift.summaryItems) {
          let actualItemAmount = item.expectedAmount
          if (item.paymentMethod?.type === 'CASH') {
            // Actual CASH sales = countedCash - starting - movements
            // But sometimes countedCash might be less than starting+movements if negative difference
            actualItemAmount = Math.max(0, Number(countedCash) - Number(openShift.startingCash || 0) - totalMovements)
          }

          await tx.shiftSummary.update({
            where: {
              shiftId_paymentMethodId: {
                shiftId: shift.id,
                paymentMethodId: item.paymentMethodId
              }
            },
            data: { actualAmount: actualItemAmount }
          })
        }

        await logActivity({
          prisma: tx,
          type: 'CASH_SHIFT_CLOSE',
          subject: `Turno de caja cerrado`,
          description: `Esperado: ${expectedCash}, Contado: ${countedCash}, Diferencia: ${difference}`,
          userId,
          metadata: { shiftId: shift.id, expectedCash, countedCash, difference }
        })

        return shift
      })

      return NextResponse.json({ shift: serializeShift(result) })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Error managing cash shift:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
