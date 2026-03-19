/**
 * POST /api/restaurant/waiters/login
 * Alias proxy para /api/restaurant/auth/waiter-login
 * El componente CommanderPINLogin llama a esta URL directamente.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession, getTenantPrismaClient } from '@/lib/tenancy'
import { ensureRestaurantMode, verifyPin, generateWaiterToken, hashPin } from '@/lib/restaurant'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const { pin } = await request.json()

  if (!pin) {
    return NextResponse.json({ error: 'El PIN es obligatorio' }, { status: 400 })
  }

  const restaurantCheck = await ensureRestaurantMode(tenantId)
  if (restaurantCheck) return restaurantCheck

  try {
    const prisma = await getTenantPrismaClient(tenantId)
    
    // Buscar directamente por el PIN hasheado (ahora que es único por tenant)
    const waiter = await prisma.waiterProfile.findUnique({
      where: { 
        tenantId_pin: { tenantId, pin: hashPin(pin) } 
      }
    })

    if (!waiter || !waiter.active) {
      return NextResponse.json({ error: 'Mesero no encontrado o inactivo' }, { status: 401 })
    }

    if (!verifyPin(pin, waiter.pin)) {
      return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
    }

    await prisma.waiterProfile.update({
      where: { id: waiter.id },
      data: { lastLogin: new Date() }
    })

    const token = generateWaiterToken({
      id: waiter.id,
      name: waiter.name,
      code: waiter.code,
      tenantId: waiter.tenantId
    })

    const { pin: _, ...waiterWithoutPin } = waiter as any
    return NextResponse.json({ success: true, waiter: waiterWithoutPin, token })
  } catch (error: any) {
    logger.error('Error in POST /api/restaurant/waiters/login', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
