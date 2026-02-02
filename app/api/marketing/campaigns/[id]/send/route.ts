import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { requirePlanFeature } from '@/lib/plan-middleware'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import {
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

  if (session instanceof NextResponse) {
    return session
  }

  // Verificar feature del plan
  const user = session.user as any
  const planCheck = await requirePlanFeature(user.tenantId, 'marketing', user.isSuperAdmin)
  if (planCheck) {
    return planCheck
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const resolvedParams = typeof params === 'object' && 'then' in params
      ? await params
      : params as { id: string }
    const campaignId = resolvedParams.id

    // Get campaign
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      include: {
        recipients: {
          where: {
            status: 'PENDING',
          },
          include: {
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    if (campaign.recipients.length === 0) {
      return NextResponse.json(
        { error: 'No pending recipients found' },
        { status: 400 }
      )
    }

    // Update campaign status
    await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: { status: 'SENDING' },
    })

    // 4. Get Blacklist
    const blacklist = await prisma.unsubscribe.findMany({
      select: { email: true }
    })
    const blacklistedEmails = new Set(blacklist.map(b => b.email))

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
      skipped: 0
    }

    // Send emails
    for (const recipient of campaign.recipients) {
      // Check Blacklist
      if (blacklistedEmails.has(recipient.email)) {
        // Mark as skipped/failed
        await prisma.marketingCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED', // Using FAILED as we didn't add SKIPPED to enum in DB push effectively without migration? Or assuming FAILED is fine.
            error: 'Recipient Unsubscribed (Blacklisted)'
          }
        })
        results.skipped++
        continue
      }

      try {
        // Personalize email content
        let personalizedContent = personalizeEmailHtml(campaign.htmlContent, {
          name: recipient.customer?.name,
          email: recipient.email,
        })

        // Append Unsubscribe Link
        // Simple append or replace placeholder if exists.
        // We will append a footer if not present.
        const unsubscribeUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/marketing/unsubscribe?email=${encodeURIComponent(recipient.email)}`
        const unsubscribeFooter = `
          <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
            <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">Darme de baja / Unsubscribe</a>
          </div>
        `

        // Inject before </body> if exists, else append
        if (personalizedContent.includes('</body>')) {
          personalizedContent = personalizedContent.replace('</body>', `${unsubscribeFooter}</body>`)
        } else {
          personalizedContent += unsubscribeFooter
        }

        // Extract image paths from HTML
        const imagePaths = extractImagePathsFromHtml(personalizedContent)
        logger.debug('Found images to embed', { imageCount: imagePaths.length })

        // Prepare image attachments with CID
        const imageAttachments = await prepareImageAttachments(imagePaths)

        // Replace image URLs with CID references
        personalizedContent = replaceImageUrlsWithCid(personalizedContent, imagePaths, imageAttachments)

        // Check for base64 images (which Gmail will block)
        const base64Images = personalizedContent.match(/src=["']data:image\/[^"']+["']/gi)
        if (base64Images && base64Images.length > 0) {
          logger.warn('Email contains base64 images (Gmail may block)', { count: base64Images.length })
        }

        const emailResult = await sendEmail({
          to: recipient.email,
          subject: campaign.subject,
          html: personalizedContent,
          attachments: imageAttachments,
        })

        if (emailResult.success) {
          await prisma.marketingCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              retryCount: { increment: 1 }
            },
          })
          results.sent++
        } else {
          await prisma.marketingCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'FAILED',
              error: emailResult.message,
              retryCount: { increment: 1 }
            },
          })
          results.failed++
          results.errors.push(`${recipient.email}: ${emailResult.message}`)
        }
      } catch (error: any) {
        await prisma.marketingCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            error: error.message || 'Unknown error',
            retryCount: { increment: 1 }
          },
        })
        results.failed++
        results.errors.push(`${recipient.email}: ${error.message}`)
      }
    }

    // Update campaign status
    const remainingPending = await prisma.marketingCampaignRecipient.count({
      where: {
        campaignId,
        status: 'PENDING',
      },
    })

    await prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        status: remainingPending > 0 ? 'SENDING' : 'SENT',
        sentAt: remainingPending === 0 ? new Date() : undefined,
      },
    })

    return NextResponse.json({
      success: true,
      sent: results.sent,
      failed: results.failed,
      errors: results.errors,
    })
  } catch (error: any) {
    logger.error('Error sending campaign', error, { endpoint: '/api/marketing/campaigns/[id]/send', method: 'POST' })
    return NextResponse.json(
      { error: 'Failed to send campaign', details: error.message },
      { status: 500 }
    )
  }
}

