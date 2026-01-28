'use client'

import { formatCurrency, formatDate } from '@/lib/utils'

interface InvoicePrintLetterProps {
    invoice: any
    settings?: any
}

/**
 * Componente de impresión de factura en tamaño carta (Letter)
 * Optimizado para cumplir con los requisitos fiscales colombianos según DIAN
 * 
 * Formato para impresión en hoja tamaño carta (8.5" x 11")
 * Incluye todos los elementos obligatorios del Art. 617 del Estatuto Tributario
 */
export function InvoicePrintLetter({ invoice, settings }: InvoicePrintLetterProps) {
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
    // Prioridad: 1. Settings pasados por prop, 2. Variables de entorno (fallback)
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

    // Forma de pago según DIAN
    const paymentForm =
        dueDate && issueDate && new Date(dueDate).getTime() > new Date(issueDate).getTime()
            ? 'CRÉDITO'
            : 'CONTADO'

    const creditDays = dueDate && issueDate
        ? Math.ceil((new Date(dueDate).getTime() - new Date(issueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0

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

    // IVA discriminado por tarifa
    const taxByRate = new Map<number, { base: number; tax: number }>()
    for (const item of invoice.items || []) {
        const rate = typeof item.taxRate === 'number' ? item.taxRate : 0
        const base = (item.unitPrice || 0) * (item.quantity || 0) * (1 - (item.discount || 0) / 100)
        const itemTax = base * (rate / 100)
        const prev = taxByRate.get(rate) || { base: 0, tax: 0 }
        taxByRate.set(rate, { base: prev.base + base, tax: prev.tax + itemTax })
    }

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

    const isElectronic = !!invoice.cufe

    return (
        <div className="letter-print-content p-8 font-sans text-sm bg-white" style={{ maxWidth: '100%' }}>
            {/* ======= ENCABEZADO ======= */}
            <div className="flex justify-between items-start border-b-2 pb-4 mb-6">
                {/* Logo y datos empresa */}
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">{companyName}</h1>
                    <div className="text-sm text-gray-600 mt-2">
                        <div className="font-semibold">NIT: {companyTaxId}</div>
                        <div>{companyRegime}</div>
                        {companyAddress && <div>{companyAddress}</div>}
                        {companyCity && <div>{companyCity}</div>}
                        {companyPhone && <div>Tel: {companyPhone}</div>}
                        {companyEmail && <div>{companyEmail}</div>}
                    </div>
                </div>

                {/* Tipo de documento y número */}
                <div className="text-right">
                    <div className="text-lg font-bold text-blue-800 uppercase">
                        {isElectronic ? 'FACTURA ELECTRÓNICA DE VENTA' : 'FACTURA DE VENTA'}
                    </div>
                    <div className="text-2xl font-bold text-blue-900 mt-2">{invoice.number || 'N/A'}</div>
                    {invoice.resolutionNumber && (
                        <div className="text-xs text-gray-600 mt-2">
                            <div>Res. DIAN No. {invoice.resolutionNumber}</div>
                            {invoice.resolutionRangeFrom && invoice.resolutionRangeTo && (
                                <div>Del {invoice.resolutionRangeFrom} al {invoice.resolutionRangeTo}</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ======= INFORMACIÓN DE FECHAS Y CLIENTE ======= */}
            <div className="grid grid-cols-2 gap-8 mb-6">
                {/* Fechas */}
                <div className="bg-gray-50 p-4 rounded-lg border">
                    <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase">Información del Documento</h3>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Fecha Generación:</span>
                            <span className="font-medium">{formatDateTime(generationDate)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">Fecha Expedición:</span>
                            <span className="font-medium">{formatDateTime(issueDate)}</span>
                        </div>
                        {dueDate && paymentForm === 'CRÉDITO' && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Fecha Vencimiento:</span>
                                <span className="font-medium">{formatDateTime(dueDate)}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-t pt-2 mt-2">
                            <span className="text-gray-600">Forma de Pago:</span>
                            <span className="font-bold">{paymentForm}{creditDays > 0 ? ` (${creditDays} días)` : ''}</span>
                        </div>
                        {invoice.payments && invoice.payments.length > 0 && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Medio de Pago:</span>
                                <span className="font-medium">
                                    {invoice.payments.map((p: any) => getPaymentMethodLabel(p.method)).join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Cliente */}
                <div className="bg-gray-50 p-4 rounded-lg border">
                    <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase">Adquirente</h3>
                    <div className="space-y-1 text-sm">
                        <div className="font-bold text-gray-900">{customerName}</div>
                        {customerTaxId ? (
                            <div>{customerIdType}: {customerTaxId}</div>
                        ) : (
                            <div className="text-gray-500">CONSUMIDOR FINAL</div>
                        )}
                        {customerAddress && <div>{customerAddress}</div>}
                        {customerCity && <div>{customerCity}</div>}
                        {customerPhone && <div>Tel: {customerPhone}</div>}
                        {customerEmail && <div>{customerEmail}</div>}
                    </div>
                </div>
            </div>

            {/* ======= TABLA DE PRODUCTOS ======= */}
            <div className="mb-6">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-100 border-y-2 border-gray-300">
                            <th className="p-2 text-left">Código</th>
                            <th className="p-2 text-left">Descripción</th>
                            <th className="p-2 text-center">Cant</th>
                            <th className="p-2 text-right">V. Unitario</th>
                            <th className="p-2 text-center">Dcto</th>
                            <th className="p-2 text-center">IVA</th>
                            <th className="p-2 text-right">V. Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items && invoice.items.length > 0 ? (
                            invoice.items.map((item: any, index: number) => (
                                <tr key={item.id || index} className="border-b border-gray-200">
                                    <td className="p-2 font-mono text-xs">{item.product?.sku || '-'}</td>
                                    <td className="p-2">{item.product?.name || 'Producto'}</td>
                                    <td className="p-2 text-center">{item.quantity || 0}</td>
                                    <td className="p-2 text-right">{formatCurrency(item.unitPrice || 0)}</td>
                                    <td className="p-2 text-center">{item.discount ? `${item.discount}%` : '-'}</td>
                                    <td className="p-2 text-center">{item.taxRate || 0}%</td>
                                    <td className="p-2 text-right font-medium">{formatCurrency(item.subtotal || 0)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={7} className="p-4 text-center text-gray-500">No hay productos en esta factura</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ======= TOTALES E IVA DISCRIMINADO ======= */}
            <div className="flex justify-end mb-6">
                <div className="w-80 bg-gray-50 p-4 rounded-lg border">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Subtotal Bruto:</span>
                            <span>{formatCurrency(subtotalBruto)}</span>
                        </div>
                        {totalDiscount > 0 && (
                            <div className="flex justify-between text-red-600">
                                <span>(-) Descuentos:</span>
                                <span>{formatCurrency(totalDiscount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-medium border-t pt-2">
                            <span>Base Gravable:</span>
                            <span>{formatCurrency(taxableBase)}</span>
                        </div>

                        {/* IVA Discriminado */}
                        {taxByRate.size > 0 && (
                            <div className="border-t pt-2 mt-2">
                                <div className="text-xs text-gray-500 mb-1 font-medium">IMPUESTOS (IVA):</div>
                                {Array.from(taxByRate.entries())
                                    .sort((a, b) => a[0] - b[0])
                                    .map(([rate, v]) => (
                                        <div key={rate} className="flex justify-between text-xs pl-2">
                                            <span>IVA {rate}% (Base: {formatCurrency(v.base)})</span>
                                            <span>{formatCurrency(v.tax)}</span>
                                        </div>
                                    ))}
                            </div>
                        )}

                        {tax > 0 && (
                            <div className="flex justify-between font-medium">
                                <span>Total IVA:</span>
                                <span>{formatCurrency(tax)}</span>
                            </div>
                        )}

                        <div className="flex justify-between text-lg font-bold border-t-2 pt-2 mt-2 text-blue-900">
                            <span>TOTAL A PAGAR (COP):</span>
                            <span>{formatCurrency(total)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ======= PAGOS RECIBIDOS ======= */}
            {invoice.payments && invoice.payments.length > 0 && (
                <div className="mb-6">
                    <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase">Pagos Recibidos</h3>
                    <div className="flex gap-4">
                        {invoice.payments.map((payment: any, index: number) => (
                            <div key={payment.id || index} className="bg-green-50 p-3 rounded border border-green-200">
                                <div className="text-sm font-medium">{getPaymentMethodLabel(payment.method)}</div>
                                <div className="text-lg font-bold text-green-700">{formatCurrency(payment.amount)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ======= FACTURACIÓN ELECTRÓNICA DIAN ======= */}
            {isElectronic && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
                    <h3 className="font-bold text-blue-800 mb-2 text-sm uppercase">Información de Facturación Electrónica</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            {invoice.electronicStatus === 'ACCEPTED' && (
                                <div className="text-green-700 font-bold">✓ VALIDADA POR LA DIAN</div>
                            )}
                            {invoice.electronicStatus === 'SENT' && (
                                <div className="text-blue-700">Enviada a DIAN - Pendiente validación</div>
                            )}
                            {invoice.electronicSentAt && (
                                <div className="text-gray-600">Fecha validación: {formatDateTime(invoice.electronicSentAt)}</div>
                            )}
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-gray-500">Consulte en: www.dian.gov.co</div>
                        </div>
                    </div>
                    <div className="mt-2 p-2 bg-white rounded border text-xs font-mono break-all">
                        <span className="font-bold">CUFE:</span> {invoice.cufe}
                    </div>
                </div>
            )}

            {/* ======= NOTAS LEGALES ======= */}
            <div className="text-xs text-center text-gray-600 border-t pt-4 space-y-1">
                <div className="font-medium">INFORMACIÓN LEGAL</div>
                <div>La presente factura se asimila en todos sus efectos legales a la letra de cambio (Art. 774 C.C.).</div>
                <div className="flex justify-center gap-4 mt-2">
                    <span>{process.env.NEXT_PUBLIC_GRAN_CONTRIBUYENTE === 'true' ? 'Grandes Contribuyentes' : 'No somos Grandes Contribuyentes'}</span>
                    <span>|</span>
                    <span>{process.env.NEXT_PUBLIC_AUTORETENEDOR === 'true' ? 'Autoretenedores' : 'No somos Autoretenedores'}</span>
                </div>
            </div>

            {/* ======= FOOTER ======= */}
            <div className="text-center mt-6 pt-4 border-t">
                <div className="text-lg font-bold text-gray-700">¡Gracias por su compra!</div>
                <div className="text-xs text-gray-500 mt-1">Conserve esta factura como documento soporte de sus compras</div>
            </div>
        </div>
    )
}
