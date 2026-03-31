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
  const userId = (session.user as any).id as string

  try {
    await withTenantTx(tenantId, async (tx: Prisma.TransactionClient) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: true,
          payments: true,
        },
      })

      if (!invoice) {
        throw new Error('Invoice not found')
      }

      // Block deletion of electronic invoices
      if (invoice.electronicStatus === 'ACCEPTED' || invoice.electronicStatus === 'SENT') {
        throw new Error('No se puede eliminar una factura que ya fue enviada a facturación electrónica')
      }

      // ── 1. Reverse stock movements ──
      const outMovements = await tx.stockMovement.findMany({
        where: { reference: invoice.number, type: 'OUT' },
      })

      for (const m of outMovements) {
        // Create reverse IN movement
        await tx.stockMovement.create({
          data: {
            warehouseId: m.warehouseId,
            productId: m.productId,
            variantId: m.variantId,
            zoneId: m.zoneId,
            type: 'IN',
            quantity: m.quantity,
            reason: `Eliminación factura ${invoice.number}`,
            createdById: userId,
            reference: invoice.number,
          },
        })

        // Restock
        const existing = await tx.stockLevel.findFirst({
          where: {
            warehouseId: m.warehouseId,
            productId: m.productId,
            variantId: m.variantId,
            zoneId: m.zoneId ?? null,
          },
        })

        if (existing) {
          await tx.stockLevel.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + m.quantity },
          })
        }
      }

      // ── 2. Reverse cash & shift summaries ──
      const cashPaid = invoice.payments
        .filter(p => (p.method || '').toUpperCase() === 'CASH')
        .reduce((s, p) => s + p.amount, 0)

      if (cashPaid > 0) {
        const openShift = await tx.cashShift.findFirst({ where: { userId, status: 'OPEN' } })

        if (openShift) {
          // Record cash OUT movement
          await tx.cashMovement.create({
            data: {
              cashShiftId: openShift.id,
              type: 'OUT',
              amount: cashPaid,
              reason: `Eliminación factura ${invoice.number}`,
              createdById: userId,
            },
          })

          await tx.cashShift.update({
            where: { id: openShift.id },
            data: { expectedCash: openShift.expectedCash - cashPaid },
          })
        }
      }

      // Reverse shift summaries for all payment methods
      for (const payment of invoice.payments) {
        const pmId = (payment as any).paymentMethodId
        if (!pmId) continue
        try {
          const openShift = await tx.cashShift.findFirst({ where: { userId, status: 'OPEN' } })
          if (openShift) {
            await tx.shiftSummary.updateMany({
              where: { shiftId: openShift.id, paymentMethodId: pmId },
              data: { expectedAmount: { decrement: payment.amount } },
            })
          }
        } catch { /* ShiftSummary may not exist */ }
      }

      // ── 3. Reverse customer balance (if invoice had unpaid balance) ──
      if (invoice.balance > 0 && invoice.customerId) {
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: { currentBalance: { decrement: invoice.balance } },
        })
      }

      // ── 4. Delete invoice (items, payments cascade) ──
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


