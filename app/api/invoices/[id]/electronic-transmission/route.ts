import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { sendToElectronicBilling } from '@/lib/electronic-billing'

export const dynamic = 'force-dynamic'

export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const { id: invoiceId } = params
    const tenantId = getTenantIdFromSession(session)

    try {
        const result = await withTenantTx(tenantId, async (tx: any) => {
            const { prisma: masterPrisma } = await import('@/lib/db')

            const tenantSettings = await masterPrisma.tenantSettings.findUnique({ where: { tenantId } })
            if (!tenantSettings?.factusClientId) {
                throw new Error('Factus no está configurado para este tenant')
            }

            const fullInvoice = await tx.invoice.findUnique({
                where: { id: invoiceId },
                include: {
                    customer: true,
                    items: {
                        include: {
                            product: true,
                            lineTaxes: { include: { taxRate: true } }
                        }
                    },
                    taxSummary: true,
                }
            })

            if (!fullInvoice) throw new Error('Factura no encontrada')

            const s = tenantSettings as any
            const billingConfig: any = {
                provider: 'FACTUS',
                companyNit: s.companyNit || '',
                companyName: s.companyName || '',
                companyAddress: s.companyAddress || '',
                companyPhone: s.companyPhone || '',
                companyEmail: s.companyEmail || '',
                resolutionNumber: s.billingResolutionNumber || '',
                resolutionPrefix: s.billingResolutionPrefix || 'FV',
                resolutionFrom: s.billingResolutionFrom || '1',
                resolutionTo: s.billingResolutionTo || '999999',
                resolutionValidFrom: s.billingResolutionValidFrom?.toISOString() || new Date().toISOString(),
                resolutionValidTo: s.billingResolutionValidTo?.toISOString() || new Date().toISOString(),
                environment: (process.env.DIAN_ENVIRONMENT as any) || '2',
                factusClientId: s.factusClientId,
                factusClientSecret: s.factusClientSecret,
                factusUsername: s.factusUsername || '',
                factusPassword: s.factusPassword || '',
                factusSandbox: s.factusSandbox ?? true,
            }

            const invoiceData = {
                id: fullInvoice.id,
                number: fullInvoice.number,
                prefix: fullInvoice.prefix || 'FV',
                consecutive: fullInvoice.consecutive || '',
                issueDate: fullInvoice.issuedAt || new Date(),
                issueTime: new Date().toISOString().split('T')[1].split('.')[0] + '-05:00',
                customer: {
                    nit: fullInvoice.customer?.taxId || '222222222222',
                    name: fullInvoice.customer?.name || 'Cliente General',
                    email: fullInvoice.customer?.email || undefined,
                    phone: fullInvoice.customer?.phone || undefined,
                    isCompany: fullInvoice.customer?.isCompany ?? false,
                    idType: fullInvoice.customer?.idType || 'CC',
                },
                items: fullInvoice.items.map((item: any) => ({
                    code: item.product?.sku || item.productId,
                    description: item.product?.name || 'Producto',
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discount: item.discount || 0,
                    subtotal: item.subtotal || 0,
                    taxes: (item.lineTaxes || []).map((lt: any) => ({
                        taxRateId: lt.taxRateId,
                        name: lt.name || lt.taxRate?.name || 'IVA',
                        rate: lt.rate || lt.taxRate?.rate || 0,
                        type: lt.taxRate?.type || 'IVA',
                        baseAmount: lt.baseAmount || 0,
                        taxAmount: lt.taxAmount || 0,
                    }))
                })),
                taxSummary: (fullInvoice.taxSummary || []).map((ts: any) => ({
                    name: ts.name,
                    rate: ts.rate,
                    baseAmount: ts.baseAmount,
                    taxAmount: ts.taxAmount,
                })),
                subtotal: fullInvoice.subtotal || 0,
                discount: fullInvoice.discount || 0,
                tax: fullInvoice.tax || 0,
                total: fullInvoice.total || 0,
                paymentMethodType: 'CASH',
            }

            const electronicResult = await sendToElectronicBilling(invoiceData as any, billingConfig)

            if (electronicResult.success && electronicResult.cufe) {
                await tx.invoice.update({
                    where: { id: invoiceId },
                    data: {
                        electronicStatus: electronicResult.status || 'SENT',
                        cufe: electronicResult.cufe,
                        electronicResponse: JSON.stringify({
                            xml: electronicResult.xmlUrl,
                            pdf: electronicResult.pdfUrl,
                            fullResponse: electronicResult.response,
                        }),
                        electronicSentAt: new Date(),
                    }
                })
            }

            return electronicResult
        })

        return NextResponse.json({ success: true, result })
    } catch (error: any) {
        logger.error('Failed to transmit electronic invoice', error)
        return NextResponse.json({ error: error?.message || 'Failed to transmit invoice' }, { status: 500 })
    }
}
