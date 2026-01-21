'use client'

import { formatCurrency, formatDate } from '@/lib/utils'

interface ShiftReportPrintLetterProps {
    shift: any
    payments: any[]
    totalsByMethod: Record<string, number>
    totalPayments: number
    movements: any[]
    discountsTotal?: number
    discountsByInvoice?: Array<{ invoiceNumber: string; discountTotal: number }>
}

/**
 * Shift report component optimized for letter-size (Carta) printing
 * Uses larger fonts and full-width tables for better readability
 */
export function ShiftReportPrintLetter({
    shift,
    payments,
    totalsByMethod,
    totalPayments,
    movements,
    discountsTotal = 0,
    discountsByInvoice = []
}: ShiftReportPrintLetterProps) {
    if (!shift) return null

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

    const getPaymentMethodLabel = (method: string) => {
        switch (method) {
            case 'CASH': return 'Efectivo'
            case 'CARD': return 'Tarjeta'
            case 'TRANSFER': return 'Transferencia'
            default: return method
        }
    }

    const totalIn = movements
        .filter((m: any) => m.type === 'IN')
        .reduce((sum: number, m: any) => sum + m.amount, 0)
    const totalOut = movements
        .filter((m: any) => m.type === 'OUT')
        .reduce((sum: number, m: any) => sum + m.amount, 0)

    return (
        <div className="letter-print-content p-8 font-sans text-sm" style={{ maxWidth: '100%' }}>
            {/* Header - Empresa */}
            <div className="text-center border-b pb-4 mb-6">
                <h1 className="text-2xl font-bold mb-2">
                    {process.env.NEXT_PUBLIC_COMPANY_NAME || 'FERRETERIA'}
                </h1>
                <div className="text-sm text-gray-600">
                    <div>NIT: {process.env.NEXT_PUBLIC_COMPANY_TAX_ID || '900000000-1'}</div>
                    <div>{process.env.NEXT_PUBLIC_COMPANY_ADDRESS || 'Dirección de la empresa'}</div>
                    <div>Tel: {process.env.NEXT_PUBLIC_COMPANY_PHONE || '0000000'}</div>
                </div>
            </div>

            {/* Título del Reporte */}
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold">REPORTE DE CIERRE DE CAJA</h2>
                <div className="text-sm text-gray-600 mt-2">
                    Período: {formatDateTime(shift.openedAt)} - {shift.closedAt ? formatDateTime(shift.closedAt) : 'En curso'}
                </div>
            </div>

            {/* Información del Cajero */}
            <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 border rounded">
                <div>
                    <div className="text-xs text-gray-500">Cajero:</div>
                    <div className="font-semibold">{shift.user?.name || 'N/A'}</div>
                </div>
                <div>
                    <div className="text-xs text-gray-500">Estado:</div>
                    <div className="font-semibold">{shift.status === 'CLOSED' ? 'Cerrado' : 'Abierto'}</div>
                </div>
            </div>

            {/* Resumen de Efectivo - Grid */}
            <div className="mb-6">
                <h3 className="text-lg font-bold border-b pb-2 mb-4">Resumen de Efectivo</h3>
                <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 border rounded text-center">
                        <div className="text-xs text-gray-500 mb-1">Efectivo Inicial</div>
                        <div className="text-xl font-bold text-blue-600">{formatCurrency(shift.startingCash || 0)}</div>
                    </div>
                    <div className="p-4 border rounded text-center">
                        <div className="text-xs text-gray-500 mb-1">Efectivo Esperado</div>
                        <div className="text-xl font-bold text-green-600">{formatCurrency(shift.expectedCash || 0)}</div>
                    </div>
                    {shift.countedCash !== null && shift.countedCash !== undefined && (
                        <div className="p-4 border rounded text-center">
                            <div className="text-xs text-gray-500 mb-1">Efectivo Contado</div>
                            <div className="text-xl font-bold">{formatCurrency(shift.countedCash)}</div>
                        </div>
                    )}
                    {shift.difference !== null && shift.difference !== undefined && (
                        <div className="p-4 border rounded text-center">
                            <div className="text-xs text-gray-500 mb-1">Diferencia</div>
                            <div className={`text-xl font-bold ${shift.difference === 0 ? 'text-green-600' :
                                    shift.difference > 0 ? 'text-blue-600' : 'text-red-600'
                                }`}>
                                {formatCurrency(shift.difference)}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Ingresos por Método de Pago */}
            {Object.keys(totalsByMethod).length > 0 && (
                <div className="mb-6 avoid-break">
                    <h3 className="text-lg font-bold border-b pb-2 mb-4">Ingresos por Método de Pago</h3>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2 text-left">Método</th>
                                <th className="border p-2 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(totalsByMethod).map(([method, amount]: [string, any]) => (
                                <tr key={method}>
                                    <td className="border p-2">{getPaymentMethodLabel(method)}</td>
                                    <td className="border p-2 text-right font-semibold">{formatCurrency(amount)}</td>
                                </tr>
                            ))}
                            <tr className="bg-blue-50 font-bold">
                                <td className="border p-2">TOTAL VENTAS</td>
                                <td className="border p-2 text-right text-blue-600">{formatCurrency(totalPayments)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Descuentos */}
            {discountsTotal > 0 && (
                <div className="mb-6 avoid-break">
                    <h3 className="text-lg font-bold border-b pb-2 mb-4">Descuentos Aplicados</h3>
                    <div className="p-4 border rounded bg-orange-50">
                        <div className="text-sm text-gray-600">Total descuentos:</div>
                        <div className="text-xl font-bold text-orange-600">{formatCurrency(discountsTotal)}</div>
                    </div>
                    {discountsByInvoice.length > 0 && (
                        <table className="w-full border-collapse mt-4">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border p-2 text-left">Factura</th>
                                    <th className="border p-2 text-right">Descuento</th>
                                </tr>
                            </thead>
                            <tbody>
                                {discountsByInvoice.map((d) => (
                                    <tr key={d.invoiceNumber}>
                                        <td className="border p-2 font-mono">{d.invoiceNumber}</td>
                                        <td className="border p-2 text-right">{formatCurrency(d.discountTotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Movimientos de Efectivo */}
            {movements.length > 0 && (
                <div className="mb-6 avoid-break">
                    <h3 className="text-lg font-bold border-b pb-2 mb-4">Movimientos de Efectivo</h3>
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border p-2 text-left">Tipo</th>
                                <th className="border p-2 text-left">Razón</th>
                                <th className="border p-2 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movements.map((movement: any) => (
                                <tr key={movement.id}>
                                    <td className={`border p-2 ${movement.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                        {movement.type === 'IN' ? 'Entrada' : 'Salida'}
                                    </td>
                                    <td className="border p-2">{movement.reason || '-'}</td>
                                    <td className={`border p-2 text-right font-semibold ${movement.type === 'IN' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {movement.type === 'IN' ? '+' : '-'}{formatCurrency(movement.amount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50">
                                <td colSpan={2} className="border p-2 font-semibold">Total Entradas</td>
                                <td className="border p-2 text-right font-bold text-green-600">{formatCurrency(totalIn)}</td>
                            </tr>
                            <tr className="bg-gray-50">
                                <td colSpan={2} className="border p-2 font-semibold">Total Salidas</td>
                                <td className="border p-2 text-right font-bold text-red-600">{formatCurrency(totalOut)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            {/* Notas */}
            {shift.notes && (
                <div className="mb-6">
                    <h3 className="text-lg font-bold border-b pb-2 mb-4">Notas</h3>
                    <div className="p-4 bg-gray-50 border rounded">{shift.notes}</div>
                </div>
            )}

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 border-t pt-4 mt-8">
                <div>Reporte generado desde Sistema de Ferretería</div>
                <div>{formatDateTime(new Date())}</div>
            </div>
        </div>
    )
}
