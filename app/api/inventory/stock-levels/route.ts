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
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const warehouseId = searchParams.get('warehouseId')
    const search = searchParams.get('search') || ''
    const skip = (page - 1) * limit

    // Obtener todos los almacenes si no se especifica uno
    const warehouses = warehouseId 
      ? await prisma.warehouse.findMany({ where: { id: warehouseId, active: true } })
      : await prisma.warehouse.findMany({ where: { active: true } })

    if (warehouses.length === 0) {
      return NextResponse.json({
        stockLevels: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      })
    }

    // Construir where para productos
    const productWhere: any = {
      active: true,
      trackStock: true,
    }

    if (search) {
      productWhere.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ]
    }

    // Obtener todos los productos con trackStock activado
    const products = await prisma.product.findMany({
      where: productWhere,
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unitOfMeasure: true,
        trackStock: true,
      },
      orderBy: { name: 'asc' },
    })

    // Obtener todos los niveles de stock existentes
    const stockLevelWhere: any = {
      product: {
        active: true,
        trackStock: true,
      },
    }

    if (warehouseId) {
      stockLevelWhere.warehouseId = warehouseId
    }

    if (search) {
      stockLevelWhere.product = {
        ...stockLevelWhere.product,
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
          { barcode: { contains: search } },
        ],
      }
    }

    const existingStockLevels = await prisma.stockLevel.findMany({
      where: stockLevelWhere,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            unitOfMeasure: true,
            trackStock: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Crear un mapa de stock levels por producto y almacén
    const stockLevelMap = new Map<string, any>()
    existingStockLevels.forEach(sl => {
      const key = `${sl.productId || sl.variantId}-${sl.warehouseId}`
      stockLevelMap.set(key, sl)
    })

    // Combinar productos con sus niveles de stock (o crear niveles vacíos)
    const allStockLevels: any[] = []
    
    for (const product of products) {
      for (const warehouse of warehouses) {
        const key = `${product.id}-${warehouse.id}`
        const existingStock = stockLevelMap.get(key)
        
        if (existingStock) {
          // Ya existe un nivel de stock
          allStockLevels.push({
            id: existingStock.id,
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            productBarcode: product.barcode,
            unitOfMeasure: product.unitOfMeasure || 'UNIT',
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            quantity: existingStock.quantity,
            minStock: existingStock.minStock,
            maxStock: (existingStock as any).maxStock ?? 0,
            isLowStock: existingStock.quantity <= existingStock.minStock,
            trackStock: product.trackStock,
          })
        } else {
          // No existe nivel de stock, crear uno virtual con cantidad 0
          allStockLevels.push({
            id: `virtual-${product.id}-${warehouse.id}`,
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            productBarcode: product.barcode,
            unitOfMeasure: product.unitOfMeasure || 'UNIT',
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            quantity: 0,
            minStock: 0,
            maxStock: 0,
            isLowStock: false,
            trackStock: product.trackStock,
          })
        }
      }
    }

    // Aplicar paginación
    const total = allStockLevels.length
    const paginated = allStockLevels.slice(skip, skip + limit)

    return NextResponse.json({
      stockLevels: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching stock levels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock levels' },
      { status: 500 }
    )
  }
}

