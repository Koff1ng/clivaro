import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { formatCurrency, formatDate } from '@/lib/utils'
import { sendEmail } from '@/lib/email'
import { generateQuotationPDF } from '@/lib/pdf'
import { logger } from '@/lib/logger'

export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  let quotationId: string | undefined

  try {
    // Handle params as Promise (Next.js 15+)
    try {
      const resolvedParams = typeof params === 'object' && 'then' in params 
        ? await params 
        : params as { id: string }
      quotationId = resolvedParams.id
      logger.debug('Send quotation requested', { quotationId })
      
      if (!quotationId) {
        return NextResponse.json(
          { error: 'ID de cotización requerido' },
          { status: 400 }
        )
      }
    } catch (paramError: any) {
      logger.warn('Error resolving params', { paramError })
      return NextResponse.json(
        { error: 'Error al procesar parámetros de la solicitud' },
        { status: 400 }
      )
    }

    let quotation
    try {
      logger.debug('Fetching quotation from database', { quotationId })
      quotation = await prisma.quotation.findUnique({
        where: { id: quotationId },
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
    } catch (dbError: any) {
      logger.error('Database error fetching quotation', dbError, { quotationId })
      throw dbError
    }

    if (!quotation) {
      return NextResponse.json(
        { error: 'Cotización no encontrada' },
        { status: 404 }
      )
    }

    if (!quotation.customer?.email) {
      return NextResponse.json(
        { error: 'El cliente no tiene un email registrado para enviar la cotización' },
        { status: 400 }
      )
    }

    logger.debug('Sending quotation email', { to: quotation.customer.email })

    // Generate quotation HTML
    let quotationHtml: string
    try {
      logger.debug('Generating quotation HTML', { quotationId })
      quotationHtml = generateQuotationHTML(quotation)
      logger.debug('Quotation HTML generated', { quotationId, length: quotationHtml.length })
    } catch (htmlError: any) {
      logger.error('Error generating HTML', htmlError, { quotationId })
      throw new Error(`Error al generar el HTML de la cotización: ${htmlError.message}`)
    }
    
    // Generate quotation PDF
    let pdfBuffer: Buffer | null = null
    try {
      logger.debug('Generating quotation PDF', { quotationId })
      pdfBuffer = await generateQuotationPDF({
        number: quotation.number,
        customer: {
          name: quotation.customer?.name || 'N/A',
          email: quotation.customer?.email,
          phone: quotation.customer?.phone || undefined,
          address: quotation.customer?.address || undefined,
          taxId: quotation.customer?.taxId || undefined,
        },
        items: quotation.items.map(item => ({
          product: {
            name: item.product?.name || 'Producto',
            sku: item.product?.sku,
          },
          variant: item.variant ? {
            name: item.variant.name,
          } : undefined,
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          discount: item.discount || 0,
          subtotal: item.subtotal || 0,
        })),
        subtotal: quotation.subtotal || 0,
        discount: quotation.discount || 0,
        tax: quotation.tax || 0,
        total: quotation.total || 0,
        validUntil: quotation.validUntil,
        notes: quotation.notes,
        createdAt: quotation.createdAt,
      })
      logger.debug('Quotation PDF generated', { quotationId, bytes: pdfBuffer.length })
    } catch (pdfError: any) {
      logger.warn('Error generating PDF (continuing without attachment)', { quotationId, pdfError })
      // Continue without PDF if generation fails
    }
    
    const companyName = process.env.COMPANY_NAME || 'Ferretería'
    
    // Send email to customer
    let emailResult
    try {
      emailResult = await sendEmail({
        to: quotation.customer.email,
        subject: `Cotización ${quotation.number} - ${companyName}`,
        html: quotationHtml,
        attachments: pdfBuffer ? [{
          filename: `Cotizacion-${quotation.number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        }] : undefined,
      })
    } catch (emailError: any) {
      logger.error('Error in sendEmail call', emailError, { quotationId })
      throw emailError
    }

    // Update quotation status to SENT (only if not already SENT, to allow resending)
    if (quotation.status !== 'SENT') {
      await prisma.quotation.update({
        where: { id: quotationId },
        data: {
          status: 'SENT',
          updatedById: (session.user as any).id,
        },
      })
    }

    if (emailResult.success) {
      logger.info('Quotation email sent', { quotationId })
      return NextResponse.json({
        success: true,
        message: `Cotización ${quotation.number} enviada exitosamente a ${quotation.customer.email}`,
        email: quotation.customer.email,
        emailSent: true,
      })
    } else {
      // Don't mark as sent if email failed
      const errorMessage = emailResult.error === 'SMTP not configured'
        ? 'El servicio de email no está configurado. Por favor, configure las variables SMTP en el archivo .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD)'
        : emailResult.message || 'Error desconocido al enviar el email'
      
      return NextResponse.json({
        success: false,
        message: `Error al enviar la cotización: ${errorMessage}`,
        email: quotation.customer.email,
        emailSent: false,
        emailError: emailResult.error || 'Unknown error',
        emailMessage: emailResult.message,
      }, { status: 500 })
    }
  } catch (error: any) {
    logger.error('Error sending quotation', error, { endpoint: '/api/quotations/[id]/send', method: 'POST', quotationId })
    
    const errorMessage = error.message || 'Error desconocido al enviar la cotización'
    const isSmtpError = errorMessage.includes('SMTP') || errorMessage.includes('email') || errorMessage.includes('smtp')
    
    return NextResponse.json(
      { 
        error: 'Failed to send quotation',
        message: isSmtpError 
          ? `Error de configuración SMTP: ${errorMessage}. Verifique las variables SMTP en .env`
          : errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

function generateQuotationHTML(quotation: any): string {
  try {
    const companyName = process.env.COMPANY_NAME || 'Ferretería'
    const companyAddress = process.env.COMPANY_ADDRESS || ''
    const companyPhone = process.env.COMPANY_PHONE || ''
    const companyEmail = process.env.COMPANY_EMAIL || ''
    const companyNit = process.env.COMPANY_NIT || ''

    // Safely handle items
    const items = quotation.items || []
    const itemsHtml = items.map((item: any) => {
      const productName = item.product?.name || 'Producto'
      const productSku = item.product?.sku || ''
      const quantity = item.quantity || 0
      const unitPrice = item.unitPrice || 0
      const discount = item.discount || 0
      const subtotal = item.subtotal || 0
      
      return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-weight: 500;">${productName}</div>
          ${productSku ? `<div style="font-size: 12px; color: #6b7280;">SKU: ${productSku}</div>` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(unitPrice)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${discount}%</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${formatCurrency(subtotal)}</td>
      </tr>
      `
    }).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cotización ${quotation.number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
          padding: 20px;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid #3b82f6;
        }
        .header h1 {
          color: #1e40af;
          font-size: 28px;
          margin-bottom: 10px;
        }
        .header .company {
          color: #6b7280;
          font-size: 14px;
        }
        .info-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 30px;
        }
        .info-box {
          background: #f9fafb;
          padding: 20px;
          border-radius: 6px;
        }
        .info-box h3 {
          color: #1e40af;
          font-size: 14px;
          text-transform: uppercase;
          margin-bottom: 15px;
          letter-spacing: 0.5px;
        }
        .info-box p {
          margin: 8px 0;
          font-size: 14px;
        }
        .info-box strong {
          color: #374151;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 30px 0;
        }
        th {
          background-color: #1e40af;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        .totals {
          margin-top: 30px;
          text-align: right;
        }
        .totals-row {
          display: flex;
          justify-content: flex-end;
          padding: 8px 0;
          font-size: 14px;
        }
        .totals-row.total-final {
          font-size: 20px;
          font-weight: bold;
          color: #1e40af;
          border-top: 2px solid #1e40af;
          padding-top: 15px;
          margin-top: 10px;
        }
        .notes {
          margin-top: 30px;
          padding: 20px;
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          border-radius: 4px;
        }
        .notes h3 {
          color: #92400e;
          margin-bottom: 10px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>COTIZACIÓN ${quotation.number}</h1>
          <div class="company">
            <div style="font-weight: 600; font-size: 16px; color: #1e40af; margin-bottom: 5px;">${companyName}</div>
            ${companyAddress ? `<div>${companyAddress}</div>` : ''}
            ${companyPhone ? `<div>Tel: ${companyPhone}</div>` : ''}
            ${companyEmail ? `<div>Email: ${companyEmail}</div>` : ''}
            ${companyNit ? `<div>NIT: ${companyNit}</div>` : ''}
          </div>
        </div>
        
        <div class="info-section">
          <div class="info-box">
            <h3>Cliente</h3>
            <p><strong>Nombre:</strong> ${quotation.customer?.name || 'N/A'}</p>
            ${quotation.customer?.taxId ? `<p><strong>NIT:</strong> ${quotation.customer.taxId}</p>` : ''}
            ${quotation.customer?.email ? `<p><strong>Email:</strong> ${quotation.customer.email}</p>` : ''}
            ${quotation.customer?.phone ? `<p><strong>Teléfono:</strong> ${quotation.customer.phone}</p>` : ''}
            ${quotation.customer?.address ? `<p><strong>Dirección:</strong> ${quotation.customer.address}</p>` : ''}
          </div>
          <div class="info-box">
            <h3>Información</h3>
            <p><strong>Fecha:</strong> ${formatDate(quotation.createdAt)}</p>
            ${quotation.validUntil ? `<p><strong>Válida hasta:</strong> ${formatDate(quotation.validUntil)}</p>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th style="text-align: center;">Cantidad</th>
              <th style="text-align: right;">Precio Unit.</th>
              <th style="text-align: center;">Descuento</th>
              <th style="text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span style="margin-right: 20px;">Subtotal:</span>
            <span>${formatCurrency((quotation.subtotal || 0) + (quotation.discount || 0))}</span>
          </div>
          ${(quotation.discount || 0) > 0 ? `
          <div class="totals-row">
            <span style="margin-right: 20px;">Descuento:</span>
            <span>${formatCurrency(quotation.discount || 0)}</span>
          </div>
          ` : ''}
          <div class="totals-row">
            <span style="margin-right: 20px;">IVA:</span>
            <span>${formatCurrency(quotation.tax || 0)}</span>
          </div>
          <div class="totals-row total-final">
            <span style="margin-right: 20px;">TOTAL:</span>
            <span>${formatCurrency(quotation.total || 0)}</span>
          </div>
        </div>

        ${quotation.notes ? `
        <div class="notes">
          <h3>Notas</h3>
          <p>${quotation.notes}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>Esta es una cotización generada automáticamente por ${companyName}</p>
          <p>Para más información, contáctenos a través de nuestros canales oficiales</p>
        </div>
      </div>
    </body>
    </html>
  `
  } catch (error: any) {
    logger.error('Error in generateQuotationHTML', error)
    throw new Error(`Error al generar HTML: ${error.message}`)
  }
}

