import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const onboardingSchema = z.object({
  userName: z.string().min(1, 'El nombre es requerido'),
  companyName: z.string().min(1, 'El nombre de la empresa es requerido'),
})

/**
 * POST /api/onboarding
 * Completa el proceso de onboarding del tenant
 */
export async function POST(request: Request) {
  try {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    
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
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
    })

    if (tenant && (!tenant.name || tenant.name === 'Nuevo Tenant')) {
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
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    // Si es super admin, no necesita onboarding
    if (user.isSuperAdmin) {
      return NextResponse.json({
        needsOnboarding: false,
        settings: null
      })
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId }
    })

    const needsOnboarding = !settings?.onboardingCompleted

    return NextResponse.json({
      needsOnboarding,
      settings: settings || null
    })
  } catch (error: any) {
    logger.error('Error checking onboarding status', error, {
      endpoint: '/api/onboarding',
      method: 'GET'
    })
    return NextResponse.json(
      { error: 'Failed to check onboarding status', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

