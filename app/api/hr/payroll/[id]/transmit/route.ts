import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession, withTenantTx, withTenantRead } from '@/lib/tenancy'
import { isYabiConfigured } from '@/lib/yabi/client'
import { transmitPayslip, type EmployerInfo, type PayslipWithEmployee, type TransmitResult } from '@/lib/yabi/payroll-service'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

/**
 * POST /api/hr/payroll/[id]/transmit
 * 
 * Transmite todos los payslips de un período de nómina a la DIAN vía YABI.
 * Requisitos:
 * - El período debe estar en estado APPROVED o PAID
 * - YABI debe estar configurado (env vars)
 * - Los payslips que ya fueron aceptados (ACCEPTED) se omiten
 */
export async function POST(
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

    // Verificar que YABI está configurado
    if (!isYabiConfigured()) {
      return NextResponse.json(
        {
          error: 'YABI no está configurado',
          details: 'Configura las variables YABI_API_URL y YABI_API_TOKEN para habilitar la nómina electrónica.',
        },
        { status: 503 }
      )
    }

    // Obtener el período con payslips y empleados
    const period = await withTenantRead(tenantId, async (db) => {
      return db.payrollPeriod.findFirst({
        where: { id: params.id, tenantId },
        include: {
          payslips: {
            include: {
              employee: true,
              items: true,
            },
          },
        },
      })
    })

    if (!period) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
    }

    if (period.status === 'DRAFT') {
      return NextResponse.json(
        { error: 'No se puede transmitir una nómina en estado Borrador. Apruébala primero.' },
        { status: 400 }
      )
    }

    // Obtener datos del empleador desde TenantSettings
    const settings = await withTenantRead(tenantId, async (db) => {
      return db.tenantSettings.findUnique({ where: { tenantId } })
    })

    const employer: EmployerInfo = {
      nit: settings?.companyNit || '',
      dv: '', // Se puede calcular o agregar al TenantSettings
      companyName: settings?.companyName || 'Empresa',
      address: settings?.companyAddress || undefined,
    }

    if (!employer.nit) {
      return NextResponse.json(
        { error: 'El NIT de la empresa no está configurado. Ve a Configuración > Empresa.' },
        { status: 400 }
      )
    }

    // Filtrar payslips que necesitan transmisión
    const payslipsToTransmit = period.payslips.filter(
      (p: any) => p.statusDIAN !== 'ACCEPTED'
    )

    if (payslipsToTransmit.length === 0) {
      return NextResponse.json({
        message: 'Todos los payslips ya fueron aceptados por la DIAN.',
        transmitted: 0,
        total: period.payslips.length,
      })
    }

    // Transmitir cada payslip
    const results: TransmitResult[] = []
    for (const payslip of payslipsToTransmit) {
      const result = await transmitPayslip(
        payslip as unknown as PayslipWithEmployee,
        employer,
        period.startDate,
        period.endDate,
      )

      // Actualizar el payslip en BD con el resultado
      await withTenantTx(tenantId, async (tx) => {
        await tx.payslip.update({
          where: { id: payslip.id },
          data: {
            cune: result.cune || payslip.cune,
            statusDIAN: result.statusDIAN,
            dianResponse: result.error ? { error: result.error } : undefined,
            signedAt: result.success ? new Date() : undefined,
          },
        })
      })

      results.push(result)
    }

    // Actualizar el período
    const allSuccess = results.every(r => r.success)
    const anySuccess = results.some(r => r.success)

    if (anySuccess) {
      await withTenantTx(tenantId, async (tx) => {
        await tx.payrollPeriod.update({
          where: { id: period.id },
          data: {
            transmittedAt: new Date(),
          },
        })
      })
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    logger.info(`[Nómina Electrónica] Período ${period.periodName}: ${successCount} exitosos, ${failCount} fallidos`)

    return NextResponse.json({
      message: allSuccess
        ? `Todos los ${successCount} payslips fueron transmitidos exitosamente.`
        : `${successCount} transmitidos, ${failCount} con errores.`,
      transmitted: successCount,
      failed: failCount,
      total: payslipsToTransmit.length,
      results,
    })
  } catch (error: any) {
    logger.error('Error transmitiendo nómina:', error)
    return NextResponse.json(
      { error: 'Error al transmitir nómina electrónica', details: safeErrorMessage(error) },
      { status: 500 }
    )
  }
}
