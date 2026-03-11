import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx } from '@/lib/tenancy'
import { z } from 'zod'

const createCategorySchema = z.object({
  name: z.string().min(1, 'El nombre de la categoría es requerido'),
})

export async function GET(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_SALES])

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId

  try {
    const categories = await withTenantRead(tenantId, async (prisma) => {
      const products = await prisma.product.findMany({
        where: {
          category: {
            not: null,
          },
        },
        select: {
          category: true,
        },
        distinct: ['category'],
      })

      return products
        .map(p => p.category)
        .filter((cat): cat is string => cat !== null && cat !== '')
        .sort()
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requireAnyPermission(request as any, [PERMISSIONS.MANAGE_PRODUCTS, PERMISSIONS.MANAGE_SALES])

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = (session.user as any).tenantId

  try {
    const body = await request.json()
    const data = createCategorySchema.parse(body)

    return await withTenantTx(tenantId, async (tx) => {
      // Verificar si la categoría ya existe
      const existing = await tx.product.findFirst({
        where: {
          category: data.name,
        },
      })

      if (existing) {
        return NextResponse.json(
          { error: 'Esta categoría ya existe' },
          { status: 400 }
        )
      }

      // Crear un producto temporal para "guardar" la categoría en el sistema
      await tx.product.create({
        data: {
          sku: `CAT-TEMP-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          name: `[Categoría: ${data.name}]`,
          category: data.name,
          unitOfMeasure: 'UNIT',
          cost: 0,
          price: 0,
          taxRate: 0,
          trackStock: false,
          active: false,
          createdById: (session.user as any).id,
        },
      })

      return NextResponse.json({
        message: 'Categoría creada exitosamente',
        name: data.name
      }, { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
}

