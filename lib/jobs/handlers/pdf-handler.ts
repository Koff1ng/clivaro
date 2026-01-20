/**
 * PDF Generation Job Handler
 * Processes PDF generation jobs in the background
 */

import { logger } from '@/lib/logger'
import { generateInvoicePDF } from '@/lib/pdf'
import { PrismaClient } from '@prisma/client'
import { getTenantPrisma } from '@/lib/tenant-db'

export async function handleGeneratePDF(payload: {
  invoiceId: string
  tenantId?: string
  databaseUrl?: string
}): Promise<void> {
  const { invoiceId, tenantId, databaseUrl } = payload

  logger.info('Processing PDF generation job', { invoiceId, tenantId })

  try {
    // Get the correct Prisma client
    let prisma: PrismaClient
    if (databaseUrl) {
      prisma = getTenantPrisma(databaseUrl)
    } else {
      // Fallback to master DB (shouldn't happen in production)
      const { prisma: masterPrisma } = await import('@/lib/db')
      prisma = masterPrisma
    }

    // Fetch invoice data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
            taxId: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
            variant: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`)
    }

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice as any)

    // Store PDF (you can save to S3, database, or file system)
    // For now, we'll just log success
    logger.info('PDF generated successfully', {
      invoiceId,
      invoiceNumber: invoice.number,
      size: pdfBuffer.length,
    })

    // TODO: Save PDF to storage (S3, Supabase Storage, etc.)
    // await savePDFToStorage(invoiceId, pdfBuffer)

  } catch (error: any) {
    logger.error('PDF generation job failed', error, {
      invoiceId,
      tenantId,
      errorMessage: error?.message,
    })
    throw error // Re-throw to trigger retry
  }
}

