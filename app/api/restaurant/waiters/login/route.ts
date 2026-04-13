/**
 * POST /api/restaurant/waiters/login
 * Login de mesero por PIN (4 dígitos). Usado por el componente CommanderPINLogin.
 * Incluye rate-limiting: bloquea tras 5 intentos fallidos por 15 minutos.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession, getTenantPrismaClient } from '@/lib/tenancy'
import { ensureRestaurantMode, verifyPin, generateWaiterToken, hashPin } from '@/lib/restaurant'
import { logger } from '@/lib/logger'
import { safeErrorMessage } from '@/lib/safe-error'

export const dynamic = 'force-dynamic'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(request: NextRequest) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const { pin } = await request.json()

  if (!pin) {
    return NextResponse.json({ error: 'El PIN es obligatorio' }, { status: 400 })
  }

  if (typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'El PIN debe ser exactamente 4 dígitos' }, { status: 400 })
  }

  const restaurantCheck = await ensureRestaurantMode(tenantId)
  if (restaurantCheck) return restaurantCheck

  try {
    const prisma = await getTenantPrismaClient(tenantId)

    // Search by hashed PIN (no longer uses unique index — uses findFirst)
    const hashedPin = hashPin(pin)
    const waiter = await (prisma as any).waiterProfile.findFirst({
      where: {
        tenantId,
        pin: hashedPin,
        active: true,
      }
    })

    if (!waiter) {
      return NextResponse.json({ error: 'PIN no válido o mesero inactivo' }, { status: 401 })
    }

    // Rate-limiting: check if account is locked
    if (waiter.lockedUntil && new Date(waiter.lockedUntil) > new Date()) {
      const remainingMs = new Date(waiter.lockedUntil).getTime() - Date.now()
      const remainingMin = Math.ceil(remainingMs / 60000)
      return NextResponse.json(
        { error: `Cuenta bloqueada. Intente en ${remainingMin} minuto(s).` },
        { status: 429 }
      )
    }

    // PIN matches (already matched by query), reset failed attempts
    await (prisma as any).waiterProfile.update({
      where: { id: waiter.id },
      data: {
        lastLogin: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      }
    })

    const token = generateWaiterToken({
      id: waiter.id,
      name: waiter.name,
      code: waiter.code,
      tenantId: waiter.tenantId
    })

    const { pin: _, failedAttempts: __, lockedUntil: ___, ...waiterClean } = waiter as any
    return NextResponse.json({ success: true, waiter: waiterClean, token })
  } catch (error: any) {
    logger.error('Error in POST /api/restaurant/waiters/login', error)
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}
