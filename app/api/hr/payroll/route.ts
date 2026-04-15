import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware';
import { PERMISSIONS } from '@/lib/permissions';
import { getTenantIdFromSession, withTenantTx, withTenantRead } from '@/lib/tenancy';
import { calculatePayroll, type PayrollEmployeeInput } from '@/lib/payroll/calculations';

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

/**
 * GET /api/hr/payroll
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
        logger.error('Error fetching payroll periods:', error?.message || error);
        
        if (error?.code === 'P2021') {
            return NextResponse.json(
                { error: 'Las tablas de nómina no existen aún. Contacte al administrador del sistema.' },
                { status: 500 }
            );
        }
        
        return NextResponse.json(
            { error: 'Error al obtener períodos de nómina', details: safeErrorMessage(error) },
            { status: 500 }
        );
    }
}

/**
 * POST /api/hr/payroll
 * 
 * Creates a new payroll period and automatically generates payslips for all active employees.
 * Uses the complete Colombian payroll calculations engine (lib/payroll/calculations.ts):
 * - Salario base proporcional a días trabajados
 * - Auxilio de transporte (si salario ≤ 2 SMLMV)
 * - Salud empleado (4%)
 * - Pensión empleado (4%)
 * - Fondo Solidaridad Pensional (1% si salario > 4 SMLMV)
 * - Aportes patronales: ARL, CCF, ICBF, SENA (visibilidad, no se descuentan)
 * 
 * All operations are performed within a tenant-scoped transaction.
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

        // Calcular días del período (ambos extremos inclusivos, máximo 30)
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const periodDays = Math.min(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1, 30);

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

            if (employees.length === 0) {
                // Cleanup the empty period
                await tx.payrollPeriod.delete({ where: { id: period.id } });
                return { error: 'NO_EMPLOYEES' } as any;
            }

            let grandTotalEarnings = 0;
            let grandTotalDeductions = 0;
            let grandNetPay = 0;

            // 3. Create Payslips & calculated items for each employee
            for (const emp of employees) {
                // Usar el motor de cálculos colombianos completo
                const input: PayrollEmployeeInput = {
                    baseSalary: emp.baseSalary,
                    salaryType: emp.salaryType,
                    riskLevel: emp.riskLevel ?? 1,
                    integralSalary: emp.integralSalary ?? false,
                    workedDays: periodDays,
                };

                const calc = calculatePayroll(input);

                grandTotalEarnings += calc.totalEarnings;
                grandTotalDeductions += calc.totalDeductions;
                grandNetPay += calc.netPay;

                // Construir items del payslip: devengados + deducciones + aportes patronales
                const payslipItems = [
                    ...calc.earnings.map(item => ({
                        type: item.type,
                        concept: item.concept,
                        code: item.code,
                        amount: item.amount,
                        percentage: item.percentage || null,
                        isAutomatic: item.isAutomatic,
                    })),
                    ...calc.deductions.map(item => ({
                        type: item.type,
                        concept: item.concept,
                        code: item.code,
                        amount: item.amount,
                        percentage: item.percentage || null,
                        isAutomatic: item.isAutomatic,
                    })),
                    // Aportes patronales como items informativos (EMPLOYER)
                    ...calc.employerContributions.map(item => ({
                        type: item.type,
                        concept: item.concept,
                        code: item.code,
                        amount: item.amount,
                        percentage: item.percentage || null,
                        isAutomatic: item.isAutomatic,
                    })),
                ];

                await tx.payslip.create({
                    data: {
                        tenantId,
                        payrollPeriodId: period.id,
                        employeeId: emp.id,
                        baseSalary: emp.baseSalary,
                        totalEarnings: calc.totalEarnings,
                        totalDeductions: calc.totalDeductions,
                        netPay: calc.netPay,
                        items: {
                            create: payslipItems,
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

        if ((newPeriod as any)?.error === 'NO_EMPLOYEES') {
            return NextResponse.json(
                { error: 'No hay empleados activos. Registra al menos un empleado antes de generar nómina.' },
                { status: 400 }
            );
        }

        return NextResponse.json(newPeriod, { status: 201 });
    } catch (error: any) {
        logger.error('Error creating payroll period:', error?.message || error);
        return NextResponse.json(
            { error: 'Error al generar la nómina', details: safeErrorMessage(error) },
            { status: 500 }
        );
    }
}
