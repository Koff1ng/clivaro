import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requirePermission } from '@/lib/api-middleware';
import { getTenantIdFromSession } from '@/lib/tenancy';

export async function GET(req: Request) {
    try {
        const session = await requirePermission(req, 'payroll:view'); // Assumes proper permission handling
        if (session instanceof NextResponse) {
            return session;
        }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search');
        const isActiveStr = searchParams.get('isActive');

        const whereClause: any = { tenantId };

        if (search) {
            whereClause.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { documentNumber: { contains: search } },
            ];
        }

        if (isActiveStr !== null) {
            whereClause.isActive = isActiveStr === 'true';
        }

        const employees = await prisma.employee.findMany({
            where: whereClause,
            orderBy: { firstName: 'asc' },
        });

        return NextResponse.json(employees);
    } catch (error: any) {
        console.error('Error fetching employees:', error);
        return NextResponse.json(
            { error: 'Error al obtener empleados', details: error.message },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const session = await requirePermission(req, 'payroll:manage');
        if (session instanceof NextResponse) {
            return session;
        }
        const tenantId = await getTenantIdFromSession(session);

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 });
        }

        const data = await req.json();

        // Basic validation
        if (!data.documentNumber || !data.firstName || !data.lastName || !data.baseSalary) {
            return NextResponse.json(
                { error: 'Faltan campos obligatorios (Documento, Nombre, Apellido, Salario base)' },
                { status: 400 }
            );
        }

        const newEmployee = await prisma.employee.create({
            data: {
                tenantId,
                documentType: data.documentType || 'CC',
                documentNumber: data.documentNumber,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                address: data.address,
                jobTitle: data.jobTitle || 'Empleado',
                department: data.department,
                hireDate: new Date(data.hireDate || new Date()),
                isActive: data.isActive !== false,
                baseSalary: parseFloat(data.baseSalary),
                salaryType: data.salaryType || 'FIJO',
                bankName: data.bankName,
                bankAccountType: data.bankAccountType,
                bankAccountNumber: data.bankAccountNumber,
            },
        });

        return NextResponse.json(newEmployee, { status: 201 });
    } catch (error: any) {
        console.error('Error creating employee:', error);
        // Handle unique constraint violation (P2002)
        if (error.code === 'P2002') {
            return NextResponse.json(
                { error: 'Ya existe un empleado con este número de documento' },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: 'Error al crear empleado', details: error.message },
            { status: 500 }
        );
    }
}
