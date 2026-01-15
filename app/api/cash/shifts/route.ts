import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

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
  try {
    // Allow both MANAGE_CASH and MANAGE_SALES permissions for POS
    const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_CASH, PERMISSIONS.MANAGE_SALES])
    
    if (session instanceof NextResponse) {
      return session
    }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  const user = session.user as any
    if (!user || !user.id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || user.id
    const active = searchParams.get('active')
    const status = searchParams.get('status')

    const where: any = { userId }
    if (active === 'true') {
      where.status = 'OPEN'
    } else if (status) {
      where.status = status
    }

    const shifts = await prisma.cashShift.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        movements: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: active === 'true' ? 1 : 50,
    })

    // Serialize all shifts
    const serializedShifts = shifts.map(serializeShift)

    return NextResponse.json({ shifts: serializedShifts })
  } catch (error) {
    console.error('Error fetching cash shifts:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch cash shifts'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Allow both MANAGE_CASH and MANAGE_SALES permissions for POS
    const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_CASH, PERMISSIONS.MANAGE_SALES])
    
    if (session instanceof NextResponse) {
      return session
    }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  const user = session.user as any
    if (!user) {
      console.error('No user in session:', { session })
      return NextResponse.json(
        { error: 'User ID is required', details: 'Session does not contain user' },
        { status: 401 }
      )
    }

    const userId = user.id
    if (!userId) {
      console.error('No userId in user object:', { user, session })
      return NextResponse.json(
        { error: 'User ID is required', details: 'User object does not contain ID' },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a valid JSON object' },
        { status: 400 }
      )
    }

    const { action, ...data } = body

    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid action parameter' },
        { status: 400 }
      )
    }

    if (action === 'open') {
      try {
        const { startingCash } = openShiftSchema.parse(data)

        // Check if user has an open shift
        const existingShift = await prisma.cashShift.findFirst({
          where: {
            userId,
            status: 'OPEN',
          },
        })

        if (existingShift) {
          return NextResponse.json(
            { error: 'Ya tienes un turno de caja abierto' },
            { status: 400 }
          )
        }

        const shift = await prisma.cashShift.create({
          data: {
            userId,
            startingCash: Number(startingCash),
            expectedCash: Number(startingCash),
            status: 'OPEN',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            movements: {
              orderBy: { createdAt: 'desc' },
            },
          },
        })

        const serializedShift = serializeShift(shift)
        return NextResponse.json({ shift: serializedShift }, { status: 201 })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Validation error', details: error.errors },
            { status: 400 }
          )
        }
        throw error
      }
    }

    if (action === 'close') {
      try {
        const { countedCash, notes } = closeShiftSchema.parse(data)

        const openShift = await prisma.cashShift.findFirst({
          where: {
            userId,
            status: 'OPEN',
          },
          include: {
            movements: true,
          },
        })

        if (!openShift) {
          return NextResponse.json(
            { error: 'No hay un turno de caja abierto' },
            { status: 400 }
          )
        }

        // Calculate expected cash
        const totalMovements = Array.isArray(openShift.movements)
          ? openShift.movements.reduce((sum: number, m: any) => {
              const amount = Number(m.amount || 0)
              return sum + (m.type === 'IN' ? amount : -amount)
            }, 0)
          : 0
        
        const expectedCash = Number(openShift.startingCash || 0) + totalMovements
        const difference = Number(countedCash) - expectedCash

        const shift = await prisma.cashShift.update({
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
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            movements: {
              orderBy: { createdAt: 'desc' },
            },
          },
        })

        const serializedShift = serializeShift(shift)
        return NextResponse.json({ shift: serializedShift })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Validation error', details: error.errors },
            { status: 400 }
          )
        }
        throw error
      }
    }

    return NextResponse.json(
      { error: 'Invalid action. Must be "open" or "close"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error managing cash shift:', error)
    
    // Ensure error message is serializable
    const errorMessage = error instanceof Error ? error.message : 'Failed to manage cash shift'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
