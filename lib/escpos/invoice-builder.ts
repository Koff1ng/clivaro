'use client'

import { EscPosEncoder, createEncoder } from './encoder'
import { formatCurrency } from '../utils'

/**
 * Invoice data structure for printing
 */
export interface InvoiceData {
    number: string
    prefix?: string
    customer: {
        name: string
        taxId?: string
        address?: string
        phone?: string
        email?: string
    }
    items: Array<{
        product: {
            name: string
            sku?: string
        }
        quantity: number
        unitPrice: number
        discount?: number
        taxRate?: number
        subtotal: number
    }>
    subtotal: number
    discount: number
    tax: number
    total: number
    issuedAt?: Date | string | null
    dueDate?: Date | string | null
    paidAt?: Date | string | null
    payments?: Array<{
        method: string
        amount: number
    }>
    cufe?: string | null
    electronicStatus?: string
    notes?: string | null
}

export interface CompanyData {
    name: string
    taxId: string
    address?: string
    city?: string
    phone?: string
    email?: string
    regime?: string
}

/**
 * Format date for ticket
 */
function formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return ''
    const d = new Date(date)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
}

/**
 * Truncate text to fit width
 */
function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen - 1) + '.'
}

/**
 * Payment method labels
 */
const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transfer.',
    CREDIT: 'Credito',
    CHECK: 'Cheque',
    MERCADOPAGO: 'MercadoPago',
}

/**
 * Build invoice ticket for ESC/POS printing
 * Width: 32 characters (48 for some printers, configurable)
 */
export function buildInvoiceTicket(
    invoice: InvoiceData,
    company: CompanyData,
    options: { width?: number; openDrawer?: boolean; printQR?: boolean } = {}
): EscPosEncoder {
    const width = options.width || 32
    const encoder = createEncoder()

    // ========== HEADER: Company Info ==========
    encoder
        .align('center')
        .size('large')
        .bold(true)
        .line(truncate(company.name, width))
        .size('normal')
        .bold(false)
        .line(`NIT: ${company.taxId}`)

    if (company.regime) {
        encoder.line(truncate(company.regime, width))
    }
    if (company.address) {
        encoder.line(truncate(company.address, width))
    }
    if (company.city) {
        encoder.line(truncate(company.city, width))
    }
    if (company.phone) {
        encoder.line(`Tel: ${company.phone}`)
    }

    encoder.hr('=', width)

    // ========== DOCUMENT TYPE ==========
    const isElectronic = !!invoice.cufe
    encoder
        .align('center')
        .bold(true)
        .line(isElectronic ? 'FACTURA ELECTRONICA' : 'FACTURA DE VENTA')
        .size('wide')
        .line(`${invoice.prefix || 'FV'}-${invoice.number}`)
        .size('normal')
        .bold(false)
        .hr('-', width)

    // ========== DATES ==========
    encoder.align('left')
    if (invoice.issuedAt) {
        encoder.row('Fecha:', formatDateTime(invoice.issuedAt), width)
    }

    // Payment form
    const isCredit = invoice.dueDate && invoice.issuedAt &&
        new Date(invoice.dueDate).getTime() > new Date(invoice.issuedAt).getTime()
    encoder.row('Forma Pago:', isCredit ? 'CREDITO' : 'CONTADO', width)

    if (isCredit && invoice.dueDate) {
        encoder.row('Vencimiento:', formatDateTime(invoice.dueDate), width)
    }

    encoder.hr('-', width)

    // ========== CUSTOMER ==========
    encoder
        .bold(true)
        .line('CLIENTE:')
        .bold(false)
        .line(truncate(invoice.customer.name, width))

    if (invoice.customer.taxId) {
        encoder.line(`NIT/CC: ${invoice.customer.taxId}`)
    } else {
        encoder.line('CONSUMIDOR FINAL')
    }

    if (invoice.customer.address) {
        encoder.line(truncate(invoice.customer.address, width))
    }

    encoder.hr('-', width)

    // ========== ITEMS HEADER ==========
    encoder
        .bold(true)
        .align('left')

    // Column widths for 32 chars: Cant(4) Desc(16) P.Unit(12)
    if (width >= 48) {
        encoder.tableRow(
            ['CANT', 'DESCRIPCION', 'P.UNIT', 'TOTAL'],
            [5, 22, 10, 11],
            ['right', 'left', 'right', 'right']
        )
    } else {
        encoder.line('CANT DESCRIPCION    P.UNIT')
    }
    encoder.bold(false).hr('-', width)

    // ========== ITEMS ==========
    for (const item of invoice.items) {
        const unitNet = item.unitPrice * (1 - (item.discount || 0) / 100)
        const qty = String(item.quantity)
        const name = truncate(item.product.name, width >= 48 ? 22 : 16)
        const price = formatCurrency(unitNet).replace('$', '').trim()
        const total = formatCurrency(item.subtotal).replace('$', '').trim()

        if (width >= 48) {
            encoder.tableRow(
                [qty, name, price, total],
                [5, 22, 10, 11],
                ['right', 'left', 'right', 'right']
            )
        } else {
            // For 32-char width, print on two lines if needed
            encoder.line(`${qty.padStart(3)} ${name}`)
            encoder.row(`  IVA:${item.taxRate || 0}%`, `$${total}`, width)
        }

        // Show discount if any
        if (item.discount && item.discount > 0) {
            encoder.line(`  Desc: ${item.discount}%`)
        }
    }

    encoder.hr('-', width)

    // ========== TOTALS ==========
    encoder.bold(false)

    // Subtotal
    const subtotalBruto = invoice.subtotal + invoice.discount
    encoder.row('Subtotal:', formatCurrency(subtotalBruto), width)

    // Discount
    if (invoice.discount > 0) {
        encoder.row('(-) Descuento:', formatCurrency(invoice.discount), width)
    }

    // Tax breakdown
    const taxByRate = new Map<number, { base: number; tax: number }>()
    for (const item of invoice.items) {
        const rate = item.taxRate || 0
        const base = item.unitPrice * item.quantity * (1 - (item.discount || 0) / 100)
        const itemTax = base * (rate / 100)
        const prev = taxByRate.get(rate) || { base: 0, tax: 0 }
        taxByRate.set(rate, { base: prev.base + base, tax: prev.tax + itemTax })
    }

    if (taxByRate.size > 0 && invoice.tax > 0) {
        for (const [rate, v] of Array.from(taxByRate.entries()).sort((a, b) => a[0] - b[0])) {
            if (v.tax > 0) {
                encoder.row(`IVA ${rate}%:`, formatCurrency(v.tax), width)
            }
        }
    }

    // TOTAL
    encoder
        .hr('=', width)
        .bold(true)
        .size('wide')
        .row('TOTAL:', formatCurrency(invoice.total), width)
        .size('normal')
        .bold(false)
        .hr('=', width)

    // ========== PAYMENTS ==========
    if (invoice.payments && invoice.payments.length > 0) {
        encoder.line('')
        encoder.bold(true).line('PAGOS:').bold(false)
        for (const payment of invoice.payments) {
            const label = PAYMENT_LABELS[payment.method] || payment.method
            encoder.row(`  ${label}:`, formatCurrency(payment.amount), width)
        }
    }

    // ========== ELECTRONIC INVOICE INFO ==========
    if (isElectronic && invoice.cufe) {
        encoder
            .newline()
            .hr('-', width)
            .align('center')
            .bold(true)
            .line('FACTURA ELECTRONICA')
            .bold(false)

        if (invoice.electronicStatus === 'ACCEPTED') {
            encoder.line('VALIDADA POR LA DIAN')
        }

        if (options.printQR && invoice.cufe) {
            encoder.newline().qrCode(invoice.cufe, 6)
        } else {
            encoder.line('CUFE:')
            // Print CUFE in chunks
            const cufe = invoice.cufe
            for (let i = 0; i < cufe.length; i += width) {
                encoder.line(cufe.slice(i, i + width))
            }
        }
    }

    // ========== NOTES ==========
    if (invoice.notes) {
        encoder
            .newline()
            .hr('-', width)
            .bold(true)
            .line('NOTAS:')
            .bold(false)

        // Word wrap notes
        const words = invoice.notes.split(' ')
        let line = ''
        for (const word of words) {
            if (line.length + word.length + 1 > width) {
                encoder.line(line)
                line = word
            } else {
                line = line ? line + ' ' + word : word
            }
        }
        if (line) encoder.line(line)
    }

    // ========== FOOTER ==========
    encoder
        .newline()
        .hr('-', width)
        .align('center')
        .line('Esta factura equivale a')
        .line('letra de cambio Art.774 C.C.')
        .newline()
        .bold(true)
        .line('Gracias por su compra!')
        .bold(false)
        .newline()

    // ========== CUT PAPER ==========
    if (options.openDrawer) {
        encoder.openDrawer()
    }
    encoder.cut(true)

    return encoder
}

/**
 * Build a simple test ticket
 */
export function buildTestTicket(company: CompanyData): EscPosEncoder {
    const encoder = createEncoder()

    encoder
        .align('center')
        .size('large')
        .bold(true)
        .line('TEST DE IMPRESORA')
        .size('normal')
        .bold(false)
        .newline()
        .line(company.name)
        .line(`NIT: ${company.taxId}`)
        .hr('-', 32)
        .align('left')
        .line('Caracteres especiales:')
        .line('aeiou: ¡Hola Niño!')
        .newline()
        .line('Numeros: 0123456789')
        .line('Simbolos: $%&()+-=')
        .hr('-', 32)
        .align('center')
        .line('Impresora configurada')
        .line('correctamente!')
        .newline()
        .line(new Date().toLocaleString('es-CO'))
        .cut(true)

    return encoder
}

/**
 * Export all from index
 */
export * from './encoder'
export * from './printer'
