import { withTenantRead } from '@/lib/tenancy'

export interface TenantEmailOptions {
  tenantId: string
  to: string
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    content: string | Buffer
    contentType: string
  }>
}

/**
 * Sends an email on behalf of a specific tenant using their verified domain.
 * Requires RESEND_MASTER_API_KEY to be set in .env.
 */
export async function sendTenantEmail(options: TenantEmailOptions) {
  const { tenantId, to, subject, html, attachments } = options
  const RESEND_API_KEY = process.env.RESEND_MASTER_API_KEY

  if (!RESEND_API_KEY) {
    throw new Error('Configuración global de Resend (RESEND_MASTER_API_KEY) no encontrada.')
  }

  // 1. Fetch tenant email configuration
  const config = await withTenantRead(tenantId, async (prisma) => {
    return await prisma.tenantEmailConfig.findUnique({
      where: { tenantId }
    })
  })

  if (!config) {
    throw new Error('El tenant no tiene configurado un dominio de email propio.')
  }

  if (!config.verified) {
    throw new Error(`El dominio ${config.domain} aún no ha sido verificado en Resend.`)
  }

  // 2. Prepare attachments for Resend
  const resendAttachments = attachments?.map(att => ({
    filename: att.filename,
    content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
    contentType: att.contentType
  }))

  // 3. Send via Resend API
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: [to],
      subject: subject,
      html: html,
      attachments: resendAttachments,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Resend API Error (Tenant Email):', data)
    throw new Error(data.message || 'Error al enviar email via Resend')
  }

  return {
    success: true,
    messageId: data.id
  }
}
