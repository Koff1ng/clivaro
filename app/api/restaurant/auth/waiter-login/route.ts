import { NextResponse } from 'next/server'
import { getTenantIdFromSession, withTenantTx } from '@/lib/tenancy'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { ensureRestaurantMode, verifyPin, generateWaiterToken } from '@/lib/restaurant'

export const dynamic = 'force-dynamic'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

/**
 * POST: Autentica a un mesero por su código y PIN.
 * Includes rate-limiting: locks account after 5 failed attempts for 15 minutes.
 */
export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
    if (session instanceof NextResponse) return session

    const tenantId = getTenantIdFromSession(session)
    const { code, pin } = await request.json()

    if (!code || !pin) {
        return NextResponse.json({ error: 'Código y PIN son obligatorios' }, { status: 400 })
    }

    if (typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        return NextResponse.json({ error: 'El PIN debe ser exactamente 4 dígitos numéricos' }, { status: 400 })
    }

    // Validar que el modo restaurante esté activo
    const errorResponse = await ensureRestaurantMode(tenantId)
    if (errorResponse) return errorResponse

    try {
        const result = await withTenantTx(tenantId, async (tx) => {
            const waiter = await (tx as any).waiterProfile.findUnique({
                where: {
                    tenantId_code: { tenantId, code }
                }
            })

            if (!waiter || !waiter.active) {
                return { error: 'Mesero no encontrado o inactivo', code: 'WAITER_NOT_FOUND', status: 401 }
            }

            // Rate-limiting: check if account is locked
            if (waiter.lockedUntil && new Date(waiter.lockedUntil) > new Date()) {
                const remainingMs = new Date(waiter.lockedUntil).getTime() - Date.now()
                const remainingMin = Math.ceil(remainingMs / 60000)
                return {
                    error: `Cuenta bloqueada por seguridad. Intente en ${remainingMin} minuto(s).`,
                    code: 'ACCOUNT_LOCKED',
                    status: 429
                }
            }

            if (!verifyPin(pin, waiter.pin)) {
                // Increment failed attempts
                const newAttempts = (waiter.failedAttempts || 0) + 1
                const updateData: any = { failedAttempts: newAttempts }

                // Lock after MAX_FAILED_ATTEMPTS
                if (newAttempts >= MAX_FAILED_ATTEMPTS) {
                    updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS)
                    logger.warn(`Waiter ${waiter.code} locked after ${newAttempts} failed PIN attempts`, { tenantId })
                }

                await (tx as any).waiterProfile.update({
                    where: { id: waiter.id },
                    data: updateData
                })

                const remaining = MAX_FAILED_ATTEMPTS - newAttempts
                return {
                    error: remaining > 0
                        ? `PIN incorrecto. ${remaining} intento(s) restante(s).`
                        : 'PIN incorrecto. Cuenta bloqueada por 15 minutos.',
                    code: 'INVALID_PIN',
                    status: 401
                }
            }

            // Login successful — reset failed attempts
            await (tx as any).waiterProfile.update({
                where: { id: waiter.id },
                data: {
                    lastLogin: new Date(),
                    failedAttempts: 0,
                    lockedUntil: null
                }
            })

            const token = generateWaiterToken({
                id: waiter.id,
                name: waiter.name,
                code: waiter.code,
                tenantId: waiter.tenantId
            })

            const { pin: _, failedAttempts: __, lockedUntil: ___, ...waiterWithoutSensitive } = waiter as any
            return { success: true, waiter: waiterWithoutSensitive, token }
        })

        if ('error' in result) {
            return NextResponse.json(
                { error: result.error, code: result.code },
                { status: result.status }
            )
        }

        return NextResponse.json(result)
    } catch (error: any) {
        logger.error('Error in api/restaurant/auth/waiter-login POST', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
