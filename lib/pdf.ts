import puppeteer from 'puppeteer'
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
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

