import { prisma as masterPrisma } from '@/lib/db'
import { getTenantPrisma } from '@/lib/tenant-db'
import { AlegraClient } from '@/lib/alegra/client'
import { logger } from '@/lib/logger'

export async function handleAlegraTransmission(payload: {
    invoiceId: string;
    tenantId: string;
}) {
    const { invoiceId, tenantId } = payload

    // 1. Get Tenant Specific DB
    const tenant = await (masterPrisma as any).tenant.findUnique({
        where: { id: tenantId },
        select: { databaseUrl: true }
    })

    if (!tenant) throw new Error(`Tenant ${tenantId} not found`)
    const prisma = getTenantPrisma(tenant.databaseUrl)

    // 2. Get Alegra Config
    const config = await (masterPrisma as any).electronicInvoiceProviderConfig.findUnique({
        where: {
            tenantId_provider: {
                tenantId,
                provider: 'ALEGRA'
            }
        }
    })

    if (!config || config.status !== 'connected') {
        logger.warn(`Alegra not connected for tenant ${tenantId}. Skipping.`)
        return
    }

    const token = config.alegraTokenEncrypted.replace('enc_', '')
    const client = new AlegraClient({ email: config.alegraEmail, token })

    // 3. Get or Create Transmission Record
    let transmission = await (prisma as any).electronicInvoiceTransmission.findUnique({
        where: { tenantId_invoiceId: { tenantId, invoiceId } }
    })

    if (!transmission) {
        transmission = await (prisma as any).electronicInvoiceTransmission.create({
            data: {
                tenantId,
                invoiceId,
                provider: 'ALEGRA',
                status: 'QUEUED',
            }
        })
    } else if (['ALEGRA_ACCEPTED', 'SENT_TO_ALEGRA'].includes(transmission.status)) {
        logger.info(`Invoice ${invoiceId} already sent or accepted. Skipping.`)
        return
    }

    // 4. Update Transmission (Attempt)
    await (prisma as any).electronicInvoiceTransmission.update({
        where: { id: transmission.id },
        data: {
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date()
        }
    })

    // 5. Fetch Invoice with items and customer
    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            items: { include: { product: true } },
            customer: true
        }
    })

    if (!invoice) throw new Error(`Invoice ${invoiceId} not found`)

    try {
        // 6. Log Event: Request Sent
        await (prisma as any).electronicInvoiceEvent.create({
            data: {
                tenantId,
                transmissionId: transmission.id,
                eventType: 'REQUEST_SENT',
            }
        })

        // 7. Map to Alegra Format
        // 7.1 Search or Create Customer in Alegra
        let alegraCustomerId = '1' // Default/Placeholder
        try {
            const identification = invoice.customer.taxId || ''
            if (identification) {
                const searchResults = await client.searchCustomer(identification)
                if (searchResults && searchResults.length > 0) {
                    alegraCustomerId = String(searchResults[0].id)
                } else {
                    // Create customer
                    const newCustomer = await client.createCustomer({
                        name: invoice.customer.name,
                        identification: identification,
                        email: invoice.customer.email,
                        address: { address: invoice.customer.address || '' },
                        type: ['client']
                    })
                    alegraCustomerId = String(newCustomer.id)
                }
            }
        } catch (err) {
            logger.error(`Failed to handle customer sync for Alegra. Using fallback.`, err)
        }

        const alegraPayload = {
            date: (invoice.issuedAt || new Date()).toISOString().split('T')[0],
            dueDate: invoice.dueDate?.toISOString().split('T')[0] || (invoice.issuedAt || new Date()).toISOString().split('T')[0],
            customer: { id: alegraCustomerId },
            items: invoice.items.map(item => ({
                name: (item.product as any).name,
                price: Number(item.unitPrice),
                quantity: Number(item.quantity),
                tax: [{ id: '1', name: 'IVA', percentage: item.taxRate }], // Simplified tax mapping (Alegra usually has '1' for generic VAT)
                discount: item.discount,
                description: (item.product as any).description || ''
            })),
            stamp: {
                generateStamp: true, // Only for electronic invoicing environments
            }
        }

        // 8. Send to Alegra
        const response = await client.createInvoice(alegraPayload)

        // 9. Update Status: Success
        await (prisma as any).electronicInvoiceTransmission.update({
            where: { id: transmission.id },
            data: {
                status: 'ALEGRA_ACCEPTED',
                alegraInvoiceId: String(response.id),
                lastErrorMessage: null
            }
        })

        await (prisma as any).electronicInvoiceEvent.create({
            data: {
                tenantId,
                transmissionId: transmission.id,
                eventType: 'RESPONSE_OK',
                payloadSanitized: { alegraId: response.id }
            }
        })

        // 10. (Optional) Update Invoice with Electronic Info
        // If Alegra returns CUFE or QR in the response (depending on the environment)
        if (response.stamp?.cufe) {
            await prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    cufe: response.stamp.cufe,
                    electronicStatus: 'ACCEPTED'
                }
            })
        }

    } catch (error: any) {
        logger.error(`Alegra transmission failed for invoice ${invoiceId}`, error)

        await (prisma as any).electronicInvoiceTransmission.update({
            where: { id: transmission.id },
            data: {
                status: 'ALEGRA_REJECTED',
                lastErrorMessage: error.message
            }
        })

        await (prisma as any).electronicInvoiceEvent.create({
            data: {
                tenantId,
                transmissionId: transmission.id,
                eventType: 'RESPONSE_ERR',
                payloadSanitized: { error: error.message }
            }
        })
    }
}
