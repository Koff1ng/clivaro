import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { ElectronicBillingConfig, sendToElectronicBilling, validateInvoiceData } from '@/lib/electronic-billing'

/**
 * Endpoint para enviar factura a facturación electrónica
 * Este endpoint debe integrarse con un proveedor de facturación electrónica
 * como Facturación Electrónica Gratuita (FEG) u otro proveedor autorizado por DIAN
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
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
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    if (invoice.electronicStatus === 'SENT' || invoice.electronicStatus === 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Invoice already sent to electronic billing' },
        { status: 400 }
      )
    }

    // Preparar datos para facturación electrónica según formato DIAN
    const electronicData = {
      // Información del emisor (debe venir de configuración)
      issuer: {
        nit: process.env.COMPANY_NIT || '900000000-1',
        name: process.env.COMPANY_NAME || 'Mi Empresa',
        address: process.env.COMPANY_ADDRESS || '',
        phone: process.env.COMPANY_PHONE || '',
        email: process.env.COMPANY_EMAIL || '',
      },
      // Información del receptor
      receiver: {
        nit: invoice.customer.taxId || '',
        name: invoice.customer.name,
        address: invoice.customer.address || '',
        phone: invoice.customer.phone || '',
        email: invoice.customer.email || '',
      },
      // Información de la factura
      invoice: {
        number: invoice.number,
        prefix: invoice.prefix || 'FV',
        consecutive: invoice.consecutive || invoice.number.split('-')[1] || '',
        issueDate: invoice.issuedAt || invoice.createdAt,
        dueDate: invoice.dueDate,
        currency: 'COP',
        exchangeRate: 1,
        // Items
        items: invoice.items.map(item => ({
          code: item.product?.sku || '',
          description: item.product?.name || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          subtotal: item.subtotal,
        })),
        // Totales
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        tax: invoice.tax,
        total: invoice.total,
      },
      // Resolución de facturación (debe venir de configuración)
      resolution: {
        number: process.env.BILLING_RESOLUTION_NUMBER || '',
        prefix: process.env.BILLING_RESOLUTION_PREFIX || 'FV',
        from: process.env.BILLING_RESOLUTION_FROM || '1',
        to: process.env.BILLING_RESOLUTION_TO || '999999',
        validFrom: process.env.BILLING_RESOLUTION_VALID_FROM || new Date().toISOString(),
        validTo: process.env.BILLING_RESOLUTION_VALID_TO || new Date().toISOString(),
      },
    }

    // Validar datos antes de enviar
    const validation = validateInvoiceData({
      number: invoice.number,
      prefix: invoice.prefix || 'FV',
      consecutive: invoice.consecutive || invoice.number.split('-')[1] || '',
      issueDate: invoice.issuedAt || invoice.createdAt,
      dueDate: invoice.dueDate || undefined,
      customer: {
        nit: invoice.customer.taxId || '',
        name: invoice.customer.name,
        address: invoice.customer.address || '',
        phone: invoice.customer.phone || '',
        email: invoice.customer.email || '',
      },
      items: invoice.items.map(item => ({
        code: item.product?.sku || '',
        description: item.product?.name || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        subtotal: item.subtotal,
      })),
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      tax: invoice.tax,
      total: invoice.total,
    })

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Datos de factura inválidos', errors: validation.errors },
        { status: 400 }
      )
    }

    // Configurar proveedor de facturación electrónica
    const config: ElectronicBillingConfig = {
      provider: (process.env.ELECTRONIC_BILLING_PROVIDER as any) || 'FEG',
      apiUrl: process.env.ELECTRONIC_BILLING_API_URL,
      apiKey: process.env.ELECTRONIC_BILLING_API_KEY,
      companyNit: process.env.COMPANY_NIT || '900000000-1',
      companyName: process.env.COMPANY_NAME || 'Mi Empresa',
      companyAddress: process.env.COMPANY_ADDRESS || '',
      companyPhone: process.env.COMPANY_PHONE || '',
      companyEmail: process.env.COMPANY_EMAIL || '',
      resolutionNumber: process.env.BILLING_RESOLUTION_NUMBER || '',
      resolutionPrefix: process.env.BILLING_RESOLUTION_PREFIX || 'FV',
      resolutionFrom: process.env.BILLING_RESOLUTION_FROM || '1',
      resolutionTo: process.env.BILLING_RESOLUTION_TO || '999999',
      resolutionValidFrom: process.env.BILLING_RESOLUTION_VALID_FROM || new Date().toISOString(),
      resolutionValidTo: process.env.BILLING_RESOLUTION_VALID_TO || new Date().toISOString(),
    }

    // Enviar a facturación electrónica
    const result = await sendToElectronicBilling({
      number: invoice.number,
      prefix: invoice.prefix || 'FV',
      consecutive: invoice.consecutive || invoice.number.split('-')[1] || '',
      issueDate: invoice.issuedAt || invoice.createdAt,
      dueDate: invoice.dueDate || undefined,
      customer: {
        nit: invoice.customer.taxId || '',
        name: invoice.customer.name,
        address: invoice.customer.address || '',
        phone: invoice.customer.phone || '',
        email: invoice.customer.email || '',
      },
      items: invoice.items.map(item => ({
        code: item.product?.sku || '',
        description: item.product?.name || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
        subtotal: item.subtotal,
      })),
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      tax: invoice.tax,
      total: invoice.total,
    }, config)

    if (result.success) {
      // Actualizar factura con datos de respuesta
      await prisma.invoice.update({
        where: { id: params.id },
        data: {
          cufe: result.cufe || null,
          qrCode: result.qrCode || null,
          electronicStatus: result.status || 'SENT',
          electronicSentAt: new Date(),
          electronicResponse: JSON.stringify(result.response || result),
        },
      })

      return NextResponse.json({
        success: true,
        cufe: result.cufe,
        qrCode: result.qrCode,
        pdfUrl: result.pdfUrl,
        xmlUrl: result.xmlUrl,
        status: result.status,
        message: result.message || 'Factura enviada a facturación electrónica',
        note: config.provider === 'FEG' && !config.apiUrl 
          ? 'Esta es una simulación. Configure las variables de entorno para integración real.'
          : undefined,
      })
    } else {
      // Actualizar con estado de rechazo
      await prisma.invoice.update({
        where: { id: params.id },
        data: {
          electronicStatus: 'REJECTED',
          electronicSentAt: new Date(),
          electronicResponse: JSON.stringify({
            errors: result.errors,
            message: result.message,
          }),
        },
      })

      return NextResponse.json(
        { 
          success: false,
          error: result.message || 'Error al enviar factura',
          errors: result.errors,
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error sending invoice to electronic billing:', error)
    return NextResponse.json(
      { error: 'Failed to send invoice to electronic billing' },
      { status: 500 }
    )
  }
}

