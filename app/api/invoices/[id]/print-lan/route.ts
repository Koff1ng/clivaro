import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger'
import { prisma as masterPrisma } from "@/lib/db";
import { InvoiceData, printInvoiceLan, PrinterOptions } from "@/lib/escpos/lan-printer";
import { requirePermission } from "@/lib/api-middleware";
import { PERMISSIONS } from "@/lib/permissions";
import { withTenantRead, getTenantIdFromSession } from "@/lib/tenancy";

export const dynamic = 'force-dynamic'

// Helper to safely format numbers
const safeNum = (n: any) => (typeof n === 'number' ? n : Number(n) || 0);

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(req as any, PERMISSIONS.MANAGE_SALES);
    if (session instanceof NextResponse) return session;

    const tenantId = getTenantIdFromSession(session);
    if (!tenantId) {
        return NextResponse.json({ error: "Tenant context required" }, { status: 403 });
    }

    try {
        const { printerInterface } = await req.json();

        if (!printerInterface) {
            return NextResponse.json(
                { error: "Printer interface is required (e.g., tcp://192.168.1.100)" },
                { status: 400 }
            );
        }

        return await withTenantRead(tenantId, async (tenantPrisma) => {
            // 1. Fetch Tenant Settings for config (from masterPrisma as it's tenant-level metadata)
            const settings = await masterPrisma.tenantSettings.findUnique({
                where: { tenantId }
            });

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

            let identityConfig: any = {};

            if (settings?.customSettings) {
                try {
                    const custom = JSON.parse(settings.customSettings);
                    if (custom.identity) identityConfig = custom.identity;
                    if (custom.printing) {
                        if (custom.printing.printers) {
                            const found = custom.printing.printers.find((p: any) =>
                                printerInterface.includes(p.interfaceConfig) || p.interfaceConfig === printerInterface
                            );
                            if (found && found.width) {
                                printerOptions.width = found.columns || (found.width === 58 ? 32 : 48);
                            } else if (custom.printing.paperWidth) {
                                printerOptions.width = custom.printing.paperWidth === 58 ? 32 : 48;
                            }
                        }
                        if (custom.printing.ticketDesign) {
                            printerOptions.design = { ...printerOptions.design, ...custom.printing.ticketDesign };
                        }
                        if (custom.printing.autoCut !== undefined) {
                            printerOptions.cut = custom.printing.autoCut;
                        }
                    }
                } catch (e) {
                    logger.error("Error parsing custom settings:", e);
                }
            }

            // 2. Fetch invoice with relations from tenant DB
            const invoice = await tenantPrisma.invoice.findUnique({
                where: { id: params.id },
                include: {
                    customer: true,
                    items: { include: { product: true } },
                    payments: true
                }
            });

            if (!invoice) {
                return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
            }

            // 3. Resolve Identity
            const finalSellerName = settings?.companyName || identityConfig.companyName || process.env.NEXT_PUBLIC_COMPANY_NAME || "FERRETERIA";
            const finalSellerNIT = settings?.companyNit || identityConfig.companyNit || process.env.NEXT_PUBLIC_COMPANY_TAX_ID || "900000000-1";
            const finalSellerAddress = settings?.companyAddress || identityConfig.companyAddress || process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "";
            const companyRegime = identityConfig.regime || process.env.NEXT_PUBLIC_COMPANY_REGIME || "Responsable de IVA";

            const items = invoice.items.map((item: any) => ({
                qty: safeNum(item.quantity),
                description: item.product?.name || "Producto",
                total: safeNum(item.subtotal)
            }));

            const taxes: { name: string, amount: number }[] = [];
            if (safeNum(invoice.tax) > 0) {
                taxes.push({ name: "IVA", amount: safeNum(invoice.tax) });
            }

            const printData: InvoiceData = {
                printerInterface,
                sellerName: finalSellerName,
                sellerNIT: finalSellerNIT,
                sellerRegime: companyRegime,
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
        });
    } catch (error: any) {
        logger.error("LAN Print Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to print" },
            { status: 500 }
        );
    }
}
