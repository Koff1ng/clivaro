import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createCampaignSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  htmlContent: z.string().min(1),
  scheduledAt: z.string().optional(),
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const user = session.user as any

  // Verificar feature del plan
  const planCheck = await requirePlanFeature(tenantId, 'marketing', user.isSuperAdmin)
  if (planCheck) return planCheck

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const result = await withTenantRead(tenantId, async (prisma) => {
      const where: any = {}
      if (status) where.status = status

      return await prisma.marketingCampaign.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          recipients: {
            select: { id: true, status: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    })

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const user = session.user as any

  // Verificar feature del plan
  const planCheck = await requirePlanFeature(tenantId, 'marketing', user.isSuperAdmin)
  if (planCheck) return planCheck

  try {
    const body = await request.json()
    const data = createCampaignSchema.parse(body)

    const result = await withTenantTx(tenantId, async (prisma) => {
      return await prisma.marketingCampaign.create({
        data: {
          name: data.name,
          subject: data.subject,
          htmlContent: data.htmlContent,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
          createdById: user.id,
        },
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
        },
      })
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    logger.error('Error creating campaign:', error)
    return NextResponse.json({ error: error.message || 'Failed to create campaign' }, { status: 500 })
  }
}

