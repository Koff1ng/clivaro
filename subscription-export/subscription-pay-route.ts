import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { MercadoPagoConfig, PreApproval, Customer } from 'mercadopago'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Función helper para ejecutar consultas con retry
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
      
      if (errorMessage.includes('MaxClientsInSessionMode') || errorMessage.includes('max clients reached')) {
        if (attempt < maxRetries - 1) {
          const backoffDelay = Math.min(delay * Math.pow(2, attempt), 15000)
          logger.warn(`[Subscription Pay] Retry ${attempt + 1}/${maxRetries} in ${backoffDelay}ms`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          continue
        }
      }
      throw error
    }
  }
  throw lastError
}

const createSubscriptionSchema = z.object({
  tenantId: z.string().optional(), // Si no se proporciona, se usa del usuario autenticado
  planId: z.string(),
  payerEmail: z.string().email(),
  cardTokenId: z.string(), // Token de tarjeta generado por Mercado Pago SDK
})

/**
 * POST /api/subscriptions/pay
 * Crea una suscripción recurrente con Mercado Pago Preapproval
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    
    if (user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Super admin no puede crear suscripciones' },
        { status: 403 }
      )
    }

    const tenantId = user.tenantId
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Usuario no tiene tenant asociado' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validatedData = createSubscriptionSchema.parse({
      ...body,
      tenantId: body.tenantId || tenantId,
    })

    // Obtener el plan
    const plan = await executeWithRetry(() => prisma.plan.findUnique({
      where: { id: validatedData.planId },
    }))

    if (!plan || !plan.active) {
      return NextResponse.json(
        { error: 'Plan no encontrado o inactivo' },
        { status: 404 }
      )
    }

    // Obtener el tenant
    const tenant = await executeWithRetry(() => prisma.tenant.findUnique({
      where: { id: validatedData.tenantId },
      include: { settings: true },
    }))

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant no encontrado' },
        { status: 404 }
      )
    }

    // Verificar credenciales de Mercado Pago
    const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()
    if (!mercadoPagoAccessToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado' },
        { status: 500 }
      )
    }

    // Inicializar cliente de Mercado Pago
    const client = new MercadoPagoConfig({ accessToken: mercadoPagoAccessToken })
    const preApproval = new PreApproval(client)
    const customer = new Customer(client)

    // Crear o buscar customer en Mercado Pago
    let mpCustomerId: string | null = null
    try {
      // Buscar customer existente por email
      const existingCustomers = await customer.search({
        options: {
          qs: {
            email: validatedData.payerEmail,
          },
        },
      })

      if (existingCustomers.results && existingCustomers.results.length > 0) {
        mpCustomerId = existingCustomers.results[0].id?.toString() || null
      } else {
        // Crear nuevo customer
        const newCustomer = await customer.create({
          body: {
            email: validatedData.payerEmail,
            first_name: tenant.name.split(' ')[0] || tenant.name,
            last_name: tenant.name.split(' ').slice(1).join(' ') || '',
          },
        })
        mpCustomerId = newCustomer.id?.toString() || null
      }
    } catch (error: any) {
      logger.warn('Error creating/finding Mercado Pago customer, continuing without customer', error)
      // Continuar sin customer ID, Mercado Pago puede crear uno automáticamente
    }

    // Calcular frecuencia de cobro según el intervalo del plan
    const frequency = plan.interval === 'annual' ? 12 : 1 // 12 meses para anual, 1 mes para mensual
    const frequencyType = 'months'

    // Crear Preapproval (suscripción recurrente) en Mercado Pago
    const preapprovalData: any = {
      reason: `Suscripción ${plan.name} - ${plan.interval === 'monthly' ? 'Mensual' : 'Anual'}`,
      external_reference: `subscription_${validatedData.tenantId}_${Date.now()}`,
      payer_email: validatedData.payerEmail,
      card_token_id: validatedData.cardTokenId,
      auto_recurring: {
        frequency: frequency,
        frequency_type: frequencyType,
        transaction_amount: plan.price,
        currency_id: plan.currency || 'COP',
        start_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Mañana
        end_date: null, // Sin fecha de fin (suscripción indefinida hasta cancelación)
      },
      back_url: `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://clivaro.vercel.app'}/settings?tab=subscription`,
      status: 'authorized',
    }

    // Si tenemos customer ID, agregarlo
    if (mpCustomerId) {
      preapprovalData.payer_id = mpCustomerId
    }

    logger.info('Creating Mercado Pago Preapproval', {
      tenantId: validatedData.tenantId,
      planId: plan.id,
      planName: plan.name,
      amount: plan.price,
      frequency,
      frequencyType,
    })

    const mpPreapproval = await preApproval.create({ body: preapprovalData })

    // Calcular fechas del período
    const now = new Date()
    const startDate = now
    const endDate = new Date(now)
    if (plan.interval === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1)
    } else {
      endDate.setMonth(endDate.getMonth() + 1)
    }

    // Crear o actualizar suscripción en la base de datos
    const subscription = await executeWithRetry(() => prisma.subscription.upsert({
      where: {
        tenantId: validatedData.tenantId,
      },
      update: {
        planId: plan.id,
        status: 'pending_payment', // Cambiará a 'active' cuando se procese el primer pago
        startDate: startDate,
        endDate: endDate,
        autoRenew: true,
        mercadoPagoPreferenceId: mpPreapproval.id?.toString() || null,
        mercadoPagoStatus: mpPreapproval.status || 'pending',
        mercadoPagoResponse: JSON.stringify(mpPreapproval),
        updatedAt: new Date(),
      },
      create: {
        tenantId: validatedData.tenantId,
        planId: plan.id,
        status: 'pending_payment',
        startDate: startDate,
        endDate: endDate,
        autoRenew: true,
        mercadoPagoPreferenceId: mpPreapproval.id?.toString() || null,
        mercadoPagoStatus: mpPreapproval.status || 'pending',
        mercadoPagoResponse: JSON.stringify(mpPreapproval),
      },
    }))

    logger.info('Subscription created successfully', {
      subscriptionId: subscription.id,
      mpPreapprovalId: mpPreapproval.id,
      tenantId: validatedData.tenantId,
    })

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planId: subscription.planId,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      },
      mercadoPago: {
        preapprovalId: mpPreapproval.id,
        initPoint: mpPreapproval.init_point,
        sandboxInitPoint: mpPreapproval.sandbox_init_point,
        status: mpPreapproval.status,
      },
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    logger.error('Error creating subscription', error, {
      endpoint: '/api/subscriptions/pay',
      method: 'POST',
    })

    return NextResponse.json(
      { 
        error: 'Error al crear la suscripción',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}

