'use client'

import { formatCurrency, formatDate } from '@/lib/utils'

interface QuotationPrintLetterProps {
    quotation: any
    settings?: any
}

/**
 * Componente de impresión de cotización en tamaño carta (Letter)
 */
export function QuotationPrintLetter({ quotation, settings }: QuotationPrintLetterProps) {
    if (!quotation) return null

    const formatDateTime = (date: Date | string | null | undefined) => {
        if (!date) return ''
        const d = new Date(date)
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
    }

    // Datos de la empresa emisora (vendedor)
    const companyName = settings?.companyName || process.env.NEXT_PUBLIC_COMPANY_NAME || 'FERRETERIA'
    const companyTaxId = settings?.companyNit || process.env.NEXT_PUBLIC_COMPANY_TAX_ID || '900000000-1'
    const companyAddress = settings?.companyAddress || process.env.NEXT_PUBLIC_COMPANY_ADDRESS || ''
    const companyCity = settings?.companyCity || process.env.NEXT_PUBLIC_COMPANY_CITY || ''
    const companyPhone = settings?.companyPhone || process.env.NEXT_PUBLIC_COMPANY_PHONE || ''
    const companyEmail = settings?.companyEmail || process.env.NEXT_PUBLIC_COMPANY_EMAIL || ''
    let companyRegime = process.env.NEXT_PUBLIC_COMPANY_REGIME || 'Responsable de IVA'

    // Datos del cliente (comprador)
    const customerName = quotation.customer?.name || 'Venta de Mostrador'
    const customerTaxId = quotation.customer?.taxId || ''
    const customerIdType = quotation.customer?.idType || (customerTaxId ? 'NIT' : 'CC')
    const customerAddress = quotation.customer?.address || ''
    const customerCity = quotation.customer?.city || ''
    const customerPhone = quotation.customer?.phone || ''
    const customerEmail = quotation.customer?.email || ''

    // Fechas
    const issueDate = quotation.createdAt
    const validUntil = quotation.validUntil

    // Calcular valores de item
    const quotationItems = Array.isArray(quotation.items) ? quotation.items : []
    
    // Totales
    const subtotalBruto = quotation.subtotal || 0
    const globalDiscount = quotation.discount || 0
    const tax = quotation.tax || 0
    const total = quotation.total || 0

    return (
        <div className="letter-print-content p-8 font-sans text-sm bg-white" style={{ maxWidth: '100%' }}>
            {/* ======= ENCABEZADO ======= */}
            <div className="flex justify-between items-start border-b-2 pb-4 mb-6">
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

                <div className="text-right">
                    <div className="text-lg font-bold text-blue-800 uppercase">
                        COTIZACIÓN
                    </div>
                    <div className="text-2xl font-bold text-blue-900 mt-2">{quotation.number || 'N/A'}</div>
                </div>
            </div>

            {/* ======= INFORMACIÓN DE FECHAS Y CLIENTE ======= */}
            <div className="grid grid-cols-2 gap-8 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg border">
                    <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase">Información del Documento</h3>
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Fecha Generación:</span>
                            <span className="font-medium">{formatDateTime(issueDate)}</span>
                        </div>
                        {validUntil && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Válida Hasta:</span>
                                <span className="font-medium">{formatDateTime(validUntil)}</span>
                            </div>
                        )}
                        {quotation.lead && (
                            <div className="flex justify-between mt-2 pt-2 border-t">
                                <span className="text-gray-600">Oportunidad CV:</span>
                                <span className="font-medium">{quotation.lead.name}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border">
                    <h3 className="font-bold text-gray-700 mb-2 text-sm uppercase">Cliente</h3>
                    <div className="space-y-1 text-sm">
                        <div className="font-bold text-gray-900">{customerName}</div>
                        {customerTaxId && <div>{customerIdType}: {customerTaxId}</div>}
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
                            <th className="p-2 text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {quotationItems.length > 0 ? (
                            quotationItems.map((item: any, index: number) => {
                                return (
                                    <tr key={item.id || index} className="border-b border-gray-200">
                                        <td className="p-2 font-mono text-xs">{item.product?.sku || '-'}</td>
                                        <td className="p-2">{item.product?.name || 'Producto sin nombre'}</td>
                                        <td className="p-2 text-center">{item.quantity || 0}</td>
                                        <td className="p-2 text-right">{formatCurrency(item.unitPrice || 0)}</td>
                                        <td className="p-2 text-center">{item.discount ? `${item.discount}%` : '0%'}</td>
                                        <td className="p-2 text-center">{item.taxRate || 0}%</td>
                                        <td className="p-2 text-right font-medium">{formatCurrency(item.subtotal || 0)}</td>
                                    </tr>
                                )
                            })
                        ) : (
                            <tr>
                                <td colSpan={7} className="p-4 text-center text-gray-500">No hay productos en esta cotización</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ======= TOTALES ======= */}
            <div className="flex justify-end mb-6">
                <div className="w-80 bg-gray-50 p-4 rounded-lg border">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Subtotal:</span>
                            <span>{formatCurrency(subtotalBruto + globalDiscount)}</span>
                        </div>
                        {globalDiscount > 0 && (
                            <div className="flex justify-between text-red-600">
                                <span>(-) Descuento Aplicado:</span>
                                <span>{formatCurrency(globalDiscount)}</span>
                            </div>
                        )}
                        {tax > 0 && (
                            <div className="flex justify-between font-medium">
                                <span>IVA:</span>
                                <span>{formatCurrency(tax)}</span>
                            </div>
                        )}

                        <div className="flex justify-between text-lg font-bold border-t-2 pt-2 mt-2 text-blue-900">
                            <span>TOTAL COTIZADO (COP):</span>
                            <span>{formatCurrency(total)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ======= NOTAS Y TÉRMINOS ======= */}
            {quotation.notes && (
                <div className="mb-6 bg-gray-50 p-4 rounded-lg border text-gray-800 text-sm">
                    <h3 className="font-bold text-gray-700 mb-2 uppercase text-xs">Observaciones y Condiciones Comerciales</h3>
                    <p className="whitespace-pre-wrap">{quotation.notes}</p>
                </div>
            )}

            {/* ======= FOOTER ======= */}
            <div className="text-center mt-6 pt-4 border-t">
                <div className="text-xs text-gray-500">Este documento es una estimación de costos y no constituye una obligación de compra ni genera compromiso tributario. Los precios pueden variar tras expirar la vigencia de la cotización.</div>
            </div>
        </div>
    )
}
