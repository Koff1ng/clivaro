import { NextResponse } from 'next/server'
import { getTenantIdFromSession, withTenantTx } from '@/lib/tenancy'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { ensureRestaurantMode, verifyPin, generateWaiterToken } from '@/lib/restaurant'

/**
 * POST: Autentica a un mesero por su código y PIN.
 */
export async function POST(request: Request) {
    // Nota: El login de mesero requiere una sesión activa de usuario de sistema (Tenant context)
    // El POS ya tiene sesión, esto es un "segundo nivel" de auth rápido.
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { code, pin } = await request.json()

    if (!code || !pin) {
        return NextResponse.json({ error: 'Código y PIN son obligatorios' }, { status: 400 })
    }

    // Validar que el modo restaurante esté activo
    const errorResponse = await ensureRestaurantMode(tenantId)
    if (errorResponse) return errorResponse

    try {
        const result = await withTenantTx(tenantId, async (tx) => {
            const waiter = await tx.waiterProfile.findUnique({
                where: {
                    tenantId_code: { tenantId, code }
                }
            })

            if (!waiter || !waiter.active) {
                return { error: 'Mesero no encontrado o inactivo', status: 401 }
            }

            if (!verifyPin(pin, waiter.pin)) {
                return { error: 'PIN incorrecto', status: 401 }
            }

            // Actualizar último login
            await tx.waiterProfile.update({
                where: { id: waiter.id },
                data: { lastLogin: new Date() }
            })

            const token = generateWaiterToken({
                id: waiter.id,
                name: waiter.name,
                code: waiter.code,
                tenantId: waiter.tenantId
            })

            const { pin: _, ...waiterWithoutPin } = waiter as any
            return { success: true, waiter: waiterWithoutPin, token }
        })

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.status })
        }

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('Error in api/restaurant/auth/waiter-login POST', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
