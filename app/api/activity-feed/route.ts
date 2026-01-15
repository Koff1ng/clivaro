import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  // Permitir acceso con VIEW_REPORTS o MANAGE_CRM
  const session = await requireAnyPermission(request as any, [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_CRM])
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '30') // Aumentar límite para incluir más actividades

    const activities: any[] = []

    // 1. Manual Stock Adjustments (Ajustes Manuales de Inventario)
    // Solo movimientos que son ajustes manuales (reference empieza con "ADJ-" o reason contiene "Ajuste")
    const stockAdjustments = await prisma.stockMovement.findMany({
      take: limit * 2, // Tomar más para filtrar después
      where: {
        OR: [
          { reference: { startsWith: 'ADJ-' } },
          { reason: { contains: 'Ajuste' } },
        ],
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    stockAdjustments.forEach(m => {
      activities.push({
        id: `adjustment-${m.id}`,
        type: 'STOCK_ADJUSTMENT',
        title: `Ajuste Manual de Inventario: ${m.product?.name || 'Producto desconocido'}`,
        description: `${m.type === 'IN' ? 'Entrada' : 'Salida'} de ${m.quantity} unidades - ${m.warehouse.name}`,
        details: {
          warehouse: m.warehouse.name,
          product: m.product?.name,
          sku: m.product?.sku,
          quantity: m.quantity,
          type: m.type,
          reason: m.reason,
        },
        user: m.createdBy.name,
        createdAt: m.createdAt,
        icon: m.type === 'IN' ? 'arrow-up-circle' : 'arrow-down-circle',
        color: m.type === 'IN' ? 'green' : 'red',
      })
    })

    // 2. Payments (Pagos - Ingresos de Dinero)
    const payments = await prisma.payment.findMany({
      take: limit,
      include: {
        invoice: { 
          select: { 
            id: true, 
            number: true,
            customer: { select: { id: true, name: true } },
          } 
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    payments.forEach(p => {
      activities.push({
        id: `payment-${p.id}`,
        type: 'PAYMENT',
        title: `Pago recibido: $${p.amount.toFixed(2)}`,
        description: `Factura: ${p.invoice?.number || 'N/A'} - Método: ${p.method === 'CASH' ? 'Efectivo' : p.method === 'CARD' ? 'Tarjeta' : 'Transferencia'}`,
        details: {
          amount: p.amount,
          method: p.method,
          invoice: p.invoice?.number,
          customer: p.invoice?.customer?.name,
        },
        user: 'Sistema', // Payment no tiene createdBy en el schema actual
        createdAt: p.createdAt,
        icon: 'dollar-sign',
        color: 'green',
      })
    })

    // 3. Cash Movements (Movimientos de Caja - Ingresos/Salidas de Dinero)
    const cashMovements = await prisma.cashMovement.findMany({
      take: limit,
      include: {
        cashShift: { select: { id: true, status: true, openedAt: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    cashMovements.forEach(cm => {
      const shiftInfo = cm.cashShift 
        ? `Turno ${cm.cashShift.status === 'OPEN' ? 'Abierto' : 'Cerrado'} (${new Date(cm.cashShift.openedAt).toLocaleDateString()})`
        : 'N/A'
      
      activities.push({
        id: `cash-movement-${cm.id}`,
        type: 'CASH_MOVEMENT',
        title: `Movimiento de Caja: ${cm.type === 'IN' ? 'Ingreso' : 'Salida'} de $${cm.amount.toFixed(2)}`,
        description: `${cm.reason || 'Sin razón especificada'} - ${shiftInfo}`,
        details: {
          type: cm.type,
          amount: cm.amount,
          reason: cm.reason,
          cashShift: shiftInfo,
        },
        user: cm.createdBy?.name || 'Sistema',
        createdAt: cm.createdAt,
        icon: cm.type === 'IN' ? 'arrow-down-circle' : 'arrow-up-circle',
        color: cm.type === 'IN' ? 'green' : 'red',
      })
    })

    // 4. Products (Productos Nuevos)
    const products = await prisma.product.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    })

    products.forEach(p => {
      activities.push({
        id: `product-${p.id}`,
        type: 'PRODUCT',
        title: `Producto nuevo: ${p.name}`,
        description: `SKU: ${p.sku || 'N/A'} - Precio: $${p.price.toFixed(2)}`,
        details: {
          name: p.name,
          sku: p.sku,
          price: p.price,
          cost: p.cost,
        },
        user: 'Sistema',
        createdAt: p.createdAt,
        icon: 'package',
        color: 'blue',
      })
    })

    // 5. Invoices (Facturas) - Solo para referencia de pagos
    const invoices = await prisma.invoice.findMany({
      take: limit,
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    invoices.forEach(inv => {
      activities.push({
        id: `invoice-${inv.id}`,
        type: 'INVOICE',
        title: `Factura creada: ${inv.number}`,
        description: `Cliente: ${inv.customer?.name || 'Cliente no registrado'}`,
        details: {
          number: inv.number,
          customer: inv.customer?.name,
          total: inv.total,
          status: inv.status,
        },
        user: inv.createdBy?.name || 'Sistema',
        createdAt: inv.createdAt,
        icon: 'file-text',
        color: 'blue',
      })
    })

    // 6. Purchase Orders (Órdenes de Compra)
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      take: limit,
      include: {
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    purchaseOrders.forEach(po => {
      activities.push({
        id: `purchase-order-${po.id}`,
        type: 'PURCHASE_ORDER',
        title: `Orden de Compra: ${po.number}`,
        description: `Proveedor: ${po.supplier?.name || 'Proveedor desconocido'} - Estado: ${po.status}`,
        details: {
          number: po.number,
          supplier: po.supplier?.name,
          total: po.total,
          status: po.status,
        },
        user: 'Sistema',
        createdAt: po.createdAt,
        icon: 'package',
        color: 'orange',
      })
    })

    // 7. Goods Receipts (Recepciones)
    const goodsReceipts = await prisma.goodsReceipt.findMany({
      take: limit,
      include: {
        purchaseOrder: { select: { id: true, number: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    goodsReceipts.forEach(gr => {
      activities.push({
        id: `goods-receipt-${gr.id}`,
        type: 'GOODS_RECEIPT',
        title: `Recepción de Mercancía: ${gr.number}`,
        description: `Orden: ${gr.purchaseOrder?.number || 'N/A'}`,
        details: {
          number: gr.number,
          purchaseOrder: gr.purchaseOrder?.number,
        },
        user: 'Sistema',
        createdAt: gr.createdAt,
        icon: 'truck',
        color: 'purple',
      })
    })

    // 8. Quotations (Cotizaciones)
    const quotations = await prisma.quotation.findMany({
      take: limit,
      include: {
        customer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    quotations.forEach(q => {
      activities.push({
        id: `quotation-${q.id}`,
        type: 'QUOTATION',
        title: `Cotización: ${q.number}`,
        description: `Cliente: ${q.customer?.name || 'Cliente no registrado'} - Estado: ${q.status}`,
        details: {
          number: q.number,
          customer: q.customer?.name,
          total: q.total,
          status: q.status,
        },
        user: 'Sistema',
        createdAt: q.createdAt,
        icon: 'file-search',
        color: 'cyan',
      })
    })


    // 8. CRM Activities (Actividades de CRM - Llamadas, Emails, Reuniones, Tareas, Notas)
    const crmActivities = await prisma.activity.findMany({
      take: limit,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    crmActivities.forEach(act => {
      const activityTypeLabels: Record<string, string> = {
        'CALL': 'Llamada',
        'EMAIL': 'Email',
        'MEETING': 'Reunión',
        'TASK': 'Tarea',
        'NOTE': 'Nota',
      }

      const activityIcons: Record<string, string> = {
        'CALL': 'phone',
        'EMAIL': 'mail',
        'MEETING': 'calendar',
        'TASK': 'check-square',
        'NOTE': 'file-text',
      }

      const activityColors: Record<string, string> = {
        'CALL': 'blue',
        'EMAIL': 'green',
        'MEETING': 'purple',
        'TASK': 'orange',
        'NOTE': 'gray',
      }

      activities.push({
        id: `crm-activity-${act.id}`,
        type: 'CRM_ACTIVITY',
        title: `${activityTypeLabels[act.type] || act.type}: ${act.subject}`,
        description: `${act.description || ''}${act.lead ? ` - Lead: ${act.lead.name}` : ''}${act.customer ? ` - Cliente: ${act.customer.name}` : ''}${act.dueDate ? ` - Vence: ${new Date(act.dueDate).toLocaleDateString()}` : ''}`,
        details: {
          type: act.type,
          subject: act.subject,
          description: act.description,
          completed: act.completed,
          lead: act.lead?.name,
          customer: act.customer?.name,
          dueDate: act.dueDate,
        },
        user: act.createdBy?.name || 'Sistema',
        createdAt: act.createdAt,
        icon: activityIcons[act.type] || 'file-text',
        color: activityColors[act.type] || 'gray',
        completed: act.completed,
      })
    })

    // Sort all activities by date (most recent first)
    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    logger.debug('[Activity Feed] Built feed', {
      totalActivities: activities.length,
      returning: Math.min(activities.length, limit),
      sampleTypes: activities.map(a => a.type).slice(0, 10),
    })

    // Return only the requested limit
    return NextResponse.json({
      activities: activities.slice(0, limit),
      total: activities.length,
    })
  } catch (error) {
    logger.error('Error fetching activity feed', error, { endpoint: '/api/activity-feed', method: 'GET' })
    return NextResponse.json(
      { error: 'Failed to fetch activity feed' },
      { status: 500 }
    )
  }
}

