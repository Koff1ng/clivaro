import { prisma } from '@/lib/db'
import { createJournalEntry } from './journal-service'

export async function createJournalEntryFromPayroll(periodId: string, tenantId: string, userId: string) {
    const period = await prisma.payrollPeriod.findUnique({
        where: { id: periodId },
        include: {
            journalEntry: true,
        }
    })

    if (!period) throw new Error('Período de nómina no encontrado')
    if (period.tenantId !== tenantId) throw new Error('No autorizado')

    // Avoid duplicate creation
    if (period.journalEntryId) return period.journalEntryId

    // 1. Encontrar las cuentas contables correspondientes
    // Sueldos (Gasto): 510506 o prefijo 5105
    let sueldosAccount = await prisma.accountingAccount.findFirst({ where: { tenantId, code: '510506' } })
    if (!sueldosAccount) sueldosAccount = await prisma.accountingAccount.findFirst({ where: { tenantId, code: { startsWith: '5105' } } })

    // Bancos (Activo): 111005 o prefijo 1110
    let bancosAccount = await prisma.accountingAccount.findFirst({ where: { tenantId, code: '111005' } })
    if (!bancosAccount) bancosAccount = await prisma.accountingAccount.findFirst({ where: { tenantId, code: { startsWith: '1110' } } })

    // Pasivos por retenciones / pagos de nómina: 2370 o prefijo 23
    let pasivoAccount = await prisma.accountingAccount.findFirst({ where: { tenantId, code: { startsWith: '2370' } } })
    if (!pasivoAccount) pasivoAccount = await prisma.accountingAccount.findFirst({ where: { tenantId, code: { startsWith: '23' } } })

    // Fallbacks genéricos si el PUC no está cargado completo
    if (!sueldosAccount) throw new Error('No existe cuenta de gastos para sueldos (código 5105)')
    if (!bancosAccount) throw new Error('No existe cuenta de bancos configurada (código 1110)')

    const lines = []

    // Gasto por salarios (Débito)
    if (period.totalEarnings > 0) {
        lines.push({
            accountId: sueldosAccount.id,
            description: `Gasto Nómina ${period.periodName}`,
            debit: period.totalEarnings,
            credit: 0
        })
    }

    // Deducciones / Pasivos (Crédito)
    if (period.totalDeductions > 0 && pasivoAccount) {
        lines.push({
            accountId: pasivoAccount.id,
            description: `Retenciones Nómina ${period.periodName}`,
            debit: 0,
            credit: period.totalDeductions
        })
    }

    // Salida Efectiva / Bancos (Crédito)
    if (period.netPay > 0) {
        lines.push({
            accountId: bancosAccount.id,
            description: `Pago Neto Nómina ${period.periodName}`,
            debit: 0,
            credit: period.netPay
        })
    }

    const entry = await createJournalEntry(tenantId, userId, {
        date: new Date(),
        type: 'COMPROBANTE_EGRESO', // O un tipo específico si existe 'NOMINA'
        description: `Pago Nómina: ${period.periodName}`,
        reference: `NOM-${period.periodName}`,
        status: 'APPROVED',
        lines: lines
    })

    // Ligar el JournalEntry a la Nómina
    await prisma.payrollPeriod.update({
        where: { id: period.id },
        data: { journalEntryId: entry.id }
    })

    return entry.id
}
