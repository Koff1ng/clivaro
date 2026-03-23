import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  buildPasswordResetUrl,
  findTenantUserForPasswordReset,
  generateResetToken,
  getPasswordResetEmailConfigured,
  hashResetToken,
} from '@/lib/password-reset'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  tenantSlug: z.string().min(1, 'Empresa requerida'),
  identifier: z.string().min(1, 'Ingrese usuario o correo'),
})

const GENERIC_OK =
  'Si los datos son correctos y su cuenta tiene un correo registrado, recibirá un enlace para restablecer la contraseña.'

export async function POST(req: Request) {
  try {
    if (!getPasswordResetEmailConfigured()) {
      return NextResponse.json(
        {
          error:
            'El envío de correo no está configurado. En Vercel agregue SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD y SMTP_FROM (o RESEND_API_KEY).',
        },
        { status: 503 }
      )
    }

    const json = await req.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { tenantSlug, identifier } = parsed.data

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, active: true, name: true, slug: true },
    })

    if (!tenant?.active) {
      // Misma respuesta que éxito (no filtrar existencia de tenant)
      return NextResponse.json({ ok: true, message: GENERIC_OK })
    }

    const user = await findTenantUserForPasswordReset(tenant.id, identifier)

    if (!user || !user.email?.trim()) {
      return NextResponse.json({ ok: true, message: GENERIC_OK })
    }

    const rawToken = generateResetToken()
    const tokenHash = hashResetToken(rawToken)

    await prisma.passwordResetToken.deleteMany({
      where: { tenantId: tenant.id, userId: user.id },
    })

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        tenantId: tenant.id,
        userId: user.id,
        expiresAt,
      },
    })

    const resetUrl = buildPasswordResetUrl(tenant.slug, rawToken)
    const tenantLabel = tenant.name || tenant.slug

    // Prioriza SMTP (variables Vercel) para el token de recuperación
    const emailResult = await sendEmail(
      {
      to: user.email.trim(),
      subject: `Restablecer contraseña — ${tenantLabel}`,
      html: `
        <p>Hola ${escapeHtml(user.name)},</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${escapeHtml(tenantLabel)}</strong>.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Restablecer contraseña</a></p>
        <p>O copia este enlace en tu navegador:</p>
        <p style="word-break:break-all;font-size:12px;color:#444;">${escapeHtml(resetUrl)}</p>
        <p>Este enlace caduca en <strong>1 hora</strong>. Si no solicitaste el cambio, ignora este mensaje.</p>
      `,
      },
      { preferSmtp: true }
    )

    if (!emailResult.success) {
      console.error('[forgot-password] sendEmail failed:', emailResult.error)
      return NextResponse.json(
        {
          error:
            'No se pudo enviar el correo en este momento. Intente más tarde o contacte al administrador.',
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, message: GENERIC_OK })
  } catch (e: any) {
    console.error('[forgot-password]', e)
    return NextResponse.json(
      { error: 'Error al procesar la solicitud. Intente nuevamente.' },
      { status: 500 }
    )
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
