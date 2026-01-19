import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Función helper para ejecutar consultas con retry y manejo de errores de conexión
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  delay = 2000
): Promise<T> {
  let lastError: any
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      const errorMessage = error?.message || String(error)
      
      // Si es error de límite de conexiones, esperar y reintentar
      if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 15000) // Backoff exponencial, max 15s
          logger.warn(`[Settings API] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          continue
        }
      }
      
      // Si no es error de conexión, lanzar inmediatamente
      throw error
    }
  }
  throw lastError
}

/**
 * GET /api/settings
 * Obtiene las configuraciones del tenant actual
 */
export async function GET(request: Request) {
  try {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    // Si es super admin, no tiene tenant settings
    if (user.isSuperAdmin) {
      return NextResponse.json({
        settings: null,
        message: 'Super admin no tiene configuraciones de tenant'
      })
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    // Obtener configuraciones del tenant desde la BD maestra con retry logic
    const settings = await executeWithRetry(() => prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId }
    }))

    return NextResponse.json({
      settings: settings || null
    })
  } catch (error: any) {
    logger.error('Error fetching settings', error, {
      endpoint: '/api/settings',
      method: 'GET'
    })
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings
 * Actualiza las configuraciones del tenant actual
 */
export async function PUT(request: Request) {
  try {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    // Si es super admin, no puede actualizar tenant settings
    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin no puede actualizar configuraciones de tenant' },
        { status: 403 }
      )
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    const body = await request.json()
    
    // Validar que el tenantId del body coincida con el del usuario
    if (body.tenantId && body.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'No autorizado para actualizar configuraciones de otro tenant' },
        { status: 403 }
      )
    }

    // Preparar datos para actualizar (sin incluir tenantId ya que viene de la sesión)
    const { tenantId, ...updateData } = body

    // Upsert: crear si no existe, actualizar si existe (con retry logic)
    const settings = await executeWithRetry(() => prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      update: updateData,
      create: {
        tenantId: user.tenantId,
        ...updateData
      }
    }))

    logger.info('Settings updated', {
      tenantId: user.tenantId,
      updatedFields: Object.keys(updateData)
    })

    return NextResponse.json({
      settings,
      message: 'Configuraciones actualizadas exitosamente'
    })
  } catch (error: any) {
    logger.error('Error updating settings', error, {
      endpoint: '/api/settings',
      method: 'PUT'
    })
    return NextResponse.json(
      { error: 'Failed to update settings', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

