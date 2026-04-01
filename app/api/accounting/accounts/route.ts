import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'
import { getAccountTree, initializePUC } from '@/lib/accounting/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = (session.user as any).tenantId

    try {
        const result = await withTenantRead(tenantId, async (prisma) => {
            return await getAccountTree(tenantId)
        })
        return NextResponse.json(result)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = (session.user as any).tenantId
    const body = await request.json()

    try {
        const result = await withTenantTx(tenantId, async (prisma) => {
            // Action: Initialize
            if (body.action === 'initialize') {
                return await initializePUC(tenantId)
            }

            // Action: Create Single
            if (body.action === 'create_single') {
                const { code, name, type, nature, requiresThirdParty, requiresCostCenter, level } = body.data

                // Verificar si la cuenta ya existe
                const existing = await prisma.accountingAccount.findFirst({
                    where: { code }
                })

                if (existing) {
                    throw new Error('Ya existe una cuenta con este código')
                }

                // Buscar el padre
                let parentId: string | null = null
                let parentCodeToFind: string | null = null

                if (code.length > 1) {
                    if (code.length === 2) parentCodeToFind = code.substring(0, 1)
                    else if (code.length === 4) parentCodeToFind = code.substring(0, 2)
                    else if (code.length === 6) parentCodeToFind = code.substring(0, 4)
                    else if (code.length > 6) parentCodeToFind = code.substring(0, 6)

                    if (parentCodeToFind) {
                        const parent = await prisma.accountingAccount.findFirst({
                            where: { code: parentCodeToFind }
                        })
                        if (parent) {
                            parentId = parent.id
                        }
                    }
                }

                return await prisma.accountingAccount.create({
                    data: {
                        tenantId,
                        code,
                        name,
                        type,
                        nature: nature || 'DEBIT',
                        level: level || (code.length === 1 ? 1 : code.length === 2 ? 2 : code.length === 4 ? 3 : 4),
                        requiresThirdParty: requiresThirdParty || false,
                        requiresCostCenter: requiresCostCenter || false,
                        parentId
                    }
                })
            }

            throw new Error('Invalid action')
        })

        return NextResponse.json(result)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}

export async function PATCH(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = (session.user as any).tenantId
    const body = await request.json()
    const { id, ...data } = body

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    try {
        const result = await withTenantTx(tenantId, async (prisma) => {
            return await prisma.accountingAccount.update({
                where: { id },
                data: {
                    name: data.name,
                    nature: data.nature,
                    requiresThirdParty: data.requiresThirdParty,
                    requiresCostCenter: data.requiresCostCenter,
                    exogenousFormat: data.exogenousFormat,
                    exogenousConcept: data.exogenousConcept,
                    active: data.active
                } as any
            })
        })

        return NextResponse.json(result)
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
