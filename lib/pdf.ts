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
  company?: {
    name?: string
    address?: string
    city?: string
    phone?: string
    email?: string
    nit?: string
    regime?: string
  }
}

export async function generateInvoicePDF(invoice: InvoicePDFData): Promise<Buffer> {
  // Company information from arguments or environment
  const companyName = invoice.company?.name || process.env.COMPANY_NAME || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Empresa'
  const companyAddress = invoice.company?.address || process.env.COMPANY_ADDRESS || process.env.NEXT_PUBLIC_COMPANY_ADDRESS || ''
  const companyCity = invoice.company?.city || process.env.COMPANY_CITY || process.env.NEXT_PUBLIC_COMPANY_CITY || ''
  const companyPhone = invoice.company?.phone || process.env.COMPANY_PHONE || process.env.NEXT_PUBLIC_COMPANY_PHONE || ''
  const companyEmail = invoice.company?.email || process.env.COMPANY_EMAIL || process.env.NEXT_PUBLIC_COMPANY_EMAIL || ''
  const companyNit = invoice.company?.nit || process.env.COMPANY_NIT || process.env.NEXT_PUBLIC_COMPANY_TAX_ID || ''
  const companyRegime = invoice.company?.regime || process.env.COMPANY_REGIME || 'Responsable de IVA'

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
      <title>Factura ${invoice.prefix || ''}${invoice.number} - ${companyName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.5;
          color: #1e293b;
          font-size: 11px;
        }
        .page {
          padding: 30px 40px;
          max-width: 210mm;
          margin: 0 auto;
        }
        
        /* Header */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 3px solid #1e40af;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .company-info {
          flex: 1;
        }
        .company-name {
          font-size: 22px;
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 8px;
        }
        .company-details {
          font-size: 10px;
          color: #475569;
          line-height: 1.6;
        }
        .company-details div {
          margin: 2px 0;
        }
        .invoice-type {
          text-align: right;
          min-width: 200px;
        }
        .invoice-type-label {
          font-size: 14px;
          font-weight: 700;
          color: #1e40af;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .invoice-number {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
        }
        .resolution-info {
          font-size: 9px;
          color: #64748b;
          margin-top: 10px;
          text-align: right;
          line-height: 1.5;
        }
        
        /* Info Grid */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }
        .info-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 15px;
        }
        .info-box-title {
          font-size: 10px;
          font-weight: 700;
          color: #1e40af;
          text-transform: uppercase;
          margin-bottom: 10px;
          padding-bottom: 5px;
          border-bottom: 2px solid #1e40af;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          font-size: 10px;
        }
        .info-label {
          color: #64748b;
          font-weight: 500;
        }
        .info-value {
          color: #0f172a;
          font-weight: 600;
          text-align: right;
        }
        .customer-name {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
        }
        
        /* Table */
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 10px;
        }
        thead tr {
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
        }
        th {
          color: white;
          padding: 10px 8px;
          text-align: left;
          font-weight: 600;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        th.right { text-align: right; }
        th.center { text-align: center; }
        td {
          padding: 10px 8px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
        }
        td.right { text-align: right; }
        td.center { text-align: center; }
        tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .product-name {
          font-weight: 600;
          color: #0f172a;
        }
        .product-sku {
          font-size: 9px;
          color: #64748b;
          margin-top: 2px;
        }
        
        /* Totals */
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-top: 10px;
        }
        .totals-box {
          width: 280px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 15px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          font-size: 11px;
        }
        .totals-row.subtotal {
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 8px;
          margin-bottom: 5px;
        }
        .tax-breakdown {
          background: #eff6ff;
          border-radius: 6px;
          padding: 8px;
          margin: 8px 0;
        }
        .tax-row {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #475569;
          padding: 2px 0;
        }
        .totals-row.total {
          font-size: 16px;
          font-weight: 700;
          color: #1e40af;
          border-top: 2px solid #1e40af;
          padding-top: 10px;
          margin-top: 8px;
        }
        
        /* Electronic Invoice Info */
        .electronic-section {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1px solid #93c5fd;
          border-radius: 8px;
          padding: 15px;
          margin-top: 20px;
        }
        .electronic-title {
          font-size: 11px;
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .cufe-code {
          font-family: 'Courier New', monospace;
          font-size: 8px;
          word-break: break-all;
          background: white;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #bfdbfe;
          color: #1e3a8a;
        }
        .qr-section {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
        }
        
        /* Footer */
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #e2e8f0;
        }
        .legal-text {
          font-size: 8px;
          color: #64748b;
          text-align: center;
          line-height: 1.6;
        }
        .legal-text p {
          margin: 3px 0;
        }
        .thank-you {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          font-weight: 600;
          color: #1e40af;
        }
        
        /* Notes */
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
            ${resolutionNumber ? `
            <div class="resolution-info">
              <div>Res. DIAN No. ${resolutionNumber}</div>
              ${resolutionDate ? `<div>Fecha: ${resolutionDate}</div>` : ''}
              ${resolutionRangeFrom && resolutionRangeTo ? `<div>Rango: ${resolutionRangeFrom} - ${resolutionRangeTo}</div>` : ''}
              ${resolutionValidUntil ? `<div>Vigente hasta: ${resolutionValidUntil}</div>` : ''}
            </div>
            ` : ''}
          </div>
        </div>
        
        <!-- Info Grid -->
        <div class="info-grid">
          <!-- Customer Info -->
          <div class="info-box">
            <div class="info-box-title">Adquirente / Cliente</div>
            <div class="customer-name">${invoice.customer.name}</div>
            ${invoice.customer.taxId ? `
            <div class="info-row">
              <span class="info-label">NIT/CC:</span>
              <span class="info-value">${invoice.customer.taxId}</span>
            </div>` : `
            <div class="info-row">
              <span class="info-label">Identificación:</span>
              <span class="info-value">CONSUMIDOR FINAL</span>
            </div>`}
            ${invoice.customer.address ? `
            <div class="info-row">
              <span class="info-label">Dirección:</span>
              <span class="info-value">${invoice.customer.address}</span>
            </div>` : ''}
            ${invoice.customer.phone ? `
            <div class="info-row">
              <span class="info-label">Teléfono:</span>
              <span class="info-value">${invoice.customer.phone}</span>
            </div>` : ''}
            ${invoice.customer.email ? `
            <div class="info-row">
              <span class="info-label">Email:</span>
              <span class="info-value">${invoice.customer.email}</span>
            </div>` : ''}
          </div>
          
          <!-- Document Info -->
          <div class="info-box">
            <div class="info-box-title">Información del Documento</div>
            <div class="info-row">
              <span class="info-label">Fecha Emisión:</span>
              <span class="info-value">${formatDateTime(invoice.issuedAt)}</span>
            </div>
            ${invoice.dueDate ? `
            <div class="info-row">
              <span class="info-label">Fecha Vencimiento:</span>
              <span class="info-value">${formatDateTime(invoice.dueDate)}</span>
            </div>` : ''}
            <div class="info-row">
              <span class="info-label">Forma de Pago:</span>
              <span class="info-value">${paymentForm}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Estado:</span>
              <span class="info-value">
                <span class="status-badge ${invoice.status === 'PAGADA' || invoice.status === 'PAID' ? 'status-paid' : invoice.status === 'ANULADA' || invoice.status === 'VOID' ? 'status-void' : 'status-pending'}">
                  ${invoice.status === 'PAGADA' || invoice.status === 'PAID' ? 'PAGADA' :
      invoice.status === 'ANULADA' || invoice.status === 'VOID' ? 'ANULADA' :
        invoice.status === 'EMITIDA' ? 'EMITIDA' : invoice.status}
                </span>
              </span>
            </div>
            ${invoice.paidAt ? `
            <div class="info-row">
              <span class="info-label">Fecha Pago:</span>
              <span class="info-value">${formatDateTime(invoice.paidAt)}</span>
            </div>` : ''}
          </div>
        </div>
        
        <!-- Items Table -->
        <table>
          <thead>
            <tr>
              <th style="width: 15%;">Código</th>
              <th style="width: 35%;">Descripción</th>
              <th class="center" style="width: 10%;">Cant.</th>
              <th class="right" style="width: 12%;">V. Unit.</th>
              <th class="center" style="width: 8%;">Dcto</th>
              <th class="center" style="width: 8%;">IVA</th>
              <th class="right" style="width: 12%;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map(item => `
              <tr>
                <td><span style="font-family: monospace; font-size: 9px;">${item.product.sku || '-'}</span></td>
                <td>
                  <div class="product-name">${item.product.name}</div>
                  ${item.variant ? `<div class="product-sku">Variante: ${item.variant.name}</div>` : ''}
                </td>
                <td class="center">${item.quantity}</td>
                <td class="right">${formatCurrency(item.unitPrice)}</td>
                <td class="center">${item.discount > 0 ? item.discount + '%' : '-'}</td>
                <td class="center">${item.taxRate}%</td>
                <td class="right" style="font-weight: 600;">${formatCurrency(item.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <!-- Totals -->
        <div class="totals-section">
          <div class="totals-box">
            <div class="totals-row subtotal">
              <span>Subtotal Bruto:</span>
              <span>${formatCurrency((invoice.subtotal || 0) + (invoice.discount || 0))}</span>
            </div>
            ${(invoice.discount || 0) > 0 ? `
            <div class="totals-row" style="color: #dc2626;">
              <span>(-) Descuentos:</span>
              <span>${formatCurrency(invoice.discount || 0)}</span>
            </div>` : ''}
            <div class="totals-row">
              <span>Base Gravable:</span>
              <span>${formatCurrency(invoice.subtotal || 0)}</span>
            </div>
            
            <!-- Tax Breakdown -->
            ${taxByRate.size > 0 ? `
            <div class="tax-breakdown">
              <div style="font-size: 9px; font-weight: 600; color: #1e40af; margin-bottom: 5px;">Discriminación IVA:</div>
              ${Array.from(taxByRate.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([rate, v]) => `
                <div class="tax-row">
                  <span>IVA ${rate}% (Base: ${formatCurrency(v.base)})</span>
                  <span>${formatCurrency(v.tax)}</span>
                </div>
              `).join('')}
            </div>` : ''}
            
            <div class="totals-row">
              <span>Total IVA:</span>
              <span>${formatCurrency(invoice.tax || 0)}</span>
            </div>
            <div class="totals-row total">
              <span>TOTAL A PAGAR (COP):</span>
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

