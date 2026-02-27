import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/api-middleware';
import { getTenantIdFromSession } from '@/lib/tenancy';

export async function GET(req: Request) {
    try {
        const session = await requirePermission(req, 'payroll:view');
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const periods = await prisma.payrollPeriod.findMany({
            where: { tenantId },
            orderBy: { startDate: 'desc' },
            include: {
                _count: {
                    select: { payslips: true }
                }
            }
        });

        return NextResponse.json(periods);
    } catch (error: any) {
        console.error('Error fetching payroll periods:', error);
        return NextResponse.json(
            { error: 'Error al obtener períodos de nómina', details: error.message },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const session = await requirePermission(req, 'payroll:manage');
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const data = await req.json();

        if (!data.periodName || !data.startDate || !data.endDate) {
            return NextResponse.json(
                { error: 'Faltan campos obligatorios (nombre, fecha de inicio, fecha de fin)' },
                { status: 400 }
            );
        }

        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);

        // Run within a transaction to ensure all payslips are created atomically
        const newPeriod = await prisma.$transaction(async (tx) => {
            // 1. Create the base Payroll Period
            const period = await tx.payrollPeriod.create({
                data: {
                    tenantId,
                    periodName: data.periodName,
                    startDate,
                    endDate,
                    status: 'DRAFT',
                    totalEarnings: 0,
                    totalDeductions: 0,
                    netPay: 0,
                },
            });

            // 2. Fetch all active employees
            const employees = await tx.employee.findMany({
                where: { tenantId, isActive: true },
            });

            let grandTotalEarnings = 0;

            // 3. Create Payslips & Basic Items for each employee
            for (const emp of employees) {
                const salary = emp.baseSalary;
                grandTotalEarnings += salary;

                await tx.payslip.create({
                    data: {
                        tenantId,
                        payrollPeriodId: period.id,
                        employeeId: emp.id,
                        baseSalary: salary,
                        totalEarnings: salary,
                        totalDeductions: 0,
                        netPay: salary,
                        items: {
                            create: [
                                {
                                    type: 'EARNING',
                                    concept: 'Salario Base',
                                    amount: salary,
                                    isAutomatic: true,
                                },
                            ],
                        },
                    },
                });
            }

            // 4. Update the period with total amounts
            if (grandTotalEarnings > 0) {
                return tx.payrollPeriod.update({
                    where: { id: period.id },
                    data: {
                        totalEarnings: grandTotalEarnings,
                        netPay: grandTotalEarnings, // deductions are 0 initially
                    },
                });
            }

            return period;
        });

        return NextResponse.json(newPeriod, { status: 201 });
    } catch (error: any) {
        console.error('Error creating payroll period:', error);
        return NextResponse.json(
            { error: 'Error al generar la nómina', details: error.message },
            { status: 500 }
        );
    }
}
