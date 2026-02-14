
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
    // ... Minimal implementation for manual creation if needed later.
    // For now, focus on initializing.

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
        }
    })

    return NextResponse.json(result)
}
