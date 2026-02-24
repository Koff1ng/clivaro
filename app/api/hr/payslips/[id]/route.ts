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
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const payslip = await prisma.payslip.findFirst({
            where: { id: params.id, tenantId },
            include: {
                employee: true,
                items: true,
            },
        });

        if (!payslip) {
            return NextResponse.json({ error: 'Recibo de nómina no encontrado' }, { status: 404 });
        }

        return NextResponse.json(payslip);
    } catch (error: any) {
        console.error('Error fetching payslip:', error);
        return NextResponse.json(
            { error: 'Error al obtener recibo', details: error.message },
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
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const data = await req.json();

        const existingPayslip = await prisma.payslip.findFirst({
            where: { id: params.id, tenantId },
            include: { items: true, payrollPeriod: true },
        });

        if (!existingPayslip) {
            return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
        }

        if (existingPayslip.payrollPeriod.status !== 'DRAFT') {
            return NextResponse.json({ error: 'Solo se pueden modificar recibos de nóminas en estado Borrador.' }, { status: 400 });
        }

        // Typical operation: add or update an item
        const { action, itemData } = data;
        // Example action: 'ADD_ITEM', 'REMOVE_ITEM'

        let newTotalEarnings = existingPayslip.totalEarnings;
        let newTotalDeductions = existingPayslip.totalDeductions;

        if (action === 'ADD_ITEM' && itemData) {
            const amount = parseFloat(itemData.amount);
            if (itemData.type === 'EARNING') newTotalEarnings += amount;
            else newTotalDeductions += amount;

            await prisma.payslipItem.create({
                data: {
                    payslipId: existingPayslip.id,
                    type: itemData.type, // 'EARNING' or 'DEDUCTION'
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

                await prisma.payslipItem.delete({
                    where: { id: itemToRemove.id }
                });
            }
        }

        const newNetPay = newTotalEarnings - newTotalDeductions;

        // Update Payslip totals
        const updatedPayslip = await prisma.payslip.update({
            where: { id: existingPayslip.id },
            data: {
                totalEarnings: newTotalEarnings,
                totalDeductions: newTotalDeductions,
                netPay: newNetPay,
            },
            include: { items: true },
        });

        // We should ideally update the PayrollPeriod totals too, but for simplicity, 
        // period totals can be sum-aggregated dynamically on the frontend or via a separate sync call.
        // For complete correctness, we aggregate it here:
        const periodPayslips = await prisma.payslip.findMany({
            where: { payrollPeriodId: existingPayslip.payrollPeriodId }
        });

        const pEarnings = periodPayslips.reduce((acc, p) => acc + p.totalEarnings, 0);
        const pDeductions = periodPayslips.reduce((acc, p) => acc + p.totalDeductions, 0);
        const pNet = periodPayslips.reduce((acc, p) => acc + p.netPay, 0);

        await prisma.payrollPeriod.update({
            where: { id: existingPayslip.payrollPeriodId },
            data: {
                totalEarnings: pEarnings,
                totalDeductions: pDeductions,
                netPay: pNet
            }
        });

        return NextResponse.json(updatedPayslip);
    } catch (error: any) {
        console.error('Error updating payslip:', error);
        return NextResponse.json(
            { error: 'Error al actualizar recibo', details: error.message },
            { status: 500 }
        );
    }
}
