import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

const transmitRequestSchema = z.object({
    provider: z.enum(['ALEGRA', 'CUSTOM']).default('ALEGRA')
})

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
        const body = await request.json()
        const parseResult = transmitRequestSchema.safeParse(body)

        if (!parseResult.success) {
            return NextResponse.json(
                { error: 'Error de validación', details: parseResult.error.flatten() },
                { status: 400 }
            )
        }

        const data: z.infer<typeof transmitRequestSchema> = parseResult.data

        const result = await withTenantTx(tenantId, async (prisma) => {
            const creditNote = await prisma.creditNote.findUnique({
                where: { id: creditNoteId },
                include: {
                    invoice: { include: { customer: true } },
                    items: { include: { product: true, variant: true, lineTaxes: true } },
                    taxSummary: true,
                    transmission: true
                }
            })

            if (!creditNote) throw new Error('Nota crédito no encontrada')
            if (creditNote.electronicStatus === 'ACCEPTED') throw new Error('Esta nota crédito ya fue aceptada por DIAN')
            if (!creditNote.invoice.cufe) throw new Error('La factura original no tiene CUFE')

            let transmission = creditNote.transmission
            if (!transmission) {
                transmission = await prisma.creditNoteTransmission.create({
                    data: {
                        creditNoteId: creditNote.id,
                        provider: data.provider,
                        status: 'PENDING'
                    }
                })
            }

            const { transmitCreditNoteToAlegra } = await import('@/lib/alegra/credit-note-transmission')
            const transmissionResult = await transmitCreditNoteToAlegra(creditNote.id, tenantId)

            const updatedCreditNote = await prisma.creditNote.findUnique({
                where: { id: creditNoteId },
                include: { transmission: true }
            })

            return { updatedCreditNote, transmissionResult }
        })

        return NextResponse.json({
            success: true,
            message: `Nota crédito transmitida exitosamente a Alegra`,
            creditNote: result.updatedCreditNote,
            alegraId: result.transmissionResult.alegraId,
            cufe: result.transmissionResult.cufe
        })
    } catch (error: any) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: 'Error de validación', details: error.errors }, { status: 400 })
        logger.error('Error transmitting credit note', error)
        return NextResponse.json({ error: error.message || 'Error al transmitir nota crédito' }, { status: 500 })
    }
}
