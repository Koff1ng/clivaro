import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { prisma as masterPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { FactusClient } from '@/lib/factus/client'

export const dynamic = 'force-dynamic'

export async function POST(
    request: Request,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
    const resolvedParams = await Promise.resolve(params)
    const creditNoteId = resolvedParams.id

    const session = await requirePermission(request as any, [
        PERMISSIONS.MANAGE_SALES,
        PERMISSIONS.MANAGE_RETURNS
    ])
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const result = await withTenantTx(tenantId, async (prisma) => {
            // 1. Fetch credit note with relations
            const creditNote = await prisma.creditNote.findUnique({
                where: { id: creditNoteId },
                include: {
                    invoice: { include: { customer: true } },
                    items: { include: { product: true, variant: true, lineTaxes: true } },
                    taxSummary: true,
                }
            })

            if (!creditNote) throw new Error('Nota crédito no encontrada')
            if (creditNote.electronicStatus === 'ACCEPTED') throw new Error('Esta nota crédito ya fue aceptada por la DIAN')
            if (!creditNote.invoice.cufe) throw new Error('La factura original no tiene CUFE — debe enviar la factura electrónicamente primero')

            // 2. Get Factus credentials
            const tenantSettings = await masterPrisma.tenantSettings.findUnique({
                where: { tenantId },
            })

            const s = tenantSettings as any
            if (!s?.factusClientId || !s?.factusClientSecret || !s?.factusUsername || !s?.factusPassword) {
                throw new Error('Configura las credenciales de Factus en Ajustes > Facturación Electrónica')
            }

            const client = new FactusClient({
                clientId: s.factusClientId,
                clientSecret: s.factusClientSecret,
                username: s.factusUsername,
                password: s.factusPassword,
                sandbox: s.factusSandbox ?? true,
            })

            // 3. Map customer identification type
            const customer = creditNote.invoice.customer
            const idTypeMap: Record<string, number> = {
                'CC': 1, 'NIT': 6, 'CE': 2, 'PA': 7, 'TI': 3, 'RC': 11, 'NUIP': 1,
            }
            const customerIdType = customer.idType || (customer.isCompany ? 'NIT' : 'CC')
            const nitParts = (customer.taxId || '222222222222').split('-')

            // 4. Map items
            const items = creditNote.items.map((item: any) => {
                const ivaTax = item.lineTaxes?.find((t: any) =>
                    t.name?.toUpperCase().includes('IVA')
                )
                const incTax = item.lineTaxes?.find((t: any) =>
                    t.name?.toUpperCase().includes('INC') ||
                    t.name?.toUpperCase().includes('IMPOCONSUMO')
                )
                const ivaRate = ivaTax?.rate || 0
                const hasIvaTax = !!ivaTax

                // Determine tribute: 1=IVA (default), 4=INC
                let tributeId = 1
                let taxRate = ivaRate
                if (!hasIvaTax && incTax) {
                    tributeId = 4
                    taxRate = incTax.rate || 0
                }

                return {
                    code_reference: item.product?.sku || item.productId || 'PROD',
                    name: item.product?.name || 'Producto',
                    quantity: item.quantity,
                    discount_rate: item.discount || 0,
                    price: item.unitPrice,
                    tax_rate: taxRate,
                    unit_measure_id: 70,
                    standard_code_id: 1,
                    is_excluded: hasIvaTax ? 0 : 1,
                    tribute_id: tributeId,
                }
            })

            // 5. Build credit note request for Factus
            const creditNotePayload = {
                document: '91', // 91 = Nota Crédito
                numbering_range_id: undefined as number | undefined,
                reference_code: creditNote.number,
                observation: creditNote.reason || `Nota crédito para factura ${creditNote.invoice.number}`,
                payment_form: 1,
                payment_method_code: '10', // Credit notes default to cash refund per DIAN
                // Reference to original invoice
                billing_reference: {
                    number: creditNote.invoice.number,
                    uuid: creditNote.invoice.cufe,
                    issue_date: creditNote.invoice.issuedAt
                        ? new Date(creditNote.invoice.issuedAt).toISOString().split('T')[0]
                        : new Date(creditNote.invoice.createdAt).toISOString().split('T')[0],
                },
                customer: {
                    identification_document_id: idTypeMap[customerIdType] || 1,
                    identification: nitParts[0],
                    dv: nitParts.length > 1 ? nitParts[1] : undefined,
                    names: customer.name || 'Cliente General',
                    address: customer.address || undefined,
                    email: customer.email || undefined,
                    phone: customer.phone || undefined,
                    legal_organization_id: customer.isCompany ? 1 : 2,
                    tribute_id: 21,
                },
                items,
            }

            logger.info('[Factus] Sending credit note', { payload: creditNotePayload })

            // 6. Send to Factus
            const response = await (client as any).request('/v1/credit-notes/validate', {
                method: 'POST',
                body: JSON.stringify(creditNotePayload),
            })

            // 7. Update credit note with result
            if (response?.data?.bill || response?.data?.credit_note) {
                const bill = response.data.bill || response.data.credit_note
                const statusStr = String(bill.status)
                const isAccepted = statusStr === '1' || statusStr === 'Validado' || !!bill.validated || !!bill.cufe

                await prisma.creditNote.update({
                    where: { id: creditNoteId },
                    data: {
                        electronicStatus: isAccepted ? 'ACCEPTED' : 'SENT',
                        cufe: bill.cufe || null,
                        electronicResponse: JSON.stringify(response),
                        electronicSentAt: new Date(),
                    }
                })

                return {
                    success: true,
                    cufe: bill.cufe,
                    number: bill.number,
                    status: isAccepted ? 'ACCEPTED' : 'SENT',
                    message: `Nota crédito ${bill.number || creditNote.number} ${isAccepted ? 'validada por la DIAN' : 'enviada'} exitosamente`,
                }
            }

            // Fallback: response didn't contain expected bill data
            await prisma.creditNote.update({
                where: { id: creditNoteId },
                data: {
                    electronicStatus: 'SENT',
                    electronicResponse: JSON.stringify(response),
                    electronicSentAt: new Date(),
                }
            })

            return {
                success: true,
                message: response?.message || 'Nota crédito enviada a Factus',
                status: 'SENT',
            }
        })

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('Error transmitting credit note to Factus', error)
        return NextResponse.json(
            { error: error.message || 'Error al transmitir nota crédito' },
            { status: 500 }
        )
    }
}
