import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const runSchema = z.object({
    startDate: z.string(),
    endDate: z.string(),
    notes: z.string().optional(),
})

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    if (session instanceof NextResponse) return session
    const prisma = await getPrismaForRequest(request, session)

    try {
        const runs = await prisma.payrollRun.findMany({
            orderBy: { startDate: 'desc' },
            include: {
                _count: {
                    select: { items: true }
                }
            }
        })
        return NextResponse.json(runs)
    } catch (error) {
        console.error('Error fetching payroll runs:', error)
        return NextResponse.json({ error: 'Failed to fetch payroll runs' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    if (session instanceof NextResponse) return session
    const prisma = await getPrismaForRequest(request, session)

    try {
        const body = await request.json()
        const data = runSchema.parse(body)

        // 1. Get all active employees
        const employees = await prisma.employee.findMany({
            where: { status: 'ACTIVE' }
        })

        if (employees.length === 0) {
            return NextResponse.json({ error: 'No active employees to generate payroll for' }, { status: 400 })
        }

        // 2. Calculate Total (Simple Base Salary sum for now)
        const total = employees.reduce((sum: number, emp: any) => sum + emp.baseSalary, 0)

        // 3. Create Run and Items
        const run = await prisma.payrollRun.create({
            data: {
                startDate: new Date(data.startDate),
                endDate: new Date(data.endDate),
                status: 'DRAFT',
                total,
                notes: data.notes,
                items: {
                    create: employees.map((emp: any) => ({
                        employeeId: emp.id,
                        type: 'SALARY',
                        description: 'Salario Base',
                        amount: emp.baseSalary
                    }))
                }
            },
            include: {
                items: true
            }
        })

        return NextResponse.json(run, { status: 201 })
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
        }
        console.error('Error creating payroll run:', error)
        return NextResponse.json({ error: 'Failed to create payroll run' }, { status: 500 })
    }
}
