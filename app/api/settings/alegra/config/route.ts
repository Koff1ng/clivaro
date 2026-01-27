import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.tenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
