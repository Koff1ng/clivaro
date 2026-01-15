'use client'

import { formatCurrency, formatDate } from '@/lib/utils'

interface InvoicePrintProps {
  invoice: any
}

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

  // Calcular totales
  const subtotal = invoice.subtotal || 0
  const discount = invoice.discount || 0
  const tax = invoice.tax || 0
  const total = invoice.total || 0
  const subtotalAfterDiscount = subtotal - discount
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'FERRETERIA'
  const companyTaxId = process.env.NEXT_PUBLIC_COMPANY_TAX_ID || 'N/A'
  const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || ''
  const companyPhone = process.env.NEXT_PUBLIC_COMPANY_PHONE || ''
  const companyEmail = process.env.NEXT_PUBLIC_COMPANY_EMAIL || ''

  const customerName = invoice.customer?.name || 'CONSUMIDOR FINAL'
  const customerTaxId = invoice.customer?.taxId || ''
  const customerAddress = invoice.customer?.address || ''
  const customerPhone = invoice.customer?.phone || ''
  const customerEmail = invoice.customer?.email || ''

  const issueDate = invoice.issuedAt || invoice.createdAt
  const saleType =
    invoice.dueDate && issueDate && new Date(invoice.dueDate).getTime() > new Date(issueDate).getTime()
      ? 'CREDITO'
      : 'CONTADO'

  // IVA por tarifa (si hay varias)
  const taxByRate = new Map<number, { base: number; tax: number }>()
  for (const item of invoice.items || []) {
    const rate = typeof item.taxRate === 'number' ? item.taxRate : 0
    const base = (item.unitPrice || 0) * (item.quantity || 0) * (1 - (item.discount || 0) / 100)
    const itemTax = base * (rate / 100)
    const prev = taxByRate.get(rate) || { base: 0, tax: 0 }
    taxByRate.set(rate, { base: prev.base + base, tax: prev.tax + itemTax })
  }

  return (
    <div className="thermal-ticket font-mono">
      {/* Header - Empresa */}
      <div className="text-center border-b border-dashed pb-2 mb-2">
        <h1 className="text-sm font-bold mb-0.5">{companyName}</h1>
        <div className="text-[10px] leading-tight break-words">
          <div>NIT: {companyTaxId}</div>
          {companyAddress && <div>DIR: {companyAddress}</div>}
          {companyPhone && <div>TEL: {companyPhone}</div>}
          {companyEmail && <div>EMAIL: {companyEmail}</div>}
        </div>
      </div>

      {/* Tipo y Número de Factura */}
      <div className="text-center border-b border-dashed pb-2 mb-2">
        <div className="text-xs font-semibold">FACTURA</div>
        <div className="text-xs font-bold">{invoice.number || 'N/A'}</div>
        <div className="text-[10px]">FECHA: {formatDateTime(issueDate)}</div>
        <div className="text-[10px]">TIPO VENTA: {saleType}</div>
      </div>

      {/* Datos del Cliente */}
      <div className="border-b border-dashed pb-2 mb-2">
        <div className="text-xs font-semibold mb-0.5">CLIENTE</div>
        <div className="text-[10px] leading-tight space-y-0.5 break-words">
          <div>{customerName}</div>
          {customerTaxId && <div>NIT: {customerTaxId}</div>}
          {customerAddress && <div>DIR: {customerAddress}</div>}
          {customerPhone && <div>TEL: {customerPhone}</div>}
          {customerEmail && <div className="break-all">EMAIL: {customerEmail}</div>}
        </div>
      </div>

      {/* Productos - Formato tipo ticket */}
      <div className="border-b border-dashed pb-2 mb-2">
        <div className="text-[10px] font-semibold mb-1 text-center">DETALLE</div>
        <div className="text-[9px] leading-tight">
          <div className="flex justify-between">
            <span>COD</span>
            <span className="flex-1 px-2">DESC</span>
            <span className="text-right w-[16mm]">TOTAL</span>
          </div>
          <div className="border-b border-dashed my-1" />
        </div>
        <div className="space-y-1">
          {invoice.items && invoice.items.length > 0 ? (
            invoice.items.map((item: any, index: number) => (
              <div key={item.id || index} className="text-[10px] leading-tight">
                <div className="flex justify-between gap-2">
                  <span className="w-[18mm]">{item.product?.sku || 'N/A'}</span>
                  <span className="flex-1 break-words">{item.product?.name || 'Producto'}</span>
                  <span className="text-right w-[16mm]">{formatCurrency(item.subtotal || 0)}</span>
                </div>
                <div className="flex justify-between text-[9px] text-gray-700">
                  <span className="flex-1">
                    {item.quantity || 0} x {formatCurrency(item.unitPrice || 0)}
                    {item.discount > 0 ? `  DESC ${item.discount}%` : ''}
                  </span>
                </div>
                <div className="border-b border-dashed border-gray-300 my-1" />
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-1 text-[10px]">No hay productos</div>
          )}
        </div>
      </div>

      {/* Totales */}
      <div className="border-b border-dashed pb-2 mb-2 space-y-0.5">
        <div className="flex justify-between text-[10px]">
          <span>Subtotal:</span>
          <span>{formatCurrency(subtotalAfterDiscount)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-[10px]">
            <span>Descuento:</span>
            <span>{formatCurrency(discount)}</span>
          </div>
        )}
        {taxByRate.size > 0 &&
          Array.from(taxByRate.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([rate, v]) => (
              <div key={rate} className="flex justify-between text-[10px]">
                <span>IVA {rate}%:</span>
                <span>{formatCurrency(v.tax)}</span>
              </div>
            ))}
        <div className="flex justify-between text-xs font-bold border-t border-dashed pt-0.5 mt-0.5">
          <span>TOTAL:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Formas de Pago */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="border-b border-dashed pb-2 mb-2">
          <div className="text-xs font-semibold mb-0.5">Formas de Pago:</div>
          <div className="text-[10px] space-y-0.5">
            {invoice.payments.map((payment: any, index: number) => (
              <div key={payment.id || index} className="flex justify-between">
                <span>
                  {payment.method === 'CASH' ? 'EFE' :
                   payment.method === 'CARD' ? 'TARJETA' :
                   payment.method === 'TRANSFER' ? 'TRANSFERENCIA' : payment.method}:
                </span>
                <span>{formatCurrency(payment.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {(!invoice.payments || invoice.payments.length === 0) && (
        <div className="border-b border-dashed pb-2 mb-2">
          <div className="text-xs font-semibold mb-0.5">Formas de Pago:</div>
          <div className="text-[10px] text-gray-700">No registradas</div>
        </div>
      )}

      {/* Información de Facturación Electrónica */}
      {invoice.cufe && (
        <div className="border-b border-dashed pb-2 mb-2 text-[9px] leading-tight">
          <div className="font-semibold mb-0.5">FACTURACIÓN ELECTRÓNICA</div>
          <div className="space-y-0.5">
            <div>RES. DIAN No. {invoice.resolutionNumber || 'N/A'}</div>
            {invoice.electronicSentAt && (
              <div>Fecha: {formatDateTime(invoice.electronicSentAt)}</div>
            )}
            <div className="break-all text-[8px]">CUFE: {invoice.cufe}</div>
            {invoice.qrCode && (
              <div className="text-[8px] break-all">QR: {invoice.qrCode}</div>
            )}
          </div>
        </div>
      )}

      {/* Notas Legales */}
      <div className="text-[9px] text-center space-y-0.5 border-b border-dashed pb-2 mb-2 leading-tight">
        <div>La presente factura se asimila en todos sus efectos legales a la letra de cambio (art. 774 del C.C.).</div>
        <div>No somos Grandes Contribuyentes, ni Autoretenedores.</div>
      </div>

      {/* Footer */}
      <div className="text-center text-[9px] text-gray-600 leading-tight">
        <div>Gracias por su compra</div>
        <div>Documento generado desde Sistema de Ferretería</div>
      </div>
    </div>
  )
}

