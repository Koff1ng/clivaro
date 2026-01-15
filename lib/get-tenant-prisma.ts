import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth'
import { getTenantPrisma } from './tenant-db'
import { prisma } from './db'

/**
 * Obtiene el cliente Prisma correcto según el tenant del usuario autenticado
 * Si es super admin, retorna la BD maestra
 * Si tiene tenantId, retorna la BD del tenant
 */
export async function getPrismaForRequest(request?: Request, session?: any) {
  try {
    // Si se proporciona una sesión, usarla directamente
    let userSession = session
    
    // Si no hay sesión proporcionada, intentar obtenerla
    if (!userSession) {
      userSession = await getServerSession(authOptions)
    }
    
    if (!userSession?.user) {
      // Si no hay sesión, retornar BD maestra (para endpoints públicos o super admin)
      return prisma
    }

    const user = userSession.user as any

    // Si es super admin, usar BD maestra
    if (user.isSuperAdmin) {
      return prisma
    }

    // Si tiene tenantId, obtener la BD del tenant
    if (user.tenantId) {
      console.log('[getPrismaForRequest] Usuario tiene tenantId:', user.tenantId)
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          databaseUrl: true,
          active: true,
        }
      })

      if (!tenant || !tenant.active) {
        console.error('[getPrismaForRequest] Tenant no encontrado o inactivo:', user.tenantId)
        throw new Error('Tenant no encontrado o inactivo')
      }

      console.log('[getPrismaForRequest] Tenant encontrado:', {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        databaseUrl: tenant.databaseUrl
      })

      const tenantPrisma = getTenantPrisma(tenant.databaseUrl)
      console.log('[getPrismaForRequest] Cliente Prisma del tenant obtenido correctamente')
      return tenantPrisma
    }

    // Si no es super admin y no tiene tenantId, es un error
    // Esto significa que la sesión es antigua o inválida
    console.warn('[getPrismaForRequest] Usuario sin tenantId y no es super admin:', {
      userId: user.id,
      isSuperAdmin: user.isSuperAdmin,
      tenantId: user.tenantId
    })
    
    // Por defecto, BD maestra (solo para super admins o sesiones antiguas)
    // En producción, deberíamos rechazar esto, pero por ahora lo permitimos
    return prisma
  } catch (error) {
    console.error('Error obteniendo Prisma para request:', error)
    // En caso de error, retornar BD maestra
    return prisma
  }
}

