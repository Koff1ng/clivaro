import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { generateInvoicePDF } from '@/lib/pdf'

export async function GET(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const resolvedParams = await params
    const invoice = await prisma.invoice.findUnique({
      where: { id: resolvedParams.id },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
            taxId: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
            variant: {
              select: {
                name: true,
              },
            },
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

    // Obtener configuración del tenant
    const settings = await prisma.tenantSettings.findUnique({
      where: { tenantId: (session.user as any).tenantId }
    })

    // Parsear configuración custom para obtener regimen si está ahí
    let regime = 'Responsable de IVA'
    try {
      if (settings?.customSettings) {
        const custom = JSON.parse(settings.customSettings)
        if (custom.identity?.regime) regime = custom.identity.regime
      }
    } catch (e) {
      // ignore
    }

    // Generar PDF
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
      items: invoice.items.map(item => ({
        product: {
          name: item.product?.name || 'Producto',
          sku: item.product?.sku || undefined,
        },
        variant: item.variant ? {
          name: item.variant.name,
        } : undefined,
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
        regime: regime
      }
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Factura-${invoice.number}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating invoice PDF:', error)
    const errorMessage = error?.message || 'Error desconocido al generar PDF'
    const errorStack = error?.stack || ''

    // Log detallado para debugging
    console.error('PDF Generation Error Details:', {
      message: errorMessage,
      stack: errorStack,
      name: error?.name,
      code: error?.code,
    })

    return NextResponse.json(
      {
        error: 'Error al generar PDF',
        details: errorMessage,
        // Solo incluir stack en desarrollo
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    )
  }
}

