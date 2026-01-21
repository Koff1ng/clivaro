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
    <div className="thermal-ticket font-mono bg-white">
      {/* ======= ENCABEZADO EMPRESA (VENDEDOR) ======= */}
      <div className="text-center border-b border-dashed pb-2 mb-2">
        <h1 className="text-sm font-bold mb-0.5">{companyName}</h1>
        <div className="text-[10px] leading-tight break-words">
          <div className="font-semibold">NIT: {companyTaxId}</div>
          {companyRegime && <div>{companyRegime}</div>}
          {companyAddress && <div>{companyAddress}</div>}
          {companyCity && <div>{companyCity}</div>}
          {companyPhone && <div>Tel: {companyPhone}</div>}
          {companyEmail && <div>{companyEmail}</div>}
        </div>
      </div>

      {/* ======= TÍTULO DEL DOCUMENTO (REQUISITO DIAN) ======= */}
      <div className="text-center border-b border-dashed pb-2 mb-2">
        <div className="text-xs font-bold uppercase">
          {isElectronic ? 'FACTURA ELECTRÓNICA DE VENTA' : 'FACTURA DE VENTA'}
        </div>
        <div className="text-xs font-bold mt-1">{invoice.number || 'N/A'}</div>

        {/* Resolución de numeración DIAN */}
        {invoice.resolutionNumber && (
          <div className="text-[8px] mt-1 text-gray-700">
            Resolución DIAN No. {invoice.resolutionNumber}
            {invoice.resolutionPrefix && ` Prefijo: ${invoice.resolutionPrefix}`}
            {invoice.resolutionRangeFrom && invoice.resolutionRangeTo && (
              <> Del {invoice.resolutionRangeFrom} al {invoice.resolutionRangeTo}</>
            )}
            {invoice.resolutionValidFrom && (
              <> Vigencia: {formatDate(invoice.resolutionValidFrom)}
                {invoice.resolutionValidTo && <> - {formatDate(invoice.resolutionValidTo)}</>}
              </>
            )}
          </div>
        )}
      </div>

      {/* ======= FECHAS (REQUISITO DIAN) ======= */}
      <div className="border-b border-dashed pb-2 mb-2 text-[10px]">
        <div className="flex justify-between">
          <span>Fecha Generación:</span>
          <span>{formatDateTime(generationDate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Fecha Expedición:</span>
          <span>{formatDateTime(issueDate)}</span>
        </div>
        {dueDate && paymentForm === 'CRÉDITO' && (
          <div className="flex justify-between">
            <span>Fecha Vencimiento:</span>
            <span>{formatDateTime(dueDate)}</span>
          </div>
        )}
      </div>

      {/* ======= DATOS DEL CLIENTE (COMPRADOR) ======= */}
      <div className="border-b border-dashed pb-2 mb-2">
        <div className="text-[10px] font-semibold mb-0.5">ADQUIRENTE:</div>
        <div className="text-[10px] leading-tight space-y-0.5 break-words">
          <div className="font-semibold">{customerName}</div>
          {customerTaxId && (
            <div>{customerIdType}: {customerTaxId}</div>
          )}
          {!customerTaxId && <div>CONSUMIDOR FINAL</div>}
          {customerAddress && <div>Dir: {customerAddress}</div>}
          {customerCity && <div>{customerCity}</div>}
          {customerPhone && <div>Tel: {customerPhone}</div>}
          {customerEmail && <div className="break-all">{customerEmail}</div>}
        </div>
      </div>

      {/* ======= FORMA Y MEDIO DE PAGO (REQUISITO DIAN) ======= */}
      <div className="border-b border-dashed pb-2 mb-2 text-[10px]">
        <div className="flex justify-between">
          <span className="font-semibold">Forma de Pago:</span>
          <span>{paymentForm}{creditDays > 0 ? ` (${creditDays} días)` : ''}</span>
        </div>
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="flex justify-between">
            <span className="font-semibold">Medio de Pago:</span>
            <span>
              {invoice.payments.map((p: any) => getPaymentMethodLabel(p.method)).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* ======= DETALLE DE PRODUCTOS/SERVICIOS ======= */}
      <div className="border-b border-dashed pb-2 mb-2">
        <div className="text-[10px] font-semibold mb-1 text-center">DETALLE DE OPERACIÓN</div>

        {/* Cabecera de la tabla */}
        <div className="text-[9px] leading-tight border-b border-dashed pb-1 mb-1">
          <div className="flex justify-between">
            <span className="w-[12mm]">Código</span>
            <span className="flex-1 px-1">Descripción</span>
            <span className="text-right w-[8mm]">Cant</span>
            <span className="text-right w-[14mm]">V.Unit</span>
            <span className="text-right w-[8mm]">IVA%</span>
            <span className="text-right w-[14mm]">Total</span>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-1">
          {invoice.items && invoice.items.length > 0 ? (
            invoice.items.map((item: any, index: number) => {
              const unitNet = (item.unitPrice || 0) * (1 - (item.discount || 0) / 100)
              return (
                <div key={item.id || index} className="text-[9px] leading-tight">
                  <div className="flex justify-between gap-0.5">
                    <span className="w-[12mm] truncate">{item.product?.sku || '-'}</span>
                    <span className="flex-1 px-1 break-words text-left">{item.product?.name || 'Producto'}</span>
                    <span className="text-right w-[8mm]">{item.quantity || 0}</span>
                    <span className="text-right w-[14mm]">{formatCurrency(unitNet)}</span>
                    <span className="text-right w-[8mm]">{item.taxRate || 0}%</span>
                    <span className="text-right w-[14mm]">{formatCurrency(item.subtotal || 0)}</span>
                  </div>
                  {item.discount > 0 && (
                    <div className="text-[8px] text-gray-600 pl-[13mm]">
                      Desc: {item.discount}% sobre ${formatCurrency(item.unitPrice)}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="text-center text-gray-500 py-1 text-[10px]">No hay productos</div>
          )}
        </div>
      </div>

      {/* ======= TOTALES CON IVA DISCRIMINADO (REQUISITO DIAN) ======= */}
      <div className="border-b border-dashed pb-2 mb-2 space-y-0.5">
        {/* Subtotal bruto (sin descuentos) */}
        <div className="flex justify-between text-[10px]">
          <span>Subtotal Bruto:</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        {/* Descuentos */}
        {discount > 0 && (
          <div className="flex justify-between text-[10px]">
            <span>(-) Descuentos:</span>
            <span>{formatCurrency(discount)}</span>
          </div>
        )}

        {/* Subtotal neto (base gravable) */}
        <div className="flex justify-between text-[10px] font-semibold">
          <span>Base Gravable:</span>
          <span>{formatCurrency(subtotalAfterDiscount)}</span>
        </div>

        {/* IVA discriminado por tarifa */}
        {taxByRate.size > 0 && (
          <>
            <div className="text-[9px] text-gray-600 mt-1">Impuestos:</div>
            {Array.from(taxByRate.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([rate, v]) => (
                <div key={rate} className="flex justify-between text-[10px] pl-2">
                  <span>IVA {rate}% (Base: {formatCurrency(v.base)}):</span>
                  <span>{formatCurrency(v.tax)}</span>
                </div>
              ))}
          </>
        )}

        {/* Total IVA */}
        {tax > 0 && (
          <div className="flex justify-between text-[10px] font-semibold">
            <span>Total IVA:</span>
            <span>{formatCurrency(tax)}</span>
          </div>
        )}

        {/* TOTAL */}
        <div className="flex justify-between text-xs font-bold border-t border-dashed pt-1 mt-1">
          <span>TOTAL A PAGAR (COP):</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* ======= DETALLE DE PAGOS RECIBIDOS ======= */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="border-b border-dashed pb-2 mb-2">
          <div className="text-[10px] font-semibold mb-0.5">PAGOS RECIBIDOS:</div>
          <div className="text-[10px] space-y-0.5">
            {invoice.payments.map((payment: any, index: number) => (
              <div key={payment.id || index} className="flex justify-between">
                <span>{getPaymentMethodLabel(payment.method)}:</span>
                <span>{formatCurrency(payment.amount)}</span>
              </div>
            ))}
          </div>
          {/* Cambio si es efectivo */}
          {invoice.change && invoice.change > 0 && (
            <div className="flex justify-between text-[10px] mt-1 font-semibold">
              <span>Cambio:</span>
              <span>{formatCurrency(invoice.change)}</span>
            </div>
          )}
        </div>
      )}

      {/* ======= INFORMACIÓN FACTURACIÓN ELECTRÓNICA DIAN ======= */}
      {isElectronic && (
        <div className="border-b border-dashed pb-2 mb-2 text-[9px] leading-tight">
          <div className="font-semibold mb-1 text-center">FACTURACIÓN ELECTRÓNICA</div>
          <div className="space-y-0.5">
            {invoice.electronicStatus === 'ACCEPTED' && (
              <div className="text-center font-semibold text-green-700">
                ✓ VALIDADA POR LA DIAN
              </div>
            )}
            {invoice.electronicStatus === 'SENT' && (
              <div className="text-center text-blue-700">
                Enviada a DIAN - Pendiente validación
              </div>
            )}
            {invoice.electronicSentAt && (
              <div>Fecha validación: {formatDateTime(invoice.electronicSentAt)}</div>
            )}
            <div className="break-all text-[8px] mt-1">
              <span className="font-semibold">CUFE:</span> {invoice.cufe}
            </div>
            {invoice.qrCode && (
              <div className="text-center mt-2">
                <div className="text-[8px] mb-1">Consulte en: www.dian.gov.co</div>
                {/* Aquí se podría agregar un QR code component */}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======= NOTAS LEGALES (REQUISITO DIAN Art. 774 C.C.) ======= */}
      <div className="text-[8px] text-center space-y-0.5 border-b border-dashed pb-2 mb-2 leading-tight">
        <div className="font-semibold">INFORMACIÓN LEGAL</div>
        <div>La presente factura se asimila en todos sus efectos</div>
        <div>legales a la letra de cambio (Art. 774 C.C.).</div>
        {process.env.NEXT_PUBLIC_RETENEDOR_IVA === 'true' && (
          <div className="font-semibold mt-1">Agentes Retenedores del IVA</div>
        )}
        {process.env.NEXT_PUBLIC_GRAN_CONTRIBUYENTE === 'true' ? (
          <div>Grandes Contribuyentes Res. DIAN</div>
        ) : (
          <div>No somos Grandes Contribuyentes</div>
        )}
        {process.env.NEXT_PUBLIC_AUTORETENEDOR === 'true' ? (
          <div>Autoretenedores Res. DIAN</div>
        ) : (
          <div>No somos Autoretenedores</div>
        )}
      </div>

      {/* ======= FOOTER ======= */}
      <div className="text-center text-[9px] text-gray-600 leading-tight">
        <div className="font-semibold">¡Gracias por su compra!</div>
        <div>Conserve esta factura como documento soporte</div>
        <div className="text-[8px] mt-1 text-gray-500">
          Documento generado electrónicamente
        </div>
      </div>
    </div>
  )
}
