import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { getTenantPrisma } from '@/lib/tenant-db'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// Función helper para ejecutar consultas con retry y manejo de errores de conexión
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
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
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 10000) // Backoff exponencial, max 10s
          logger.warn(`[Onboarding] Límite de conexiones alcanzado, reintentando en ${backoffDelay}ms (intento ${attempt + 1}/${maxRetries})`)
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

const onboardingSchema = z.object({
  userName: z.string().min(1, 'El nombre es requerido'),
  companyName: z.string().min(1, 'El nombre de la empresa es requerido'),
  newUsername: z.string().min(3, 'El usuario debe tener al menos 3 caracteres').optional(),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional(),
})

/**
 * POST /api/onboarding
 * Completa el proceso de onboarding del tenant
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    // Si es super admin, no puede hacer onboarding
    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin no puede completar onboarding de tenant' },
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
    const validatedData = onboardingSchema.parse(body)

    // Obtener tenant para acceder a su BD
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
    })

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      )
    }

    // Si se proporcionaron nuevas credenciales, actualizar el admin
    if (validatedData.newUsername || validatedData.newPassword) {
      const tenantPrisma = getTenantPrisma(tenant.databaseUrl)
      
      // Buscar el usuario admin actual
      const adminUser = await tenantPrisma.user.findUnique({
        where: { username: 'admin' },
      })

      if (adminUser) {
        const updateData: any = {}
        
        if (validatedData.newUsername) {
          // Verificar que el nuevo username no exista
          const existingUser = await tenantPrisma.user.findUnique({
            where: { username: validatedData.newUsername },
          })
          
          if (existingUser && existingUser.id !== adminUser.id) {
            return NextResponse.json(
              { error: 'El nombre de usuario ya está en uso' },
              { status: 400 }
            )
          }
          
          updateData.username = validatedData.newUsername
        }
        
        if (validatedData.newPassword) {
          updateData.password = await bcrypt.hash(validatedData.newPassword, 10)
        }
        
        await tenantPrisma.user.update({
          where: { id: adminUser.id },
          data: updateData,
        })
      }
    }

    // Actualizar o crear TenantSettings con los datos del onboarding
    const settings = await prisma.tenantSettings.upsert({
      where: { tenantId: user.tenantId },
      update: {
        onboardingCompleted: true,
        onboardingUserName: validatedData.userName,
        onboardingCompanyName: validatedData.companyName,
      },
      create: {
        tenantId: user.tenantId,
        onboardingCompleted: true,
        onboardingUserName: validatedData.userName,
        onboardingCompanyName: validatedData.companyName,
      }
    })

    // También actualizar el nombre del tenant si no está configurado
    if (!tenant.name || tenant.name === 'Nuevo Tenant') {
      await prisma.tenant.update({
        where: { id: user.tenantId },
        data: {
          name: validatedData.companyName,
        }
      })
    }

    logger.info('Onboarding completed', {
      tenantId: user.tenantId,
      userName: validatedData.userName,
      companyName: validatedData.companyName,
      credentialsChanged: !!(validatedData.newUsername || validatedData.newPassword),
    })

    return NextResponse.json({
      success: true,
      settings,
      message: 'Onboarding completado exitosamente'
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error completing onboarding', error, {
      endpoint: '/api/onboarding',
      method: 'POST'
    })
    return NextResponse.json(
      { error: 'Failed to complete onboarding', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/onboarding
 * Verifica si el tenant necesita completar el onboarding
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    // Si es super admin, no necesita onboarding
    if (user.isSuperAdmin) {
      return NextResponse.json({
        needsOnboarding: false,
        settings: null,
        plan: null,
      })
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    try {
      // Usar executeWithRetry para manejar errores de conexión
      const settings = await executeWithRetry(() =>
        prisma.tenantSettings.findUnique({
          where: { tenantId: user.tenantId }
        })
      )

      // Obtener el plan del tenant (con manejo de errores y retry)
      let subscription = null
      try {
        subscription = await executeWithRetry(() =>
          prisma.subscription.findFirst({
            where: {
              tenantId: user.tenantId,
              status: 'active',
            },
            include: {
              plan: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        )
      } catch (subError: any) {
        // Si hay error al obtener suscripción (posiblemente campos nuevos no migrados), continuar sin plan
        logger.warn('Error fetching subscription in onboarding check', {
          tenantId: user.tenantId,
          error: subError?.message || String(subError),
        })
      }

      // Solo necesita onboarding si:
      // 1. No hay settings (tenant recién creado)
      // 2. O si hay settings pero onboardingCompleted es false o null
      const needsOnboarding = !settings || settings.onboardingCompleted === false || settings.onboardingCompleted === null

      return NextResponse.json({
        needsOnboarding,
        settings: settings || null,
        plan: subscription?.plan || null,
      })
    } catch (settingsError: any) {
      // Si hay error al obtener settings, asumir que NO necesita onboarding
      // Esto evita mostrar el onboarding a usuarios existentes cuando hay errores de BD
      logger.warn('Error fetching settings in onboarding check', {
        tenantId: user.tenantId,
        error: settingsError?.message || String(settingsError),
      })
      
      // Retornar que NO necesita onboarding si hay error (para evitar mostrar onboarding a usuarios existentes)
      return NextResponse.json({
        needsOnboarding: false,
        settings: null,
        plan: null,
      })
    }
  } catch (error: any) {
    logger.error('Error checking onboarding status', error, {
      endpoint: '/api/onboarding',
      method: 'GET'
    })
    // En lugar de retornar un error 500, retornar un objeto válido para evitar errores en el frontend
    // El frontend puede manejar esto mostrando valores por defecto
    return NextResponse.json({
      needsOnboarding: false,
      settings: null,
      plan: null,
    })
  }
}

