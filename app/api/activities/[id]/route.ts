import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const updateActivitySchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE']).optional(),
  subject: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  completed: z.boolean().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const body = await request.json()
    const data = updateActivitySchema.parse(body)

    const activity = await withTenantTx(tenantId, async (prisma) => {
      return await prisma.activity.update({
        where: { id: params.id },
        data: {
          ...data,
          description: data.description !== undefined ? (data.description || null) : undefined,
          dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
        },
      })
    })

    return NextResponse.json(activity)
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    logger.error('Error updating activity', error)
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    await withTenantTx(tenantId, async (prisma) => {
      await prisma.activity.delete({ where: { id: params.id } })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error('Error deleting activity', error)
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 })
  }
}
