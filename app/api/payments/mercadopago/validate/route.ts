import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { validateMercadoPagoCredentials } from '@/lib/mercadopago'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const validateSchema = z.object({
  accessToken: z.string().min(1, 'Access Token es requerido'),
})

/**
 * POST /api/payments/mercadopago/validate
 * Valida las credenciales de Mercado Pago (solo para super admin)
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    // Solo super admin puede validar credenciales
    if (!user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'No autorizado. Solo administradores pueden validar credenciales.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { accessToken } = validateSchema.parse(body)

    const isValid = await validateMercadoPagoCredentials(accessToken)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Credenciales inválidas', valid: false },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      message: 'Credenciales válidas',
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error validating Mercado Pago credentials', error, {
      endpoint: '/api/payments/mercadopago/validate',
      method: 'POST',
    })
    return NextResponse.json(
      { error: 'Error al validar credenciales', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

