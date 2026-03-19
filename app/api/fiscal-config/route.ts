import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession, withTenantRead } from '@/lib/tenancy'
import { prisma as masterPrisma } from '@/lib/db'

/**
 * GET: Returns the fiscal configuration for the current tenant.
 * Includes DIAN resolution data, numbering range status, and Alegra connection status.
 */
export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SETTINGS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const settings = await masterPrisma.tenantSettings.findUnique({
            where: { tenantId }
        })

        if (!settings) {
            return NextResponse.json({ error: 'No se encontró configuración del tenant' }, { status: 404 })
        }

        // Parse resolution range
        const rangeFrom = settings.billingResolutionFrom ? parseInt(settings.billingResolutionFrom) : null
        const rangeTo = settings.billingResolutionTo ? parseInt(settings.billingResolutionTo) : null

        // Calculate last used consecutive from the tenant's invoices
        const lastInvoice = await withTenantRead(tenantId, async (prisma) => {
            return await prisma.invoice.findFirst({
                where: {
                    prefix: settings.invoicePrefix || undefined,
                    consecutive: { not: null }
                },
                orderBy: { createdAt: 'desc' },
                select: { consecutive: true, number: true }
            })
        })

        const currentConsecutive = lastInvoice?.consecutive ? parseInt(lastInvoice.consecutive) : (rangeFrom || 0)
        const remainingInvoices = rangeTo ? rangeTo - currentConsecutive : null

        // Resolution expiry check
        const resolutionExpired = settings.billingResolutionValidTo
            ? new Date(settings.billingResolutionValidTo) < new Date()
            : null

        // Range exhausted check
        const rangeExhausted = rangeTo !== null && currentConsecutive >= rangeTo

        // Warnings
        const warnings: string[] = []
        if (resolutionExpired) {
            warnings.push('⛔ La resolución de facturación ha expirado. No puede emitir facturas electrónicas.')
        }
        if (rangeExhausted) {
            warnings.push('⛔ El rango de numeración está agotado. Solicite una nueva resolución ante la DIAN.')
        } else if (remainingInvoices !== null && remainingInvoices < 50) {
            warnings.push(`⚠️ Quedan solo ${remainingInvoices} facturas disponibles en el rango actual.`)
        }

        // Alegra connection status
        const alegraConfigured = !!(settings.alegraEmail && settings.alegraToken)

        return NextResponse.json({
            fiscal: {
                companyNit: settings.companyNit,
                companyName: settings.companyName,
                companyAddress: settings.companyAddress,
                companyPhone: settings.companyPhone,
                companyEmail: settings.companyEmail,
            },
            resolution: {
                number: settings.billingResolutionNumber,
                prefix: settings.billingResolutionPrefix || settings.invoicePrefix,
                rangeFrom: settings.billingResolutionFrom,
                rangeTo: settings.billingResolutionTo,
                validFrom: settings.billingResolutionValidFrom,
                validTo: settings.billingResolutionValidTo,
                expired: resolutionExpired,
            },
            numbering: {
                currentConsecutive,
                remaining: remainingInvoices,
                rangeExhausted,
                invoicePrefix: settings.invoicePrefix,
                invoiceNumberFormat: settings.invoiceNumberFormat,
            },
            dian: {
                provider: settings.electronicBillingProvider,
                softwareId: settings.softwareId ? '****' + settings.softwareId.slice(-4) : null,
                technicalKey: settings.technicalKey ? '****' + settings.technicalKey.slice(-4) : null,
            },
            alegra: {
                configured: alegraConfigured,
                email: settings.alegraEmail ? settings.alegraEmail.replace(/(.{2}).+(@.+)/, '$1***$2') : null,
            },
            warnings,
            status: warnings.length === 0 ? 'OK' : (rangeExhausted || resolutionExpired ? 'CRITICAL' : 'WARNING'),
        })
    } catch (error: any) {
        console.error('Error in fiscal-config GET:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
