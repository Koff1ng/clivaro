import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendEmail } from '@/lib/email'
import { rateLimiters } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const contactSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Correo electrónico inválido'),
  phone: z.string().min(7, 'El teléfono debe tener al menos 7 caracteres'),
  company: z.string().optional(),
  plan: z.string().optional(),
  message: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Public endpoint: apply strict write rate limit by IP
    const rl = await rateLimiters.write(request, { scope: '/api/contact' })
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.message || 'Too many requests', retryAfter: rl.retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(rl.retryAfter || 60),
            ...(rl.limit ? { 'X-RateLimit-Limit': String(rl.limit) } : {}),
            ...(typeof rl.remaining === 'number' ? { 'X-RateLimit-Remaining': String(rl.remaining) } : {}),
            ...(rl.reset ? { 'X-RateLimit-Reset': String(rl.reset) } : {}),
          },
        }
      )
    }

    const body = await request.json()
    
    // Validate data
    const validatedData = contactSchema.parse(body)

    // Prepare email content
    const emailSubject = `Nueva Solicitud de Prueba Gratis - ${validatedData.plan || 'Sin plan específico'}`
    
    const emailHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
              color: white;
              padding: 30px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .field {
              margin-bottom: 20px;
              padding: 15px;
              background: white;
              border-radius: 6px;
              border-left: 4px solid #2563eb;
            }
            .field-label {
              font-weight: 600;
              color: #2563eb;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 5px;
            }
            .field-value {
              color: #1f2937;
              font-size: 16px;
            }
            .plan-badge {
              display: inline-block;
              background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
              color: white;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">Nueva Solicitud de Prueba Gratis</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Clivaro - Sistema de Gestión</p>
          </div>
          <div class="content">
            <div class="field">
              <div class="field-label">Nombre Completo</div>
              <div class="field-value">${validatedData.name}</div>
            </div>
            <div class="field">
              <div class="field-label">Correo Electrónico</div>
              <div class="field-value">${validatedData.email}</div>
            </div>
            <div class="field">
              <div class="field-label">Teléfono</div>
              <div class="field-value">${validatedData.phone}</div>
            </div>
            ${validatedData.company ? `
            <div class="field">
              <div class="field-label">Empresa</div>
              <div class="field-value">${validatedData.company}</div>
            </div>
            ` : ''}
            ${validatedData.plan ? `
            <div class="field">
              <div class="field-label">Plan de Interés</div>
              <div class="field-value">
                <span class="plan-badge">${validatedData.plan}</span>
              </div>
            </div>
            ` : ''}
            ${validatedData.message ? `
            <div class="field">
              <div class="field-label">Mensaje Adicional</div>
              <div class="field-value">${validatedData.message.replace(/\n/g, '<br>')}</div>
            </div>
            ` : ''}
            <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
              <p>Este correo fue enviado desde el formulario de contacto de Clivaro</p>
              <p style="margin: 5px 0;">Fecha: ${new Date().toLocaleString('es-CO', { 
                dateStyle: 'long', 
                timeStyle: 'short' 
              })}</p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email
    const emailResult = await sendEmail({
      to: 'gerencia@clientumstudio.com',
      subject: emailSubject,
      html: emailHTML,
    })

    if (!emailResult.success) {
      logger.error('Error sending contact email', emailResult.error, { endpoint: '/api/contact', method: 'POST' })
      return NextResponse.json(
        { 
          error: emailResult.message || 'Error al enviar el email. Por favor, intenta nuevamente.' 
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Formulario enviado exitosamente. Nos pondremos en contacto contigo pronto.' 
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('Error sending contact form', error, { endpoint: '/api/contact', method: 'POST' })
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error al enviar el formulario. Por favor, intenta nuevamente.' },
      { status: 500 }
    )
  }
}

