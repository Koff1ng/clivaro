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
    const port = parseInt(smtpPort)
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
      // Add timeout and connection options (increased for Hostinger)
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,
      socketTimeout: 30000,
      // For ports other than 465, require TLS
      requireTLS: !secure && port !== 25,
      tls: {
        // Do not fail on invalid certificates (useful for some providers)
        rejectUnauthorized: false,
        // For Hostinger compatibility
        minVersion: 'TLSv1',
      },
      // Debug mode to see SMTP conversation
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development',
    })

    return transporter
  } catch (error: any) {
    console.error('Error creating email transporter:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    })
    return null
  }
}

export async function sendEmail(options: EmailOptions): Promise<{
  success: boolean
  message: string
  error?: string
  messageId?: string
  accepted?: string[]
  rejected?: string[]
}> {
  console.log('sendEmail called with options:', {
    to: options.to,
    subject: options.subject,
    hasHtml: !!options.html,
    htmlLength: options.html?.length || 0,
  })

  // 1. Try Resend if API key is available (Preferred "New" method)
  const resendApiKey = process.env.RESEND_API_KEY
  if (resendApiKey) {
    try {
      console.log('Using Resend API for email delivery')
      const fromEmail = process.env.SMTP_FROM || 'notificaciones@clivaro.com'
      const fromName = process.env.COMPANY_NAME || 'Ferretería'

      // Convert attachments to Resend format
      const attachments = options.attachments?.map(att => {
        let content = att.content
        if (Buffer.isBuffer(content)) {
          content = content.toString('base64')
        }
        return {
          filename: att.filename,
          content: content,
          contentType: att.contentType
        }
      })

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
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
        console.log('Email sent via Resend successfully:', data.id)
        return {
          success: true,
          message: `Email enviado exitosamente vía Resend a ${options.to}`,
          messageId: data.id,
          accepted: [options.to],
        }
      } else {
        console.error('Resend API error:', data)
        throw new Error(data.message || 'Error en API de Resend')
      }
    } catch (resendError: any) {
      console.error('Failed to send via Resend, falling back to SMTP if configured:', resendError.message)
      // Fall through to SMTP logic below
    }
  }

  // 2. Fallback to Nodemailer/SMTP (Old method)
  const emailTransporter = getEmailTransporter()

  if (!emailTransporter) {
    console.error('Email transporter is null - SMTP not configured')
    return {
      success: false,
      message: 'Servicio de email no configurado. Configure RESEND_API_KEY o variables SMTP en .env',
      error: 'No email provider configured',
    }
  }

  try {
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@ferreteria.com'
    const fromName = process.env.COMPANY_NAME || 'Ferretería'

    console.log('Sending email via SMTP transporter:', {
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

    console.log('Email SMTP sendMail response:', {
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response,
    })

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
      message: `Email enviado exitosamente vía SMTP a ${options.to}`,
      messageId: info.messageId,
      accepted: info.accepted,
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


