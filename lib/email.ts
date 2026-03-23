import nodemailer from 'nodemailer'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

export interface EmailOptions {
  to: string
  subject: string
  html: string
  attachments?: Array<{
    filename?: string
    content: string | Buffer
    contentType?: string
    cid?: string // Content-ID for embedded images
    path?: string // File path (alternative to content)
  }>
}

export type SendEmailResult = {
  success: boolean
  message: string
  error?: string
  messageId?: string
  accepted?: string[]
  rejected?: string[]
}

/** Variables SMTP típicas en Vercel: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD (+ SMTP_FROM remitente). */
export function isSmtpConfigured(): boolean {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env
  return !!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD)
}

let transporter: nodemailer.Transporter | null = null

export function getEmailTransporter(): nodemailer.Transporter | null {
  if (transporter) {
    return transporter
  }

  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASSWORD

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    console.warn('SMTP configuration not found. Email sending will be disabled.')
    return null
  }

  try {
    const port = parseInt(smtpPort, 10)
    const secure = port === 465

    console.log('Creating email transporter:', {
      host: smtpHost,
      port: port,
      secure: secure,
      user: smtpUser,
      hasPassword: !!smtpPass,
    })

    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: port,
      secure: secure, // true for 465 (SSL), false for other ports (TLS)
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      requireTLS: !secure && port !== 25,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
      },
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development',
    })

    return transporter
  } catch (error: any) {
    console.error('Error creating email transporter:', error)
    return null
  }
}

async function sendViaSmtp(options: EmailOptions): Promise<SendEmailResult> {
  const emailTransporter = getEmailTransporter()

  if (!emailTransporter) {
    return {
      success: false,
      message: 'SMTP no configurado (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD)',
      error: 'No SMTP transporter',
    }
  }

  try {
    // Remitente: SMTP_FROM en Vercel (o usuario SMTP como respaldo)
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@ferreteria.com'
    const fromName = process.env.COMPANY_NAME || 'Clivaro'

    console.log('Sending email via SMTP:', {
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
    })

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    }

    const info = await emailTransporter.sendMail(mailOptions)

    if (info.rejected && info.rejected.length > 0) {
      return {
        success: false,
        message: `El email fue rechazado por el servidor SMTP: ${info.rejected.join(', ')}`,
        error: 'Email rejected',
        rejected: info.rejected,
      }
    }

    return {
      success: true,
      message: `Email enviado vía SMTP a ${options.to}`,
      messageId: info.messageId,
      accepted: info.accepted as string[],
    }
  } catch (error: any) {
    console.error('Error sending email via SMTP:', error)
    return {
      success: false,
      message: `Error al enviar email vía SMTP: ${error.message}`,
      error: error.code || 'SMTP error',
    }
  }
}

async function sendViaResend(options: EmailOptions): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return {
      success: false,
      message: 'RESEND_API_KEY no configurada',
      error: 'No Resend',
    }
  }

  const fromEmail = process.env.SMTP_FROM || 'notificaciones@clivaro.com'
  const fromName = process.env.COMPANY_NAME || 'Clivaro'

  const attachments = options.attachments?.map((att) => {
    let content = att.content
    if (Buffer.isBuffer(content)) {
      content = content.toString('base64')
    }
    return {
      filename: att.filename,
      content: content,
      contentType: att.contentType,
    }
  })

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    }),
  })

  const data = await response.json()

  if (response.ok) {
    return {
      success: true,
      message: `Email enviado vía Resend a ${options.to}`,
      messageId: data.id,
      accepted: [options.to],
    }
  }

  return {
    success: false,
    message: data.message || 'Error en API de Resend',
    error: 'Resend API error',
  }
}

export type SendEmailConfig = {
  /**
   * Si true (p. ej. recuperación de contraseña), intenta primero SMTP con las variables de Vercel
   * (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM) antes que Resend.
   */
  preferSmtp?: boolean
}

/**
 * Envía correo. Por defecto: Resend si hay API key, si no SMTP.
 * Con `preferSmtp: true`: primero SMTP, si falla entonces Resend, si no hay ninguno error.
 */
export async function sendEmail(options: EmailOptions, sendConfig?: SendEmailConfig): Promise<SendEmailResult> {
  console.log('sendEmail called:', {
    to: options.to,
    subject: options.subject,
    preferSmtp: !!sendConfig?.preferSmtp,
    hasSmtp: isSmtpConfigured(),
    hasResend: !!process.env.RESEND_API_KEY,
  })

  if (sendConfig?.preferSmtp && isSmtpConfigured()) {
    const smtpResult = await sendViaSmtp(options)
    if (smtpResult.success) {
      return smtpResult
    }
    console.warn('[sendEmail] SMTP (preferSmtp) failed, trying Resend if available:', smtpResult.error)
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (resendApiKey) {
    try {
      const res = await sendViaResend(options)
      if (res.success) {
        return res
      }
      console.error('Resend failed, falling back to SMTP:', res.message)
    } catch (resendError: any) {
      console.error('Resend exception, falling back to SMTP:', resendError?.message)
    }
  }

  if (isSmtpConfigured()) {
    return sendViaSmtp(options)
  }

  return {
    success: false,
    message:
      'Servicio de email no configurado. En Vercel defina SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD y SMTP_FROM (o RESEND_API_KEY).',
    error: 'No email provider configured',
  }
}
