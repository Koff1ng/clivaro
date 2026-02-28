
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { prisma } from '@/lib/db'
import { getAccountTree, initializePUC } from '@/lib/accounting/service'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const accounts = await getAccountTree(tenantId)

    return NextResponse.json(accounts)
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const body = await request.json()

    // Action: Initialize
    if (body.action === 'initialize') {
        const result = await initializePUC(tenantId)
        return NextResponse.json(result)
    }

    // Action: Create Single
    if (body.action === 'create_single') {
        const { code, name, type, nature, requiresThirdParty, requiresCostCenter, level } = body.data

        // Verificar si la cuenta ya existe
        const existing = await prisma.accountingAccount.findFirst({
            where: { tenantId, code }
        })

        if (existing) {
            return NextResponse.json({ error: 'Ya existe una cuenta con este código' }, { status: 400 })
        }

        // Buscar el padre, normalmente si level > 1, es el código menos su último dígito (o par de dígitos dependiendo del nivel)
        let parentId = null
        let parentCode = ''

        if (code.length > 1) {
            if (code.length === 2) parentCode = code.substring(0, 1)
            else if (code.length === 4) parentCode = code.substring(0, 2)
            else if (code.length === 6) parentCode = code.substring(0, 4)
            else if (code.length > 6) parentCode = code.substring(0, 6)

            if (parentCode) {
                const parent = await prisma.accountingAccount.findFirst({
                    where: { tenantId, code: parentCode }
                })
                if (parent) {
                    parentId = parent.id
                }
            }
        }

        const newAccount = await prisma.accountingAccount.create({
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

        return NextResponse.json(newAccount)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function PATCH(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const body = await request.json()
    const { id, ...data } = body

    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 })

    const result = await prisma.accountingAccount.update({
        where: { id, tenantId },
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

    return NextResponse.json(result)
}
