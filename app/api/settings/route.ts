import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings
 * Obtiene las configuraciones del tenant actual.
 * 
 * ARCHITECTURE NOTE: TenantSettings is stored in the MASTER database (public schema).
 * This is because:
 * 1. /api/onboarding saves to master via `prisma.tenantSettings.upsert()`
 * 2. /api/onboarding GET checks from master
 * 3. TenantSettings is logically a platform-level concept (billing, fiscal identity)
 * 
 * The tenant schema also has a TenantSettings table (from init), but it's NOT used.
 * The canonical source of truth is the master database.
 */
export async function GET(request: Request) {
  try {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    if (session instanceof NextResponse) return session

    const user = session.user as any

    if (user.isSuperAdmin && !user.tenantId) {
      return NextResponse.json({
        settings: null,
        message: 'Super admin no tiene configuraciones de tenant'
      })
    }

    const tenantId = getTenantIdFromSession(session)

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId }
    })

    return NextResponse.json({ settings: settings || null })
  } catch (error: any) {
    logger.error('Error fetching settings', error, { endpoint: '/api/settings', method: 'GET' })
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings
 * Actualiza las configuraciones del tenant actual.
 * Uses master prisma — same source as onboarding.
 */
export async function PUT(request: Request) {
  try {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const body = await request.json()

    if (body.tenantId && body.tenantId !== tenantId) {
      return NextResponse.json({ error: 'No autorizado para actualizar configuraciones de otro tenant' }, { status: 403 })
    }

    const { tenantId: _, ...updateData } = body

    const settings = await prisma.tenantSettings.upsert({
      where: { tenantId },
      update: updateData,
      create: {
        tenantId,
        ...updateData
      }
    })

    logger.info('Settings updated', { tenantId, updatedFields: Object.keys(updateData) })

    return NextResponse.json({
      settings,
      message: 'Configuraciones actualizadas exitosamente'
    })
  } catch (error: any) {
    logger.error('Error updating settings', error, { endpoint: '/api/settings', method: 'PUT' })
    return NextResponse.json(
      { error: 'Failed to update settings', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
