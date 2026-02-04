
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession } from '@/lib/tenancy'
import {
    getAccountingConfig,
    updateAccountingConfig,
    validateConfig
} from '@/lib/accounting/config-service'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    const config = await getAccountingConfig(tenantId)
    const validation = await validateConfig(tenantId)

    return NextResponse.json({
        config,
        validation
    })
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_ACCOUNTING)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const body = await request.json()

    try {
        const config = await updateAccountingConfig(tenantId, body)
        const validation = await validateConfig(tenantId)

        return NextResponse.json({
            config,
            validation,
            message: 'Configuración actualizada correctamente'
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 400 }
        )
    }
}
