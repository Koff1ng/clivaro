import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession, withTenantRead, withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/settings
 * Obtiene las configuraciones del tenant actual.
 * 
 * NOTA: TenantSettings existe TANTO en la BD master como en el schema del tenant.
 * Usamos withTenantRead para leer del schema del tenant.
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

    const settings = await withTenantRead(tenantId, async (prisma) => {
      return await prisma.tenantSettings.findUnique({
        where: { tenantId }
      })
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

    const settings = await withTenantTx(tenantId, async (prisma) => {
      return await prisma.tenantSettings.upsert({
        where: { tenantId },
        update: updateData,
        create: {
          tenantId,
          ...updateData
        }
      })
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
