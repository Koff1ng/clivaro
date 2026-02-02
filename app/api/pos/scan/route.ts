import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx } from '@/lib/tenancy'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId

  try {
    return await withTenantTx(tenantId, async (prisma) => {
      const { searchParams } = new URL(request.url)
      const code = (searchParams.get('code') || '').trim()
      const warehouseId = (searchParams.get('warehouseId') || '').trim()

      if (!code) {
        return NextResponse.json({ error: 'Falta code', code: 'VALIDATION_ERROR' }, { status: 400 })
      }

      // 1) Try variant barcode exact match
      const variant = await prisma.productVariant.findFirst({
        where: { barcode: code, active: true },
        include: {
          product: {
            select: { id: true, name: true, sku: true, barcode: true, price: true, taxRate: true, trackStock: true, active: true },
          },
          stockLevels: {
            select: { warehouseId: true, quantity: true },
          },
        },
      })

      if (variant?.product?.active) {
        const stockLevels = warehouseId
          ? variant.stockLevels.filter((sl: any) => sl.warehouseId === warehouseId)
          : variant.stockLevels

        return NextResponse.json(
          {
            kind: 'VARIANT',
            product: {
              id: variant.product.id,
              name: variant.product.name,
              sku: variant.product.sku,
              barcode: variant.product.barcode,
              price: variant.product.price,
              taxRate: variant.product.taxRate,
              trackStock: variant.product.trackStock,
            },
            variant: {
              id: variant.id,
              name: variant.name,
              sku: variant.sku,
              barcode: variant.barcode,
              price: variant.price,
            },
            stockLevels,
          },
          { status: 200 }
        )
      }

      // 2) Try product barcode or SKU exact match
      const product = await prisma.product.findFirst({
        where: {
          active: true,
          OR: [{ barcode: code }, { sku: code }],
        },
        include: {
          stockLevels: {
            select: { warehouseId: true, quantity: true },
          },
        },
      })

      if (!product) {
        return NextResponse.json({ error: 'Producto no encontrado', code: 'NOT_FOUND' }, { status: 404 })
      }

      const stockLevels = warehouseId
        ? product.stockLevels.filter((sl: any) => sl.warehouseId === warehouseId)
        : product.stockLevels

      return NextResponse.json(
        {
          kind: 'PRODUCT',
          product: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            price: product.price,
            taxRate: product.taxRate,
            trackStock: product.trackStock,
          },
          stockLevels,
        },
        { status: 200 }
      )
    })
  } catch (error: any) {
    logger.error('Error POS scan', error, { endpoint: '/api/pos/scan', method: 'GET' })
    return NextResponse.json({ error: error?.message || 'Error al escanear', code: 'SERVER_ERROR' }, { status: 500 })
  }
}


