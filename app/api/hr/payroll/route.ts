import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-middleware';
import { PERMISSIONS } from '@/lib/permissions';
import { getTenantIdFromSession, withTenantTx, withTenantRead } from '@/lib/tenancy';

export const dynamic = 'force-dynamic'

/**
 * Fetches all payroll periods for the current tenant.
 * Requires `MANAGE_USERS` permission (Human Resources context).
 */
export async function GET(req: Request) {
    try {
        const session = await requirePermission(req, PERMISSIONS.MANAGE_USERS);
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const periods = await withTenantRead(tenantId, async (db) => {
            return db.payrollPeriod.findMany({
                where: { tenantId },
                orderBy: { startDate: 'desc' },
                include: { _count: { select: { payslips: true } } }
            })
        })

        return NextResponse.json(periods);
    } catch (error: any) {
        console.error('Error fetching payroll periods:', error);
        return NextResponse.json(
            { error: 'Error al obtener períodos de nómina', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Creates a new payroll period and automatically generates payslips for all active employees.
 * This process includes calculating legal deductions for Colombia (Health 4% and Pension 4%).
 * All operations are performed within a tenant-scoped transaction.
 * 
 * @param req - The request object containing `periodName`, `startDate`, and `endDate`.
 */
export async function POST(req: Request) {
    try {
        const session = await requirePermission(req, PERMISSIONS.MANAGE_USERS);
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

        // withTenantTx wraps in a transaction so this is equivalent to prisma.$transaction
        const newPeriod = await withTenantTx(tenantId, async (tx) => {
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
            let grandTotalDeductions = 0;
            let grandNetPay = 0;

            // 3. Create Payslips & Basic Items for each employee
            for (const emp of employees) {
                const salary = emp.baseSalary;

                // CÁLCULOS DE LEY (COLOMBIA)
                const healthDeduction = salary * 0.04; // 4% Salud
                const pensionDeduction = salary * 0.04; // 4% Pensión

                const totalEarnings = salary;
                const totalDeductions = healthDeduction + pensionDeduction;
                const netPay = totalEarnings - totalDeductions;

                grandTotalEarnings += totalEarnings;
                grandTotalDeductions += totalDeductions;
                grandNetPay += netPay;

                await tx.payslip.create({
                    data: {
                        tenantId,
                        payrollPeriodId: period.id,
                        employeeId: emp.id,
                        baseSalary: salary,
                        totalEarnings: totalEarnings,
                        totalDeductions: totalDeductions,
                        netPay: netPay,
                        items: {
                            create: [
                                {
                                    type: 'EARNING',
                                    concept: 'Salario Base',
                                    amount: salary,
                                    isAutomatic: true,
                                },
                                {
                                    type: 'DEDUCTION',
                                    concept: 'Salud (4%)',
                                    amount: healthDeduction,
                                    isAutomatic: true,
                                },
                                {
                                    type: 'DEDUCTION',
                                    concept: 'Pensión (4%)',
                                    amount: pensionDeduction,
                                    isAutomatic: true,
                                },
                            ],
                        },
                    },
                });
            }

            // 4. Update the period with total amounts
            return tx.payrollPeriod.update({
                where: { id: period.id },
                data: {
                    totalEarnings: grandTotalEarnings,
                    totalDeductions: grandTotalDeductions,
                    netPay: grandNetPay,
                },
            });
        }, { timeout: 30000 })

        return NextResponse.json(newPeriod, { status: 201 });
    } catch (error: any) {
        console.error('Error creating payroll period:', error);
        return NextResponse.json(
            { error: 'Error al generar la nómina', details: error.message },
            { status: 500 }
        );
    }
}
