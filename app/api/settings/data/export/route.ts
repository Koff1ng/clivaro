import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTenantPrisma } from '@/lib/tenant-db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as any
        if (!user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const tenantId = user.tenantId
        if (!tenantId) {
            return NextResponse.json({ error: 'No tenant associated with user' }, { status: 400 })
        }

        // Get tenant's database URL from master DB
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, databaseUrl: true }
        })

        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
        }

        // Get tenant-specific Prisma client
        const tenantPrisma = getTenantPrisma(tenant.databaseUrl)

        const { entities, format } = await req.json()

        const wb = XLSX.utils.book_new()
        const jsonResult: Record<string, any[]> = {}

        // CLIENTS
        if (entities.includes('clients')) {
            const clients = await tenantPrisma.customer.findMany({
                select: {
                    id: true,
                    name: true,
                    taxId: true,
                    email: true,
                    phone: true,
                    address: true,
                    tags: true,
                    notes: true,
                    active: true,
                    createdAt: true
                }
            })
            if (format === 'json') {
                jsonResult['clients'] = clients
            } else {
                const ws = XLSX.utils.json_to_sheet(clients)
                XLSX.utils.book_append_sheet(wb, ws, "Clientes")
            }
        }

        // PRODUCTS (and related Restaurant Data)
        if (entities.includes('products')) {
            const products = await tenantPrisma.product.findMany({
                select: {
                    id: true,
                    sku: true,
                    barcode: true,
                    name: true,
                    brand: true,
                    category: true,
                    unitOfMeasure: true,
                    cost: true,
                    price: true,
                    taxRate: true,
                    trackStock: true,
                    active: true,
                    description: true,
                    productType: true,
                    enableRecipeConsumption: true,
                    createdAt: true
                }
            })

            const units = await tenantPrisma.unit.findMany()
            const unitConversions = await tenantPrisma.unitConversion.findMany()
            const recipes = await tenantPrisma.recipe.findMany({
                include: { items: true }
            })

            if (format === 'json') {
                jsonResult['products'] = products
                jsonResult['units'] = units
                jsonResult['unitConversions'] = unitConversions
                jsonResult['recipes'] = recipes
            } else {
                const ws = XLSX.utils.json_to_sheet(products)
                XLSX.utils.book_append_sheet(wb, ws, "Productos")

                if (units.length > 0) {
                    const wsUnits = XLSX.utils.json_to_sheet(units)
                    XLSX.utils.book_append_sheet(wb, wsUnits, "Unidades")
                }
                if (unitConversions.length > 0) {
                    const wsConv = XLSX.utils.json_to_sheet(unitConversions)
                    XLSX.utils.book_append_sheet(wb, wsConv, "Conversiones")
                }

                // Flatten recipes for Excel
                if (recipes.length > 0) {
                    const flatRecipes = recipes.flatMap((r: any) =>
                        r.items.map((item: any) => ({
                            recipeId: r.id,
                            productId: r.productId, // Product being made
                            yield: r.yield,
                            active: r.active,
                            ingredientId: item.ingredientId,
                            quantity: item.quantity,
                            unitId: item.unitId
                        }))
                    )
                    const wsRecipes = XLSX.utils.json_to_sheet(flatRecipes)
                    XLSX.utils.book_append_sheet(wb, wsRecipes, "Recetas")
                }
            }
        }

        // SALES
        if (entities.includes('sales')) {
            const sales = await tenantPrisma.invoice.findMany({
                include: {
                    customer: { select: { name: true, taxId: true, email: true } },
                    items: {
                        include: { product: { select: { name: true, sku: true } } }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 5000 // Increased limit
            })

            // Flat items for Excel export
            const flatSales = sales.flatMap((sale: any) =>
                sale.items.map((item: any) => ({
                    invoiceNumber: sale.number,
                    date: sale.issuedAt,
                    customerName: sale.customer?.name,
                    customerTaxId: sale.customer?.taxId,
                    customerEmail: sale.customer?.email,
                    total: sale.total,
                    status: sale.status,
                    sku: item.product?.sku,
                    productName: item.product?.name,
                    quantity: item.quantity,
                    price: item.unitPrice,
                    subtotal: item.subtotal
                }))
            )

            if (format === 'json') {
                jsonResult['sales'] = sales // Full nested structure for JSON
            } else {
                const ws = XLSX.utils.json_to_sheet(flatSales)
                XLSX.utils.book_append_sheet(wb, ws, "Ventas_Items")
            }
        }

        // SETTINGS
        if (entities.includes('settings')) {
            const settings = await prisma.tenantSettings.findUnique({
                where: { tenantId }
            })

            if (settings) {
                if (format === 'json') {
                    jsonResult['settings'] = [settings] // Array for consistency
                } else {
                    // Remove internal fields
                    const { id, tenantId: tId, ...safeSettings } = settings as any
                    const ws = XLSX.utils.json_to_sheet([safeSettings])
                    XLSX.utils.book_append_sheet(wb, ws, "Configuracion")
                }
            }
        }

        if (format === 'json') {
            return new NextResponse(JSON.stringify(jsonResult, null, 2), {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="backup-${tenant.id}-${new Date().toISOString().split('T')[0]}.json"`
                }
            })
        } else {
            // Generate Buffer
            const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

            return new NextResponse(buf, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="backup-${tenant.id}-${new Date().toISOString().split('T')[0]}.xlsx"`
                }
            })
        }

    } catch (error: any) {
        console.error('Export Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
