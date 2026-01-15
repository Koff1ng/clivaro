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

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Send emails
    for (const recipient of campaign.recipients) {
      try {
        // Personalize email content
        let personalizedContent = personalizeEmailHtml(campaign.htmlContent, {
          name: recipient.customer?.name,
          email: recipient.email,
        })

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
            },
          })
          results.sent++
        } else {
          await prisma.marketingCampaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'FAILED',
              error: emailResult.message,
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

