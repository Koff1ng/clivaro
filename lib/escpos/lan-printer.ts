import { ThermalPrinter, PrinterTypes, CharacterSet } from "node-thermal-printer";

// ---------- helpers ----------
// ---------- helpers ----------
// Default to 48 cols (80mm).
const DEFAULT_COLS = 48;

// Currency formatter for COP
const money = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

// Wrap text to fit width
function wrap(text: string, width: number): string[] {
    const words = String(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
        if (!line.length) {
            line = w;
            continue;
        }
        if ((line + " " + w).length <= width) {
            line += " " + w;
        } else {
            lines.push(line);
            line = w;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function padRight(s: any, n: number) { s = String(s); return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
function padLeft(s: any, n: number) { s = String(s); return s.length >= n ? s.slice(0, n) : " ".repeat(n - s.length) + s; }

interface PrintItem {
    qty: number
    description: string
    total: number
}

function lineItem({ qty, desc, total, width }: { qty: any, desc: string, total: string, width: number }) {
    // Dynamic Layout based on width
    // For 48 cols: QTY(4) + DESC(30) + TOTAL(14)
    // For 32 cols (58mm): QTY(3) + DESC(17) + TOTAL(12)

    let Q = 4, T = 14;
    if (width < 40) { Q = 3; T = 12; }

    const D = width - Q - T;

    const qtyStr = padLeft(qty, Q);
    const totalStr = padLeft(total, T);

    const descLines = wrap(desc, D);
    const first = `${qtyStr}${padRight(descLines[0] ?? "", D)}${totalStr}`;
    const rest = descLines.slice(1).map((l) => `${" ".repeat(Q)}${padRight(l, D)}${" ".repeat(T)}`);
    return [first, ...rest];
}

export interface InvoiceData {
    printerInterface: string // e.g. "tcp://192.168.1.50:9100"
    sellerName: string
    sellerNIT: string
    sellerRegime?: string
    sellerAddress?: string
    prefix?: string
    number: string
    issueDateTime: string
    buyerName?: string
    buyerId?: string
    paymentMethod?: string
    items: PrintItem[]
    subtotal: number
    taxes?: { name: string, amount: number }[]
    total: number
    cufe?: string
    qrValue?: string
}

export interface PrinterOptions {
    width?: number // columns, e.g. 48 or 42 or 32
    cut?: boolean
    design?: {
        showLogo?: boolean // not implemented yet as we need base64/buffer logic, but placeholder
        showQr?: boolean
        showCufe?: boolean
        footerText?: string
    }
}

// ---------- main ----------
export async function printInvoiceLan(invoice: InvoiceData, options?: PrinterOptions) {
    const COLS = options?.width || DEFAULT_COLS;
    const DESIGN = options?.design || {};
    const CUT = options?.cut ?? true;

    // Simulator mode
    if (invoice.printerInterface === 'simulator') {
        console.log("=== SIMULATED PRINT JOB ===");
        console.log("Invoice:", invoice.prefix, invoice.number);
        console.log("Total:", invoice.total);
        console.log("Design Options:", options);
        console.log("=== END SIMULATION ===");
        return { success: true };
    }

    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON, // ESC/POS compatible
        interface: invoice.printerInterface, // e.g. "tcp://192.168.1.50:9100"
        characterSet: "PC850" as any, // good for Spanish accents in many printers
        removeSpecialCharacters: false,
        lineCharacter: "-", // used by drawLine
        options: { timeout: 5000 },
        width: COLS // passed to driver for centering calculations
    });

    const ok = await printer.isPrinterConnected();
    if (!ok) throw new Error(`Printer not connected at ${invoice.printerInterface}`);

    // Header
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.bold(true);
    printer.println(invoice.sellerName);
    printer.bold(false);
    printer.setTextNormal();
    printer.println(`NIT: ${invoice.sellerNIT}`);
    if (invoice.sellerRegime) printer.println(invoice.sellerRegime);
    if (invoice.sellerAddress) printer.println(invoice.sellerAddress);
    printer.drawLine();

    // Document type
    printer.bold(true);
    printer.println("FACTURA ELECTRÓNICA DE VENTA");
    printer.bold(false);
    printer.println(`${invoice.prefix || ''}${invoice.number}`);
    printer.println(`Fecha: ${invoice.issueDateTime}`);
    printer.drawLine();

    // Buyer
    printer.alignLeft();
    printer.bold(true);
    printer.println("ADQUIRENTE:");
    printer.bold(false);
    printer.println(invoice.buyerName ?? "CONSUMIDOR FINAL");
    if (invoice.buyerId) printer.println(`ID/NIT: ${invoice.buyerId}`);
    if (invoice.paymentMethod) printer.println(`Pago: ${invoice.paymentMethod}`);
    printer.drawLine();

    // Items
    printer.bold(true);
    // Header for items
    let Q = 4, T = 14;
    if (COLS < 40) { Q = 3; T = 12; }
    const D = COLS - Q - T;

    printer.println(padRight("Cant", Q) + padRight("Descripción", D) + padLeft("Total", T));
    printer.bold(false);

    for (const it of invoice.items) {
        const lines = lineItem({
            qty: it.qty,
            desc: it.description,
            total: money(it.total),
            width: COLS
        });
        lines.forEach((l) => printer.println(l));
    }

    printer.drawLine();

    // Totals
    const totals = [
        ["Subtotal", money(invoice.subtotal)],
        ...(invoice.taxes?.map(t => [t.name, money(t.amount)]) ?? []), // e.g. IVA 19%
        ["TOTAL A PAGAR", money(invoice.total)]
    ];

    totals.forEach(([label, value]) => {
        const leftWidth = COLS - 14;
        const valLen = 14;
        // if small width, adjust logic or just let it wrap?
        // for simplicitly we assume COLS >= 32
        printer.println(padRight(label, COLS - valLen) + padLeft(value, valLen));
    });

    printer.drawLine();

    // CUFE + QR (DIAN verification)
    // Only show if config allows (default true if undefined, OR explicit check)
    // Let's adhere to config exactly. If config is provided, we respect false.
    // If DESIGN.showCufe is undefined, we default to TRUE for compliance? 
    // The user config has defaults.

    if (invoice.cufe && (DESIGN.showCufe !== false)) {
        printer.bold(true);
        printer.println("CUFE:");
        printer.bold(false);
        // Wrap CUFE nicely
        wrap(invoice.cufe, COLS).forEach((l) => printer.println(l));
        printer.println("");
    }

    printer.alignCenter();

    if (invoice.qrValue && (DESIGN.showQr !== false)) {
        printer.printQR(invoice.qrValue, { cellSize: 6, correction: "M" });
        printer.println("");
    }

    printer.setTextNormal();
    if (DESIGN.footerText) {
        printer.println(DESIGN.footerText);
    } else {
        printer.println("Gracias por su compra");
    }

    if (CUT) printer.cut();

    try {
        const executed = await printer.execute();
        if (!executed) throw new Error("Print job failed to execute (no response).");
        return { success: true };
    } catch (err: any) {
        console.error("Print execution error:", err);
        throw new Error(`Print failed: ${err.message}`);
    }
}
