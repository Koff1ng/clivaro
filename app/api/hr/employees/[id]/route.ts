import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware';
import { PERMISSIONS } from '@/lib/permissions';
import { getTenantIdFromSession, withTenantTx, withTenantRead } from '@/lib/tenancy';

export const dynamic = 'force-dynamic'

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requirePermission(req, PERMISSIONS.MANAGE_USERS);
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const employee = await withTenantRead(tenantId, async (db) => {
            return db.employee.findFirst({
                where: { id: params.id, tenantId },
                include: { payslips: true },
            })
        })

        if (!employee) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        }

        return NextResponse.json(employee);
    } catch (error: any) {
        logger.error('Error fetching employee:', error);
        return NextResponse.json(
            { error: 'Error al obtener empleado', details: error.message },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await requirePermission(req, PERMISSIONS.MANAGE_USERS);
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const data = await req.json();

        const updatedEmployee = await withTenantTx(tenantId, async (tx) => {
            const existingEmployee = await tx.employee.findFirst({
                where: { id: params.id, tenantId }
            });

            if (!existingEmployee) return null;

            return tx.employee.update({
                where: { id: params.id },
                data: {
                    documentType: data.documentType,
                    documentNumber: data.documentNumber,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                    phone: data.phone,
                    address: data.address,
                    jobTitle: data.jobTitle,
                    department: data.department,
                    hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
                    isActive: data.isActive,
                    baseSalary: data.baseSalary ? parseFloat(data.baseSalary) : undefined,
                    salaryType: data.salaryType,
                    bankName: data.bankName,
                    bankAccountType: data.bankAccountType,
                    bankAccountNumber: data.bankAccountNumber,
                    healthEntity: data.healthEntity,
                    pensionEntity: data.pensionEntity,
                    arlEntity: data.arlEntity,
                    compensationBox: data.compensationBox,
                    paymentMethod: data.paymentMethod,
                    // Campos Nómina Electrónica
                    riskLevel: data.riskLevel !== undefined ? parseInt(data.riskLevel) : undefined,
                    contractType: data.contractType,
                    workerType: data.workerType,
                    workerSubType: data.workerSubType,
                    municipality: data.municipality,
                    integralSalary: data.integralSalary,
                },
            });
        })

        if (!updatedEmployee) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        }

        return NextResponse.json(updatedEmployee);
    } catch (error: any) {
        logger.error('Error updating employee:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                { error: 'Ya existe un empleado con este número de documento' },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: 'Error al actualizar empleado', details: error.message },
            { status: 500 }
        );
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

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const result = await withTenantTx(tenantId, async (tx) => {
            const employee = await tx.employee.findFirst({
                where: { id: params.id, tenantId },
                include: { payslips: true }
            });

            if (!employee) return { notFound: true };
            if (employee.payslips.length > 0) return { hasPayslips: true };

            await tx.employee.delete({ where: { id: params.id } });
            return { success: true };
        })

        if ((result as any).notFound) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        }
        if ((result as any).hasPayslips) {
            return NextResponse.json(
                { error: 'No se puede eliminar el empleado porque tiene nóminas asociadas. Se recomienda marcarlo como Inactivo.' },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        logger.error('Error deleting employee:', error);
        return NextResponse.json(
            { error: 'Error al eliminar empleado', details: error.message },
            { status: 500 }
        );
    }
}
