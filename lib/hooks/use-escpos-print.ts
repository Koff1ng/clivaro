'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    ThermalPrinter,
    createPrinter,
    getGlobalPrinter,
    isWebSerialSupported,
    PrinterStatus,
    PrinterInfo,
    EscPosEncoder,
    buildInvoiceTicket,
    buildTestTicket,
    InvoiceData,
    CompanyData
} from '@/lib/escpos'

export interface UseEscPosPrintOptions {
    /** Use global printer instance (shared across components) */
    useGlobal?: boolean
    /** Auto-connect to previously saved printer */
    autoConnect?: boolean
    /** Paper width in characters (32 or 48) */
    paperWidth?: number
    /** Open cash drawer after printing */
    openDrawer?: boolean
    /** Print QR code for electronic invoices */
    printQR?: boolean
}

export interface UseEscPosPrintReturn {
    /** WebSerial API support check */
    isSupported: boolean
    /** Current printer status */
    status: PrinterStatus
    /** Connected printer info */
    printerInfo: PrinterInfo | null
    /** List of previously paired printers */
    savedPrinters: PrinterInfo[]
    /** Error message if any */
    error: string | null
    /** Is currently printing */
    isPrinting: boolean
    /** Select and connect to a new printer */
    selectPrinter: () => Promise<boolean>
    /** Connect to a saved printer */
    connectToSaved: (printer: PrinterInfo) => Promise<boolean>
    /** Disconnect from current printer */
    disconnect: () => Promise<void>
    /** Print raw encoder data */
    printRaw: (encoder: EscPosEncoder) => Promise<boolean>
    /** Print invoice ticket */
    printInvoice: (invoice: InvoiceData, company: CompanyData) => Promise<boolean>
    /** Print test ticket */
    printTest: (company: CompanyData) => Promise<boolean>
    /** Refresh saved printers list */
    refreshSavedPrinters: () => Promise<void>
}

/**
 * Hook for ESC/POS thermal printer management
 */
export function useEscPosPrint(options: UseEscPosPrintOptions = {}): UseEscPosPrintReturn {
    const {
        useGlobal = true,
        autoConnect = true,
        paperWidth = 32,
        openDrawer = false,
        printQR = true,
    } = options

    const printerRef = useRef<ThermalPrinter | null>(null)
    const [status, setStatus] = useState<PrinterStatus>('disconnected')
    const [printerInfo, setPrinterInfo] = useState<PrinterInfo | null>(null)
    const [savedPrinters, setSavedPrinters] = useState<PrinterInfo[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isPrinting, setIsPrinting] = useState(false)

    const isSupported = isWebSerialSupported()

    // Get or create printer instance
    const getPrinter = useCallback(() => {
        if (!printerRef.current) {
            printerRef.current = useGlobal ? getGlobalPrinter() : createPrinter()
        }
        return printerRef.current
    }, [useGlobal])

    // Subscribe to status changes
    useEffect(() => {
        if (!isSupported) return

        const printer = getPrinter()
        const unsubscribe = printer.onStatusChange(newStatus => {
            setStatus(newStatus)
            if (newStatus === 'error') {
                setError('Error de conexión con la impresora')
            }
        })

        // Set initial status
        setStatus(printer.status)

        return () => {
            unsubscribe()
        }
    }, [getPrinter, isSupported])

    // Load saved printers on mount
    useEffect(() => {
        if (!isSupported) return
        refreshSavedPrinters()
    }, [isSupported])

    // Auto-connect to first saved printer
    useEffect(() => {
        if (!isSupported || !autoConnect || savedPrinters.length === 0) return
        if (status !== 'disconnected') return

        // Try to connect to first saved printer
        const saved = savedPrinters[0]
        if (saved) {
            connectToSaved(saved).catch(console.error)
        }
    }, [savedPrinters, autoConnect, status, isSupported])

    // Refresh saved printers list
    const refreshSavedPrinters = useCallback(async () => {
        if (!isSupported) return
        try {
            const printer = getPrinter()
            const printers = await printer.getSavedPorts()
            setSavedPrinters(printers)
        } catch (err) {
            console.error('Error loading saved printers:', err)
        }
    }, [getPrinter, isSupported])

    // Select and connect to a new printer
    const selectPrinter = useCallback(async (): Promise<boolean> => {
        if (!isSupported) {
            setError('WebSerial no es soportado en este navegador')
            return false
        }

        setError(null)
        const printer = getPrinter()

        try {
            const info = await printer.requestPrinter()
            if (!info) {
                // User cancelled
                return false
            }

            setPrinterInfo(info)
            await printer.connect()
            await refreshSavedPrinters()
            return true
        } catch (err: any) {
            setError(err.message || 'Error al conectar impresora')
            return false
        }
    }, [getPrinter, refreshSavedPrinters, isSupported])

    // Connect to a saved printer
    const connectToSaved = useCallback(async (info: PrinterInfo): Promise<boolean> => {
        if (!isSupported) {
            setError('WebSerial no es soportado en este navegador')
            return false
        }

        setError(null)
        const printer = getPrinter()

        try {
            await printer.useSavedPort(info)
            setPrinterInfo(info)
            return true
        } catch (err: any) {
            setError(err.message || 'Error al conectar impresora')
            return false
        }
    }, [getPrinter, isSupported])

    // Disconnect
    const disconnect = useCallback(async (): Promise<void> => {
        const printer = getPrinter()
        await printer.disconnect()
        setPrinterInfo(null)
    }, [getPrinter])

    // Print raw encoder data
    const printRaw = useCallback(async (encoder: EscPosEncoder): Promise<boolean> => {
        if (status !== 'connected') {
            setError('Impresora no conectada')
            return false
        }

        setError(null)
        setIsPrinting(true)
        const printer = getPrinter()

        try {
            await printer.print(encoder)
            setIsPrinting(false)
            return true
        } catch (err: any) {
            setError(err.message || 'Error al imprimir')
            setIsPrinting(false)
            return false
        }
    }, [getPrinter, status])

    // Print invoice
    const printInvoice = useCallback(async (
        invoice: InvoiceData,
        company: CompanyData
    ): Promise<boolean> => {
        const encoder = buildInvoiceTicket(invoice, company, {
            width: paperWidth,
            openDrawer,
            printQR,
        })
        return printRaw(encoder)
    }, [printRaw, paperWidth, openDrawer, printQR])

    // Print test
    const printTest = useCallback(async (company: CompanyData): Promise<boolean> => {
        const encoder = buildTestTicket(company)
        return printRaw(encoder)
    }, [printRaw])

    return {
        isSupported,
        status,
        printerInfo,
        savedPrinters,
        error,
        isPrinting,
        selectPrinter,
        connectToSaved,
        disconnect,
        printRaw,
        printInvoice,
        printTest,
        refreshSavedPrinters,
    }
}
