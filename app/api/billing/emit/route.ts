import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { handleError } from '@/lib/error-handler'
import { sendToElectronicBilling, validateInvoiceData, InvoiceData, ElectronicBillingConfig } from '@/lib/electronic-billing'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    try {
        const body = await request.json()
        const { invoiceId } = body

        if (!invoiceId) {
            return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 })
        }

        return await withTenantTx(session.user.tenantId, async (tx) => {
            // 1. Fetch Invoice Full Data
            const invoice = await tx.invoice.findUnique({
                where: { id: invoiceId },
                include: {
                    customer: true,
                    items: {
                        include: {
                            product: true,
                            lineTaxes: {
                                include: { taxRate: true }
                            } // Assuming this relation exists from previous phase
                        }
                    },
                    taxSummary: true
                }
            })

            if (!invoice) throw new Error('Factura no encontrada')

            // 2. Fetch Tenant Settings (Billing Config)
            // We need to fetch from masterPrisma.tenantSettings as withTenantTx gives us the tenant DB context
            // But settings are likely in tenant DB too if using the correct schema strategy
            // For now assuming existing pattern: settings are in public or per-tenant table

            // Re-checking how settings were fetched in 'settings-screen.tsx' -> /api/settings.
            // It seems likely stored in the TenantSettings model. 
            // Let's check schema via Prisma Client usage in other files if needed, but assuming standard access:

            const settings = await prisma.tenantSettings.findUnique({
                where: { tenantId: session.user.tenantId }
            })

            if (!settings) throw new Error('Configuración de facturación no encontrada')

            // 3. Map to InvoiceData interface
            const invoiceData: InvoiceData = {
                id: invoice.id,
                number: invoice.number,
                prefix: invoice.prefix || '',
                consecutive: invoice.consecutive || '',
                issueDate: invoice.issuedAt || new Date(),
                issueTime: formatTime(invoice.createdAt), // Helper needed
                customer: {
                    nit: invoice.customer.taxId || '222222222222', // Fallback
                    name: invoice.customer.name,
                    email: invoice.customer.email || undefined,
                    phone: invoice.customer.phone || undefined,
                    isCompany: (invoice.customer as any).isCompany || false,
                    taxRegime: (invoice.customer as any).taxRegime || undefined
                },
                items: invoice.items.map((item: any) => ({
                    code: item.product.sku || item.product.id,
                    description: item.product.name,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    subtotal: item.subtotal,
                    taxes: item.lineTaxes.map((lt: any) => ({
                        taxRateId: lt.taxRateId,
                        name: lt.name,
                        rate: lt.rate,
                        baseAmount: lt.baseAmount,
                        taxAmount: lt.taxAmount
                    }))
                })),
                taxSummary: invoice.taxSummary.map((ts: any) => ({
                    name: ts.name,
                    rate: ts.rate,
                    baseAmount: ts.baseAmount,
                    taxAmount: ts.taxAmount
                })),
                subtotal: invoice.subtotal,
                discount: invoice.discount,
                tax: invoice.tax,
                total: invoice.total
            }

            // 4. Map settings to Config
            const billingConfig: ElectronicBillingConfig = {
                provider: (settings.electronicBillingProvider as any) || 'FEG',
                companyNit: settings.companyNit || '',
                companyName: settings.companyName || '',
                companyAddress: settings.companyAddress || '',
                companyPhone: settings.companyPhone || '',
                companyEmail: settings.companyEmail || '',
                resolutionNumber: settings.billingResolutionNumber || '',
                resolutionPrefix: settings.billingResolutionPrefix || '',
                resolutionFrom: settings.billingResolutionFrom || '',
                resolutionTo: settings.billingResolutionTo || '',
                resolutionValidFrom: settings.billingResolutionValidFrom ? new Date(settings.billingResolutionValidFrom).toISOString().split('T')[0] : '',
                resolutionValidTo: settings.billingResolutionValidTo ? new Date(settings.billingResolutionValidTo).toISOString().split('T')[0] : '',
                softwareId: settings.softwareId,
                softwarePin: settings.softwarePin,
                technicalKey: settings.technicalKey,
                environment: '2', // Test by default for now
                alegraEmail: settings.alegraEmail,
                alegraToken: settings.alegraToken
            }

            // 5. Validation
            const validation = validateInvoiceData(invoiceData)
            if (!validation.valid) {
                return NextResponse.json({ error: 'Datos de factura inválidos', details: validation.errors }, { status: 400 })
            }

            // 6. Send
            const result = await sendToElectronicBilling(invoiceData, billingConfig)

            // 7. Update Invoice Status if success
            if (result.success && result.cufe) {
                await tx.invoice.update({
                    where: { id: invoice.id },
                    data: {
                        electronicStatus: result.status,
                        cufe: result.cufe,
                        electronicResponse: JSON.stringify({
                            xml: result.xmlUrl,
                            pdf: result.pdfUrl,
                            fullResponse: result.response
                        }),
                        electronicSentAt: new Date()
                    }
                })
            }

            return NextResponse.json(result)
        })

    } catch (error) {
        return handleError(error, 'POST /api/billing/emit')
    }
}

function formatTime(date: Date): string {
    return date.toISOString().split('T')[1].split('.')[0] + '-05:00'
}
