import puppeteer, { Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { formatCurrency, formatDate } from './utils'

export interface QuotationPDFData {
  number: string
  customer: {
    name: string
    email?: string
    phone?: string
    address?: string
    taxId?: string
  }
  items: Array<{
    product: {
      name: string
      sku?: string
    }
    variant?: {
      name: string
    }
    quantity: number
    unitPrice: number
    discount: number
    subtotal: number
  }>
  subtotal: number
  discount: number
  tax: number
  total: number
  validUntil?: Date | null
  notes?: string | null
  createdAt: Date
}

export async function generateQuotationPDF(quotation: QuotationPDFData): Promise<Buffer> {
  const companyName = process.env.COMPANY_NAME || 'Ferretería'
  const companyAddress = process.env.COMPANY_ADDRESS || ''
  const companyPhone = process.env.COMPANY_PHONE || ''
  const companyEmail = process.env.COMPANY_EMAIL || ''
  const companyNit = process.env.COMPANY_NIT || ''

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          padding: 40px;
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
        }
        .info-box p {
          margin: 8px 0;
          font-size: 14px;
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
      </style>
    </head>
    <body>
      <div class="header">
        <h1>COTIZACIÓN ${quotation.number}</h1>
        <div>
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
          <p><strong>Nombre:</strong> ${quotation.customer.name}</p>
          ${quotation.customer.taxId ? `<p><strong>NIT:</strong> ${quotation.customer.taxId}</p>` : ''}
          ${quotation.customer.email ? `<p><strong>Email:</strong> ${quotation.customer.email}</p>` : ''}
          ${quotation.customer.phone ? `<p><strong>Teléfono:</strong> ${quotation.customer.phone}</p>` : ''}
          ${quotation.customer.address ? `<p><strong>Dirección:</strong> ${quotation.customer.address}</p>` : ''}
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
          ${quotation.items.map(item => `
            <tr>
              <td>
                <div style="font-weight: 500;">${item.product.name}</div>
                ${item.product.sku ? `<div style="font-size: 12px; color: #6b7280;">SKU: ${item.product.sku}</div>` : ''}
              </td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">${formatCurrency(item.unitPrice)}</td>
              <td style="text-align: center;">${item.discount}%</td>
              <td style="text-align: right; font-weight: 500;">${formatCurrency(item.subtotal)}</td>
            </tr>
          `).join('')}
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
    </body>
    </html>
  `

  let browser
  try {
    // Configuración para Vercel (serverless)
    const isVercel = process.env.VERCEL === '1'
    const executablePath = isVercel
      ? await chromium.executablePath()
      : undefined

    const chromiumArgs = isVercel ? chromium.args || [] : []
    const args = isVercel
      ? [...chromiumArgs, '--hide-scrollbars', '--disable-web-security']
      : ['--no-sandbox', '--disable-setuid-sandbox']

    browser = await puppeteer.launch({
      headless: true,
      args,
      executablePath,
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    })

    await browser.close()
    return Buffer.from(pdf)
  } catch (error) {
    if (browser) {
      await browser.close()
    }
    throw error
  }
}

export interface InvoicePDFData {
  number: string
  prefix?: string
  customer: {
    name: string
    email?: string
    phone?: string
    address?: string
    taxId?: string
  }
  items: Array<{
    product: {
      name: string
      sku?: string
    }
    variant?: {
      name: string
    }
    quantity: number
    unitPrice: number
    discount: number
    taxRate: number
    subtotal: number
  }>
  subtotal: number
  discount: number
  tax: number
  total: number
  issuedAt?: Date | null
  dueDate?: Date | null
  paidAt?: Date | null
  notes?: string | null
  cufe?: string | null
  qrCode?: string | null
  status: string
}

export async function generateInvoicePDF(invoice: InvoicePDFData): Promise<Buffer> {
  // Company information from environment
  const companyName = process.env.COMPANY_NAME || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Empresa'
  const companyAddress = process.env.COMPANY_ADDRESS || process.env.NEXT_PUBLIC_COMPANY_ADDRESS || ''
  const companyCity = process.env.COMPANY_CITY || process.env.NEXT_PUBLIC_COMPANY_CITY || ''
  const companyPhone = process.env.COMPANY_PHONE || process.env.NEXT_PUBLIC_COMPANY_PHONE || ''
  const companyEmail = process.env.COMPANY_EMAIL || process.env.NEXT_PUBLIC_COMPANY_EMAIL || ''
  const companyNit = process.env.COMPANY_NIT || process.env.NEXT_PUBLIC_COMPANY_TAX_ID || ''
  const companyRegime = process.env.COMPANY_REGIME || 'Responsable de IVA'

  // DIAN Resolution info (should come from environment or database)
  const resolutionNumber = process.env.DIAN_RESOLUTION_NUMBER || ''
  const resolutionDate = process.env.DIAN_RESOLUTION_DATE || ''
  const resolutionRangeFrom = process.env.DIAN_RANGE_FROM || ''
  const resolutionRangeTo = process.env.DIAN_RANGE_TO || ''
  const resolutionValidUntil = process.env.DIAN_VALID_UNTIL || ''

  // Calculate payment form
  const isCredit = invoice.dueDate && invoice.issuedAt &&
    new Date(invoice.dueDate).getTime() > new Date(invoice.issuedAt).getTime()
  const paymentForm = isCredit ? 'CRÉDITO' : 'CONTADO'

  // IVA breakdown by rate
  const taxByRate = new Map<number, { base: number; tax: number }>()
  for (const item of invoice.items || []) {
    const rate = typeof item.taxRate === 'number' ? item.taxRate : 0
    const base = (item.unitPrice || 0) * (item.quantity || 0) * (1 - (item.discount || 0) / 100)
    const itemTax = base * (rate / 100)
    const prev = taxByRate.get(rate) || { base: 0, tax: 0 }
    taxByRate.set(rate, { base: prev.base + base, tax: prev.tax + itemTax })
  }

  // Format date with time
  const formatDateTime = (date: Date | string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  }

  const isElectronic = !!invoice.cufe

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          line-height: 1.5;
          color: #334155;
          font-size: 10px;
        }
        .page {
          padding: 40px;
          max-width: 210mm;
          margin: 0 auto;
        }
        
        /* Header */
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #f1f5f9;
        }
        .company-info {
          flex: 1;
        }
        /* ... */
        
        /* Table */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th {
          text-align: left;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          font-weight: 600;
        }
        td {
          padding: 10px 0;
          border-bottom: 1px solid #f8fafc;
          vertical-align: top;
          color: #334155;
        }
        
        /* ... */

        /* Totals */
        .total-row.final {
          border-top: 1px solid #e2e8f0;
          margin-top: 8px;
          padding-top: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
        }
        
        /* Tax breakdown - minimalistic */
        .tax-details {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #f1f5f9;
        }
        .tax-row {
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          color: #94a3b8;
          margin-bottom: 2px;
        }

        /* Electronic Info */
        .electronic-info {
          margin-top: 15px;
          font-size: 8px;
          color: #64748b;
        }
        .cufe-box {
          background: #f8fafc;
          padding: 8px;
          border-radius: 4px;
          word-break: break-all;
          font-family: monospace;
          margin-top: 4px;
          border: 1px solid #e2e8f0;
        }

        /* Legal Footer */
        .legal-footer {
          margin-top: 40px;
          text-align: center;
          font-size: 8px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
        }
        .legal-text {
          margin-bottom: 4px;
        }
      </style>
        .notes-section {
          background: #fefce8;
          border-left: 4px solid #eab308;
          border-radius: 0 8px 8px 0;
          padding: 12px 15px;
          margin-top: 15px;
        }
        .notes-title {
          font-size: 10px;
          font-weight: 700;
          color: #854d0e;
          margin-bottom: 5px;
        }
        .notes-content {
          font-size: 10px;
          color: #713f12;
        }
        
        /* Status Badge */
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-paid { background: #dcfce7; color: #166534; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-void { background: #fee2e2; color: #991b1b; }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <div class="company-name">${companyName}</div>
            <div class="company-details">
              <div><strong>NIT:</strong> ${companyNit}</div>
              <div>${companyRegime}</div>
              ${companyAddress ? `<div>${companyAddress}</div>` : ''}
              ${companyCity ? `<div>${companyCity}</div>` : ''}
              ${companyPhone ? `<div>Tel: ${companyPhone}</div>` : ''}
              ${companyEmail ? `<div>${companyEmail}</div>` : ''}
            </div>
          </div>
          <div class="invoice-type">
            <div class="invoice-type-label">${isElectronic ? 'Factura Electrónica de Venta' : 'Factura de Venta'}</div>
            <div class="invoice-number">${invoice.prefix || 'FV'}-${invoice.number}</div>
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <div class="company-name">${companyName}</div>
            <div class="company-details">
              <div>NIT: ${companyNit}</div>
              <div>${companyRegime}</div>
              ${companyAddress ? `<div>${companyAddress}</div>` : ''}
              ${companyCity ? `<div>${companyCity}</div>` : ''}
              ${companyPhone ? `<div>Tel: ${companyPhone}</div>` : ''}
              ${companyEmail ? `<div>${companyEmail}</div>` : ''}
            </div>
          </div>
          <div class="invoice-title">
            <div class="invoice-label">${isElectronic ? 'Factura Electrónica' : 'Factura de Venta'}</div>
            <div class="invoice-number"># ${invoice.number || '------'}</div>
            ${resolutionNumber ? `
            <div class="resolution-text">
              Resolución DIAN No. ${resolutionNumber}<br/>
              ${resolutionValidUntil ? `Vigencia: ${resolutionValidUntil}<br/>` : ''}
              Rango del ${resolutionRangeFrom} al ${resolutionRangeTo}
            </div>
            ` : ''}
          </div>
        </div>

        <!-- Info Grid -->
        <div class="info-grid">
          <div class="info-column">
            <h3>Cliente</h3>
            <div class="customer-name">${invoice.customer.name}</div>
            <div class="info-text">
              ${invoice.customer.taxId ? `<div>NIT/CC: ${invoice.customer.taxId}</div>` : `<div>CONSUMIDOR FINAL</div>`}
              ${invoice.customer.phone ? `<div>Tel: ${invoice.customer.phone}</div>` : ''}
              ${invoice.customer.email ? `<div>Email: ${invoice.customer.email}</div>` : ''}
              ${invoice.customer.address ? `<div>Dir: ${invoice.customer.address}</div>` : ''}
            </div>
          </div>
          <div class="info-column" style="text-align: right;">
            <h3>Detalles</h3>
            <div class="info-text">
              <div class="info-row">
                <strong>Fecha Emisión:</strong> ${formatDateTime(invoice.issuedAt)}
              </div>
              ${invoice.dueDate ? `
              <div class="info-row">
                <strong>Vencimiento:</strong> ${formatDateTime(invoice.dueDate)}
              </div>
              ` : ''}
              <div class="info-row">
                <strong>Forma de Pago:</strong> ${paymentForm}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Items Table -->
        <table>
          <thead>
            <tr>
              <th>Descripción</th>
              <th width="10%" class="center">Cant.</th>
              <th width="15%" class="right">Precio Unit.</th>
              <th width="10%" class="center">Desc.</th>
              <th width="10%" class="center">IVA</th>
              <th width="15%" class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.items || []).map((item, index) => {
    const basePrice = item.unitPrice * item.quantity;
    const discountAmount = basePrice * ((item.discount || 0) / 100);
    const finalPrice = basePrice - discountAmount;

    return `
              <tr>
                <td>
                  <div class="item-name">${item.product?.name || 'Item'}</div>
                  ${item.product?.sku ? `<div class="item-sku">SKU: ${item.product.sku}</div>` : ''}
                </td>
                <td class="center">${item.quantity}</td>
                <td class="right">${formatCurrency(item.unitPrice)}</td>
                <td class="center">${item.discount > 0 ? `${item.discount}%` : '-'}</td>
                <td class="center">${item.taxRate > 0 ? `${item.taxRate}%` : '0%'}</td>
                <td class="right" style="font-weight: 600;">${formatCurrency(finalPrice)}</td>
              </tr>
              `
  }).join('')}
          </tbody>
        </table>
        
        <!-- Totals -->
        <div class="footer-section">
          <div class="payment-info"></div>
          <div class="totals-container">
            <div class="total-row">
              <span class="total-label">Subtotal</span>
              <span class="total-value">${formatCurrency((invoice.subtotal || 0) + (invoice.discount || 0))}</span>
            </div>
            ${(invoice.discount || 0) > 0 ? `
            <div class="total-row">
              <span class="total-label">Descuento</span>
              <span class="total-value">-${formatCurrency(invoice.discount || 0)}</span>
            </div>
            ` : ''}
            <div class="total-row">
              <span class="total-label">Base Gravable</span>
              <span class="total-value">${formatCurrency(invoice.subtotal || 0)}</span>
            </div>
            <div class="total-row">
              <span class="total-label">Total Impuestos</span>
              <span class="total-value">${formatCurrency(invoice.tax || 0)}</span>
            </div>
            
            <div class="tax-details">
              ${Array.from(taxByRate.entries()).map(([rate, data]) => `
              <div class="tax-row">
                <span>IVA ${rate}% (Base: ${formatCurrency(data.base)})</span>
                <span>${formatCurrency(data.tax)}</span>
              </div>
              `).join('')}
            </div>
            
            <div class="total-row final">
              <span>TOTAL A PAGAR</span>
              <span>${formatCurrency(invoice.total || 0)}</span>
            </div>
          </div>
        </div>
        
        <!-- Electronic Invoice Section -->
        ${isElectronic ? `
        <div class="electronic-section">
          <div class="electronic-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            Factura Electrónica Validada por la DIAN
          </div>
          <div style="margin-bottom: 10px; font-size: 9px; color: #1e3a8a;"><strong>CUFE:</strong></div>
          <div class="cufe-code">${invoice.cufe}</div>
          ${invoice.qrCode ? `
          <div class="qr-section">
            <span style="font-size: 9px; color: #1e3a8a;">Verificar en: </span>
            <a href="${invoice.qrCode}" style="font-size: 9px; color: #2563eb; word-break: break-all;">${invoice.qrCode}</a>
          </div>` : ''}
        </div>` : ''}
        
        <!-- Notes -->
        ${invoice.notes ? `
        <div class="notes-section">
          <div class="notes-title">Observaciones:</div>
          <div class="notes-content">${invoice.notes}</div>
        </div>` : ''}
        
        <!-- Footer -->
        <div class="footer">
          <div class="legal-text">
            <p>Esta factura se asimila en todos sus efectos legales a la letra de cambio según Art. 774 del Código de Comercio.</p>
            <p>Autorización de numeración de facturación según Resolución DIAN. Consulte la validez en www.dian.gov.co</p>
            <p style="margin-top: 8px;">
              ${process.env.GRAN_CONTRIBUYENTE === 'true' ? '✓ Grandes Contribuyentes' : 'No somos Grandes Contribuyentes'} | 
              ${process.env.AUTORETENEDOR === 'true' ? '✓ Autoretenedores' : 'No somos Autoretenedores'} |
              ${process.env.AGENTE_RETENEDOR_IVA === 'true' ? '✓ Agente Retenedor IVA' : ''}
            </p>
          </div>
          <div class="thank-you">¡Gracias por su compra!</div>
        </div>
      </div>
    </body>
    </html>
  `

  let browser: Browser | null = null
  try {
    // Configuración para Vercel (serverless)
    const isVercel = process.env.VERCEL === '1'
    let executablePath: string | undefined
    let chromiumArgs: string[] = []

    if (isVercel) {
      try {
        executablePath = await chromium.executablePath()
        chromiumArgs = chromium.args || []
      } catch (chromiumError: any) {
        console.error('Error getting chromium executable path:', chromiumError)
        throw new Error(`Error configurando Chromium para Vercel: ${chromiumError?.message || 'Error desconocido'}`)
      }
    }

    const args = isVercel
      ? [...chromiumArgs, '--hide-scrollbars', '--disable-web-security']
      : ['--no-sandbox', '--disable-setuid-sandbox']

    try {
      browser = await puppeteer.launch({
        headless: true,
        args,
        executablePath,
        timeout: 30000,
      })
    } catch (launchError: any) {
      console.error('Error launching Puppeteer:', launchError)
      throw new Error(`Error al iniciar Puppeteer: ${launchError?.message || 'Error desconocido'}`)
    }

    if (!browser) {
      throw new Error('Browser no se pudo inicializar')
    }

    try {
      const page = await browser.newPage()

      await Promise.race([
        page.setContent(html, { waitUntil: 'networkidle0' }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout al cargar contenido HTML')), 20000)
        )
      ])

      const pdf = await Promise.race([
        page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '10mm',
            right: '10mm',
            bottom: '10mm',
            left: '10mm',
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout al generar PDF')), 30000)
        )
      ])

      await browser.close()
      return Buffer.from(pdf)
    } catch (pageError: any) {
      if (browser) {
        await (browser as Browser).close().catch(() => { })
      }
      console.error('Error en proceso de generación de PDF:', pageError)
      throw new Error(`Error al generar PDF: ${pageError?.message || 'Error desconocido'}`)
    }
  } catch (error: any) {
    if (browser) {
      await (browser as Browser).close().catch(() => { })
    }
    console.error('Error general en generateInvoicePDF:', error)
    throw error
  }
}

