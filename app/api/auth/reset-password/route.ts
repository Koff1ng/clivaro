import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { hashResetToken } from '@/lib/password-reset'
import { withTenantTx } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  token: z.string().min(20, 'Token inválido'),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { token, newPassword } = parsed.data
    const tokenHash = hashResetToken(token)

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    })

    if (!record || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'El enlace no es válido o ha expirado. Solicite uno nuevo desde "Olvidé mi contraseña".' },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: record.tenantId },
      select: { id: true, active: true },
    })

    if (!tenant?.active) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {})
      return NextResponse.json({ error: 'Empresa no disponible.' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(newPassword, 10)

    await withTenantTx(tenant.id, async (tx) => {
      const u = await tx.user.findUnique({ where: { id: record.userId } })
      if (!u || !u.active) {
        throw new Error('USER_GONE')
      }
      await tx.user.update({
        where: { id: record.userId },
        data: { password: hashed },
      })

      // Sync super-admin password visibility if it's the main 'admin' user
      if (u.username === 'admin') {
        await prisma.tenant.update({
          where: { id: record.tenantId },
          data: { adminPassword: newPassword },
        })
      }
    })

    await prisma.passwordResetToken.deleteMany({
      where: { OR: [{ id: record.id }, { tenantId: record.tenantId, userId: record.userId }] },
    })

    return NextResponse.json({ ok: true, message: 'Contraseña actualizada. Ya puede iniciar sesión.' })
  } catch (e: any) {
    if (e?.message === 'USER_GONE') {
      return NextResponse.json(
        { error: 'La cuenta no existe o está inactiva. Contacte al administrador.' },
        { status: 400 }
      )
    }
    console.error('[reset-password]', e)
    return NextResponse.json(
      { error: 'No se pudo restablecer la contraseña. Intente nuevamente.' },
      { status: 500 }
    )
  }
}
