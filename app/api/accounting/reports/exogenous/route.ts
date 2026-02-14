
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31, 23, 59, 59)

    try {
        // Fetch all lines that belong to accounts with exogenous mapping
        const lines = await prisma.journalEntryLine.findMany({
            where: {
                journalEntry: {
                    tenantId,
                    date: { gte: start, lte: end },
                    status: 'APPROVED'
                },
                account: {
                    exogenousFormat: { not: null }
                }
            } as any,
            include: {
                account: {
                    select: {
                        code: true,
                        name: true,
                        exogenousFormat: true,
                        exogenousConcept: true
                    } as any
                },
                accountingThirdParty: {
                    select: {
                        name: true,
                        documentNumber: true,
                        documentType: true
                    }
                },
                customer: {
                    select: {
                        name: true,
                        taxId: true,
                        idType: true
                    }
                },
                supplier: {
                    select: {
                        name: true,
                        taxId: true
                    }
                }
            }
        })

        // Aggregate by Format -> Concept -> Third Party
        const aggregation: Record<string, any> = {}

            ; (lines as any[]).forEach(line => {
                const format = line.account.exogenousFormat || 'SIN_FORMATO'
                const concept = line.account.exogenousConcept || 'SIN_CONCEPTO'

                // Determine Third Party ID and Name
                let tpId = line.thirdPartyNit || line.thirdPartyId || 'SIN_TERCERO'
                let tpName = line.thirdPartyName || 'TERCERO NO IDENTIFICADO'
                let tpType = 'NIT'

                if (line.accountingThirdParty) {
                    tpId = line.accountingThirdParty.documentNumber
                    tpName = line.accountingThirdParty.name
                    tpType = line.accountingThirdParty.documentType
                } else if (line.customer) {
                    tpId = line.customer.taxId || tpId
                    tpName = line.customer.name
                    tpType = line.customer.idType || 'CC'
                } else if (line.supplier) {
                    tpId = line.supplier.taxId || tpId
                    tpName = line.supplier.name
                    tpType = 'NIT'
                }

                const key = `${format}-${concept}-${tpId}`

                if (!aggregation[key]) {
                    aggregation[key] = {
                        format,
                        concept,
                        idType: tpType,
                        idNumber: tpId,
                        name: tpName,
                        amount: 0,
                        debit: 0,
                        credit: 0
                    }
                }

                aggregation[key].debit += line.debit
                aggregation[key].credit += line.credit
                // Normal behavior for Exogenous: Net balance of movements
                // But it depends on the account nature. For simplicity, we provide both and a sum.
                aggregation[key].amount += (line.debit - line.credit)
            })

        return NextResponse.json(Object.values(aggregation))
    } catch (e: any) {
        console.error(e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
