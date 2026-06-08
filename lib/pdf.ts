import puppeteer, { Browser } from 'puppeteer-core'
import { logger } from './logger'
import chromium from '@sparticuz/chromium'
import { formatCurrency, formatDate } from './utils'
import QRCode from 'qrcode'
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
    logo?: string
    commercialName?: string
    verificationDigit?: string
    fiscalResponsibilities?: string
    economicActivity?: string
    department?: string
    resolutionNumber?: string
    resolutionDate?: string
    resolutionRangeFrom?: string
    resolutionRangeTo?: string
    resolutionValidUntil?: string
  }
}

// Helper: convert number to Spanish words for Colombian pesos (SON field)
function numberToWordsCOP(n: number): string {
  const units = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
  const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
  const tens = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
  const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

  function chunk(num: number): string {
    if (num === 0) return ''
    if (num === 100) return 'cien'
    if (num < 10) return units[num]
    if (num < 20) return teens[num - 10]
    if (num < 30) return num === 20 ? 'veinte' : 'veinti' + units[num - 20]
    if (num < 100) {
      const t = Math.floor(num / 10)
      const u = num % 10
      return u === 0 ? tens[t] : tens[t] + ' y ' + units[u]
    }
    const h = Math.floor(num / 100)
    const rest = num % 100
    return hundreds[h] + (rest > 0 ? ' ' + chunk(rest) : '')
  }

  const intPart = Math.floor(Math.abs(n))
  const cents = Math.round((Math.abs(n) - intPart) * 100)

  if (intPart === 0) return 'cero pesos' + (cents > 0 ? ' con ' + chunk(cents) + ' centavos' : '')

  let result = ''
  if (intPart >= 1000000) {
    const millions = Math.floor(intPart / 1000000)
    result += (millions === 1 ? 'un millón' : chunk(millions) + ' millones')
    const rest = intPart % 1000000
    if (rest > 0) result += ' ' + convertThousands(rest)
  } else {
    result = convertThousands(intPart)
  }

  function convertThousands(num: number): string {
    if (num >= 1000) {
      const t = Math.floor(num / 1000)
      const rest = num % 1000
      return (t === 1 ? 'mil' : chunk(t) + ' mil') + (rest > 0 ? ' ' + chunk(rest) : '')
    }
    return chunk(num)
  }

  result += ' pesos'
  if (cents > 0) result += ' con ' + chunk(cents) + ' centavos'
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1)
}

// Helper: fetch a remote image URL and convert to base64 data URI for embedding in HTML
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    if (!url) return ''
    if (url.startsWith('data:')) return url
    // Try local filesystem first
    try {
      let localPath: string | null = null
      if (url.startsWith('/')) localPath = url
      else if (url.includes('localhost') || url.includes('127.0.0.1')) {
        const u = new URL(url); localPath = u.pathname
      }
      if (localPath) {
        const filePath2 = process.cwd() + '/public' + localPath
        if (fs.existsSync(filePath2)) {
          const buf = fs.readFileSync(filePath2)
          const ext = filePath2.split('.').pop()?.toLowerCase() || 'png'
          const mimeMap: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', gif: 'image/gif' }
          return 'data:' + (mimeMap[ext] || 'image/png') + ';base64,' + buf.toString('base64')
        }
      }
    } catch (_) {}
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!response.ok) { logger.warn('[PDF] Logo fetch failed: ' + response.status); return '' }
      const ct = response.headers.get('content-type') || 'image/png'
      const ab = await response.arrayBuffer()
      return 'data:' + ct + ';base64,' + Buffer.from(ab).toString('base64')
    } catch (e: any) { clearTimeout(timer); logger.warn('[PDF] Logo fetch error: ' + (e?.message || e)); return '' }
  } catch (e: any) { logger.warn('[PDF] fetchImageAsBase64 error: ' + (e?.message || e)); return '' }
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
  const rawLogo = invoice.company?.logo || ''
  // Convert logo URL to base64 data URI so Puppeteer renders it reliably
  const companyLogo = rawLogo ? await fetchImageAsBase64(rawLogo) : ''
  const companyCommercialName = invoice.company?.commercialName || companyName
  const companyVerificationDigit = invoice.company?.verificationDigit || ''
  const companyFiscalResponsibilities = invoice.company?.fiscalResponsibilities || 'NO SOMOS GRANDES CONTRIBUYENTES. NO SOMOS AUTORRETENEDORES.'
  const companyEconomicActivity = invoice.company?.economicActivity || ''
  const companyDepartment = invoice.company?.department || ''

  // DIAN Resolution info
  const resolutionNumber = invoice.company?.resolutionNumber || process.env.DIAN_RESOLUTION_NUMBER || ''
  const resolutionDate = invoice.company?.resolutionDate || process.env.DIAN_RESOLUTION_DATE || ''
  const resolutionRangeFrom = invoice.company?.resolutionRangeFrom || process.env.DIAN_RANGE_FROM || ''
  const resolutionRangeTo = invoice.company?.resolutionRangeTo || process.env.DIAN_RANGE_TO || ''
  const resolutionValidUntil = invoice.company?.resolutionValidUntil || process.env.DIAN_VALID_UNTIL || ''

  // Calculate payment form and method
  const isCredit = invoice.dueDate && invoice.issuedAt &&
    new Date(invoice.dueDate).getTime() > new Date(invoice.issuedAt).getTime()
  const paymentForm = isCredit ? 'Crédito' : 'Contado'

  // Payment method label (DIAN codes)
  const medioPago = (invoice as any).paymentMethod || 'Efectivo'

  // SON: total in words
  const totalInWords = numberToWordsCOP(invoice.total || 0)

  // IVA breakdown by rate - only rates > 0
  // item.subtotal = pre-tax base (unitPrice * qty * (1 - discount%))
  const taxByRate = new Map<number, { base: number; tax: number }>()
  for (const item of invoice.items || []) {
    const rate = typeof item.taxRate === 'number' ? item.taxRate : 0
    if (rate <= 0) continue
    const base = (typeof item.subtotal === 'number' && item.subtotal > 0)
      ? Math.round(item.subtotal * 100) / 100
      : Math.round((item.unitPrice || 0) * (item.quantity || 0) * (1 - (item.discount || 0) / 100) * 100) / 100
    const itemTax = Math.round(base * (rate / 100) * 100) / 100
    const prev = taxByRate.get(rate) || { base: 0, tax: 0 }
    taxByRate.set(rate, { base: prev.base + base, tax: prev.tax + itemTax })
  }

  const formatDateOnly = (date: Date | string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const formatTimeOnly = (date: Date | string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}-05:00`
  }

  const formatDateTime = (date: Date | string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  const isElectronic = !!invoice.cufe

  // Generate QR code as base64 data URI for reliable embedding
  let qrDataUri = ''
  if (isElectronic && invoice.cufe) {
    try {
      const dianUrl = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${invoice.cufe}`
      qrDataUri = await QRCode.toDataURL(dianUrl, {
        width: 120,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
    } catch (e) {
      // Fallback: no QR if generation fails
    }
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Factura ${invoice.number} - ${companyName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          line-height: 1.2;
          color: #000;
          font-size: 8px;
        }
        .page {
          padding: 15px 25px;
          max-width: 210mm;
          margin: 0 auto;
        }
        
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td { padding: 2px 6px; border: none; vertical-align: top; }
        .info-table .lbl { font-weight: 700; width: 80px; }
        .info-table .val { text-transform: uppercase; }

        .grid-table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
        .grid-table th { 
          border: 1px solid #000; 
          background: #e5e7eb; 
          font-weight: 700; 
          padding: 3px 2px; 
          text-align: center;
          font-size: 7.5px;
        }
        .grid-table td { 
          border: 1px solid #000; 
          padding: 3px 4px; 
          font-size: 8px;
        }
        .grid-table td.center { text-align: center; }
        .grid-table td.right { text-align: right; }

        .totals-table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
        .totals-table td { padding: 3px 6px; border: 1px solid #000; }
        .totals-table .lbl { font-weight: 700; background: #e5e7eb; width: 50%; }
        .totals-table .val { text-align: right; }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- HEADER -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <!-- Left: Logo & Company Name -->
          <div style="width: 45%; text-align: center; padding-top: 10px;">
            ${companyLogo
              ? `<img src="${companyLogo}" style="max-width: 160px; max-height: 70px; object-fit: contain; margin-bottom: 6px; display: block; margin-left: auto; margin-right: auto;" />`
              : `<div style="font-size: 16px; font-weight: 800; margin-bottom: 4px;">${companyCommercialName.toUpperCase()}</div>`
            }
            ${companyLogo ? `<div style="font-size: 10px; font-weight: 700; color: #444;">${companyCommercialName.toUpperCase()}</div>` : ''}
          </div>
          
          <!-- Right: Invoice Info -->
          <div style="width: 50%; font-size: 8px; text-align: left; padding-left: 20px;">
            <div style="font-size: 11px; font-weight: 700; margin-bottom: 8px;">
              ${isElectronic ? 'FACTURA ELECTRÓNICA DE VENTA' : 'FACTURA DE VENTA'} ${invoice.number}
            </div>
            <table style="width: 100%; border: none; margin: 0; padding: 0;">
              <tr><td style="border: none; padding: 1px 0; font-weight: 700;">Fecha de Exp.:</td><td style="border: none; padding: 1px 0;">${formatDateOnly(invoice.issuedAt)}</td></tr>
              <tr><td style="border: none; padding: 1px 0; font-weight: 700;">Hora de Exp.:</td><td style="border: none; padding: 1px 0;">${formatTimeOnly(invoice.issuedAt)}</td></tr>
              <tr><td style="border: none; padding: 1px 0; font-weight: 700;">Fecha de Ven.:</td><td style="border: none; padding: 1px 0;">${formatDateOnly(invoice.dueDate) || formatDateOnly(invoice.issuedAt)}</td></tr>
              <tr><td style="border: none; padding: 1px 0; font-weight: 700;">Fecha y hora de validación.:</td><td style="border: none; padding: 1px 0;">${formatDateTime(invoice.issuedAt)}</td></tr>
            </table>
          </div>
        </div>

        <!-- RESOLUTION & LEGAL TEXT -->
        <div style="font-size: 6.5px; line-height: 1.3; margin-bottom: 8px; display: flex; text-transform: uppercase;">
           <div style="width: 50%; text-align: center; font-weight: 600; padding-right: 10px;">
             ${companyFiscalResponsibilities}
           </div>
           <div style="width: 50%; padding-left: 10px;">
             ${resolutionNumber ? `N°. Resolución: ${resolutionNumber} válida desde el ${resolutionDate} hasta el ${resolutionValidUntil} rango desde ${resolutionRangeFrom} hasta ${resolutionRangeTo}` : ''}
           </div>
        </div>

        <!-- DATOS EMISOR / ADQUIRENTE -->
        <div style="display: flex; gap: 0; border: 2px solid #000; margin-bottom: 8px;">
           <div style="width: 50%; border-right: 2px solid #000;">
              <div style="background: #e5e7eb; border-bottom: 1px solid #000; padding: 2px 6px; font-weight: 700; font-size: 8px;">DATOS EMISOR</div>
              <table class="info-table">
                <tr><td class="lbl">Razón Social:</td><td class="val">${companyName}</td></tr>
                <tr><td class="lbl">NIT:</td><td class="val">${companyNit}${companyVerificationDigit ? ` - ${companyVerificationDigit}` : ''}</td></tr>
                <tr><td class="lbl">Actividad:</td><td class="val">${companyEconomicActivity || ''}</td></tr>
                <tr><td class="lbl">Dirección:</td><td class="val">${[companyDepartment, companyCity, companyAddress].filter(Boolean).join(' - ')}</td></tr>
                <tr><td class="lbl">Teléfono:</td><td class="val">${companyPhone}</td></tr>
                <tr><td class="lbl">E-mail:</td><td class="val" style="text-transform: none;">${companyEmail}</td></tr>
              </table>
           </div>
           <div style="width: 50%;">
              <div style="background: #e5e7eb; border-bottom: 1px solid #000; padding: 2px 6px; font-weight: 700; font-size: 8px;">DATOS ADQUIRENTE</div>
              <table class="info-table">
                <tr><td class="lbl">Razón Social:</td><td class="val">${invoice.customer.name}</td></tr>
                <tr><td class="lbl">NIT:</td><td class="val">${invoice.customer.taxId || ''}</td></tr>
                ${invoice.customer.phone ? `<tr><td class="lbl">Teléfono:</td><td class="val">${invoice.customer.phone}</td></tr>` : ''}
                ${invoice.customer.address ? `<tr><td class="lbl">Dirección:</td><td class="val">${invoice.customer.address}</td></tr>` : ''}
                ${invoice.customer.email ? `<tr><td class="lbl">E-mail:</td><td class="val" style="text-transform: none;">${invoice.customer.email}</td></tr>` : ''}
              </table>
           </div>
        </div>

        <!-- ORDEN ROW -->
        <table class="grid-table" style="margin-bottom: 8px;">
          <thead>
            <tr>
              <th style="width: 10%;">MONEDA</th>
              <th style="width: 10%;">No. LÍNEAS</th>
              <th style="width: 20%;">ORDEN DE COMPRA</th>
              <th style="width: 15%;">FECHA DE ORDEN</th>
              <th style="width: 15%;">MEDIO DE PAGO</th>
              <th style="width: 15%;">FORMA DE PAGO</th>
              <th style="width: 15%;">VALOR</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="center">COP</td>
              <td class="center">${invoice.items.length}</td>
              <td class="center"></td>
              <td class="center"></td>
              <td class="center">${medioPago}</td>
              <td class="center">${paymentForm}</td>
              <td class="right" style="font-weight: 700;">$ ${invoice.total || 0}</td>
            </tr>
          </tbody>
        </table>

        <!-- NOTAS -->
        <div style="border: 2px solid #000; margin-bottom: 8px;">
          <div style="background: #e5e7eb; border-bottom: 1px solid #000; padding: 2px 6px; font-weight: 700; font-size: 8px; text-align: center;">NOTAS</div>
          <div style="padding: 6px 10px; font-size: 8px; min-height: 18px;">
            ${invoice.notes || ''}
          </div>
        </div>

        <!-- ITEMS TABLE -->
        <table class="grid-table" style="margin-bottom: 8px;">
          <thead>
            <tr>
              <th rowspan="2" style="width: 3%;">#</th>
              <th rowspan="2" style="width: 6%;">CANT.</th>
              <th rowspan="2" style="width: 8%;">COD.</th>
              <th rowspan="2" style="width: 5%;">U.M</th>
              <th rowspan="2" style="width: 25%;">DESCRIPCIÓN</th>
              <th rowspan="2" style="width: 10%;">VALOR UNIT.</th>
              <th rowspan="2" style="width: 10%;">VALOR SIN IMP.</th>
              <th colspan="3" style="border-bottom: 1px solid #000;">IMPUESTOS</th>
              <th rowspan="2" style="width: 6%;">DCTO.</th>
              <th rowspan="2" style="width: 10%;">VALOR</th>
            </tr>
            <tr>
              <th style="font-size: 6px; width: 5%;">NOM.</th>
              <th style="font-size: 6px; width: 4%;">%</th>
              <th style="font-size: 6px; width: 8%;">VALOR IMP.</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map((item, idx) => {
              // lineBase = pre-tax amount. Use item.subtotal (stored pre-tax base) if available
              const lineBase = (typeof item.subtotal === 'number' && item.subtotal > 0)
                ? item.subtotal
                : item.unitPrice * item.quantity * (1 - (item.discount || 0) / 100)
              const lineTaxAmt = lineBase * ((item.taxRate || 0) / 100)
              // lineTotal = pre-tax base + tax (correct total per line)
              const lineTotal = lineBase + lineTaxAmt
              const taxName = item.taxRate === 8 ? 'INC' : (item.taxRate > 0 ? 'IVA' : '')
              return `
              <tr>
                <td class="center">${idx + 1}</td>
                <td class="center">${item.quantity.toFixed(1)}</td>
                <td class="center">${item.product.sku || ''}</td>
                <td class="center">94</td>
                <td>${item.product.name.toUpperCase()}</td>
                <td class="right">${item.unitPrice.toFixed(2)}</td>
                <td class="right">${lineBase.toFixed(2)}</td>
                <td class="center">${taxName}</td>
                <td class="center">${item.taxRate || 0}</td>
                <td class="right">$ ${lineTaxAmt.toFixed(2)}</td>
                <td class="right">${item.discount > 0 ? item.discount.toFixed(2) : '0.00'}</td>
                <td class="right">${lineTotal.toFixed(2)}</td>
              </tr>`
            }).join('')}
          </tbody>
        </table>

        <!-- TOTALES -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
           <div style="width: 45%;">
             ${taxByRate.size > 0 ? `
             <table class="grid-table">
               <thead>
                 <tr><th style="width: 30%;">TIPO</th><th style="width: 50%;">BASE IMP.</th><th style="width: 20%;">VALOR</th></tr>
               </thead>
               <tbody>
                 ${Array.from(taxByRate.entries()).map(([rate, data]) => `
                 <tr>
                   <td class="center" style="height: 15px;">${rate === 8 ? 'INC' : 'IVA'}</td>
                   <td class="right">$ ${data.base.toFixed(2)}</td>
                   <td class="right">$ ${data.tax.toFixed(2)}</td>
                 </tr>`).join('')}
               </tbody>
             </table>
             ` : ''}
           </div>
           <div style="width: 35%;">
             <table class="totals-table">
               <tr><td class="lbl">SubTotal</td><td class="val">$ ${(invoice.subtotal || 0).toFixed(2)}</td></tr>
               <tr><td class="lbl">Total Imp.</td><td class="val">$ ${(invoice.tax || 0).toFixed(2)}</td></tr>
               <tr><td class="lbl" style="font-weight: normal;">Retiva</td><td class="val">$ 0.00</td></tr>
               <tr><td class="lbl" style="font-weight: normal;">Reteica</td><td class="val">$ 0.00</td></tr>
               <tr><td class="lbl" style="font-weight: normal;">ReteRenta</td><td class="val">$ 0.00</td></tr>
               <tr><td class="lbl">Cargos</td><td class="val">$ 0.00</td></tr>
               <tr><td class="lbl">Descuentos</td><td class="val">$ ${(invoice.discount || 0).toFixed(2)}</td></tr>
               <tr><td class="lbl">Valor Total</td><td class="val" style="font-weight: 700;">$ ${(invoice.total || 0).toFixed(2)}</td></tr>
             </table>
           </div>
        </div>

        <!-- TASA REPRESENTATIVA (Optional footer) -->
        <table class="grid-table" style="margin-bottom: 12px; width: 60%;">
          <thead>
            <tr>
              <th>MONEDA</th>
              <th>TASA REPRESENTATIVA</th>
              <th>VALOR FACTURA</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="center" style="height: 12px;">COP</td>
              <td class="center">1.00</td>
              <td class="center">$ ${(invoice.total || 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <!-- FIRMA / CUFE Section -->
        ${isElectronic ? `
        <div style="display: flex; gap: 10px; align-items: flex-end;">
          <div style="flex-shrink: 0;">
            ${qrDataUri ? `<img src="${qrDataUri}" alt="QR DIAN" style="width: 90px; height: 90px;" />` : ''}
          </div>
          <div style="flex: 1; padding-bottom: 5px;">
            <div style="font-size: 6px; color: #4b5563; word-break: break-all; margin-bottom: 8px; line-height: 1.2;">
              <strong>FIRMA:</strong> (HASH DE LA FIRMA DIGITAL DEL PROVEEDOR TECNOLÓGICO)
            </div>
            <div style="font-size: 7.5px;">
              <strong>CUFE</strong> <span style="font-family: monospace;">${invoice.cufe}</span>
            </div>
          </div>
          <div style="font-size: 7px; padding-bottom: 5px;">
            1/1
          </div>
        </div>
        ` : ''}

        <!-- LEGAL FOOTER -->
        <div style="text-align: center; margin-top: 15px; font-size: 7px; color: #374151;">
          Factura elaborada y enviada por el proveedor tecnológico a través del software de facturación electrónica.
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
        logger.error('Error getting chromium executable path:', chromiumError)
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
      logger.error('Error launching Puppeteer:', launchError)
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
      logger.error('Error en proceso de generación de PDF:', pageError)
      throw new Error(`Error al generar PDF: ${pageError?.message || 'Error desconocido'}`)
    }
  } catch (error: any) {
    if (browser) {
      await (browser as Browser).close().catch(() => { })
    }
    logger.error('Error general en generateInvoicePDF:', error)
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
    logger.error('Error general en generatePayslipPDF:', error)
    throw error
  }
}
