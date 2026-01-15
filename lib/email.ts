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

  const emailTransporter = getEmailTransporter()

  if (!emailTransporter) {
    console.error('Email transporter is null - SMTP not configured')
    return {
      success: false,
      message: 'Servicio de email no configurado. Configure las variables SMTP en .env',
      error: 'SMTP not configured',
    }
  }

  try {
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@ferreteria.com'
    const fromName = process.env.COMPANY_NAME || 'Ferretería'

    console.log('Sending email via transporter:', {
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
    })

    // Verify connection before sending (optional, but helpful for debugging)
    try {
      await emailTransporter.verify()
      console.log('SMTP connection verified successfully')
    } catch (verifyError: any) {
      console.warn('SMTP verification failed (will still attempt to send):', verifyError.message)
    }

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    }

    console.log('Attempting to send email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      htmlLength: mailOptions.html?.length || 0,
    })

    const info = await emailTransporter.sendMail(mailOptions)

    console.log('Email sendMail response:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      envelope: info.envelope,
    })

    // Check if email was actually accepted
    if (info.rejected && info.rejected.length > 0) {
      console.error('Email was rejected:', info.rejected)
      return {
        success: false,
        message: `El email fue rechazado por el servidor: ${info.rejected.join(', ')}`,
        error: 'Email rejected',
        rejected: info.rejected,
      }
    }

    if (!info.accepted || info.accepted.length === 0) {
      console.error('Email was not accepted by server')
      return {
        success: false,
        message: 'El servidor SMTP no aceptó el email',
        error: 'Email not accepted',
      }
    }

    console.log('Email accepted by server, messageId:', info.messageId)

    return {
      success: true,
      message: `Email enviado exitosamente a ${options.to}`,
      messageId: info.messageId,
      accepted: info.accepted,
    }
  } catch (error: any) {
    console.error('Error sending email:', error)
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      message: error.message,
      stack: error.stack,
    })
    
    // Provide more specific error messages
    let errorMessage = error.message || 'Error desconocido'
    if (error.code === 'EAUTH') {
      errorMessage = 'Error de autenticación. Verifique SMTP_USER y SMTP_PASSWORD'
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Error de conexión. Verifique SMTP_HOST y SMTP_PORT'
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Timeout de conexión. Verifique su conexión a internet y la configuración SMTP'
    }
    
    return {
      success: false,
      message: `Error al enviar email: ${errorMessage}`,
      error: error.code || 'Unknown error',
    }
  }
}


