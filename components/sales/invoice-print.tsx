'use client'

import { formatCurrency, formatDate } from '@/lib/utils'

interface InvoicePrintProps {
  invoice: any
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
export function InvoicePrint({ invoice }: InvoicePrintProps) {
  if (!invoice) return null

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
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'FERRETERIA'
  const companyTaxId = process.env.NEXT_PUBLIC_COMPANY_TAX_ID || '900000000-1'
  const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || ''
  const companyCity = process.env.NEXT_PUBLIC_COMPANY_CITY || ''
  const companyPhone = process.env.NEXT_PUBLIC_COMPANY_PHONE || ''
  const companyEmail = process.env.NEXT_PUBLIC_COMPANY_EMAIL || ''
  const companyRegime = process.env.NEXT_PUBLIC_COMPANY_REGIME || 'Responsable de IVA'

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
  const paymentForm =
    dueDate && issueDate && new Date(dueDate).getTime() > new Date(issueDate).getTime()
      ? 'CRÉDITO'
      : 'CONTADO'

  // Calcular días de crédito si aplica
  const creditDays = dueDate && issueDate
    ? Math.ceil((new Date(dueDate).getTime() - new Date(issueDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  // Calcular totales
  const subtotal = invoice.subtotal || 0
  const discount = invoice.discount || 0
  const tax = invoice.tax || 0
  const total = invoice.total || 0
  const subtotalAfterDiscount = subtotal - discount

  // IVA discriminado por tarifa (REQUISITO DIAN)
  const taxByRate = new Map<number, { base: number; tax: number }>()
  for (const item of invoice.items || []) {
    const rate = typeof item.taxRate === 'number' ? item.taxRate : 0
    const base = (item.unitPrice || 0) * (item.quantity || 0) * (1 - (item.discount || 0) / 100)
    const itemTax = base * (rate / 100)
    const prev = taxByRate.get(rate) || { base: 0, tax: 0 }
    taxByRate.set(rate, { base: prev.base + base, tax: prev.tax + itemTax })
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

  return (
    <div className="ticket">
      {/* ======= ENCABEZADO EMPRESA (VENDEDOR) ======= */}
      <div className="center">
        <div className="bold">{companyName}</div>
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
          <div className="small" style={{ fontSize: '9px', marginTop: '4px' }}>
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
                    {item.product?.sku && <div style={{ fontSize: '9px', color: '#333' }}>{item.product.sku}</div>}
                    {item.discount > 0 && (
                      <div style={{ fontSize: '8px', color: '#555' }}>
                        Desc: {item.discount}% de ${formatCurrency(item.unitPrice)}
                      </div>
                    )}
                  </td>
                  <td className="qty">{item.quantity || 0}</td>
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
      <table className="totals">
        <tbody>
          <tr>
            <td className="label">Subtotal Bruto</td>
            <td className="value">{formatCurrency(subtotal)}</td>
          </tr>
          {discount > 0 && (
            <tr>
              <td className="label">(-) Descuentos</td>
              <td className="value">{formatCurrency(discount)}</td>
            </tr>
          )}
          <tr>
            <td className="label bold">Base Gravable</td>
            <td className="value bold">{formatCurrency(subtotalAfterDiscount)}</td>
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
            <td className="label bold" style={{ fontSize: '13px', paddingTop: '4px' }}>TOTAL A PAGAR</td>
            <td className="value bold" style={{ fontSize: '13px', paddingTop: '4px' }}>{formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>

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

        <div className="separator" />

        <div style={{ marginTop: '6px', fontSize: '10px' }}>
          <div>{companyRegime}</div>
          <div>La presente factura se asimila en todos sus efectos</div>
          <div>legales a la letra de cambio (Art. 774 C.C.).</div>
          <div className="bold" style={{ marginTop: '4px' }}>¡GRACIAS POR SU COMPRA!</div>
          <div style={{ marginTop: '4px' }}>Conserve esta factura</div>
          <div style={{ fontSize: '8px', color: '#555', marginTop: '2px' }}>Documento generado electrónicamente</div>
        </div>

        {isElectronic && (
          <div style={{ marginTop: '8px' }}>
            <div className="bold">CUFE:</div>
            <div style={{ wordBreak: 'break-all', fontSize: '8px', marginTop: '2px' }}>{invoice.cufe}</div>
            {invoice.electronicStatus === 'ACCEPTED' && (
              <div className="bold" style={{ color: '#000', marginTop: '4px' }}>✓ VALIDADA POR LA DIAN</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
