import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/api-middleware';
import { getTenantIdFromSession } from '@/lib/tenancy';

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requirePermission(req, 'payroll:view');
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const period = await prisma.payrollPeriod.findFirst({
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
        });

        if (!period) {
            return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
        }

        return NextResponse.json(period);
    } catch (error: any) {
        console.error('Error fetching payroll period:', error);
        return NextResponse.json(
            { error: 'Error al obtener período', details: error.message },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requirePermission(req, 'payroll:manage');
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const data = await req.json();

        const existing = await prisma.payrollPeriod.findFirst({
            where: { id: params.id, tenantId },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
        }

        if (existing.status === 'PAID') {
            return NextResponse.json({ error: 'No se puede modificar una nómina que ya ha sido pagada y contabilizada.' }, { status: 400 });
        }

        // Only allow updating status and basic info for now.
        // Payslip items are edited separately (or implicitly update period totals)
        const updateData: any = {};
        if (data.status) updateData.status = data.status;
        if (data.periodName) updateData.periodName = data.periodName;

        if (data.status === 'PAID' && existing.status !== 'PAID') {
            updateData.paidAt = new Date();
        }

        const updated = await prisma.payrollPeriod.update({
            where: { id: params.id },
            data: updateData,
        });

        if (data.status === 'PAID' && existing.status !== 'PAID') {
            try {
                const { createJournalEntryFromPayroll } = await import('@/lib/accounting/payroll-integration');
                await createJournalEntryFromPayroll(updated.id, tenantId, session.user.id);
            } catch (err: any) {
                console.error('Error integrando nómina con contabilidad:', err);
                // Non-blocking error logging
            }
        }

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error updating payroll period:', error);
        return NextResponse.json(
            { error: 'Error al actualizar período', details: error.message },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requirePermission(req, 'payroll:manage');
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const existing = await prisma.payrollPeriod.findFirst({
            where: { id: params.id, tenantId },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 });
        }

        if (existing.status !== 'DRAFT') {
            return NextResponse.json(
                { error: 'Solo se pueden eliminar nóminas en estado Borrador.' },
                { status: 400 }
            );
        }

        await prisma.payrollPeriod.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting payroll period:', error);
        return NextResponse.json(
            { error: 'Error al eliminar período', details: error.message },
            { status: 500 }
        );
    }
}
