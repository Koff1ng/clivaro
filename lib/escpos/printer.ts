'use client'

/**
 * Thermal Printer Connection Manager
 * Uses WebSerial API to connect to USB thermal printers
 */

export type PrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'printing' | 'error'

export interface PrinterInfo {
    name: string
    vendorId?: number
    productId?: number
    port?: SerialPort
}

export interface PrinterConfig {
    baudRate?: number
    dataBits?: 8 | 7
    stopBits?: 1 | 2
    parity?: 'none' | 'even' | 'odd'
    flowControl?: 'none' | 'hardware'
}

const DEFAULT_CONFIG: PrinterConfig = {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    flowControl: 'none',
}

// Common thermal printer USB vendor IDs
export const KNOWN_VENDORS: Record<number, string> = {
    0x04B8: 'Epson',
    0x0519: 'Star Micronics',
    0x0FE6: 'Bixolon',
    0x0416: 'Winbond (Generic)',
    0x0483: 'STMicroelectronics (Generic)',
    0x1A86: 'QinHeng (CH340)',
    0x067B: 'Prolific (PL2303)',
    0x10C4: 'Silabs (CP210x)',
    0x0403: 'FTDI',
}

/**
 * Check if WebSerial is supported
 */
export function isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator
}

/**
 * Thermal Printer class
 * Manages connection and communication with thermal printers
 */
export class ThermalPrinter {
    private port: SerialPort | null = null
    private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
    private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    private config: PrinterConfig
    private _status: PrinterStatus = 'disconnected'
    private statusListeners: Set<(status: PrinterStatus) => void> = new Set()

    constructor(config?: PrinterConfig) {
        this.config = { ...DEFAULT_CONFIG, ...config }
    }

    /**
     * Get current status
     */
    get status(): PrinterStatus {
        return this._status
    }

    /**
     * Set status and notify listeners
     */
    private setStatus(status: PrinterStatus): void {
        this._status = status
        this.statusListeners.forEach(listener => listener(status))
    }

    /**
     * Subscribe to status changes
     */
    onStatusChange(listener: (status: PrinterStatus) => void): () => void {
        this.statusListeners.add(listener)
        return () => this.statusListeners.delete(listener)
    }

    /**
     * Check if connected
     */
    get isConnected(): boolean {
        return this._status === 'connected' || this._status === 'printing'
    }

    /**
     * Request printer from user (shows browser picker)
     */
    async requestPrinter(): Promise<PrinterInfo | null> {
        if (!isWebSerialSupported()) {
            throw new Error('WebSerial API no es soportada en este navegador. Usa Chrome o Edge.')
        }

        try {
            this.setStatus('connecting')

            // Request a port from user
            const port = await navigator.serial.requestPort({
                // Filter for known thermal printer vendors (optional)
                // filters: Object.keys(KNOWN_VENDORS).map(vid => ({ usbVendorId: parseInt(vid) }))
            })

            this.port = port
            const info = port.getInfo()

            return {
                name: KNOWN_VENDORS[info.usbVendorId || 0] || 'Impresora Térmica',
                vendorId: info.usbVendorId,
                productId: info.usbProductId,
                port,
            }
        } catch (error: any) {
            this.setStatus('disconnected')
            if (error.name === 'NotFoundError') {
                // User cancelled the picker
                return null
            }
            throw error
        }
    }

    /**
     * Connect to the selected printer
     */
    async connect(): Promise<void> {
        if (!this.port) {
            throw new Error('No hay impresora seleccionada. Llama a requestPrinter() primero.')
        }

        try {
            this.setStatus('connecting')

            // Open the serial port
            await this.port.open({
                baudRate: this.config.baudRate!,
                dataBits: this.config.dataBits,
                stopBits: this.config.stopBits,
                parity: this.config.parity,
                flowControl: this.config.flowControl,
            })

            // Get writer for sending data
            if (this.port.writable) {
                this.writer = this.port.writable.getWriter()
            }

            // Get reader for receiving responses
            if (this.port.readable) {
                this.reader = this.port.readable.getReader()
            }

            this.setStatus('connected')
            console.log('Impresora conectada:', this.port.getInfo())
        } catch (error: any) {
            this.setStatus('error')
            throw new Error(`Error al conectar impresora: ${error.message}`)
        }
    }

    /**
     * Disconnect from printer
     */
    async disconnect(): Promise<void> {
        try {
            if (this.writer) {
                await this.writer.close()
                this.writer = null
            }
            if (this.reader) {
                await this.reader.cancel()
                this.reader = null
            }
            if (this.port) {
                await this.port.close()
                this.port = null
            }
            this.setStatus('disconnected')
        } catch (error: any) {
            console.error('Error al desconectar:', error)
            this.setStatus('disconnected')
        }
    }

    /**
     * Send raw bytes to printer
     */
    async write(data: Uint8Array): Promise<void> {
        if (!this.writer) {
            throw new Error('No hay conexión con la impresora')
        }

        try {
            this.setStatus('printing')
            await this.writer.write(data)
            this.setStatus('connected')
        } catch (error: any) {
            this.setStatus('error')
            throw new Error(`Error al enviar datos: ${error.message}`)
        }
    }

    /**
     * Print using an encoder
     */
    async print(encoder: { encode(): Uint8Array }): Promise<void> {
        const data = encoder.encode()
        await this.write(data)
    }

    /**
     * Get saved printers from browser
     */
    async getSavedPorts(): Promise<PrinterInfo[]> {
        if (!isWebSerialSupported()) {
            return []
        }

        try {
            const ports = await navigator.serial.getPorts()
            return ports.map(port => {
                const info = port.getInfo()
                return {
                    name: KNOWN_VENDORS[info.usbVendorId || 0] || 'Impresora Térmica',
                    vendorId: info.usbVendorId,
                    productId: info.usbProductId,
                    port,
                }
            })
        } catch (error) {
            console.error('Error al obtener puertos guardados:', error)
            return []
        }
    }

    /**
     * Use a previously saved port
     */
    async useSavedPort(portInfo: PrinterInfo): Promise<void> {
        if (portInfo.port) {
            this.port = portInfo.port
            await this.connect()
        }
    }
}

/**
 * Create a new printer instance
 */
export function createPrinter(config?: PrinterConfig): ThermalPrinter {
    return new ThermalPrinter(config)
}

/**
 * Singleton printer instance for global use
 */
let globalPrinter: ThermalPrinter | null = null

export function getGlobalPrinter(): ThermalPrinter {
    if (!globalPrinter) {
        globalPrinter = new ThermalPrinter()
    }
    return globalPrinter
}
