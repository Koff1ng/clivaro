import puppeteer, { Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { formatCurrency, formatDate } from './utils'
import fs from 'fs'

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
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', 'Segoe UI', sans-serif;
          background: #ffffff;
          color: #1a1a2e;
          font-size: 11px;
          line-height: 1.5;
        }
        .page { max-width: 210mm; margin: 0 auto; padding: 0; }

        /* ---- TOP HEADER BAR ---- */
        .header-band {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          padding: 32px 40px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .company-block .company-name {
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }
        .company-block .company-meta {
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.7;
        }
        .doc-block {
          text-align: right;
        }
        .doc-block .doc-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .doc-block .doc-number {
          font-size: 28px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -1px;
        }
        .doc-block .doc-date {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 6px;
        }
        .doc-block .validity-tag {
          display: inline-block;
          margin-top: 8px;
          background: #1d4ed8;
          color: white;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        /* ---- BODY ---- */
        .body-content {
          padding: 32px 40px;
        }

        /* ---- INFO GRID ---- */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 28px;
        }
        .info-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        .info-card-header {
          background: #f8fafc;
          padding: 8px 16px;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #64748b;
          border-bottom: 1px solid #e2e8f0;
        }
        .info-card-body {
          padding: 14px 16px;
        }
        .info-card-body .client-name {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .info-row:last-child { border-bottom: none; }
        .info-row .lbl { color: #64748b; font-size: 10px; }
        .info-row .val { color: #1e293b; font-weight: 600; font-size: 10px; text-align: right; }

        /* ---- ITEMS TABLE ---- */
        .section-title {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #64748b;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 2px solid #e2e8f0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        thead tr {
          background: #0f172a;
        }
        th {
          padding: 10px 12px;
          text-align: left;
          font-size: 9px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        th.r { text-align: right; }
        th.c { text-align: center; }
        tbody tr { border-bottom: 1px solid #f1f5f9; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        td { padding: 10px 12px; vertical-align: top; }
        td.r { text-align: right; }
        td.c { text-align: center; }
        .prod-name { font-weight: 600; color: #0f172a; font-size: 11px; }
        .prod-sku { font-size: 9px; color: #94a3b8; margin-top: 2px; font-family: monospace; }

        /* ---- TOTALS ---- */
        .totals-wrapper {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
          margin-bottom: 28px;
        }
        .totals-box {
          width: 260px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        .totals-box .t-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 14px;
          font-size: 11px;
          border-bottom: 1px solid #f1f5f9;
        }
        .totals-box .t-row:last-child { border-bottom: none; }
        .totals-box .t-row .t-lbl { color: #64748b; }
        .totals-box .t-row .t-val { font-weight: 600; color: #0f172a; }
        .totals-box .t-row.total {
          background: #0f172a;
          padding: 12px 14px;
        }
        .totals-box .t-row.total .t-lbl {
          color: #94a3b8;
          font-weight: 700;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .totals-box .t-row.total .t-val {
          font-size: 15px;
          font-weight: 800;
          color: #ffffff;
        }

        /* ---- NOTES ---- */
        .notes-block {
          border-left: 3px solid #1d4ed8;
          padding: 12px 16px;
          background: #eff6ff;
          border-radius: 0 6px 6px 0;
          margin-bottom: 28px;
        }
        .notes-block .notes-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #1d4ed8;
          margin-bottom: 5px;
        }
        .notes-block p { font-size: 10px; color: #1e40af; }

        /* ---- FOOTER ---- */
        .footer {
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          padding: 16px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .footer-left {
          font-size: 9px;
          color: #94a3b8;
          line-height: 1.6;
        }
        .footer-right {
          font-size: 9px;
          color: #94a3b8;
          text-align: right;
        }
        .footer-right strong { color: #64748b; }
      </style>
    </head>
    <body>
      <div class="page">

        <!-- HEADER BAND -->
        <div class="header-band">
          <div class="company-block">
            <div class="company-name">${companyName}</div>
            <div class="company-meta">
              ${companyNit ? `NIT: ${companyNit}<br>` : ''}
              ${companyAddress ? `${companyAddress}<br>` : ''}
              ${companyPhone ? `Tel. ${companyPhone}<br>` : ''}
              ${companyEmail ? `${companyEmail}` : ''}
            </div>
          </div>
          <div class="doc-block">
            <div class="doc-label">Cotización de Venta</div>
            <div class="doc-number">${quotation.number}</div>
            <div class="doc-date">Fecha: ${formatDate(quotation.createdAt)}</div>
            ${quotation.validUntil ? `<div class="validity-tag">Válida hasta: ${formatDate(quotation.validUntil)}</div>` : ''}
          </div>
        </div>

        <div class="body-content">

          <!-- INFO GRID -->
          <div class="info-grid">
            <div class="info-card">
              <div class="info-card-header">Información del Cliente</div>
              <div class="info-card-body">
                <div class="client-name">${quotation.customer.name}</div>
                ${quotation.customer.taxId ? `<div class="info-row"><span class="lbl">NIT / CC</span><span class="val">${quotation.customer.taxId}</span></div>` : ''}
                ${quotation.customer.email ? `<div class="info-row"><span class="lbl">Email</span><span class="val">${quotation.customer.email}</span></div>` : ''}
                ${quotation.customer.phone ? `<div class="info-row"><span class="lbl">Teléfono</span><span class="val">${quotation.customer.phone}</span></div>` : ''}
                ${quotation.customer.address ? `<div class="info-row"><span class="lbl">Dirección</span><span class="val">${quotation.customer.address}</span></div>` : ''}
              </div>
            </div>
            <div class="info-card">
              <div class="info-card-header">Resumen del Documento</div>
              <div class="info-card-body">
                <div class="info-row"><span class="lbl">No. de Cotización</span><span class="val">${quotation.number}</span></div>
                <div class="info-row"><span class="lbl">Fecha de Emisión</span><span class="val">${formatDate(quotation.createdAt)}</span></div>
                ${quotation.validUntil ? `<div class="info-row"><span class="lbl">Válida Hasta</span><span class="val">${formatDate(quotation.validUntil)}</span></div>` : ''}
                <div class="info-row"><span class="lbl">Total a Pagar</span><span class="val" style="color:#1d4ed8;font-size:12px;">${formatCurrency(quotation.total || 0)}</span></div>
              </div>
            </div>
          </div>

          <!-- ITEMS TABLE -->
          <div class="section-title">Detalle de Productos / Servicios</div>
          <table>
            <thead>
              <tr>
                <th style="width:40%">Descripción</th>
                <th class="c" style="width:10%">Cant.</th>
                <th class="r" style="width:15%">V. Unit.</th>
                <th class="c" style="width:10%">Dcto.</th>
                <th class="r" style="width:15%">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${quotation.items.map(item => `
                <tr>
                  <td>
                    <div class="prod-name">${item.product.name}</div>
                    ${item.product.sku ? `<div class="prod-sku">SKU: ${item.product.sku}</div>` : ''}
                    ${(item as any).variant ? `<div class="prod-sku">Variante: ${(item as any).variant.name}</div>` : ''}
                  </td>
                  <td class="c">${item.quantity}</td>
                  <td class="r">${formatCurrency(item.unitPrice)}</td>
                  <td class="c">${item.discount > 0 ? item.discount + '%' : '—'}</td>
                  <td class="r" style="font-weight:600;">${formatCurrency(item.subtotal)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- TOTALS -->
          <div class="totals-wrapper">
            <div class="totals-box">
              <div class="t-row">
                <span class="t-lbl">Subtotal bruto</span>
                <span class="t-val">${formatCurrency((quotation.subtotal || 0) + (quotation.discount || 0))}</span>
              </div>
              ${(quotation.discount || 0) > 0 ? `
              <div class="t-row">
                <span class="t-lbl">(-) Descuentos</span>
                <span class="t-val" style="color:#dc2626;">-${formatCurrency(quotation.discount || 0)}</span>
              </div>` : ''}
              <div class="t-row">
                <span class="t-lbl">IVA</span>
                <span class="t-val">${formatCurrency(quotation.tax || 0)}</span>
              </div>
              <div class="t-row total">
                <span class="t-lbl">Total</span>
                <span class="t-val">${formatCurrency(quotation.total || 0)}</span>
              </div>
            </div>
          </div>

          ${quotation.notes ? `
          <div class="notes-block">
            <div class="notes-label">Notas y Condiciones</div>
            <p>${quotation.notes}</p>
          </div>` : ''}

        </div><!-- /body-content -->

        <!-- FOOTER -->
        <div class="footer">
          <div class="footer-left">
            © ${new Date().getFullYear()} ${companyName}. Documento generado electrónicamente.<br>
            Esta cotización es válida exclusivamente por el período indicado y no constituye un acuerdo vinculante.
          </div>
          <div class="footer-right">
            <strong>${companyName}</strong><br>
            ${companyNit ? `NIT: ${companyNit}` : ''}
          </div>
        </div>

      </div><!-- /page -->
    </body>
    </html>
  `

  let browser
  try {
    // Configuración para Vercel (serverless) vs Local
    const isVercel = process.env.VERCEL === '1'
    let executablePath = isVercel ? await chromium.executablePath() : undefined

    // Si no es Vercel y no hay ruta, intentar detectar navegadores comunes en Windows
    if (!isVercel && !executablePath) {
      const commonPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
      for (const p of commonPaths) {
        if (fs.existsSync(p)) {
          executablePath = p
          break
        }
      }
    }

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
      <title>Factura ${invoice.number} - ${companyName}</title>
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
            <div class="invoice-number">${invoice.number}</div>
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
                  <span>${formatCurrency((invoice.items || []).reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0))}</span>
                </div>
                ${(invoice.items || []).reduce((sum, it) => sum + ((it.unitPrice * it.quantity) - it.subtotal), 0) + (invoice.discount || 0) > 0 ? `
                <div class="totals-row" style="color: #dc2626;">
                  <span>(-) Descuentos:</span>
                  <span>${formatCurrency((invoice.items || []).reduce((sum, it) => sum + ((it.unitPrice * it.quantity) - it.subtotal), 0) + (invoice.discount || 0))}</span>
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
          <div class="qr-section">
            <img src="https://chart.googleapis.com/chart?cht=qr&chs=120x120&chl=${encodeURIComponent(invoice.cufe || invoice.qrCode || '')}" alt="QR" style="width: 120px; height: 120px;" />
            <div style="flex: 1;">
              <div style="font-size: 9px; color: #1e3a8a; margin-bottom: 4px;"><strong>Verificar en:</strong></div>
              <div style="font-size: 8px; color: #2563eb; word-break: break-all;">https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${invoice.cufe}</div>
            </div>
          </div>
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

export interface PayslipPDFData {
  company: {
    name: string
    nit: string
  }
  employee: {
    name: string
    documentNumber: string
    jobTitle?: string
    email?: string
    bankName?: string
    bankAccountType?: string
    bankAccountNumber?: string
    healthEntity?: string
    pensionEntity?: string
    paymentMethod?: string
  }
  payslip: {
    number: string
    cune?: string
    periodStartDate: Date
    periodEndDate: Date
    settlementDate: Date
    baseSalary: number
    netPay: number
  }
  earnings: Array<{
    concept: string
    amount: number
  }>
  deductions: Array<{
    concept: string
    amount: number
  }>
  totalEarnings: number
  totalDeductions: number
}

export async function generatePayslipPDF(data: PayslipPDFData): Promise<Buffer> {
  // Use a fallback empty string for environment variables if not set
  const companyName = process.env.COMPANY_NAME || data.company.name || 'Ferretería'
  const companyNit = process.env.COMPANY_NIT || data.company.nit || ''

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          line-height: 1.4;
          color: #1f2937;
          font-size: 11px;
          padding: 20px;
        }
        .container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          background: white;
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #1e3a8a;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        .header-left {
          width: 60%;
        }
        .header-right {
          width: 35%;
          text-align: right;
        }
        h1 {
          font-size: 18px;
          color: #1e3a8a;
          margin-bottom: 5px;
        }
        h2 {
          font-size: 14px;
          color: #374151;
          margin-bottom: 5px;
        }
        .box {
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 10px;
          margin-bottom: 15px;
        }
        .box-title {
          font-weight: bold;
          font-size: 12px;
          color: #1e3a8a;
          margin-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 3px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
        }
        .field {
          margin-bottom: 4px;
        }
        .label {
          font-weight: bold;
          color: #6b7280;
          font-size: 10px;
        }
        .value {
          font-size: 11px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 6px 8px;
          text-align: left;
        }
        th {
          background-color: #f3f4f6;
          color: #374151;
          font-weight: bold;
          font-size: 10px;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .totals-box {
          width: 300px;
          float: right;
          border: 1px solid #1e3a8a;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        .totals-row:last-child {
          border-bottom: none;
          background-color: #f0fdf4;
          font-weight: bold;
          color: #166534;
          font-size: 13px;
        }
        .totals-label {
          font-weight: bold;
        }
        .clearfix::after {
          content: "";
          clear: both;
          display: table;
        }
        .footer {
          margin-top: 30px;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
          text-align: center;
          font-size: 9px;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="header-left">
            <h1>Documento Soporte de Pago de Nómina Electrónica</h1>
            <div class="field"><span class="label">EMPRESA:</span> <span class="value">${companyName}</span></div>
            <div class="field"><span class="label">NIT:</span> <span class="value">${companyNit}</span></div>
          </div>
          <div class="header-right">
            <h2>Comprobante N° ${data.payslip.number}</h2>
            ${data.payslip.cune ? `
            <div class="field" style="margin-top: 8px;">
              <div class="label" style="font-size: 8px;">CUNE:</div>
              <div class="value" style="font-size: 8px; word-break: break-all;">${data.payslip.cune}</div>
            </div>` : ''}
          </div>
        </div>

        <div class="grid-2">
          <!-- Employee Info -->
          <div class="box">
            <div class="box-title">Información del Empleado</div>
            <div class="field"><span class="label">Nombre:</span> <span class="value">${data.employee.name}</span></div>
            <div class="field"><span class="label">Documento:</span> <span class="value">${data.employee.documentNumber}</span></div>
            <div class="field"><span class="label">Cargo:</span> <span class="value">${data.employee.jobTitle || 'No registrado'}</span></div>
            <div class="field"><span class="label">Salario Base:</span> <span class="value">${formatCurrency(data.payslip.baseSalary)}</span></div>
          </div>

          <!-- Period Details -->
          <div class="box">
            <div class="box-title">Detalles del Período y Pago</div>
            <div class="field"><span class="label">Fecha Liquidación:</span> <span class="value">${formatDate(data.payslip.settlementDate)}</span></div>
            <div class="field"><span class="label">Período Inicio:</span> <span class="value">${formatDate(data.payslip.periodStartDate)}</span></div>
            <div class="field"><span class="label">Período Fin:</span> <span class="value">${formatDate(data.payslip.periodEndDate)}</span></div>
            <div class="field"><span class="label">Método Pago:</span> <span class="value">${data.employee.paymentMethod || 'Efectivo'}</span></div>
            ${data.employee.bankName ? `<div class="field"><span class="label">Banco:</span> <span class="value">${data.employee.bankName} - ${data.employee.bankAccountType || ''} ${data.employee.bankAccountNumber || ''}</span></div>` : ''}
          </div>
        </div>

        <div class="grid-2">
           <!-- Social Security Info -->
           <div class="box">
            <div class="box-title">Entidades de Seguridad Social</div>
            <div class="field"><span class="label">Salud (EPS):</span> <span class="value">${data.employee.healthEntity || 'No registrado'}</span></div>
            <div class="field"><span class="label">Pensión (AFP):</span> <span class="value">${data.employee.pensionEntity || 'No registrado'}</span></div>
          </div>
        </div>

        <!-- Devengos y Deducciones -->
        <div class="box">
          <div class="box-title">Liquidación Detallada</div>
          <div class="grid-2">
            
            <!-- Earnings Table -->
            <div>
              <table>
                <thead>
                  <tr>
                    <th>Concepto Devengo (+)</th>
                    <th class="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.earnings.length > 0 ? data.earnings.map(e => `
                  <tr>
                    <td>${e.concept}</td>
                    <td class="text-right">${formatCurrency(e.amount)}</td>
                  </tr>
                  `).join('') : `
                  <tr>
                    <td colspan="2" class="text-center" style="color:#9ca3af; font-style:italic;">No hay devengos adicionales</td>
                  </tr>`}
                </tbody>
              </table>
            </div>

            <!-- Deductions Table -->
            <div>
              <table>
                <thead>
                  <tr>
                    <th>Concepto Deducción (-)</th>
                    <th class="text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.deductions.length > 0 ? data.deductions.map(d => `
                  <tr>
                    <td>${d.concept}</td>
                    <td class="text-right">${formatCurrency(d.amount)}</td>
                  </tr>
                  `).join('') : `
                   <tr>
                    <td colspan="2" class="text-center" style="color:#9ca3af; font-style:italic;">No hay deducciones</td>
                  </tr>`}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        <!-- Totals -->
        <div class="clearfix">
          <div class="totals-box">
            <div class="totals-row">
              <span class="totals-label">Total Devengado:</span>
              <span>${formatCurrency(data.totalEarnings)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label">Total Deducido:</span>
              <span style="color: #dc2626;">- ${formatCurrency(data.totalDeductions)}</span>
            </div>
            <div class="totals-row">
              <span class="totals-label">NETO A PAGAR:</span>
              <span>${formatCurrency(data.payslip.netPay)}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>Este documento es la representación gráfica del Documento Soporte de Pago de Nómina Electrónica conforme al anexo técnico de la DIAN.</p>
          <p>Generado automáticamente a través de la plataforma administrativa.</p>
        </div>
      </div>
    </body>
    </html>
  `

  let browser: Browser | null = null
  try {
    const isVercel = process.env.VERCEL === '1'
    let executablePath: string | undefined
    let chromiumArgs: string[] = []

    if (isVercel) {
      try {
        executablePath = await chromium.executablePath()
        chromiumArgs = chromium.args || []
      } catch (chromiumError: any) {
        throw new Error(`Error configurando Chromium para Vercel: ${chromiumError?.message || 'Error desconocido'}`)
      }
    }

    const args = isVercel
      ? [...chromiumArgs, '--hide-scrollbars', '--disable-web-security']
      : ['--no-sandbox', '--disable-setuid-sandbox']

    browser = await puppeteer.launch({
      headless: true,
      args,
      executablePath,
      timeout: 30000,
    })

    if (!browser) {
      throw new Error('Browser no se pudo inicializar')
    }

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
          top: '15mm',
          right: '15mm',
          bottom: '15mm',
          left: '15mm',
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout al generar PDF')), 30000)
      )
    ])

    await browser.close()
    return Buffer.from(pdf)
  } catch (error: any) {
    if (browser) {
      await (browser as Browser).close().catch(() => { })
    }
    console.error('Error general en generatePayslipPDF:', error)
    throw error
  }
}
