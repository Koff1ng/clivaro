import { prisma } from '@/lib/db'
import { AlegraClient } from '@/lib/alegra/client'
import { logger } from '@/lib/logger'

/**
 * Transmit credit note to Alegra API for DIAN electronic submission
 */
export async function transmitCreditNoteToAlegra(
    creditNoteId: string,
    tenantId: string
) {
    try {
        // 1. Get credit note with all details
        const creditNote = await prisma.creditNote.findUnique({
            where: { id: creditNoteId },
            include: {
                invoice: {
                    include: {
                        customer: true
                    }
                },
                items: {
                    include: {
                        product: true,
                        variant: true
                    }
                },
                transmission: true
            }
        })

        if (!creditNote) {
            throw new Error('Credit note not found')
        }

        // 2. Get Alegra config from integration
        const integration = await prisma.electronicInvoiceProviderConfig.findFirst({
            where: {
                tenantId,
                provider: 'ALEGRA',
                status: 'connected'
            }
        })

        if (!integration?.alegraEmail || !integration?.alegraTokenEncrypted) {
            throw new Error('Alegra integration not configured for this tenant')
        }

        // 3. Create Alegra client
        const token = integration.alegraTokenEncrypted.replace('enc_', '')
        const client = new AlegraClient({
            email: integration.alegraEmail,
            token
        })

        // 4. Get or create transmission record
        let transmission = creditNote.transmission
        if (!transmission) {
            transmission = await prisma.creditNoteTransmission.create({
                data: {
                    creditNoteId: creditNote.id,
                    provider: 'ALEGRA',
                    status: 'PENDING'
                }
            })
        }

        // Update to processing
        await prisma.creditNoteTransmission.update({
            where: { id: transmission.id },
            data: { status: 'PROCESSING' }
        })

        await prisma.creditNoteEvent.create({
            data: {
                transmissionId: transmission.id,
                event: 'TRANSMISSION_STARTED',
                message: `Iniciando transmisión de NC ${creditNote.number} a Alegra`
            }
        })

        // 5. Get or create customer in Alegra
        let alegraCustomerId = ''
        const nit = creditNote.invoice.customer.taxId?.split('-')[0] || ''

        if (nit) {
            const searchResults = await client.searchCustomer(nit)
            if (searchResults && searchResults.length > 0) {
                alegraCustomerId = String(searchResults[0].id)
            }
        }

        // Create customer if not found
        if (!alegraCustomerId) {
            const customerPayload: any = {
                name: creditNote.invoice.customer.name,
                identification: creditNote.invoice.customer.taxId || '',
                phonePrimary: creditNote.invoice.customer.phone || '',
                email: creditNote.invoice.customer.email || ''
            }

            // Set identification type based on length
            const idNumber = creditNote.invoice.customer.taxId?.split('-')[0] || ''
            if (idNumber.length === 10) {
                customerPayload.identificationObject = { type: 'CC', number: idNumber }
            } else {
                customerPayload.identificationObject = { type: 'NIT', number: idNumber }
            }

            const newCustomer = await client.createCustomer(customerPayload)
            alegraCustomerId = String(newCustomer.id)
        }

        // 6. Get a fallback product from Alegra
        const alegraProducts = await client.getProducts({ limit: 10 })
        let fallbackProductId = null

        if (alegraProducts && alegraProducts.length > 0) {
            const activeProduct = alegraProducts.find((p: any) => p.status === 'active')
            if (activeProduct) {
                fallbackProductId = activeProduct.id
            } else {
                fallbackProductId = alegraProducts[0].id
            }
        }

        // 7. Get electronic numbering template
        const numberingTemplates = await client.getNumberTemplates()
        const electronicTemplate = numberingTemplates.find(
            (t: any) => t.isElectronic === true || t.documentType === 'credit-note'
        )

        if (!electronicTemplate) {
            logger.warn('[CreditNoteAlegra] No electronic numbering template found for credit notes')
        }

        // 8. Map to Alegra credit note format
        const alegraPayload: any = {
            invoice: creditNote.invoice.alegraInvoiceId || creditNote.invoice.number,
            date: new Date(creditNote.createdAt).toISOString().split('T')[0],
            client: alegraCustomerId,
            observations: creditNote.reason,
            items: creditNote.items.map(item => ({
                id: fallbackProductId,
                name: item.description,
                description: item.description,
                price: item.unitPrice,
                quantity: item.quantity,
                discount: item.discount,
                tax: [
                    {
                        id: 1, // IVA - typically ID 1 in Alegra
                        percentage: item.taxRate
                    }
                ]
            }))
        }

        // Add numbering template if found
        if (electronicTemplate?.id) {
            alegraPayload.numberTemplate = { id: electronicTemplate.id }
        }

        // Add reference code
        if (creditNote.referenceCode === '20') {
            alegraPayload.referenceType = '20' // Anulación
        } else if (creditNote.referenceCode === '22') {
            alegraPayload.referenceType = '22' // Devolución parcial
        }

        // 9. Send to Alegra
        logger.info(`[CreditNoteAlegra] Sending to Alegra:`, { payload: alegraPayload })
        const response = await client.createCreditNote(alegraPayload)

        // 10. Update transmission with success
        await prisma.creditNoteTransmission.update({
            where: { id: transmission.id },
            data: {
                status: 'SENT',
                externalId: String(response.id),
                responseData: JSON.stringify(response)
            }
        })

        await prisma.creditNoteEvent.create({
            data: {
                transmissionId: transmission.id,
                event: 'ALEGRA_ACCEPTED',
                message: `Nota crédito creada en Alegra con ID ${response.id}`
            }
        })

        // 11. Update credit note status
        await prisma.creditNote.update({
            where: { id: creditNote.id },
            data: {
                electronicStatus: 'SENT',
                electronicSentAt: new Date(),
                cufe: response.cufe || response.cude || null,
                qrCode: response.qrCode || null,
                alegraId: String(response.id)
            }
        })

        logger.info(`[CreditNoteAlegra] Successfully transmitted credit note ${creditNote.number}`)

        return {
            success: true,
            alegraId: response.id,
            cufe: response.cufe || response.cude,
            response
        }

    } catch (error: any) {
        logger.error(`[CreditNoteAlegra] Error transmitting credit note ${creditNoteId}:`, error)

        // Update transmission with error
        const transmission = await prisma.creditNoteTransmission.findFirst({
            where: { creditNoteId }
        })

        if (transmission) {
            await prisma.creditNoteTransmission.update({
                where: { id: transmission.id },
                data: {
                    status: 'FAILED',
                    errorMessage: error.message || 'Unknown error'
                }
            })

            await prisma.creditNoteEvent.create({
                data: {
                    transmissionId: transmission.id,
                    event: 'TRANSMISSION_FAILED',
                    message: `Error: ${error.message || 'Unknown error'}`
                }
            })
        }

        // Update credit note status
        await prisma.creditNote.update({
            where: { id: creditNoteId },
            data: {
                electronicStatus: 'REJECTED'
            }
        })

        throw error
    }
}
