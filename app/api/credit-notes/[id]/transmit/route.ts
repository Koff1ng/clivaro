import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

const transmitRequestSchema = z.object({
    provider: z.enum(['ALEGRA', 'CUSTOM']).default('ALEGRA')
})

/**
 * POST /api/credit-notes/[id]/transmit
 * Transmit credit note to DIAN via provider (Alegra)
 */
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

    const prisma = await getPrismaForRequest(request, session)
    const tenantId = getTenantIdFromSession(session)
    const userId = (session.user as any).id

    try {
        const body = await request.json()
        const data = transmitRequestSchema.parse(body)

        // Get credit note with all details
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
                        variant: true,
                        lineTaxes: true
                    }
                },
                taxSummary: true,
                transmission: true
            }
        })

        if (!creditNote) {
            return NextResponse.json({ error: 'Nota crédito no encontrada' }, { status: 404 })
        }

        // Check if already transmitted successfully
        if (creditNote.electronicStatus === 'ACCEPTED') {
            return NextResponse.json({
                error: 'Esta nota crédito ya fue aceptada por DIAN',
                creditNote
            }, { status: 400 })
        }

        // Validate that invoice is electronic
        if (!creditNote.invoice.cufe) {
            return NextResponse.json({
                error: 'La factura original no tiene CUFE. Solo facturas electrónicas pueden tener notas crédito electrónicas.'
            }, { status: 400 })
        }

        // Create or update transmission record
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

        // Transmit to Alegra
        const { transmitCreditNoteToAlegra } = await import('@/lib/alegra/credit-note-transmission')

        try {
            const result = await transmitCreditNoteToAlegra(creditNote.id, tenantId)

            logger.info('Credit note transmitted successfully', {
                creditNoteId: creditNote.id,
                alegraId: result.alegraId,
                cufe: result.cufe
            })

            // Refresh credit note data
            const updatedCreditNote = await prisma.creditNote.findUnique({
                where: { id: creditNoteId },
                include: {
                    transmission: true
                }
            })

            return NextResponse.json({
                success: true,
                message: `Nota crédito transmitida exitosamente a Alegra`,
                creditNote: updatedCreditNote,
                alegraId: result.alegraId,
                cufe: result.cufe
            })
        } catch (transmissionError: any) {
            logger.error('Transmission error', transmissionError, { creditNoteId })

            return NextResponse.json({
                success: false,
                error: transmissionError.message || 'Error al transmitir a Alegra',
                details: transmissionError
            }, { status: 500 })
        }
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Error de validación', details: error.errors }, { status: 400 })
        }
        logger.error('Error transmitting credit note', error, { creditNoteId })
        return NextResponse.json({ error: error.message || 'Error al transmitir nota crédito' }, { status: 500 })
    }
}
