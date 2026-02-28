import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { generatePayslipPDF } from '@/lib/pdf'

export async function GET(
    request: Request,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
    // Verificamos permisos de Recursos Humanos
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)

    if (session instanceof NextResponse) {
        return session
    }

    const tenantId = await getTenantIdFromSession(session)
    if (!tenantId) {
        return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 })
    }

    try {
        const resolvedParams = await params
        const payslip = await prisma.payslip.findFirst({
            where: { id: resolvedParams.id, tenantId },
            include: {
                employee: true,
                payrollPeriod: true,
                items: true,
            },
        })

        if (!payslip) {
            return NextResponse.json(
                { error: 'Colilla/Recibo no encontrado' },
                { status: 404 }
            )
        }

        const settings = await prisma.tenantSettings.findUnique({
            where: { tenantId: (session.user as any).tenantId }
        })

        let companyName = 'Empresa'
        let companyNit = 'NIT 000000000-0'
        try {
            if (settings?.customSettings) {
                const custom = JSON.parse(settings.customSettings)
                if (custom.identity?.name) companyName = custom.identity.name
                if (custom.identity?.nit) companyName = custom.identity.nit
            }
        } catch (e) {
            // Ignorar fallback parse error
        }

        const earnings = payslip.items
            .filter((item: any) => item.type === 'EARNING')
            .map((item: any) => ({
                concept: item.concept,
                amount: item.amount,
            }))

        const deductions = payslip.items
            .filter((item: any) => item.type === 'DEDUCTION')
            .map((item: any) => ({
                concept: item.concept,
                amount: item.amount,
            }))

        const pdfBuffer = await generatePayslipPDF({
            company: {
                name: companyName,
                nit: companyNit,
            },
            employee: {
                name: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
                documentNumber: payslip.employee.documentNumber,
                jobTitle: payslip.employee.jobTitle || undefined,
                email: payslip.employee.email || undefined,
                bankName: payslip.employee.bankName || undefined,
                bankAccountType: payslip.employee.bankAccountType || undefined,
                bankAccountNumber: payslip.employee.bankAccountNumber || undefined,
                healthEntity: payslip.employee.healthEntity || undefined,
                pensionEntity: payslip.employee.pensionEntity || undefined,
                paymentMethod: payslip.employee.paymentMethod || undefined,
            },
            payslip: {
                number: payslip.documentNumber || `NEA-${payslip.id.substring(0, 6).toUpperCase()}`,
                cune: payslip.cune || undefined,
                periodStartDate: payslip.payrollPeriod.startDate,
                periodEndDate: payslip.payrollPeriod.endDate,
                settlementDate: payslip.payrollPeriod.paidAt || new Date(),
                baseSalary: payslip.employee.baseSalary,
                netPay: payslip.netPay,
            },
            earnings,
            deductions,
            totalEarnings: payslip.totalEarnings,
            totalDeductions: payslip.totalDeductions,
        })

        const safePeriodName = payslip.payrollPeriod.periodName.replace(/[^a-zA-Z0-9-]/g, '_')

        return new NextResponse(new Uint8Array(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Nomina_${payslip.employee.documentNumber}_${safePeriodName}.pdf"`,
            }
        })

    } catch (error) {
        console.error('Error generating payslip pdf:', error)
        return NextResponse.json(
            { error: 'Error al generar el documento pdf de nomina' },
            { status: 500 }
        )
    }
}
