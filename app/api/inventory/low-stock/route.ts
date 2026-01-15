import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

export async function GET(request: Request) {
  // Permitir acceso con MANAGE_INVENTORY o VIEW_REPORTS (para dashboard)
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_INVENTORY, PERMISSIONS.VIEW_REPORTS])
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const allStockLevels = await prisma.stockLevel.findMany({
      where: {
        product: {
          active: true,
          trackStock: true,
        },
      },
      include: {
        product: true,
        warehouse: true,
      },
    })

    // Filter where quantity <= minStock
    const lowStockItems = allStockLevels.filter(item => 
      item.quantity <= item.minStock
    ).slice(0, 20)

    const result = lowStockItems.map(item => ({
      id: item.id,
      productName: item.product?.name || 'Unknown',
      warehouseName: item.warehouse.name,
      quantity: item.quantity,
      minStock: item.minStock,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching low stock:', error)
    return NextResponse.json(
      { error: 'Failed to fetch low stock' },
      { status: 500 }
    )
  }
}

