import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { isSuperAdmin: true }
    })
    if (!user?.isSuperAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const url = new URL(request.url)
    const status = url.searchParams.get('status') || undefined
    const priority = url.searchParams.get('priority') || undefined

    const where: any = {}
    if (status) where.status = status
    if (priority) where.priority = priority

    const tickets = await (prisma as any).supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json(tickets)
  } catch (error: any) {
    logger.error('Error fetching tickets:', error)
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tenantId, tenantName, subject, description, priority, category, userAgent, reportedBy, reportedEmail } = body

    if (!subject || !description) {
      return NextResponse.json({ error: 'subject y description son requeridos' }, { status: 400 })
    }

    const ticket = await (prisma as any).supportTicket.create({
      data: {
        tenantId: tenantId || null,
        tenantName: tenantName || null,
        subject,
        description,
        priority: priority || 'MEDIUM',
        category: category || null,
        userAgent: userAgent || null,
        reportedBy: reportedBy || null,
        reportedEmail: reportedEmail || null,
      }
    })

    // Send email notification to super admins
    try {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM
      if (adminEmail) {
        const priorityLabel = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: '🚨 CRÍTICA' }[priority || 'MEDIUM'] || priority
        await sendEmail({
          to: adminEmail,
          subject: `[Ticket ${priority === 'CRITICAL' ? '🚨' : '📩'}] ${subject}`,
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#0F172A;color:white;padding:20px;border-radius:12px 12px 0 0">
                <h2 style="margin:0">Nuevo Ticket de Soporte</h2>
                <p style="margin:4px 0 0;opacity:0.7">Clivaro ERP — Panel Super Admin</p>
              </div>
              <div style="padding:20px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px 0;color:#64748b">Asunto:</td><td style="padding:8px 0;font-weight:600">${subject}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Prioridad:</td><td style="padding:8px 0">${priorityLabel}</td></tr>
                  <tr><td style="padding:8px 0;color:#64748b">Categoría:</td><td style="padding:8px 0">${category || 'Sin categoría'}</td></tr>
                  ${tenantName ? `<tr><td style="padding:8px 0;color:#64748b">Tenant:</td><td style="padding:8px 0">${tenantName}</td></tr>` : ''}
                  ${reportedBy ? `<tr><td style="padding:8px 0;color:#64748b">Reportado por:</td><td style="padding:8px 0">${reportedBy} ${reportedEmail ? `(${reportedEmail})` : ''}</td></tr>` : ''}
                </table>
                <div style="margin-top:16px;padding:16px;background:#f8fafc;border-radius:8px">
                  <p style="margin:0;color:#334155;white-space:pre-wrap">${description}</p>
                </div>
                <p style="margin-top:16px;text-align:center">
                  <a href="${process.env.NEXTAUTH_URL || 'https://app.clivaro.com'}/admin/audit" 
                     style="display:inline-block;padding:10px 24px;background:#3b82f6;color:white;border-radius:8px;text-decoration:none;font-weight:600">
                    Ver en Panel Admin
                  </a>
                </p>
              </div>
            </div>
          `,
        })
        logger.info(`[TICKETS] Email notification sent to ${adminEmail} for ticket: ${subject}`)
      }
    } catch (emailError: any) {
      logger.warn(`[TICKETS] Failed to send email notification: ${emailError?.message}`)
      // Don't fail the request if email fails
    }

    return NextResponse.json(ticket, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating ticket:', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Error al crear ticket') }, { status: 500 })
  }
}
