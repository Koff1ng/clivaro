import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-middleware';
import { PERMISSIONS } from '@/lib/permissions';
import { getTenantIdFromSession, withTenantTx } from '@/lib/tenancy';

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requirePermission(req, PERMISSIONS.MANAGE_USERS);
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });

        const period = await withTenantTx(tenantId, async (tx) => {
            return tx.payrollPeriod.findFirst({
                where: { id: params.id, tenantId },
                include: {
                    payslips: {
                        include: {
                            employee: true,
                            items: true,
                        },
                    },
                    journalEntry: true,
                },
            })
        })

        if (!period) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
        return NextResponse.json(period);
    } catch (error: any) {
        return NextResponse.json({ error: 'Error al obtener período', details: error.message }, { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requirePermission(req, PERMISSIONS.MANAGE_USERS);
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });

        const data = await req.json();

        const result = await withTenantTx(tenantId, async (tx) => {
            const existing = await tx.payrollPeriod.findFirst({ where: { id: params.id, tenantId } });
            if (!existing) return { notFound: true }
            if (existing.status === 'PAID') return { alreadyPaid: true }

            const updateData: any = {};
            if (data.status) updateData.status = data.status;
            if (data.periodName) updateData.periodName = data.periodName;
            if (data.status === 'PAID' && existing.status !== 'PAID') {
                updateData.paidAt = new Date();
            }

            const updated = await tx.payrollPeriod.update({ where: { id: params.id }, data: updateData });
            return { updated, wasPaid: data.status === 'PAID' && existing.status !== 'PAID' }
        })

        if ((result as any).notFound) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
        if ((result as any).alreadyPaid) return NextResponse.json({ error: 'No se puede modificar una nómina que ya ha sido pagada y contabilizada.' }, { status: 400 });

        const { updated, wasPaid } = result as any;

        if (wasPaid) {
            try {
                const { createJournalEntryFromPayroll } = await import('@/lib/accounting/payroll-integration');
                await createJournalEntryFromPayroll(updated.id, tenantId, session.user.id);
            } catch (err: any) {
                console.error('Error integrando nómina con contabilidad:', err);
            }
        }

        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: 'Error al actualizar período', details: error.message }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requirePermission(req, PERMISSIONS.MANAGE_USERS);
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });

        const result = await withTenantTx(tenantId, async (tx) => {
            const existing = await tx.payrollPeriod.findFirst({ where: { id: params.id, tenantId } });
            if (!existing) return { notFound: true }
            if (existing.status !== 'DRAFT') return { notDraft: true }
            await tx.payrollPeriod.delete({ where: { id: params.id } });
            return { success: true }
        })

        if ((result as any).notFound) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
        if ((result as any).notDraft) return NextResponse.json({ error: 'Solo se pueden eliminar nóminas en estado Borrador.' }, { status: 400 });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: 'Error al eliminar período', details: error.message }, { status: 500 });
    }
}
