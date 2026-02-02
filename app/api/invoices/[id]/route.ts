import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const updateInvoiceSchema = z.object({
  status: z.enum(['EMITIDA', 'PAGADA', 'ANULADA', 'EN_COBRANZA', 'ISSUED', 'PAID', 'VOID', 'PARCIAL', 'PARTIAL']).optional(), // Compatibilidad con estados antiguos
  notes: z.string().optional(),
})

type InvoiceStatus = z.infer<typeof updateInvoiceSchema>['status']
type InvoiceStatusValue = Exclude<InvoiceStatus, undefined>

export async function GET(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  // Handle params as Promise (Next.js 15+)
  const resolvedParams = await Promise.resolve(params)
  const invoiceId = resolvedParams.id

  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = getTenantIdFromSession(session)

  try {
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    const result = await withTenantTx(tenantId, async (tx: Prisma.TransactionClient) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          customer: {
            select: {
              id: true,
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
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                },
              },
              lineTaxes: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
          payments: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          taxSummary: true,
        },
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      // Asegurar que todos los datos estén presentes
      if (!invoice.issuedAt && invoice.createdAt) {
        // @ts-ignore - handled during runtime
        invoice.issuedAt = invoice.createdAt
      }

      return invoice
    })

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error fetching invoice', error, { endpoint: '/api/invoices/[id]', method: 'GET', invoiceId })

    return NextResponse.json(
      {
        error: error.message === 'Invoice not found' ? 'Invoice not found' : 'Failed to fetch invoice',
        message: error.message || 'Unknown error',
      },
      { status: error.message === 'Invoice not found' ? 404 : 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(params)
  const invoiceId = resolvedParams.id

  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = getTenantIdFromSession(session)

  try {
    const body = await request.json()
    const data = updateInvoiceSchema.parse(body)

    const result = await withTenantTx(tenantId, async (tx: Prisma.TransactionClient) => {
      // Si se actualiza el status, mapear estados antiguos a nuevos
      let statusToUpdate = data.status
      if (statusToUpdate) {
        const statusMap: Partial<Record<InvoiceStatusValue, InvoiceStatusValue>> = {
          ISSUED: 'EMITIDA',
          PAID: 'PAGADA',
          VOID: 'ANULADA',
          PARTIAL: 'EN_COBRANZA',
          PARCIAL: 'EN_COBRANZA',
        }
        statusToUpdate = statusMap[statusToUpdate] ?? statusToUpdate
      }

      // Si no se especifica status, calcularlo automáticamente basándose en los pagos
      if (!statusToUpdate) {
        const invoice = await tx.invoice.findUnique({
          where: { id: invoiceId },
          include: { payments: { select: { amount: true } } },
        })

        if (invoice) {
          const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
          if (totalPaid >= invoice.total) {
            statusToUpdate = 'PAGADA'
          } else if (totalPaid > 0) {
            statusToUpdate = 'EN_COBRANZA'
          } else {
            statusToUpdate = 'EMITIDA'
          }
        }
      }

      return await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          ...(statusToUpdate && { status: statusToUpdate }),
          notes: data.notes !== undefined ? (data.notes || null) : undefined,
          updatedById: (session.user as any).id,
          ...(statusToUpdate === 'PAGADA' && !data.status ? { paidAt: new Date() } : {}),
        },
      })
    })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error updating invoice', error, { endpoint: '/api/invoices/[id]', method: 'PUT', invoiceId })
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(params)
  const invoiceId = resolvedParams.id

  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = getTenantIdFromSession(session)

  try {
    await withTenantTx(tenantId, async (tx: Prisma.TransactionClient) => {
      // Verificar que la factura existe
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      // Validar que la factura no esté enviada a facturación electrónica
      if (invoice.electronicStatus === 'ACCEPTED' || invoice.electronicStatus === 'SENT') {
        throw new Error('No se puede eliminar una factura que ya fue enviada a facturación electrónica')
      }

      // Eliminar factura (los items y payments se eliminan en cascada)
      await tx.invoice.delete({
        where: { id: invoiceId },
      })
    })

    return NextResponse.json({ message: 'Invoice deleted successfully' })
  } catch (error: any) {
    logger.error('Error deleting invoice', error, { endpoint: '/api/invoices/[id]', method: 'DELETE', invoiceId })
    return NextResponse.json(
      { error: error.message || 'Failed to delete invoice' },
      { status: error.message === 'Invoice not found' ? 404 : 400 }
    )
  }
}

