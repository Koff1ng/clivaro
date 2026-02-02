import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx } from '@/lib/tenancy'

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_INVOICES)
    if (session instanceof NextResponse) return session

    const customerId = params.id

    return await withTenantTx(session.user.tenantId, async (tx: any) => {
        // 1. Get all invoices with their payments
        const invoices = await tx.invoice.findMany({
            where: { customerId },
            include: {
                payments: true
            },
            orderBy: { issuedAt: 'desc' }
        })

        // 2. Normalize and calculate running balance per invoice
        const ledger = invoices.map((inv: any) => {
            const paid = inv.payments.reduce((sum: number, p: any) => sum + p.amount, 0)
            const balance = inv.total - paid
            const status = balance <= 0.01 ? 'PAID' : (inv.status === 'ANULADA' ? 'ANULADA' : 'PENDING')

            return {
                id: inv.id,
                number: inv.number,
                date: inv.issuedAt,
                total: inv.total,
                paid,
                balance,
                status,
                payments: inv.payments
            }
        })

        return NextResponse.json(ledger)
    })
}
