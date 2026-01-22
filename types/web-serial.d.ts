/**
 * Web Serial API Type Declarations
 * These types are for the Web Serial API which is available in Chrome/Edge
 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API
 */

interface SerialPortInfo {
    usbVendorId?: number
    usbProductId?: number
}

interface SerialOptions {
    baudRate: number
    dataBits?: 7 | 8
    stopBits?: 1 | 2
    parity?: 'none' | 'even' | 'odd'
    bufferSize?: number
    flowControl?: 'none' | 'hardware'
}

interface SerialPort {
    readonly readable: ReadableStream<Uint8Array> | null
    readonly writable: WritableStream<Uint8Array> | null
    getInfo(): SerialPortInfo
    open(options: SerialOptions): Promise<void>
    close(): Promise<void>
}

interface SerialPortRequestOptions {
    filters?: Array<{ usbVendorId?: number; usbProductId?: number }>
}

interface Serial {
    getPorts(): Promise<SerialPort[]>
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
    addEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void
    removeEventListener(type: 'connect' | 'disconnect', listener: (event: Event) => void): void
}

declare global {
    interface Navigator {
        serial: Serial
    }
}

export { }
