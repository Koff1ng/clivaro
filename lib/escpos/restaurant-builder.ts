'use client'

import { createEncoder, EscPosEncoder } from './encoder'

/**
 * Restaurant-specific ESC/POS ticket builders.
 * 
 * - buildKitchenComanda(): Kitchen ticket — large font, no prices, notes highlighted
 * - buildRestaurantReceipt(): Customer receipt — full breakdown with tips, discounts
 */

// ── Types ──

export interface ComandaItem {
  productName: string
  quantity: number
  notes?: string | null
}

export interface RestaurantReceiptData {
  tableNumber: string
  waiterName: string
  zoneName?: string
  items: Array<{
    productName: string
    quantity: number
    unitPrice: number
    notes?: string | null
    status: string
  }>
  subtotal: number
  taxAmount: number
  total: number
  tipAmount: number
  discountAmount: number
  paymentMethod?: string
  payments?: Array<{ method: string; amount: number }>
  customerName?: string | null
  customerTaxId?: string | null
}

export interface RestaurantCompany {
  name: string
  taxId?: string
  address?: string
  phone?: string
  regime?: string
}

export interface RestaurantPrintOptions {
  width?: number // 32 or 48
  autoCut?: boolean
  openDrawer?: boolean
}

// ── Helpers ──

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function padRow(left: string, right: string, width: number): string {
  const space = Math.max(1, width - left.length - right.length)
  return left + ' '.repeat(space) + right
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '.' : str
}

// ── Kitchen Comanda ──

export function buildKitchenComanda(
  tableName: string,
  waiterName: string,
  items: ComandaItem[],
  options: RestaurantPrintOptions = {}
): EscPosEncoder {
  const W = options.width || 32
  const enc = createEncoder()

  // Header — BIG and bold
  enc.align('center')
  enc.line('*** COMANDA ***', { bold: true, size: 'large' })
  enc.newline()
  enc.hr('=', W)

  // Table & Waiter — double height for visibility
  enc.line(`MESA: ${tableName}`, { bold: true, size: 'tall' })
  enc.line(`Mesero: ${waiterName}`, { bold: true })

  // Timestamp
  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
  enc.line(`${dateStr}  ${timeStr}`)
  enc.hr('=', W)

  // Items — large and clear for kitchen staff
  enc.align('left')
  for (const item of items) {
    enc.newline()
    enc.line(`${item.quantity}x ${truncate(item.productName, W - 4)}`, { bold: true, size: 'tall' })
    if (item.notes && item.notes.trim()) {
      enc.line(`   >> ${item.notes}`, { bold: true })
    }
  }

  enc.newline()
  enc.hr('=', W)
  enc.align('center')
  enc.line('PREPARAR', { bold: true, size: 'large' })
  enc.newline()

  if (options.autoCut !== false) enc.cut()

  return enc
}

// ── Customer Receipt ──

export function buildRestaurantReceipt(
  data: RestaurantReceiptData,
  company: RestaurantCompany,
  options: RestaurantPrintOptions = {}
): EscPosEncoder {
  const W = options.width || 32
  const enc = createEncoder()

  // Company header
  enc.align('center')
  enc.line(company.name, { bold: true, size: 'large' })
  if (company.taxId) enc.line(`NIT: ${company.taxId}`)
  if (company.regime) enc.line(company.regime)
  if (company.address) enc.line(company.address)
  if (company.phone) enc.line(`Tel: ${company.phone}`)
  enc.hr('-', W)

  // Document title
  enc.line('CUENTA', { bold: true, size: 'tall' })
  enc.hr('-', W)

  // Table info
  enc.align('left')
  enc.row(`Mesa: ${data.tableNumber}`, `Mesero: ${data.waiterName}`, W)
  if (data.zoneName) enc.line(`Area: ${data.zoneName}`)

  // Timestamp
  const now = new Date()
  enc.line(`Fecha: ${now.toLocaleDateString('es-CO')} ${now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`)

  // Customer
  if (data.customerName) {
    enc.line(`Cliente: ${data.customerName}`)
    if (data.customerTaxId) enc.line(`NIT: ${data.customerTaxId}`)
  }

  enc.hr('-', W)

  // Items header
  const qW = 4, tW = W < 40 ? 10 : 12
  const dW = W - qW - tW
  enc.line(
    'Cant'.padEnd(qW) + 'Descripcion'.padEnd(dW) + 'Total'.padStart(tW),
    { bold: true }
  )
  enc.hr('-', W)

  // Items
  const activeItems = data.items.filter(i => i.status !== 'CANCELLED')
  for (const item of activeItems) {
    const qty = String(item.quantity).padEnd(qW)
    const desc = truncate(item.productName, dW - 1).padEnd(dW)
    const total = fmtCurrency(item.quantity * item.unitPrice).padStart(tW)
    enc.line(`${qty}${desc}${total}`)
    if (item.notes && item.notes.trim()) {
      enc.line(`    [${item.notes}]`)
    }
  }

  enc.hr('-', W)

  // Totals
  enc.row('Subtotal:', fmtCurrency(data.subtotal), W)
  if (data.taxAmount > 0) {
    enc.row('Impuestos:', fmtCurrency(data.taxAmount), W)
  }
  if (data.discountAmount > 0) {
    enc.row('Descuento:', `-${fmtCurrency(data.discountAmount)}`, W)
  }
  if (data.tipAmount > 0) {
    enc.row('Propina:', fmtCurrency(data.tipAmount), W)
  }

  enc.hr('=', W)
  const grandTotal = data.total + data.tipAmount - data.discountAmount
  enc.align('center')
  enc.line(`TOTAL: ${fmtCurrency(grandTotal)}`, { bold: true, size: 'large' })
  enc.hr('=', W)

  // Payment info
  if (data.payments && data.payments.length > 0) {
    enc.align('left')
    enc.line('FORMA DE PAGO:', { bold: true })
    for (const p of data.payments) {
      const label = p.method === 'CASH' ? 'Efectivo' : p.method === 'CARD' ? 'Tarjeta' : 'Transferencia'
      enc.row(`  ${label}:`, fmtCurrency(p.amount), W)
    }
    // Change calculation for cash
    const totalPaid = data.payments.reduce((s, p) => s + p.amount, 0)
    if (totalPaid > grandTotal) {
      enc.row('  Cambio:', fmtCurrency(totalPaid - grandTotal), W)
    }
    enc.hr('-', W)
  } else if (data.paymentMethod) {
    enc.row('Pago:', data.paymentMethod, W)
    enc.hr('-', W)
  }

  // Footer
  enc.align('center')
  enc.newline()
  enc.line('Gracias por su preferencia')
  enc.newline()

  if (options.openDrawer) enc.openDrawer()
  if (options.autoCut !== false) enc.cut()

  return enc
}
