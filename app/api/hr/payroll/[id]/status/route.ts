import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession, withTenantTx, withTenantRead } from '@/lib/tenancy'
import { isYabiConfigured } from '@/lib/yabi/client'
import { checkDocumentStatus } from '@/lib/yabi/payroll-service'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

/**
 * GET /api/hr/payroll/[id]/status
 * 
 * Consulta y actualiza el estado de transmisión DIAN de todos los
 * payslips de un período de nómina. Llama a YABI para cada payslip
 * que tenga un CUNE asignado y no esté en estado terminal (ACCEPTED/REJECTED).
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(req, PERMISSIONS.MANAGE_USERS)
    if (session instanceof NextResponse) { return session }
    const tenantId = await getTenantIdFromSession(session)

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 400 })
    }

    // Obtener el período con payslips
    const period = await withTenantRead(tenantId, async (db) => {
      return db.payrollPeriod.findFirst({
        where: { id: params.id, tenantId },
        include: {
          payslips: {
            include: { employee: true },
          },
        },
      })
    })

    if (!period) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
    }

    // Si YABI no está configurado, retornar estado actual sin consultar
    if (!isYabiConfigured()) {
      const statusSummary = buildStatusSummary(period.payslips as any[])
      return NextResponse.json({
        ...statusSummary,
        yabiConfigured: false,
        message: 'YABI no configurado. Mostrando estado local.',
      })
    }

    // Consultar estado para payslips que tienen CUNE y no están en estado terminal
    const updatedPayslips: Array<{
      id: string
      employeeName: string
      cune: string | null
      previousStatus: string
      currentStatus: string
      changed: boolean
      error?: string
    }> = []
    for (const payslip of period.payslips as any[]) {
      if (payslip.cune && !['ACCEPTED', 'REJECTED'].includes(payslip.statusDIAN)) {
        const status = await checkDocumentStatus(payslip.cune)

        // Actualizar en BD si el estado cambió
        if (status.statusDIAN !== payslip.statusDIAN) {
          await withTenantTx(tenantId, async (tx) => {
            await tx.payslip.update({
              where: { id: payslip.id },
              data: {
                statusDIAN: status.statusDIAN,
                dianResponse: status.documentStatus
                  ? { code: status.documentStatus.code, description: status.documentStatus.description }
                  : undefined,
              },
            })
          })
        }

        updatedPayslips.push({
          id: payslip.id,
          employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
          cune: payslip.cune,
          previousStatus: payslip.statusDIAN,
          currentStatus: status.statusDIAN,
          changed: status.statusDIAN !== payslip.statusDIAN,
          error: status.error,
        })
      } else {
        updatedPayslips.push({
          id: payslip.id,
          employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
          cune: payslip.cune,
          previousStatus: payslip.statusDIAN,
          currentStatus: payslip.statusDIAN,
          changed: false,
        })
      }
    }

    const statusSummary = {
      pending: updatedPayslips.filter(p => p.currentStatus === 'PENDING').length,
      sent: updatedPayslips.filter(p => p.currentStatus === 'SENT').length,
      accepted: updatedPayslips.filter(p => p.currentStatus === 'ACCEPTED').length,
      rejected: updatedPayslips.filter(p => p.currentStatus === 'REJECTED').length,
      total: updatedPayslips.length,
    }

    return NextResponse.json({
      periodId: period.id,
      periodName: period.periodName,
      yabiConfigured: true,
      ...statusSummary,
      payslips: updatedPayslips,
    })
  } catch (error: any) {
    logger.error('Error consultando estado DIAN:', error)
    return NextResponse.json(
      { error: 'Error al consultar estado DIAN', details: safeErrorMessage(error) },
      { status: 500 }
    )
  }
}

function buildStatusSummary(payslips: any[]) {
  return {
    pending: payslips.filter((p: any) => p.statusDIAN === 'PENDING').length,
    sent: payslips.filter((p: any) => p.statusDIAN === 'SENT').length,
    accepted: payslips.filter((p: any) => p.statusDIAN === 'ACCEPTED').length,
    rejected: payslips.filter((p: any) => p.statusDIAN === 'REJECTED').length,
    total: payslips.length,
    payslips: payslips.map((p: any) => ({
      id: p.id,
      employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
      cune: p.cune,
      currentStatus: p.statusDIAN,
    })),
  }
}
