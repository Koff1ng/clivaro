import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { id: true, isSuperAdmin: true, name: true }
    })
    if (!user?.isSuperAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const { status, priority, assignedTo } = body

    const updateData: any = {}
    if (status) updateData.status = status
    if (priority) updateData.priority = priority
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo
    if (status === 'RESOLVED' || status === 'CLOSED') {
      updateData.resolvedAt = new Date()
    }

    const ticket = await (prisma as any).supportTicket.update({
      where: { id },
      data: updateData,
    })

    // Audit log
    try {
      await (prisma as any).adminAuditLog.create({
        data: {
          action: 'UPDATE_TICKET',
          adminUserId: user.id,
          adminUserName: user.name || '',
          details: JSON.stringify({ ticketId: id, changes: updateData }),
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        }
      })
    } catch { /* audit table may not exist */ }

    return NextResponse.json(ticket)
  } catch (error: any) {
    logger.error('Error updating ticket:', error)
    return NextResponse.json({ error: safeErrorMessage(error, 'Error al actualizar ticket') }, { status: 500 })
  }
}
