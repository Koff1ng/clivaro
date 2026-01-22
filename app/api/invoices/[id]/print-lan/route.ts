import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { InvoiceData, printInvoiceLan, PrinterOptions } from "@/lib/escpos/lan-printer";
import { getServerSession } from "next-auth"; // Or authOptions import if available
import { authOptions } from "@/lib/auth"; // Assuming authOptions is here, or use helper

// Helper to safely format numbers
const safeNum = (n: any) => (typeof n === 'number' ? n : Number(n) || 0);

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // 0. Auth check to get Tenant Context
        // We use getServerSession to get basic auth. For permissions we might check perms but print is basic.
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = session.user as any;
        const tenantId = user.tenantId;

        const { printerInterface } = await req.json();

        if (!printerInterface) {
            return NextResponse.json(
                { error: "Printer interface is required (e.g., tcp://192.168.1.100)" },
                { status: 400 }
            );
        }

        // 1. Fetch Tenant Settings for config
        let printerOptions: PrinterOptions = {
            width: 48, // default
            cut: true,
            design: {
                showLogo: true,
                showQr: true,
                showCufe: true,
                footerText: "Gracias por su compra"
            }
        };

        // Identity overrides
        let identityConfig: any = {};

        if (tenantId) {
            const settings = await prisma.tenantSettings.findUnique({
                where: { tenantId }
            });

            if (settings?.customSettings) {
                try {
                    const custom = JSON.parse(settings.customSettings);

                    // A. Identity
                    if (custom.identity) {
                        identityConfig = custom.identity;
                    }

                    // B. Printing Config
                    if (custom.printing) {
                        // Find matching printer for width
                        if (custom.printing.printers) {
                            // Try to find printer by Interface Config match
                            // The client sends "tcp://IP:PORT" or "IP:PORT" or maybe just IP.
                            // We try fuzzy match? Or just use default width if no match?
                            // If the user manually typed an IP in the dialog, it might not match a saved printer ID.
                            // But if they picked from list... (Future).
                            // For now, let's try to find one that includes the IP.

                            const found = custom.printing.printers.find((p: any) =>
                                printerInterface.includes(p.interfaceConfig) || p.interfaceConfig === printerInterface
                            );

                            if (found && found.width) {
                                // Convert mm to cols approx? 
                                // 80mm -> 48 cols
                                // 58mm -> 32 cols
                                printerOptions.width = found.columns || (found.width === 58 ? 32 : 48);
                            } else if (custom.printing.paperWidth) {
                                printerOptions.width = custom.printing.paperWidth === 58 ? 32 : 48;
                            }
                        }

                        // Design
                        if (custom.printing.ticketDesign) {
                            printerOptions.design = {
                                ...printerOptions.design,
                                ...custom.printing.ticketDesign
                            };
                        }

                        if (custom.printing.autoCut !== undefined) {
                            printerOptions.cut = custom.printing.autoCut;
                        }
                    }
                } catch (e) {
                    console.error("Error parsing custom settings:", e);
                }
            }
        }

        // 2. Fetch invoice with relations
        const invoice = await prisma.invoice.findUnique({
            where: { id: params.id },
            include: {
                customer: true,
                items: {
                    include: {
                        product: true
                    }
                },
                payments: true
            }
        });

        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        // 3. Prepare data for printer
        // Priority: customSettings identity > invoice relation override > env var
        const companyName = identityConfig.companyName || process.env.NEXT_PUBLIC_COMPANY_NAME || "FERRETERIA";
        const companyNit = identityConfig.companyNit || process.env.NEXT_PUBLIC_COMPANY_TAX_ID || "900000000-1";
        const companyRegime = identityConfig.regime || process.env.NEXT_PUBLIC_COMPANY_REGIME || "Responsable de IVA";
        const companyAddress = identityConfig.companyAddress || process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "";
        // Note: GenericConfig form saved identity in customSettings.identity as: regime, city, website. 
        // But Name, Nit, Address might be in root TenantSettings columns or custom?
        // GenericConfig implementation I wrote saved EVERYTHING to customSettings too for safety?
        // Wait, GeneralConfig saved companyName to root form data but onSubmit merged it?
        // My GeneralConfig onSubmit: `onSave({...data, customSettings: ...})`.
        // So companyName IS in root. BUT `print-lan` accesses `TenantSettings` model.
        // `TenantSettings` model usually has `companyName` column?
        // If so, `settings.companyName` is best.
        // I will assume `settings` has these cols.

        let finalSellerName = companyName;
        let finalSellerNIT = companyNit;
        let finalSellerAddress = companyAddress;

        if (tenantId) {
            const settings = await prisma.tenantSettings.findUnique({ where: { tenantId } });
            if (settings) {
                if (settings.companyName) finalSellerName = settings.companyName;
                if (settings.companyNit) finalSellerNIT = settings.companyNit;
                if (settings.companyAddress) finalSellerAddress = settings.companyAddress;
            }
        }

        const items = invoice.items.map(item => {
            const unitPrice = safeNum(item.unitPrice);
            const qty = safeNum(item.quantity);
            const discountPct = safeNum(item.discount);
            const subtotal = safeNum(item.subtotal);

            return {
                qty,
                description: item.product?.name || "Producto",
                total: subtotal
            };
        });

        const taxes: { name: string, amount: number }[] = [];
        if (safeNum(invoice.tax) > 0) {
            taxes.push({ name: "IVA", amount: safeNum(invoice.tax) });
        }

        const printData: InvoiceData = {
            printerInterface,
            sellerName: finalSellerName,
            sellerNIT: finalSellerNIT,
            sellerRegime: companyRegime, // from customSettings or env
            sellerAddress: finalSellerAddress,
            prefix: invoice.prefix || undefined,
            number: String(invoice.number),
            issueDateTime: invoice.issuedAt
                ? new Date(invoice.issuedAt).toLocaleString('es-CO')
                : new Date().toLocaleString('es-CO'),
            buyerName: invoice.customer?.name || "CONSUMIDOR FINAL",
            buyerId: invoice.customer?.taxId || undefined,
            paymentMethod: invoice.payments.length > 0 ? invoice.payments[0].method : "CONTADO",
            items,
            subtotal: safeNum(invoice.subtotal),
            taxes,
            total: safeNum(invoice.total),
            cufe: invoice.cufe || undefined,
            qrValue: invoice.qrCode || undefined
        };

        // 4. Execute Print
        await printInvoiceLan(printData, printerOptions);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("LAN Print Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to print" },
            { status: 500 }
        );
    }
}
