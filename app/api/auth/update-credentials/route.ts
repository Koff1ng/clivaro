import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { withTenantTx } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  username: z.string().min(3, 'El usuario debe tener al menos 3 caracteres'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { tenantId, id: userId } = session.user as any
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'No se encontró el tenantId o userId.' }, { status: 400 })
    }

    const json = await req.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { username, password } = parsed.data
    const hashedPassword = await bcrypt.hash(password, 10)

    let success = false;
    let errorMsg = '';

    await withTenantTx(tenantId, async (tx) => {
      // Validar si el username ya está en uso por otro usuario (excepto él mismo)
      const existingUser = await tx.user.findFirst({
        where: {
          username: { equals: username, mode: 'insensitive' },
          id: { not: userId }
        }
      })

      if (existingUser) {
        errorMsg = 'El nombre de usuario ya está en uso. Por favor, elige otro.'
        throw new Error('USERNAME_TAKEN')
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          username: username,
          password: hashedPassword,
          forcePasswordChange: false,
        },
      })
      success = true;
    }).catch(e => {
        if(e.message !== 'USERNAME_TAKEN') {
            logger.error('[UPDATE-CREDENTIALS] Error:', e)
            errorMsg = 'Error al actualizar credenciales.'
        }
    })
    
    if(!success) {
        return NextResponse.json({ error: errorMsg }, { status: 400 })
    }

    return NextResponse.json({ ok: true, message: 'Credenciales actualizadas exitosamente.' })
  } catch (e: any) {
    logger.error('[UPDATE-CREDENTIALS] Unhandled Exception:', e)
    return NextResponse.json(
      { error: 'Error al procesar la solicitud. Intente nuevamente.' },
      { status: 500 }
    )
  }
}
