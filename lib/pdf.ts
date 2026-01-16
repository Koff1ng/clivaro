import puppeteer from 'puppeteer-core'
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
  const companyName = process.env.COMPANY_NAME || process.env.NEXT_PUBLIC_COMPANY_NAME || 'Ferretería'
  const companyAddress = process.env.COMPANY_ADDRESS || process.env.NEXT_PUBLIC_COMPANY_ADDRESS || ''
  const companyPhone = process.env.COMPANY_PHONE || process.env.NEXT_PUBLIC_COMPANY_PHONE || ''
  const companyEmail = process.env.COMPANY_EMAIL || process.env.NEXT_PUBLIC_COMPANY_EMAIL || ''
  const companyNit = process.env.COMPANY_NIT || process.env.NEXT_PUBLIC_COMPANY_TAX_ID || ''

  let browser
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
        timeout: 30000, // 30 segundos timeout
      })
    } catch (launchError: any) {
      console.error('Error launching Puppeteer:', launchError)
      throw new Error(`Error al iniciar Puppeteer: ${launchError?.message || 'Error desconocido'}`)
    }

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
          border-bottom: 3px solid #dc2626;
        }
        .header h1 {
          color: #dc2626;
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
          color: #dc2626;
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
          background-color: #dc2626;
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
          color: #dc2626;
          border-top: 2px solid #dc2626;
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
        .electronic-info {
          margin-top: 20px;
          padding: 15px;
          background: #dbeafe;
          border-left: 4px solid #3b82f6;
          border-radius: 4px;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>FACTURA ${invoice.prefix || 'FV'} ${invoice.number}</h1>
        <div>
          <div style="font-weight: 600; font-size: 16px; color: #dc2626; margin-bottom: 5px;">${companyName}</div>
          ${companyAddress ? `<div>${companyAddress}</div>` : ''}
          ${companyPhone ? `<div>Tel: ${companyPhone}</div>` : ''}
          ${companyEmail ? `<div>Email: ${companyEmail}</div>` : ''}
          ${companyNit ? `<div>NIT: ${companyNit}</div>` : ''}
        </div>
      </div>
      
      <div class="info-section">
        <div class="info-box">
          <h3>Cliente</h3>
          <p><strong>Nombre:</strong> ${invoice.customer.name}</p>
          ${invoice.customer.taxId ? `<p><strong>NIT:</strong> ${invoice.customer.taxId}</p>` : ''}
          ${invoice.customer.email ? `<p><strong>Email:</strong> ${invoice.customer.email}</p>` : ''}
          ${invoice.customer.phone ? `<p><strong>Teléfono:</strong> ${invoice.customer.phone}</p>` : ''}
          ${invoice.customer.address ? `<p><strong>Dirección:</strong> ${invoice.customer.address}</p>` : ''}
        </div>
        <div class="info-box">
          <h3>Información</h3>
          ${invoice.issuedAt ? `<p><strong>Fecha Emisión:</strong> ${formatDate(invoice.issuedAt)}</p>` : ''}
          ${invoice.dueDate ? `<p><strong>Fecha Vencimiento:</strong> ${formatDate(invoice.dueDate)}</p>` : ''}
          ${invoice.paidAt ? `<p><strong>Fecha Pago:</strong> ${formatDate(invoice.paidAt)}</p>` : ''}
          <p><strong>Estado:</strong> ${invoice.status}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th style="text-align: center;">Cantidad</th>
            <th style="text-align: right;">Precio Unit.</th>
            <th style="text-align: center;">Descuento</th>
            <th style="text-align: center;">IVA</th>
            <th style="text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items.map(item => `
            <tr>
              <td>
                <div style="font-weight: 500;">${item.product.name}</div>
                ${item.product.sku ? `<div style="font-size: 12px; color: #6b7280;">SKU: ${item.product.sku}</div>` : ''}
                ${item.variant ? `<div style="font-size: 12px; color: #6b7280;">Variante: ${item.variant.name}</div>` : ''}
              </td>
              <td style="text-align: center;">${item.quantity}</td>
              <td style="text-align: right;">${formatCurrency(item.unitPrice)}</td>
              <td style="text-align: center;">${item.discount}%</td>
              <td style="text-align: center;">${item.taxRate}%</td>
              <td style="text-align: right; font-weight: 500;">${formatCurrency(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span style="margin-right: 20px;">Subtotal:</span>
          <span>${formatCurrency((invoice.subtotal || 0) + (invoice.discount || 0))}</span>
        </div>
        ${(invoice.discount || 0) > 0 ? `
        <div class="totals-row">
          <span style="margin-right: 20px;">Descuento:</span>
          <span>${formatCurrency(invoice.discount || 0)}</span>
        </div>
        ` : ''}
        <div class="totals-row">
          <span style="margin-right: 20px;">IVA:</span>
          <span>${formatCurrency(invoice.tax || 0)}</span>
        </div>
        <div class="totals-row total-final">
          <span style="margin-right: 20px;">TOTAL:</span>
          <span>${formatCurrency(invoice.total || 0)}</span>
        </div>
      </div>

      ${invoice.cufe ? `
      <div class="electronic-info">
        <p><strong>CUFE:</strong> ${invoice.cufe}</p>
        ${invoice.qrCode ? `<p><strong>QR Code:</strong> <a href="${invoice.qrCode}" target="_blank">${invoice.qrCode}</a></p>` : ''}
      </div>
      ` : ''}

      ${invoice.notes ? `
      <div class="notes">
        <h3>Notas</h3>
        <p>${invoice.notes}</p>
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

