import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { createPaymentPreference } from '@/lib/mercadopago'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createPreferenceSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID es requerido'),
})

/**
 * POST /api/payments/mercadopago/create
 * Crea una preferencia de pago en Mercado Pago para una factura
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
        { error: 'Super admin no puede crear pagos de tenant' },
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
    const { invoiceId } = createPreferenceSchema.parse(body)

    // Obtener configuración de Mercado Pago del tenant
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: user.tenantId },
    })

    if (!settings?.mercadoPagoEnabled || !settings?.mercadoPagoAccessToken) {
      return NextResponse.json(
        { error: 'Mercado Pago no está configurado para este tenant' },
        { status: 400 }
      )
    }

    // Obtener la factura
    const tenantPrisma = await getPrismaForRequest(request, session)
    const invoice = await tenantPrisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    if (invoice.status === 'PAGADA') {
      return NextResponse.json(
        { error: 'La factura ya está pagada' },
        { status: 400 }
      )
    }

    // Calcular el total pendiente
    const totalPaid = await tenantPrisma.payment.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    })

    const pendingAmount = invoice.total - (totalPaid._sum.amount || 0)

    if (pendingAmount <= 0) {
      return NextResponse.json(
        { error: 'No hay monto pendiente por pagar' },
        { status: 400 }
      )
    }

    // Crear la preferencia de pago
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const tenantSlug = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { slug: true },
    })

    const preference = await createPaymentPreference(
      {
        accessToken: settings.mercadoPagoAccessToken!,
        publicKey: settings.mercadoPagoPublicKey || undefined,
      },
      {
        title: `Factura ${invoice.number}`,
        description: `Pago de factura ${invoice.number} - ${invoice.customer.name}`,
        amount: pendingAmount,
        currency: settings.currency || 'COP',
        invoiceId: invoice.id,
        customerEmail: invoice.customer.email || undefined,
        customerName: invoice.customer.name,
        backUrls: {
          success: `${baseUrl}/invoices/${invoice.id}?payment=success`,
          failure: `${baseUrl}/invoices/${invoice.id}?payment=failure`,
          pending: `${baseUrl}/invoices/${invoice.id}?payment=pending`,
        },
        autoReturn: 'approved',
        externalReference: invoice.id,
      }
    )

    // Crear registro de pago pendiente
    const payment = await tenantPrisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: pendingAmount,
        method: 'MERCADOPAGO',
        mercadoPagoPreferenceId: preference.preferenceId,
        mercadoPagoStatus: 'pending',
        createdById: user.id,
      },
    })

    logger.info('Mercado Pago payment preference created', {
      paymentId: payment.id,
      invoiceId: invoice.id,
      preferenceId: preference.preferenceId,
      amount: pendingAmount,
    })

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      preferenceId: preference.preferenceId,
      initPoint: preference.initPoint,
      sandboxInitPoint: preference.sandboxInitPoint,
      publicKey: settings.mercadoPagoPublicKey,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error creating Mercado Pago preference', error, {
      endpoint: '/api/payments/mercadopago/create',
      method: 'POST',
    })
    return NextResponse.json(
      { error: 'Error al crear preferencia de pago', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

