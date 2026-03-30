'use client'

import { FOOTER_TEMPLATES, type FooterTemplate } from '@/components/settings/ticket-editor'

import { formatCurrency, formatDate } from '@/lib/utils'

interface InvoicePrintProps {
  invoice: any
  settings?: any
}

/**
 * Componente de impresión de factura optimizado para cumplir con los requisitos
 * fiscales colombianos según la Resolución DIAN 000165/2023 y Anexo Técnico 1.9
 * 
 * Elementos obligatorios según Art. 617 del Estatuto Tributario:
 * 1. ✓ Título visible: "FACTURA ELECTRÓNICA DE VENTA"
 * 2. ✓ Identificación del vendedor (NIT, razón social, dirección)
 * 3. ✓ Identificación del comprador (NIT o cédula, nombre)
 * 4. ✓ Numeración consecutiva con autorización DIAN
 * 5. ✓ Fecha y hora de generación y expedición
 * 6. ✓ Descripción de bienes/servicios (cantidad, código, descripción)
 * 7. ✓ Valor total de la operación
 * 8. ✓ Forma de pago (contado/crédito)
 * 9. ✓ Medio de pago (efectivo, tarjeta, transferencia)
 * 10. ✓ IVA discriminado por tarifa
 * 11. ✓ CUFE (Código Único de Factura Electrónica)
 * 12. ✓ Código QR
 */
export function InvoicePrint({ invoice, settings }: InvoicePrintProps) {
  if (!invoice) return null

  // Parse ticket design settings from tenant customSettings JSON
  let td: any = {}
  try {
    if (settings?.customSettings) {
      const custom = typeof settings.customSettings === 'string'
        ? JSON.parse(settings.customSettings)
        : settings.customSettings
      td = custom?.printing?.ticketDesign || {}
    }
  } catch (e) { }

  // Ticket design toggles with defaults
  const showCufe = td.showCufe !== false
  const showQr = td.showQr !== false
  const showLogo = td.showLogo !== false
  const showDescription = td.showDescription || false
  const showUnitPrice = td.showUnitPrice !== false
  const showTotals = td.showTotals !== false
  const showLineCount = td.showLineCount || false
  const showProductCount = td.showProductCount || false
  const showUnitOfMeasure = td.showUnitOfMeasure || false
  const customFooterText = td.customFooterText || ''
  const footerTemplate: FooterTemplate = td.footerTemplate || 'general'
  const footerText = td.footerText || '¡Gracias por su compra!'
  const logoUrl = (() => {
    try {
      if (settings?.customSettings) {
        const custom = typeof settings.customSettings === 'string'
          ? JSON.parse(settings.customSettings)
          : settings.customSettings
        return custom?.identity?.logo || null
      }
    } catch (e) { }
    return null
  })()

  const formatDateTime = (date: Date | string | null | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
  }

  // Datos de la empresa emisora (vendedor)
  const companyName = settings?.companyName || process.env.NEXT_PUBLIC_COMPANY_NAME || 'FERRETERIA'
  const companyTaxId = settings?.companyNit || process.env.NEXT_PUBLIC_COMPANY_TAX_ID || '900000000-1'
  const companyAddress = settings?.companyAddress || process.env.NEXT_PUBLIC_COMPANY_ADDRESS || ''
  const companyCity = settings?.companyCity || process.env.NEXT_PUBLIC_COMPANY_CITY || ''
  const companyPhone = settings?.companyPhone || process.env.NEXT_PUBLIC_COMPANY_PHONE || ''
  const companyEmail = settings?.companyEmail || process.env.NEXT_PUBLIC_COMPANY_EMAIL || ''

  // Regimen desde customSettings
  let companyRegime = process.env.NEXT_PUBLIC_COMPANY_REGIME || 'Responsable de IVA'
  try {
    if (settings?.customSettings) {
      const custom = typeof settings.customSettings === 'string'
        ? JSON.parse(settings.customSettings)
        : settings.customSettings
      if (custom.identity?.regime) companyRegime = custom.identity.regime
    }
  } catch (e) { }

  // Datos del cliente (comprador)
  const customerName = invoice.customer?.name || 'CONSUMIDOR FINAL'
  const customerTaxId = invoice.customer?.taxId || ''
  const customerIdType = invoice.customer?.idType || (customerTaxId ? 'NIT' : 'CC')
  const customerAddress = invoice.customer?.address || ''
  const customerCity = invoice.customer?.city || ''
  const customerPhone = invoice.customer?.phone || ''
  const customerEmail = invoice.customer?.email || ''

  // Fechas
  const issueDate = invoice.issuedAt || invoice.createdAt
  const generationDate = invoice.createdAt
  const dueDate = invoice.dueDate

  // Forma de pago según DIAN (contado o crédito)
  // EN_COBRANZA means there's an outstanding balance — this is a credit sale
  const isCredit = invoice.status === 'EN_COBRANZA' || invoice.balance > 0 || (
    dueDate && issueDate && new Date(dueDate).getTime() > new Date(issueDate).getTime()
  )
  const paymentForm = isCredit ? 'CRÉDITO' : 'CONTADO'

  // Calcular días de crédito si aplica
  const creditDays = dueDate && issueDate
    ? Math.ceil((new Date(dueDate).getTime() - new Date(issueDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  // Abono/payment tracking
  const totalPaid = (invoice.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
  const pendingBalance = Math.max(0, (invoice.total || 0) - totalPaid)

  // Calcular totales
  const globalDiscount = invoice.discount || 0

  // Calcular descuentos por item para mostrar el subtotal bruto real
  const itemDiscounts = (invoice.items || []).reduce((sum: number, item: any) => {
    const grossLine = (item.unitPrice || 0) * (item.quantity || 0)
    // El subtotal del item ya viene neto (con el descuento aplicado)
    const netLine = item.subtotal || (grossLine * (1 - (item.discount || 0) / 100))
    return sum + Math.max(0, grossLine - netLine)
  }, 0)

  const totalDiscount = globalDiscount + itemDiscounts

  // subtotal de la factura en DB es neto (después de descuentos de item y global)
  // Base gravable es subtotal antes de impuesto
  const taxableBase = invoice.subtotal || 0
  const subtotalBruto = taxableBase + totalDiscount
  const tax = invoice.tax || 0
  const total = invoice.total || 0

  // IVA discriminado por tarifa (REQUISITO DIAN)
  const taxByRate = new Map<number, { base: number; tax: number; name?: string }>()

  if (invoice.taxSummary && invoice.taxSummary.length > 0) {
    for (const ts of invoice.taxSummary) {
      const prev = taxByRate.get(ts.rate) || { base: 0, tax: 0 }
      taxByRate.set(ts.rate, {
        base: prev.base + (ts.baseAmount || 0),
        tax: prev.tax + (ts.taxAmount || 0),
        name: ts.name
      })
    }
  } else {
    // Legacy fallback
    for (const item of invoice.items || []) {
      const rate = typeof item.taxRate === 'number' ? item.taxRate : 0
      const base = (item.unitPrice || 0) * (item.quantity || 0) * (1 - (item.discount || 0) / 100)
      const itemTax = base * (rate / 100)
      const prev = taxByRate.get(rate) || { base: 0, tax: 0 }
      taxByRate.set(rate, { base: prev.base + base, tax: prev.tax + itemTax })
    }
  }

  // Medios de pago con etiquetas según DIAN
  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return 'Efectivo'
      case 'CARD': return 'Tarjeta Débito/Crédito'
      case 'TRANSFER': return 'Transferencia Electrónica'
      case 'CREDIT': return 'Crédito'
      case 'CHECK': return 'Cheque'
      default: return method
    }
  }

  // Determinar si es factura electrónica validada
  const isElectronic = !!invoice.cufe

  // Font size mapping from settings
  const fontSizeMap: Record<string, { base: number; small: number; items: number; itemsHeader: number }> = {
    small:  { base: 10, small: 8,  items: 9,  itemsHeader: 8 },
    medium: { base: 12, small: 10, items: 11, itemsHeader: 10 },
    large:  { base: 14, small: 11, items: 13, itemsHeader: 11 },
  }
  const headerFontSizeMap: Record<string, number> = {
    medium: 12, large: 14, xlarge: 16,
  }
  
  // Font size: custom numeric value takes priority over presets
  const customFontSize = td.customFontSize ? Number(td.customFontSize) : null
  const fs = customFontSize
    ? { base: customFontSize, small: Math.max(6, customFontSize - 2), items: Math.max(7, customFontSize - 1), itemsHeader: Math.max(6, customFontSize - 2) }
    : (fontSizeMap[td.fontSize as string] || fontSizeMap.medium)
  const hfs = headerFontSizeMap[td.headerFontSize as string] || headerFontSizeMap.large
  const totalFs = fs.base + 2 // TOTAL A PAGAR slightly larger

  return (
    <div className="ticket">
      <style>{`
        .ticket {
          width: 80mm;
          max-width: 80mm;
          font-family: 'Courier New', 'Lucida Console', monospace;
          font-size: ${fs.base}px;
          color: #000;
          background: #fff;
          padding: 8px 4px;
          line-height: 1.4;
        }
        .ticket .center { text-align: center; }
        .ticket .bold { font-weight: bold; }
        .ticket .small { font-size: ${fs.small}px; }
        .ticket .separator {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .ticket .company-name {
          font-size: ${hfs}px;
          font-weight: bold;
        }
        .ticket table.items {
          width: 100%;
          border-collapse: collapse;
          font-size: ${fs.items}px;
        }
        .ticket table.items th {
          text-align: left;
          border-bottom: 1px solid #000;
          padding: 2px 0;
          font-size: ${fs.itemsHeader}px;
          font-weight: bold;
        }
        .ticket table.items th.qty,
        .ticket table.items td.qty {
          text-align: center;
          width: 50px;
        }
        .ticket table.items th.price,
        .ticket table.items td.price {
          text-align: right;
          width: 80px;
        }
        .ticket table.items th.desc,
        .ticket table.items td.desc {
          text-align: left;
        }
        .ticket table.items td {
          padding: 3px 0;
          vertical-align: top;
          border-bottom: 1px dotted #ccc;
        }
        .ticket table.totals {
          width: 100%;
          border-collapse: collapse;
          font-size: ${fs.base}px;
        }
        .ticket table.totals td {
          padding: 2px 0;
        }
        .ticket table.totals td.label {
          text-align: left;
        }
        .ticket table.totals td.value {
          text-align: right;
        }
        .ticket .footer {
          font-size: ${fs.items}px;
        }
      `}</style>
      {/* ======= ENCABEZADO EMPRESA (VENDEDOR) ======= */}
      <div className="center">
        {showLogo && logoUrl && (
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
            <img src={logoUrl} alt="Logo" style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div className="company-name">{companyName}</div>
        <div className="small">
          <div>NIT: {companyTaxId}</div>
          {companyRegime && <div>{companyRegime}</div>}
          {companyAddress && <div>{companyAddress}</div>}
          {companyCity && <div>{companyCity}</div>}
          {companyPhone && <div>Tel: {companyPhone}</div>}
          {companyEmail && <div>{companyEmail}</div>}
        </div>
      </div>

      <div className="separator" />

      {/* ======= TÍTULO DEL DOCUMENTO ======= */}
      <div className="center">
        <div className="bold">
          {isElectronic ? 'FACTURA ELECTRÓNICA DE VENTA' : 'FACTURA DE VENTA'}
        </div>
        <div className="bold">{invoice.number || 'N/A'}</div>

        {/* Resolución DIAN */}
        {invoice.resolutionNumber && (
          <div className="small" style={{ marginTop: '4px' }}>
            Resolución DIAN No. {invoice.resolutionNumber}
            {invoice.resolutionPrefix && ` Prefijo: ${invoice.resolutionPrefix}`}
            {invoice.resolutionRangeFrom && invoice.resolutionRangeTo && (
              <div>Del {invoice.resolutionRangeFrom} al {invoice.resolutionRangeTo}</div>
            )}
            {invoice.resolutionValidFrom && (
              <div>Vigencia: {formatDate(invoice.resolutionValidFrom)}
                {invoice.resolutionValidTo && ` - ${formatDate(invoice.resolutionValidTo)}`}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="separator" />

      {/* ======= FECHAS Y CLIENTE ======= */}
      <div className="small">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Fecha Gen:</span>
          <span>{formatDateTime(generationDate)}</span>
        </div>
        {issueDate && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Fecha Exp:</span>
            <span>{formatDateTime(issueDate)}</span>
          </div>
        )}
        {dueDate && paymentForm === 'CRÉDITO' && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Fecha Venc:</span>
            <span>{formatDateTime(dueDate)}</span>
          </div>
        )}

        <div style={{ marginTop: '6px' }}>
          <div className="bold">CLIENTE:</div>
          <div>{customerName}</div>
          {customerTaxId && <div>{customerIdType}: {customerTaxId}</div>}
          {customerAddress && <div>Dir: {customerAddress}</div>}
          {customerPhone && <div>Tel: {customerPhone}</div>}
          {customerEmail && <div style={{ wordBreak: 'break-all' }}>{customerEmail}</div>}
        </div>
      </div>

      <div className="separator" />

      {/* ======= DETALLE DE ITEMS ======= */}
      <table className="items">
        <thead>
          <tr>
            <th className="desc">DESC</th>
            <th className="qty">CANT</th>
            <th className="price">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items && invoice.items.length > 0 ? (
            invoice.items.map((item: any, index: number) => {
              const unitNet = (item.unitPrice || 0) * (1 - (item.discount || 0) / 100)
              return (
                <tr key={item.id || index}>
                  <td className="desc">
                    <div className="bold">{item.product?.name || 'Producto'}</div>
                    {item.product?.sku && <div style={{ fontSize: `${fs.small}px`, color: '#333' }}>{item.product.sku}</div>}
                    {showDescription && item.product?.description && <div style={{ fontSize: `${fs.small - 1}px`, color: '#555' }}>{item.product.description}</div>}
                    {showUnitOfMeasure && <div style={{ fontSize: `${fs.small - 1}px`, color: '#999' }}>UN</div>}
                    {item.discount > 0 && showUnitPrice && (
                      <div style={{ fontSize: `${fs.small - 1}px`, color: '#555' }}>
                        Desc: {item.discount}% de ${formatCurrency(item.unitPrice)}
                      </div>
                    )}
                  </td>
                  <td className="qty">{item.quantity || 0}{showUnitPrice && <div style={{ fontSize: `${fs.small - 1}px` }}>x {formatCurrency(item.unitPrice)}</div>}</td>
                  <td className="price">{formatCurrency(item.subtotal || 0)}</td>
                </tr>
              )
            })
          ) : (
            <tr><td colSpan={3} className="center">No hay productos</td></tr>
          )}
        </tbody>
      </table>

      <div className="separator" />

      {/* ======= TOTALES ======= */}
      {showTotals && (
      <table className="totals">
        <tbody>
          <tr>
            <td className="label">Subtotal Bruto</td>
            <td className="value">{formatCurrency(subtotalBruto)}</td>
          </tr>
          {totalDiscount > 0 && (
            <tr>
              <td className="label">(-) Descuentos</td>
              <td className="value">{formatCurrency(totalDiscount)}</td>
            </tr>
          )}
          <tr>
            <td className="label bold">Base Gravable</td>
            <td className="value bold">{formatCurrency(taxableBase)}</td>
          </tr>

          {/* IVA discriminado por tarifa */}
          {taxByRate.size > 0 && Array.from(taxByRate.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([rate, v]) => (
              <tr key={rate}>
                <td className="label small">IVA {rate}% (Base: {formatCurrency(v.base)})</td>
                <td className="value small">{formatCurrency(v.tax)}</td>
              </tr>
            ))}

          {tax > 0 && (
            <tr>
              <td className="label bold">Total IVA</td>
              <td className="value bold">{formatCurrency(tax)}</td>
            </tr>
          )}

          <tr>
            <td className="label bold" style={{ fontSize: `${totalFs}px`, paddingTop: '4px' }}>TOTAL A PAGAR</td>
            <td className="value bold" style={{ fontSize: `${totalFs}px`, paddingTop: '4px' }}>{formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>
      )}

      <div className="separator" />

      {/* ======= PAGOS Y FOOTER ======= */}
      <div className="footer">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="bold">Forma de Pago:</span>
          <span>{paymentForm}{creditDays > 0 ? ` (${creditDays} días)` : ''}</span>
        </div>

        {invoice.payments && invoice.payments.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            <div className="bold">PAGOS RECIBIDOS:</div>
            {invoice.payments.map((payment: any, index: number) => (
              <div key={payment.id || index} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{getPaymentMethodLabel(payment.method)}:</span>
                <span>{formatCurrency(payment.amount)}</span>
              </div>
            ))}
            {invoice.change && invoice.change > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }} className="bold">
                <span>Cambio:</span>
                <span>{formatCurrency(invoice.change)}</span>
              </div>
            )}
          </div>
        )}

        {/* Balance section for credit/partial payment invoices */}
        {isCredit && (
          <div style={{ marginTop: '6px', padding: '4px', border: '1px dashed #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }} className="bold">
              <span>Total Factura:</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Abonos Recibidos:</span>
              <span>{formatCurrency(totalPaid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }} className="bold">
              <span>SALDO PENDIENTE:</span>
              <span>{formatCurrency(pendingBalance)}</span>
            </div>
          </div>
        )}

        <div className="separator" />

          <div style={{ marginTop: '6px', fontSize: `${fs.items}px` }}>
            <div>{companyRegime}</div>
            <div style={{ fontSize: `${fs.small - 1}px`, color: '#555', marginTop: '4px', lineHeight: '1.3' }}>
            {footerTemplate === 'custom'
              ? (customFooterText || 'Texto legal personalizado')
              : FOOTER_TEMPLATES[footerTemplate]?.text || FOOTER_TEMPLATES.general.text}
          </div>
          <div className="bold" style={{ marginTop: '6px' }}>{footerText}</div>
          {(showLineCount || showProductCount) && (
            <div style={{ marginTop: '4px', fontSize: `${fs.small}px` }}>
              {showLineCount && <div>Total líneas: {(invoice.items || []).length}</div>}
              {showProductCount && <div>Total productos: {(invoice.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 0), 0)}</div>}
            </div>
          )}
          <div style={{ marginTop: '4px' }}>Conserve esta factura</div>
            <div style={{ fontSize: `${fs.small - 1}px`, color: '#555', marginTop: '2px' }}>Representación impresa de la factura electrónica</div>
        </div>

        {isElectronic && showCufe && (
          <div style={{ marginTop: '8px' }}>
            <div className="bold">CUFE:</div>
            <div style={{ wordBreak: 'break-all', fontSize: `${fs.small - 1}px`, marginTop: '2px' }}>{invoice.cufe}</div>
            {invoice.electronicStatus === 'ACCEPTED' && (
              <div className="bold" style={{ color: '#000', marginTop: '4px' }}>✓ VALIDADA POR LA DIAN</div>
            )}
          </div>
        )}

        {/* ======= QR CODE ======= */}
        {isElectronic && showQr && invoice.cufe && (
          <div style={{ marginTop: '8px', textAlign: 'center' }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${invoice.cufe}`)}`}
              alt="QR Verificación DIAN"
              style={{ width: '120px', height: '120px', margin: '0 auto', display: 'block' }}
            />
            <div style={{ fontSize: `${fs.small - 1}px`, color: '#555', marginTop: '4px' }}>Escanear para verificar en DIAN</div>
          </div>
        )}
      </div>
    </div>
  )
}
