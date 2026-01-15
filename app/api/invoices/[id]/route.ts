import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'

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

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      )
    }

    const invoice = await prisma.invoice.findUnique({
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
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // debug logs removed

    // Asegurar que todos los datos estén presentes
    if (!invoice.issuedAt && invoice.createdAt) {
      // Si no hay issuedAt, usar createdAt como fallback
      invoice.issuedAt = invoice.createdAt
      logger.debug('Using createdAt as issuedAt fallback', { invoiceId })
    }

    return NextResponse.json(invoice)
  } catch (error: any) {
    logger.error('Error fetching invoice', error, { endpoint: '/api/invoices/[id]', method: 'GET', invoiceId })
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch invoice',
        message: error.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack,
          code: error.code,
        } : undefined
      },
      { status: 500 }
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

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const data = updateInvoiceSchema.parse(body)

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
      const invoice = await prisma.invoice.findUnique({
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

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ...(statusToUpdate && { status: statusToUpdate }),
        notes: data.notes !== undefined ? (data.notes || null) : undefined,
        updatedById: (session.user as any).id,
        ...(statusToUpdate === 'PAGADA' && !data.status ? { paidAt: new Date() } : {}),
      },
    })

    return NextResponse.json(invoice)
  } catch (error) {
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

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    // Verificar que la factura existe
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        payments: true,
      },
    })

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // Validar que la factura no esté enviada a facturación electrónica
    if (invoice.electronicStatus === 'ACCEPTED' || invoice.electronicStatus === 'SENT') {
      return NextResponse.json(
        { error: 'No se puede eliminar una factura que ya fue enviada a facturación electrónica' },
        { status: 400 }
      )
    }

    // Eliminar factura (los items y payments se eliminan en cascada)
    await prisma.invoice.delete({
      where: { id: invoiceId },
    })

    return NextResponse.json({ message: 'Invoice deleted successfully' })
  } catch (error) {
    logger.error('Error deleting invoice', error, { endpoint: '/api/invoices/[id]', method: 'DELETE', invoiceId })
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    )
  }
}

