import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, getTenantIdFromSession } from '@/lib/tenancy'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { sendEmail } from '@/lib/email'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import {
  extractImagePathsFromHtml,
  personalizeEmailHtml,
  prepareImageAttachments,
  replaceImageUrlsWithCid,
} from '@/lib/marketing/email-assets'

const schema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)
  const isSuper = (session.user as any).isSuperAdmin
  const planCheck = await requirePlanFeature(tenantId, 'marketing', isSuper)
  if (planCheck) return planCheck

  try {
    const resolvedParams = typeof params === 'object' && 'then' in params ? await params : (params as { id: string })
    const campaignId = resolvedParams.id
    const body = await request.json()
    const input = schema.parse(body)

    const result = await withTenantRead(tenantId, async (prisma) => {
      const campaign = await prisma.marketingCampaign.findUnique({
        where: { id: campaignId },
        select: { id: true, name: true, subject: true, htmlContent: true },
      })

      if (!campaign) throw new Error('Campaign not found')

      let html = personalizeEmailHtml(campaign.htmlContent, { name: input.name, email: input.email })
      const imagePaths = extractImagePathsFromHtml(html)
      const attachments = await prepareImageAttachments(imagePaths)
      html = replaceImageUrlsWithCid(html, imagePaths, attachments)

      const emailResult = await sendEmail({
        to: input.email,
        subject: `[PRUEBA] ${campaign.subject}`,
        html,
        attachments,
      })

      return emailResult
    })

    if (!result.success) return NextResponse.json({ error: result.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    logger.error('Error sending test campaign', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


