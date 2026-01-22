import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
    try {
        const session = await auth()
        if (!session?.user?.id || !session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { entityType, data, mapping } = await req.json() // data is valid array from preflight
        const tenantId = session.user.tenantId

        let results = { success: 0, failed: 0, errors: [] as string[] }

        if (entityType === 'clients') {
            for (const row of data) {
                try {
                    // Determine unique key (Email or TaxID)
                    const uniqueKey = row['email'] || row['taxId'] || row['nit'] || row['cc']
                    if (!uniqueKey) {
                        results.failed++
                        results.errors.push(`Row skipped: No identifier (email/taxId) found for ${row['name'] || 'unknown'}`)
                        continue
                    }

                    // Map fields based on user selection or auto-match
                    // Simple implementation: direct mapping for now
                    await prisma.customer.upsert({
                        where: {
                            tenantId_email: row['email'] ? { tenantId, email: row['email'] } : undefined,
                            // If no email, we ideally need another unique constraint. 
                            // Prisma schema might use taxId as unique? Currently schema says: @@index([tenantId, email])
                            // Let's rely on Create if not found for MVP if no unique constraint matches perfectly
                        },
                        update: {
                            name: row['name'],
                            phone: row['phone'],
                            address: row['address'],
                            city: row['city'],
                            taxId: row['taxId'] || row['nit']
                        },
                        create: {
                            tenantId,
                            name: row['name'],
                            email: row['email'],
                            phone: row['phone'],
                            address: row['address'],
                            city: row['city'],
                            taxId: row['taxId'] || row['nit'] || 'CONSUMIDOR_FINAL'
                        }
                    })
                    results.success++
                } catch (e: any) {
                    // If upsert fails (e.g. unique constraint on taxId not handled above), try generic create or log error
                    // Fallback to simpler logic:
                    if (e.code === 'P2002') {
                        // Constraint violation
                        results.failed++
                        results.errors.push(`Duplicate found for ${row['name']}`)
                    } else {
                        console.error(e)
                        results.failed++
                        results.errors.push(e.message)
                    }
                }
            }
        } else if (entityType === 'products') {
            for (const row of data) {
                try {
                    const sku = row['sku'] || row['code']
                    if (!sku) {
                        results.failed++
                        continue
                    }

                    await prisma.product.upsert({
                        where: { tenantId_sku: { tenantId, sku } },
                        update: {
                            name: row['name'],
                            price: parseFloat(row['price'] || 0),
                            stock: parseInt(row['stock'] || 0),
                            description: row['description']
                        },
                        create: {
                            tenantId,
                            sku: String(sku),
                            name: row['name'],
                            price: parseFloat(row['price'] || 0),
                            stock: parseInt(row['stock'] || 0),
                            description: row['description'],
                            categoryId: 'uncategorized' // Placeholder, ideally findByCategoryName
                        }
                    })
                    results.success++
                } catch (e: any) {
                    results.failed++
                    results.errors.push(`Error on ${row['name']}: ${e.message}`)
                }
            }
        }

        return NextResponse.json(results)

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
