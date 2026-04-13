import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getTenantIdFromSession, withTenantRead, withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)

    try {
        const config = await withTenantRead(tenantId, async (prisma) => {
            return await (prisma as any).electronicInvoiceProviderConfig.findUnique({
                where: {
                    tenantId_provider: {
                        tenantId,
                        provider: 'ALEGRA'
                    }
                }
            })
        })

        if (!config) return NextResponse.json({ config: null })

        // No devolvemos el token cifrado al frontend por seguridad
        const { alegraTokenEncrypted, ...safeConfig } = config
        return NextResponse.json({ config: safeConfig })
    } catch (error: any) {
        logger.error('[Alegra Config GET ERROR]:', error)
        return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const body = await request.json()

    try {
        const { email, token, status } = body

        const updateData: any = {
            alegraEmail: email,
            status,
            lastCheckedAt: new Date(),
        }

        // Solo actualizamos el token si se proporciona uno nuevo
        if (token && token.trim() !== '') {
            updateData.alegraTokenEncrypted = `enc_${token}`
        }

        await withTenantTx(tenantId, async (prisma) => {
            await (prisma as any).electronicInvoiceProviderConfig.upsert({
                where: {
                    tenantId_provider: {
                        tenantId,
                        provider: 'ALEGRA'
                    }
                },
                update: updateData,
                create: {
                    tenantId,
                    provider: 'ALEGRA',
                    alegraEmail: email,
                    alegraTokenEncrypted: token ? `enc_${token}` : '',
                    status,
                    lastCheckedAt: new Date(),
                }
            })

            // Sincronizar con TenantSettings
            await prisma.tenantSettings.upsert({
                where: { tenantId },
                update: { electronicBillingProvider: 'ALEGRA' },
                create: {
                    tenantId,
                    electronicBillingProvider: 'ALEGRA'
                }
            })
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        logger.error('Error saving Alegra config', error)
        return NextResponse.json({ error: safeErrorMessage(error, 'Error al guardar la configuración') }, { status: 500 })
    }
}
