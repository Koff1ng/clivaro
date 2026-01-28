import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const recipeSchema = z.object({
    productId: z.string(),
    yield: z.number().min(0.01),
    active: z.boolean().default(true),
    items: z.array(z.object({
        ingredientId: z.string(),
        quantity: z.number().min(0.0001),
        unitId: z.string().optional().nullable(),
    }))
})

export async function GET(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
    if (session instanceof NextResponse) return session
    const prisma = await getPrismaForRequest(request, session)

    try {
        const { searchParams } = new URL(request.url)
        const productId = searchParams.get('productId')
        if (!productId) return NextResponse.json({ error: 'ProductId is required' }, { status: 400 })

        const recipe = await prisma.recipe.findUnique({
            where: { productId },
            include: {
                items: {
                    include: {
                        ingredient: true,
                        unit: true
                    }
                }
            }
        })
        return NextResponse.json(recipe)
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch recipe' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PRODUCTS)
    if (session instanceof NextResponse) return session
    const prisma = await getPrismaForRequest(request, session)

    try {
        const body = await request.json()
        const data = recipeSchema.parse(body)

        // Use transaction for Upsert Recipe + Replace Items
        const result = await prisma.$transaction(async (tx: any) => {
            // 1. Upsert Recipe
            const recipe = await tx.recipe.upsert({
                where: { productId: data.productId },
                update: {
                    yield: data.yield,
                    active: data.active,
                },
                create: {
                    productId: data.productId,
                    yield: data.yield,
                    active: data.active,
                }
            })

            // 2. Delete old items
            await tx.recipeItem.deleteMany({
                where: { recipeId: recipe.id }
            })

            // 3. Create new items
            if (data.items.length > 0) {
                await tx.recipeItem.createMany({
                    data: data.items.map(item => ({
                        recipeId: recipe.id,
                        ingredientId: item.ingredientId,
                        quantity: item.quantity,
                        unitId: item.unitId || null,
                    }))
                })
            }

            return tx.recipe.findUnique({
                where: { id: recipe.id },
                include: { items: true }
            })
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('[Recipe API] Error:', error)
        return NextResponse.json({ error: error.message || 'Failed to save recipe' }, { status: 500 })
    }
}
