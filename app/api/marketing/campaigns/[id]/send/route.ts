import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import {

export const dynamic = 'force-dynamic'
  extractImagePathsFromHtml,
  personalizeEmailHtml,
  prepareImageAttachments,
  replaceImageUrlsWithCid,
} from '@/lib/marketing/email-assets'

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
    const resolvedParams = typeof params === 'object' && 'then' in params ? await params : params as { id: string }
    const campaignId = resolvedParams.id

    const result = await withTenantTx(tenantId, async (prisma) => {
      const campaign = await prisma.marketingCampaign.findUnique({
        where: { id: campaignId },
        include: {
          recipients: { where: { status: 'PENDING' }, include: { customer: { select: { name: true } } } },
        },
      })

      if (!campaign) throw new Error('Campaign not found')
      if (campaign.recipients.length === 0) throw new Error('No pending recipients found')

      await prisma.marketingCampaign.update({ where: { id: campaignId }, data: { status: 'SENDING' } })

      const blacklist = await prisma.unsubscribe.findMany({ select: { email: true } })
      const blacklistedEmails = new Set(blacklist.map(b => b.email))

      const results = { sent: 0, failed: 0, errors: [] as string[], skipped: 0 }

      for (const recipient of campaign.recipients) {
        if (blacklistedEmails.has(recipient.email)) {
          await prisma.marketingCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'FAILED', error: 'Recipient Unsubscribed' }
          })
          results.skipped++
          continue
        }

        try {
          let personalizedContent = personalizeEmailHtml(campaign.htmlContent, {
            name: recipient.customer?.name,
            email: recipient.email,
          })

          const unsubscribeUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/marketing/unsubscribe?email=${encodeURIComponent(recipient.email)}&tenantId=${tenantId}`
          const unsubscribeFooter = `
            <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
              <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">Darme de baja / Unsubscribe</a>
            </div>
          `
          personalizedContent = personalizedContent.includes('</body>')
            ? personalizedContent.replace('</body>', `${unsubscribeFooter}</body>`)
            : personalizedContent + unsubscribeFooter

          const imagePaths = extractImagePathsFromHtml(personalizedContent)
          const imageAttachments = await prepareImageAttachments(imagePaths)
          personalizedContent = replaceImageUrlsWithCid(personalizedContent, imagePaths, imageAttachments)

          const emailResult = await sendEmail({
            to: recipient.email,
            subject: campaign.subject,
            html: personalizedContent,
            attachments: imageAttachments,
          })

          if (emailResult.success) {
            await prisma.marketingCampaignRecipient.update({
              where: { id: recipient.id },
              data: { status: 'SENT', sentAt: new Date(), retryCount: { increment: 1 } },
            })
            results.sent++
          } else {
            await prisma.marketingCampaignRecipient.update({
              where: { id: recipient.id },
              data: { status: 'FAILED', error: emailResult.message, retryCount: { increment: 1 } },
            })
            results.failed++
            results.errors.push(`${recipient.email}: ${emailResult.message}`)
          }
        } catch (err: any) {
          await prisma.marketingCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'FAILED', error: err.message || 'Unknown error', retryCount: { increment: 1 } },
          })
          results.failed++
          results.errors.push(`${recipient.email}: ${err.message}`)
        }
      }

      const remainingPending = await prisma.marketingCampaignRecipient.count({ where: { campaignId, status: 'PENDING' } })
      await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          status: remainingPending > 0 ? 'SENDING' : 'SENT',
          sentAt: remainingPending === 0 ? new Date() : undefined,
        },
      })

      return results
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    logger.error('Error sending campaign', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

