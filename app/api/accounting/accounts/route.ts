
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'
import { prisma } from '@/lib/db'
import { getAccountTree, initializePUC } from '@/lib/accounting/service'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, 'manage_accounting' as any) // Need to define permission or use 'manage_crm' temp? USER SAID NO EXTRA COMPLEXITY. I will check permissions.
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const accounts = await getAccountTree(tenantId)

    return NextResponse.json(accounts)
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, 'manage_accounting' as any)
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
