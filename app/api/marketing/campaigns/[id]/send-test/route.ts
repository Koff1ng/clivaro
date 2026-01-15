import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { sendEmail } from '@/lib/email'
import { z } from 'zod'
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

  const user = session.user as any
  const planCheck = await requirePlanFeature(user.tenantId, 'marketing', user.isSuperAdmin)
  if (planCheck) return planCheck

  const prisma = await getPrismaForRequest(request, session)

  try {
    const resolvedParams = typeof params === 'object' && 'then' in params ? await params : (params as { id: string })
    const campaignId = resolvedParams.id
    const body = await request.json()
    const input = schema.parse(body)

    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, name: true, subject: true, htmlContent: true },
    })

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    let html = personalizeEmailHtml(campaign.htmlContent, { name: input.name, email: input.email })

    const imagePaths = extractImagePathsFromHtml(html)
    const attachments = await prepareImageAttachments(imagePaths)
    html = replaceImageUrlsWithCid(html, imagePaths, attachments)

    const result = await sendEmail({
      to: input.email,
      subject: `[PRUEBA] ${campaign.subject}`,
      html,
      attachments,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message || 'Failed to send test email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    console.error('Error sending test campaign:', error)
    return NextResponse.json({ error: error.message || 'Failed to send test email' }, { status: 500 })
  }
}


