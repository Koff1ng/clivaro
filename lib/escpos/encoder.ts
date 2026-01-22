'use client'

/**
 * ESC/POS Command Encoder
 * Encodes text and commands into ESC/POS byte sequences
 * Compatible with most thermal receipt printers (Epson, Star, Bixolon, etc.)
 */

// ESC/POS Command Constants
export const ESC = 0x1B
export const GS = 0x1D
export const FS = 0x1C
export const DLE = 0x10
export const EOT = 0x04
export const NUL = 0x00
export const LF = 0x0A

// Command sequences
export const Commands = {
    // Initialization
    INIT: [ESC, 0x40], // Initialize printer

    // Text alignment
    ALIGN_LEFT: [ESC, 0x61, 0x00],
    ALIGN_CENTER: [ESC, 0x61, 0x01],
    ALIGN_RIGHT: [ESC, 0x61, 0x02],

    // Text formatting
    BOLD_ON: [ESC, 0x45, 0x01],
    BOLD_OFF: [ESC, 0x45, 0x00],
    UNDERLINE_ON: [ESC, 0x2D, 0x01],
    UNDERLINE_OFF: [ESC, 0x2D, 0x00],
    INVERT_ON: [GS, 0x42, 0x01],
    INVERT_OFF: [GS, 0x42, 0x00],

    // Text size
    NORMAL_SIZE: [ESC, 0x21, 0x00],
    DOUBLE_WIDTH: [ESC, 0x21, 0x20],
    DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
    DOUBLE_SIZE: [ESC, 0x21, 0x30], // Double width and height

    // Line spacing
    LINE_SPACING_DEFAULT: [ESC, 0x32],
    LINE_SPACING_SET: (n: number) => [ESC, 0x33, n], // n/180 inch

    // Paper handling
    CUT_PARTIAL: [GS, 0x56, 0x01],
    CUT_FULL: [GS, 0x56, 0x00],
    FEED_LINES: (n: number) => [ESC, 0x64, n],
    FEED_PAPER: (n: number) => [ESC, 0x4A, n], // n/180 inch

    // Cash drawer
    OPEN_DRAWER_PIN2: [ESC, 0x70, 0x00, 0x19, 0x78], // Pin 2
    OPEN_DRAWER_PIN5: [ESC, 0x70, 0x01, 0x19, 0x78], // Pin 5

    // Beep
    BEEP: [ESC, 0x42, 0x03, 0x02], // 3 beeps, 200ms

    // Barcode
    BARCODE_HEIGHT: (n: number) => [GS, 0x68, n],
    BARCODE_WIDTH: (n: number) => [GS, 0x77, n], // 2-6
    BARCODE_TEXT_BELOW: [GS, 0x48, 0x02],
    BARCODE_TEXT_NONE: [GS, 0x48, 0x00],

    // QR Code
    QR_MODEL: [GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00], // Model 2
    QR_SIZE: (n: number) => [GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, n], // 1-16
    QR_ERROR_CORRECTION: (level: 'L' | 'M' | 'Q' | 'H') => {
        const levels = { L: 0x30, M: 0x31, Q: 0x32, H: 0x33 }
        return [GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, levels[level]]
    },

    // Character sets
    CHARSET_PC437: [ESC, 0x74, 0x00], // USA Standard
    CHARSET_PC850: [ESC, 0x74, 0x02], // Multilingual Latin I
    CHARSET_PC858: [ESC, 0x74, 0x13], // Latin I + Euro
    CHARSET_UTF8: [ESC, 0x74, 0xFF], // UTF-8 (if supported)
} as const

export type TextAlign = 'left' | 'center' | 'right'
export type TextSize = 'normal' | 'wide' | 'tall' | 'large'

export interface TextOptions {
    align?: TextAlign
    bold?: boolean
    underline?: boolean
    size?: TextSize
    invert?: boolean
}

/**
 * ESC/POS Encoder class
 * Builds a sequence of ESC/POS commands
 */
export class EscPosEncoder {
    private buffer: number[] = []
    private encoding: 'cp437' | 'cp850' | 'cp858' | 'utf8' = 'cp858'

    constructor() {
        this.initialize()
    }

    /**
     * Initialize the printer
     */
    initialize(): this {
        this.buffer.push(...Commands.INIT)
        this.buffer.push(...Commands.CHARSET_PC858) // Latin with Euro symbol
        return this
    }

    /**
     * Reset buffer and reinitialize
     */
    reset(): this {
        this.buffer = []
        return this.initialize()
    }

    /**
     * Set text alignment
     */
    align(alignment: TextAlign): this {
        switch (alignment) {
            case 'left':
                this.buffer.push(...Commands.ALIGN_LEFT)
                break
            case 'center':
                this.buffer.push(...Commands.ALIGN_CENTER)
                break
            case 'right':
                this.buffer.push(...Commands.ALIGN_RIGHT)
                break
        }
        return this
    }

    /**
     * Set bold text
     */
    bold(enabled = true): this {
        this.buffer.push(...(enabled ? Commands.BOLD_ON : Commands.BOLD_OFF))
        return this
    }

    /**
     * Set underline
     */
    underline(enabled = true): this {
        this.buffer.push(...(enabled ? Commands.UNDERLINE_ON : Commands.UNDERLINE_OFF))
        return this
    }

    /**
     * Set inverted text (white on black)
     */
    invert(enabled = true): this {
        this.buffer.push(...(enabled ? Commands.INVERT_ON : Commands.INVERT_OFF))
        return this
    }

    /**
     * Set text size
     */
    size(size: TextSize): this {
        switch (size) {
            case 'normal':
                this.buffer.push(...Commands.NORMAL_SIZE)
                break
            case 'wide':
                this.buffer.push(...Commands.DOUBLE_WIDTH)
                break
            case 'tall':
                this.buffer.push(...Commands.DOUBLE_HEIGHT)
                break
            case 'large':
                this.buffer.push(...Commands.DOUBLE_SIZE)
                break
        }
        return this
    }

    /**
     * Add text with optional formatting
     */
    text(content: string, options?: TextOptions): this {
        if (options?.align) this.align(options.align)
        if (options?.bold) this.bold(true)
        if (options?.underline) this.underline(true)
        if (options?.invert) this.invert(true)
        if (options?.size) this.size(options.size)

        // Encode text to bytes
        const bytes = this.encodeText(content)
        this.buffer.push(...bytes)

        // Reset formatting
        if (options?.bold) this.bold(false)
        if (options?.underline) this.underline(false)
        if (options?.invert) this.invert(false)
        if (options?.size && options.size !== 'normal') this.size('normal')

        return this
    }

    /**
     * Add a line of text with newline
     */
    line(content: string, options?: TextOptions): this {
        this.text(content, options)
        this.newline()
        return this
    }

    /**
     * Add empty line(s)
     */
    newline(count = 1): this {
        for (let i = 0; i < count; i++) {
            this.buffer.push(LF)
        }
        return this
    }

    /**
     * Feed paper by lines
     */
    feed(lines = 1): this {
        this.buffer.push(...Commands.FEED_LINES(lines))
        return this
    }

    /**
     * Print a horizontal rule (dashes)
     */
    hr(char = '-', width = 32): this {
        this.line(char.repeat(width))
        return this
    }

    /**
     * Print a row with left and right aligned text
     */
    row(left: string, right: string, width = 32, fillChar = ' '): this {
        const leftLen = this.getStringWidth(left)
        const rightLen = this.getStringWidth(right)
        const padding = Math.max(1, width - leftLen - rightLen)
        this.line(left + fillChar.repeat(padding) + right)
        return this
    }

    /**
     * Print a table row
     */
    tableRow(columns: string[], widths: number[], aligns?: TextAlign[]): this {
        let row = ''
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i] || ''
            const width = widths[i] || 8
            const align = aligns?.[i] || 'left'

            const strWidth = this.getStringWidth(col)
            const truncated = strWidth > width ? col.slice(0, width - 1) + '.' : col
            const padding = Math.max(0, width - this.getStringWidth(truncated))

            if (align === 'right') {
                row += ' '.repeat(padding) + truncated
            } else if (align === 'center') {
                const leftPad = Math.floor(padding / 2)
                const rightPad = padding - leftPad
                row += ' '.repeat(leftPad) + truncated + ' '.repeat(rightPad)
            } else {
                row += truncated + ' '.repeat(padding)
            }
        }
        this.line(row.trimEnd())
        return this
    }

    /**
     * Cut paper
     */
    cut(partial = true): this {
        this.feed(3) // Feed paper before cutting
        this.buffer.push(...(partial ? Commands.CUT_PARTIAL : Commands.CUT_FULL))
        return this
    }

    /**
     * Open cash drawer
     */
    openDrawer(pin: 2 | 5 = 2): this {
        this.buffer.push(...(pin === 2 ? Commands.OPEN_DRAWER_PIN2 : Commands.OPEN_DRAWER_PIN5))
        return this
    }

    /**
     * Beep
     */
    beep(): this {
        this.buffer.push(...Commands.BEEP)
        return this
    }

    /**
     * Print QR code
     */
    qrCode(data: string, size = 6): this {
        // Set QR model
        this.buffer.push(...Commands.QR_MODEL)

        // Set size (1-16)
        this.buffer.push(...Commands.QR_SIZE(Math.min(16, Math.max(1, size))))

        // Set error correction level
        this.buffer.push(...Commands.QR_ERROR_CORRECTION('M'))

        // Store QR data
        const dataBytes = this.encodeText(data)
        const len = dataBytes.length + 3
        const pL = len & 0xFF
        const pH = (len >> 8) & 0xFF
        this.buffer.push(GS, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...dataBytes)

        // Print QR code
        this.buffer.push(GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)
        this.newline()

        return this
    }

    /**
     * Print barcode (Code 128)
     */
    barcode(data: string, height = 50): this {
        this.buffer.push(...Commands.BARCODE_HEIGHT(height))
        this.buffer.push(...Commands.BARCODE_WIDTH(2))
        this.buffer.push(...Commands.BARCODE_TEXT_BELOW)

        // Code 128
        const dataBytes = this.encodeText(data)
        this.buffer.push(GS, 0x6B, 73, dataBytes.length, ...dataBytes)
        this.newline()

        return this
    }

    /**
     * Get the encoded buffer as Uint8Array
     */
    encode(): Uint8Array {
        return new Uint8Array(this.buffer)
    }

    /**
     * Get buffer for debugging
     */
    getBuffer(): number[] {
        return [...this.buffer]
    }

    /**
     * Encode text to bytes
     */
    private encodeText(text: string): number[] {
        // Use TextEncoder for UTF-8, but ESC/POS printers typically expect Code Page 858
        // For simplicity, we'll use basic ASCII and replace special chars
        const bytes: number[] = []
        for (const char of text) {
            const code = char.charCodeAt(0)
            if (code < 128) {
                bytes.push(code)
            } else {
                // Map common Spanish/Latin characters to CP858
                const mapped = this.mapToCodePage(char)
                bytes.push(mapped)
            }
        }
        return bytes
    }

    /**
     * Map Unicode character to Code Page 858
     */
    private mapToCodePage(char: string): number {
        const map: Record<string, number> = {
            'á': 0xA0, 'é': 0x82, 'í': 0xA1, 'ó': 0xA2, 'ú': 0xA3,
            'Á': 0xB5, 'É': 0x90, 'Í': 0xD6, 'Ó': 0xE0, 'Ú': 0xE9,
            'ñ': 0xA4, 'Ñ': 0xA5,
            'ü': 0x81, 'Ü': 0x9A,
            '¿': 0xA8, '¡': 0xAD,
            '€': 0xD5, // Euro symbol in CP858
            '°': 0xF8,
            '±': 0xF1,
            '×': 0xAA,
            '÷': 0xF6,
        }
        return map[char] || 0x3F // Return '?' for unknown chars
    }

    /**
     * Get visual width of string (accounting for wide chars)
     */
    private getStringWidth(str: string): number {
        return str.length // Simplified - doesn't handle East Asian wide chars
    }
}

/**
 * Create a new encoder instance
 */
export function createEncoder(): EscPosEncoder {
    return new EscPosEncoder()
}
