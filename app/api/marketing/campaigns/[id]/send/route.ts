import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import {
  extractImagePathsFromHtml,
  inlineDataImagesToCid,
  personalizeText,
  prepareImageAttachments,
  replaceImageUrlsWithCid,
} from '@/lib/marketing/email-assets'
import { buildPublicUrl } from '@/lib/public-url'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // long-running send loop (Vercel: 5 min on Pro)

import { safeErrorMessage } from '@/lib/safe-error'

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

    // ── Phase 1: load campaign + pending recipients + blacklist (read-only, no tx) ──
    const prep = await withTenantRead(tenantId, async (prisma) => {
      const campaign = await prisma.marketingCampaign.findUnique({
        where: { id: campaignId },
        include: {
          recipients: {
            where: { status: 'PENDING' },
            include: { customer: { select: { name: true } } },
          },
        },
      })

      if (!campaign) return { error: 'Campaign not found', status: 404 as const }
      if (campaign.recipients.length === 0) return { error: 'No pending recipients found', status: 400 as const }

      const blacklist = await prisma.unsubscribe.findMany({ select: { email: true } })
      return {
        campaign,
        blacklistedEmails: new Set(blacklist.map(b => b.email)),
      }
    })

    if ('error' in prep) {
      return NextResponse.json({ error: prep.error }, { status: prep.status })
    }

    const { campaign, blacklistedEmails } = prep

    // ── Phase 2: mark campaign as SENDING (small, fast tx) ──
    await withTenantTx(tenantId, async (prisma) => {
      await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: { status: 'SENDING' },
      })
    })

    // ── Phase 3: send each email + persist its result individually ──
    // External I/O (SMTP, attachments) MUST run outside any DB transaction:
    // a slow SMTP would otherwise blow Prisma's tx timeout (15s default), causing
    // emails to be sent without their corresponding recipient row updates,
    // leaving recipients stuck in PENDING and producing duplicate sends.
    const results = { sent: 0, failed: 0, skipped: 0, errors: [] as string[] }

    for (const recipient of campaign.recipients) {
      // Skip blacklisted recipients
      if (blacklistedEmails.has(recipient.email)) {
        try {
          await withTenantTx(tenantId, async (prisma) => {
            await prisma.marketingCampaignRecipient.update({
              where: { id: recipient.id },
              data: { status: 'FAILED', error: 'Recipient Unsubscribed' },
            })
          })
        } catch (e) {
          logger.error('Error marking recipient as unsubscribed', e)
        }
        results.skipped++
        continue
      }

      try {
        const personalizationVars = {
          name: recipient.customer?.name,
          email: recipient.email,
        }

        let personalizedContent = personalizeText(campaign.htmlContent, personalizationVars)
        const personalizedSubject = personalizeText(campaign.subject, personalizationVars)

        const unsubscribeUrl = buildPublicUrl(
          `/marketing/unsubscribe?email=${encodeURIComponent(recipient.email)}&tenantId=${encodeURIComponent(tenantId)}`,
        )
        const unsubscribeFooter = `
            <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
              <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">Darme de baja / Unsubscribe</a>
            </div>
          `
        personalizedContent = personalizedContent.includes('</body>')
          ? personalizedContent.replace('</body>', `${unsubscribeFooter}</body>`)
          : personalizedContent + unsubscribeFooter

        // Local /uploads/* assets → CID attachments
        const imagePaths = extractImagePathsFromHtml(personalizedContent)
        const fileAttachments = await prepareImageAttachments(imagePaths)
        personalizedContent = replaceImageUrlsWithCid(personalizedContent, imagePaths, fileAttachments)

        // Inline data:image/* → CID attachments (Outlook drops base64 images otherwise)
        const inlineResult = inlineDataImagesToCid(personalizedContent)
        personalizedContent = inlineResult.html

        const emailResult = await sendEmail({
          to: recipient.email,
          subject: personalizedSubject,
          html: personalizedContent,
          attachments: [...fileAttachments, ...inlineResult.attachments],
        })

        // Persist per-recipient result in its own short transaction.
        await withTenantTx(tenantId, async (prisma) => {
          if (emailResult.success) {
            await prisma.marketingCampaignRecipient.update({
              where: { id: recipient.id },
              data: { status: 'SENT', sentAt: new Date() },
            })
          } else {
            await prisma.marketingCampaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'FAILED',
                error: emailResult.message,
                retryCount: { increment: 1 },
              },
            })
          }
        })

        if (emailResult.success) {
          results.sent++
        } else {
          results.failed++
          results.errors.push(`${recipient.email}: ${emailResult.message}`)
        }
      } catch (err: any) {
        try {
          await withTenantTx(tenantId, async (prisma) => {
            await prisma.marketingCampaignRecipient.update({
              where: { id: recipient.id },
              data: {
                status: 'FAILED',
                error: err?.message || 'Unknown error',
                retryCount: { increment: 1 },
              },
            })
          })
        } catch (innerErr) {
          logger.error('Error persisting recipient failure', innerErr)
        }
        results.failed++
        results.errors.push(`${recipient.email}: ${err?.message || 'Unknown error'}`)
      }
    }

    // ── Phase 4: finalize campaign status ──
    try {
      await withTenantTx(tenantId, async (prisma) => {
        const remainingPending = await prisma.marketingCampaignRecipient.count({
          where: { campaignId, status: 'PENDING' },
        })
        await prisma.marketingCampaign.update({
          where: { id: campaignId },
          data: {
            status: remainingPending > 0 ? 'SENDING' : 'SENT',
            sentAt: remainingPending === 0 ? new Date() : undefined,
          },
        })
      })
    } catch (e) {
      logger.error('Error finalizing campaign status', e)
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error: any) {
    logger.error('Error sending campaign', error)
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 })
  }
}
