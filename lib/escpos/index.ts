/**
 * ESC/POS Thermal Printing Library
 * 
 * Usage:
 * import { createEncoder, createPrinter, buildInvoiceTicket } from '@/lib/escpos'
 * 
 * // Create printer and connect
 * const printer = createPrinter()
 * await printer.requestPrinter()
 * await printer.connect()
 * 
 * // Build and print invoice
 * const encoder = buildInvoiceTicket(invoice, company)
 * await printer.print(encoder)
 */

export { EscPosEncoder, createEncoder, Commands } from './encoder'
export type { TextAlign, TextSize, TextOptions } from './encoder'

export {
    ThermalPrinter,
    createPrinter,
    getGlobalPrinter,
    isWebSerialSupported,
    KNOWN_VENDORS
} from './printer'
export type { PrinterStatus, PrinterInfo, PrinterConfig } from './printer'

export {
    buildInvoiceTicket,
    buildTestTicket
} from './invoice-builder'
export type { InvoiceData, CompanyData } from './invoice-builder'
