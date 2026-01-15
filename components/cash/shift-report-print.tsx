'use client'

import { formatCurrency, formatDate } from '@/lib/utils'

interface ShiftReportPrintProps {
  shift: any
  payments: any[]
  totalsByMethod: Record<string, number>
  totalPayments: number
  movements: any[]
  discountsTotal?: number
  discountsByInvoice?: Array<{ invoiceNumber: string; discountTotal: number }>
}

export function ShiftReportPrint({ shift, payments, totalsByMethod, totalPayments, movements, discountsTotal = 0, discountsByInvoice = [] }: ShiftReportPrintProps) {
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
    <div className="thermal-ticket p-4 space-y-3 text-xs">
      {/* Header - Empresa */}
      <div className="text-center border-b pb-2">
        <h1 className="text-base font-bold mb-1">FERRETERIA</h1>
        <div className="text-xs">
          <div>NIT: {process.env.NEXT_PUBLIC_COMPANY_TAX_ID || '900000000-1'}</div>
          <div>{process.env.NEXT_PUBLIC_COMPANY_ADDRESS || 'Dirección de la empresa'}</div>
          <div>Tel: {process.env.NEXT_PUBLIC_COMPANY_PHONE || '0000000'}</div>
        </div>
      </div>

      {/* Tipo y Fecha */}
      <div className="text-center border-b pb-2">
        <div className="font-semibold">REPORTE DE CIERRE DE CAJA</div>
        <div className="text-xs">
          {formatDateTime(shift.openedAt)} - {shift.closedAt ? formatDateTime(shift.closedAt) : 'En curso'}
        </div>
      </div>

      {/* Información del Cajero */}
      <div className="border-b pb-2">
        <div className="font-semibold mb-1">Cajero:</div>
        <div className="text-xs">{shift.user?.name || 'N/A'}</div>
      </div>

      {/* Resumen de Efectivo */}
      <div className="border-b pb-2 space-y-1">
        <div className="font-semibold mb-1">Resumen de Efectivo:</div>
        <div className="flex justify-between text-xs">
          <span>Efectivo Inicial:</span>
          <span className="font-semibold">{formatCurrency(shift.startingCash || 0)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Efectivo Esperado:</span>
          <span className="font-semibold">{formatCurrency(shift.expectedCash || 0)}</span>
        </div>
        {shift.countedCash !== null && shift.countedCash !== undefined && (
          <div className="flex justify-between text-xs">
            <span>Efectivo Contado:</span>
            <span className="font-semibold">{formatCurrency(shift.countedCash)}</span>
          </div>
        )}
        {shift.difference !== null && shift.difference !== undefined && (
          <div className={`flex justify-between text-xs font-bold ${
            shift.difference === 0 ? 'text-green-600' :
            shift.difference > 0 ? 'text-blue-600' : 'text-red-600'
          }`}>
            <span>Diferencia:</span>
            <span>{formatCurrency(shift.difference)}</span>
          </div>
        )}
      </div>

      {/* Ingresos por Método de Pago */}
      {Object.keys(totalsByMethod).length > 0 && (
        <div className="border-b pb-2">
          <div className="font-semibold mb-1">Ingresos por Método de Pago:</div>
          <div className="space-y-1">
            {Object.entries(totalsByMethod).map(([method, amount]: [string, any]) => (
              <div key={method} className="flex justify-between text-xs">
                <span>{getPaymentMethodLabel(method)}:</span>
                <span className="font-semibold">{formatCurrency(amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs font-bold border-t pt-1 mt-1">
              <span>Total Ventas:</span>
              <span>COP {formatCurrency(totalPayments)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Descuentos */}
      {discountsTotal > 0 && (
        <div className="border-b pb-2">
          <div className="font-semibold mb-1">Descuentos aplicados:</div>
          <div className="flex justify-between text-xs">
            <span>Total descuentos:</span>
            <span className="font-semibold">{formatCurrency(discountsTotal)}</span>
          </div>
          {discountsByInvoice.length > 0 && (
            <div className="mt-1 space-y-1">
              {discountsByInvoice.slice(0, 10).map((d) => (
                <div key={d.invoiceNumber} className="flex justify-between text-xs">
                  <span className="font-mono">{d.invoiceNumber}</span>
                  <span className="font-semibold">{formatCurrency(d.discountTotal)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Movimientos de Efectivo */}
      {movements.length > 0 && (
        <div className="border-b pb-2">
          <div className="font-semibold mb-1">Movimientos de Efectivo:</div>
          <div className="space-y-1">
            {movements.map((movement: any) => (
              <div key={movement.id} className="flex justify-between text-xs">
                <div className="flex-1">
                  <div>{movement.type === 'IN' ? 'Entrada' : 'Salida'}</div>
                  <div className="text-xs text-gray-600">{movement.reason || '-'}</div>
                </div>
                <div className={`font-semibold ${movement.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                  {movement.type === 'IN' ? '+' : '-'}{formatCurrency(movement.amount)}
                </div>
              </div>
            ))}
            <div className="flex justify-between text-xs border-t pt-1 mt-1">
              <span>Total Entradas:</span>
              <span className="text-green-600 font-semibold">{formatCurrency(totalIn)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Total Salidas:</span>
              <span className="text-red-600 font-semibold">{formatCurrency(totalOut)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Notas */}
      {shift.notes && (
        <div className="border-b pb-2">
          <div className="font-semibold mb-1">Notas:</div>
          <div className="text-xs">{shift.notes}</div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-600">
        <div>Reporte generado desde Sistema de Ferretería</div>
        <div>{formatDateTime(new Date())}</div>
      </div>
    </div>
  )
}

