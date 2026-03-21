import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { generateQuotationPDF } from '@/lib/pdf'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const quotation = await withTenantRead(tenantId, async (prisma) => {
      return await prisma.quotation.findUnique({
        where: { id: params.id },
        include: {
          customer: {
            select: {
              id: true,
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
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      })
    })

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
    }

    const pdfBuffer = await generateQuotationPDF(quotation as any)

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="cotizacion-${quotation.number}.pdf"`,
      },
    })
  } catch (error) {
    logger.error('Error generating quotation PDF', error, { endpoint: '/api/quotations/[id]/pdf', method: 'GET' })
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
