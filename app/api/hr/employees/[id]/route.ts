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

        const employee = await prisma.employee.findFirst({
            where: { id: params.id, tenantId },
            include: {
                payslips: true, // You may want to limit this later
            },
        });

        if (!employee) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        }

        return NextResponse.json(employee);
    } catch (error: any) {
        console.error('Error fetching employee:', error);
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
        const session = await requirePermission(req, 'payroll:manage');
        if (session instanceof NextResponse) { return session; }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const data = await req.json();

        // Verify employee exists and belongs to tenant
        const existingEmployee = await prisma.employee.findFirst({
            where: { id: params.id, tenantId }
        });

        if (!existingEmployee) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        }

        const updatedEmployee = await prisma.employee.update({
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
            },
        });

        return NextResponse.json(updatedEmployee);
    } catch (error: any) {
        console.error('Error updating employee:', error);
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
        const session = await requirePermission(req, 'payroll:manage');
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const employee = await prisma.employee.findFirst({
            where: { id: params.id, tenantId },
            include: { payslips: true }
        });

        if (!employee) {
            return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
        }

        // Prevent deletion if employee has payslips, instead encourage setting them as inactive
        if (employee.payslips.length > 0) {
            return NextResponse.json(
                { error: 'No se puede eliminar el empleado porque tiene nóminas asociadas. Se recomienda marcarlo como Inactivo.' },
                { status: 400 }
            );
        }

        await prisma.employee.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting employee:', error);
        return NextResponse.json(
            { error: 'Error al eliminar empleado', details: error.message },
            { status: 500 }
        );
    }
}
