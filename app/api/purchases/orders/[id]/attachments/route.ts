import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'

export const dynamic = 'force-dynamic'

// Valid file types for purchase order documents
const VALID_FILE_TYPES = [
  'FACTURA',        // Supplier invoice
  'ACUSE_RECIBO',   // Receipt acknowledgment
  'NOTA_CREDITO',   // Credit note
  'REMISION',       // Shipping/delivery document
  'SOPORTE_PAGO',   // Payment proof
  'OTRO',           // Other
]

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId
  const { id: orderId } = await params

  try {
    const attachments = await withTenantRead(tenantId, async (prisma) => {
      return prisma.purchaseOrderAttachment.findMany({
        where: { purchaseOrderId: orderId },
        orderBy: { createdAt: 'desc' },
      })
    })

    return NextResponse.json({ attachments })
  } catch (error: any) {
    console.error('Error fetching attachments:', error)
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId
  const userId = (session.user as any).id
  const { id: orderId } = await params

  try {
    const body = await request.json()
    const { fileName, fileUrl, fileType, fileSize, mimeType, notes } = body

    if (!fileName || !fileUrl) {
      return NextResponse.json({ error: 'fileName and fileUrl are required' }, { status: 400 })
    }

    if (fileType && !VALID_FILE_TYPES.includes(fileType)) {
      return NextResponse.json({ error: `Invalid fileType. Valid: ${VALID_FILE_TYPES.join(', ')}` }, { status: 400 })
    }

    const attachment = await withTenantTx(tenantId, async (prisma) => {
      // Verify PO exists
      const po = await prisma.purchaseOrder.findUnique({ where: { id: orderId } })
      if (!po) throw new Error('Purchase order not found')

      return prisma.purchaseOrderAttachment.create({
        data: {
          purchaseOrderId: orderId,
          fileName,
          fileUrl,
          fileType: fileType || 'OTRO',
          fileSize: fileSize || 0,
          mimeType: mimeType || 'application/octet-stream',
          notes: notes || null,
          uploadedById: userId,
        },
      })
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error: any) {
    console.error('Error creating attachment:', error)
    return NextResponse.json({ error: error.message || 'Failed to create attachment' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId
  const { id: orderId } = await params

  try {
    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return NextResponse.json({ error: 'attachmentId query param required' }, { status: 400 })
    }

    await withTenantTx(tenantId, async (prisma) => {
      await prisma.purchaseOrderAttachment.delete({
        where: { id: attachmentId },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting attachment:', error)
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 })
  }
}
