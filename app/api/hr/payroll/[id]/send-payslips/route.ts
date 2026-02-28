import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { generatePayslipPDF } from '@/lib/pdf'
import { sendEmail } from '@/lib/email'

export async function POST(
    request: Request,
    { params }: { params: { id: string } | Promise<{ id: string }> }
) {
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
        const payroll = await prisma.payrollPeriod.findFirst({
            where: { id: resolvedParams.id, tenantId },
            include: {
                payslips: {
                    include: {
                        employee: true,
                        items: true,
                    }
                }
            },
        })

        if (!payroll) {
            return NextResponse.json(
                { error: 'Nómina no encontrada' },
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

        let successCount = 0
        let failureCount = 0

        // Bucle asicrónico para enviar correos y generar PDFs por colilla
        for (const payslip of payroll.payslips) {
            // Filtrar si el empleado no tiene correo
            if (!payslip.employee.email) {
                failureCount++
                continue
            }

            try {
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
                    company: { name: companyName, nit: companyNit },
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
                        periodStartDate: payroll.startDate,
                        periodEndDate: payroll.endDate,
                        settlementDate: payroll.paidAt || new Date(),
                        baseSalary: payslip.employee.baseSalary,
                        netPay: payslip.netPay,
                    },
                    earnings,
                    deductions,
                    totalEarnings: payslip.totalEarnings,
                    totalDeductions: payslip.totalDeductions,
                })

                const safePeriodName = payroll.periodName.replace(/[^a-zA-Z0-9-]/g, '_')
                const fileName = `Nomina_${payslip.employee.documentNumber}_${safePeriodName}.pdf`

                const htmlEmail = `
          <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <h2 style="color: #1e3a8a;">Documento Soporte de Pago de Nómina Electrónica</h2>
            <p>Estimado/a <strong>${payslip.employee.firstName}</strong>,</p>
            <p>Adjunto a este correo encontrará su documento soporte de pago de nómina correspondiente al periodo <strong>${payroll.periodName}</strong>.</p>
            <br/>
            <p>Atentamente,</p>
            <p><strong>${companyName}</strong></p>
          </div>
        `

                const emailResult = await sendEmail({
                    to: payslip.employee.email,
                    subject: `Comprobante de Nómina - ${payroll.periodName} - ${companyName}`,
                    html: htmlEmail,
                    attachments: [
                        {
                            filename: fileName,
                            content: pdfBuffer,
                            contentType: 'application/pdf',
                        }
                    ]
                })

                if (emailResult.success) {
                    successCount++
                } else {
                    console.error(`Error enviando email a ${payslip.employee.email}:`, emailResult.message)
                    failureCount++
                }

            } catch (err) {
                console.error(`Error generando/enviando payslip para empleado ${payslip.employee.id}:`, err)
                failureCount++
            }
        }

        return NextResponse.json({
            success: true,
            message: `Enviados ${successCount} correos. ${failureCount > 0 ? `Fallaron ${failureCount} correos (empleados sin cuenta vinculada o error temporal).` : ''}`,
            sent: successCount,
            failed: failureCount
        })

    } catch (error) {
        console.error('Error sending mass payslip pdfs:', error)
        return NextResponse.json(
            { error: 'Error general al procesar correos masivos' },
            { status: 500 }
        )
    }
}
