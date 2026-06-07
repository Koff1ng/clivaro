import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { generateInvoicePDF } from '@/lib/pdf'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function GET(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const resolvedParams = await params

    const result = await withTenantRead(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findUnique({
        where: { id: resolvedParams.id },
        include: {
          customer: { select: { name: true, email: true, phone: true, address: true, taxId: true } },
          items: {
            include: {
              product: { select: { name: true, sku: true } },
              variant: { select: { name: true } },
            },
          },
        },
      })

      if (!invoice) throw new Error('Factura no encontrada')

      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId }
      })

      return { invoice, settings }
    })

    const { invoice, settings } = result

    let regime = 'Responsable de IVA'
    let customIdentity: any = {}
    try {
      if (settings?.customSettings) {
        const custom = JSON.parse(settings.customSettings)
        if (custom.identity) {
          customIdentity = custom.identity
          if (customIdentity.regime) regime = customIdentity.regime
        }
      }
    } catch (e) { /* ignore */ }

    const pdfBuffer = await generateInvoicePDF({
      number: invoice.number,
      prefix: invoice.prefix || undefined,
      customer: {
        name: invoice.customer?.name || 'Cliente General',
        email: invoice.customer?.email || undefined,
        phone: invoice.customer?.phone || undefined,
        address: invoice.customer?.address || undefined,
        taxId: invoice.customer?.taxId || undefined,
      },
      items: (invoice.items as any[]).map(item => ({
        product: {
          name: item.product?.name || 'Producto',
          sku: item.product?.sku || undefined,
        },
        variant: item.variant ? { name: item.variant.name } : undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        taxRate: item.taxRate || 0,
        subtotal: item.subtotal,
      })),
      subtotal: invoice.subtotal || 0,
      discount: invoice.discount || 0,
      tax: invoice.tax || 0,
      total: invoice.total || 0,
      issuedAt: invoice.issuedAt || undefined,
      dueDate: invoice.dueDate || undefined,
      paidAt: invoice.paidAt || undefined,
      notes: invoice.notes || undefined,
      cufe: invoice.cufe || undefined,
      qrCode: invoice.qrCode || undefined,
      status: invoice.status,
      company: {
        name: settings?.companyName || undefined,
        address: settings?.companyAddress || undefined,
        phone: settings?.companyPhone || undefined,
        email: settings?.companyEmail || undefined,
        nit: settings?.companyNit || undefined,
        regime,
        logo: customIdentity?.logo,
        commercialName: settings?.commercialName || customIdentity?.companyName || settings?.companyName,
        verificationDigit: settings?.verificationDigit || customIdentity?.verificationDigit,
        fiscalResponsibilities: settings?.fiscalResponsibilities || customIdentity?.fiscalResponsibilities,
        economicActivity: settings?.economicActivity || customIdentity?.economicActivity,
        department: settings?.companyDepartment || customIdentity?.department,
        city: settings?.companyCity || customIdentity?.city,
        resolutionNumber: settings?.billingResolutionNumber || undefined,
        resolutionDate: settings?.billingResolutionValidFrom ? new Date(settings.billingResolutionValidFrom).toISOString().split('T')[0] : undefined,
        resolutionValidUntil: settings?.billingResolutionValidTo ? new Date(settings.billingResolutionValidTo).toISOString().split('T')[0] : undefined,
        resolutionRangeFrom: settings?.billingResolutionFrom || undefined,
        resolutionRangeTo: settings?.billingResolutionTo || undefined,
      }
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Factura-${invoice.number}.pdf"`,
      },
    })
  } catch (error: any) {
    logger.error('Error generating invoice PDF', error)
    return NextResponse.json({ error: 'Error al generar PDF', details: safeErrorMessage(error) }, { status: 500 })
  }
}

