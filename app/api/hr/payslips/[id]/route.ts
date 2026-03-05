import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-middleware';
import { PERMISSIONS } from '@/lib/permissions';
import { getTenantIdFromSession, withTenantTx, withTenantRead } from '@/lib/tenancy';

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requirePermission(req, PERMISSIONS.MANAGE_USERS);
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });

        const payslip = await withTenantRead(tenantId, async (db) => {
            return db.payslip.findFirst({
                where: { id: params.id, tenantId },
                include: { employee: true, items: true },
            })
        })

        if (!payslip) return NextResponse.json({ error: 'Recibo de nómina no encontrado' }, { status: 404 });
        return NextResponse.json(payslip);
    } catch (error: any) {
        return NextResponse.json({ error: 'Error al obtener recibo', details: error.message }, { status: 500 });
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
        const { action, itemData } = data;

        const result = await withTenantTx(tenantId, async (tx) => {
            const existingPayslip = await tx.payslip.findFirst({
                where: { id: params.id, tenantId },
                include: { items: true, payrollPeriod: true },
            });

            if (!existingPayslip) return { notFound: true }
            if (existingPayslip.payrollPeriod.status !== 'DRAFT') return { notDraft: true }

            let newTotalEarnings = existingPayslip.totalEarnings;
            let newTotalDeductions = existingPayslip.totalDeductions;

            if (action === 'ADD_ITEM' && itemData) {
                const amount = parseFloat(itemData.amount);
                if (itemData.type === 'EARNING') newTotalEarnings += amount;
                else newTotalDeductions += amount;

                await tx.payslipItem.create({
                    data: {
                        payslipId: existingPayslip.id,
                        type: itemData.type,
                        concept: itemData.concept,
                        amount: amount,
                        isAutomatic: false,
                    },
                });
            } else if (action === 'REMOVE_ITEM' && itemData?.id) {
                const itemToRemove = existingPayslip.items.find(i => i.id === itemData.id);
                if (itemToRemove) {
                    if (itemToRemove.type === 'EARNING') newTotalEarnings -= itemToRemove.amount;
                    else newTotalDeductions -= itemToRemove.amount;
                    await tx.payslipItem.delete({ where: { id: itemToRemove.id } });
                }
            }

            const newNetPay = newTotalEarnings - newTotalDeductions;

            const updatedPayslip = await tx.payslip.update({
                where: { id: existingPayslip.id },
                data: { totalEarnings: newTotalEarnings, totalDeductions: newTotalDeductions, netPay: newNetPay },
                include: { items: true },
            });

            // Sync PayrollPeriod totals
            const periodPayslips = await tx.payslip.findMany({ where: { payrollPeriodId: existingPayslip.payrollPeriodId } });
            const pEarnings = periodPayslips.reduce((acc, p) => acc + p.totalEarnings, 0);
            const pDeductions = periodPayslips.reduce((acc, p) => acc + p.totalDeductions, 0);
            const pNet = periodPayslips.reduce((acc, p) => acc + p.netPay, 0);

            await tx.payrollPeriod.update({
                where: { id: existingPayslip.payrollPeriodId },
                data: { totalEarnings: pEarnings, totalDeductions: pDeductions, netPay: pNet },
            });

            return { updatedPayslip }
        })

        if ((result as any).notFound) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
        if ((result as any).notDraft) return NextResponse.json({ error: 'Solo se pueden modificar recibos de nóminas en estado Borrador.' }, { status: 400 });

        return NextResponse.json((result as any).updatedPayslip);
    } catch (error: any) {
        return NextResponse.json({ error: 'Error al actualizar recibo', details: error.message }, { status: 500 });
    }
}
