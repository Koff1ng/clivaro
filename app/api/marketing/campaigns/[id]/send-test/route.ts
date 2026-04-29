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
  inlineDataImagesToCid,
  personalizeText,
  prepareImageAttachments,
  replaceImageUrlsWithCid,
} from '@/lib/marketing/email-assets'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

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

      if (!campaign) {
        return { kind: 'not_found' as const }
      }

      // Respect the unsubscribe blacklist even for tests, so we never reach
      // recipients who explicitly asked not to be contacted.
      const blacklisted = await prisma.unsubscribe.findUnique({
        where: { email: input.email },
        select: { email: true },
      })
      if (blacklisted) {
        return { kind: 'blacklisted' as const }
      }

      const personalizationVars = { name: input.name, email: input.email }
      let html = personalizeText(campaign.htmlContent, personalizationVars)

      // Local /uploads/* assets → CID
      const imagePaths = extractImagePathsFromHtml(html)
      const fileAttachments = await prepareImageAttachments(imagePaths)
      html = replaceImageUrlsWithCid(html, imagePaths, fileAttachments)

      // Inline data:image/* → CID (Outlook drops base64 images otherwise)
      const inlineResult = inlineDataImagesToCid(html)
      html = inlineResult.html

      const personalizedSubject = personalizeText(campaign.subject, personalizationVars)

      const emailResult = await sendEmail({
        to: input.email,
        subject: `[PRUEBA] ${personalizedSubject}`,
        html,
        attachments: [...fileAttachments, ...inlineResult.attachments],
      })

      return { kind: 'sent' as const, emailResult }
    })

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
    }
    if (result.kind === 'blacklisted') {
      return NextResponse.json(
        { error: 'Este correo está en la lista de bajas y no puede recibir mensajes de prueba.' },
        { status: 422 },
      )
    }
    if (!result.emailResult.success) {
      return NextResponse.json({ error: result.emailResult.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    logger.error('Error sending test campaign', error)
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}
