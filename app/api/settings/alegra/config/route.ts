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

        // En un entorno de producción real, aquí usaríamos una función de cifrado (ej. AES-256)
        // Para este P0, lo guardaremos con un prefijo "enc_" simulando el cifrado
        const alegraTokenEncrypted = `enc_${token}`

        const config = await (prisma as any).electronicInvoiceProviderConfig.upsert({
            where: {
                tenantId_provider: {
                    tenantId: user.tenantId,
                    provider: 'ALEGRA'
                }
            },
            update: {
                alegraEmail: email,
                alegraTokenEncrypted,
                status,
                lastCheckedAt: new Date(),
            },
            create: {
                tenantId: user.tenantId,
                provider: 'ALEGRA',
                alegraEmail: email,
                alegraTokenEncrypted,
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
