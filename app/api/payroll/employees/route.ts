import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const employeeSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    documentId: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    hireDate: z.string(),
    baseSalary: z.number().min(0),
})

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS) // Reusing MANAGE_USERS for HR
    if (session instanceof NextResponse) return session
    const prisma = await getPrismaForRequest(request, session)

    try {
        const employees = await prisma.employee.findMany({
            orderBy: { lastName: 'asc' }
        })
        return NextResponse.json(employees)
    } catch (error) {
        console.error('Error fetching employees:', error)
        return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    if (session instanceof NextResponse) return session
    const prisma = await getPrismaForRequest(request, session)

    try {
        const body = await request.json()
        const data = employeeSchema.parse(body)

        const employee = await prisma.employee.create({
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                documentId: data.documentId,
                email: data.email || null,
                phone: data.phone,
                address: data.address,
                hireDate: new Date(data.hireDate),
                baseSalary: data.baseSalary,
                status: 'ACTIVE'
            }
        })

        return NextResponse.json(employee, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
        }
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'Employee already exists (Document ID)' }, { status: 409 })
        }
        console.error('Error creating employee:', error)
        return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
    }
}
