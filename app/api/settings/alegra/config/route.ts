import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
    if (session instanceof NextResponse) return session

    const user = session.user as any

    // La configuración de Alegra es específica de cada empresa (tenant)
    if (!user?.tenantId) {
        if (user.isSuperAdmin) {
            return NextResponse.json({
                config: null,
                message: 'Los Super Admins deben estar en el contexto de una empresa para configurar Alegra.'
            })
        }
        return NextResponse.json({ error: 'No se encontró un ID de empresa en la sesión.' }, { status: 401 })
    }

    try {
        const config = await (prisma as any).electronicInvoiceProviderConfig.findUnique({
            where: {
                tenantId_provider: {
                    tenantId: user.tenantId,
                    provider: 'ALEGRA'
                }
            }
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

    const user = session.user as any

    if (!user?.tenantId) {
        return NextResponse.json({ error: 'No autorizado - Se requiere una empresa asociada' }, { status: 401 })
    }

    try {
        const { email, token, status } = await request.json()

        const updateData: any = {
            alegraEmail: email,
            status,
            lastCheckedAt: new Date(),
        }

        // Solo actualizamos el token si se proporciona uno nuevo
        if (token && token.trim() !== '') {
            updateData.alegraTokenEncrypted = `enc_${token}`
        }

        const config = await (prisma as any).electronicInvoiceProviderConfig.upsert({
            where: {
                tenantId_provider: {
                    tenantId: user.tenantId,
                    provider: 'ALEGRA'
                }
            },
            update: updateData,
            create: {
                tenantId: user.tenantId,
                provider: 'ALEGRA',
                alegraEmail: email,
                alegraTokenEncrypted: token ? `enc_${token}` : '',
                status,
                lastCheckedAt: new Date(),
            }
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        logger.error('Error saving Alegra config', error)
        return NextResponse.json({ error: error.message || 'Error al guardar la configuración' }, { status: 500 })
    }
}
