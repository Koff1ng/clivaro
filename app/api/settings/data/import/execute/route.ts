import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTenantPrisma } from '@/lib/tenant-db'

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

        const { entityType, data } = await req.json() // data is valid array from preflight

        let results = { success: 0, failed: 0, errors: [] as string[] }

        if (entityType === 'clients') {
            for (const row of data) {
                try {
                    // Determine unique key (Email or TaxID or name)
                    const email = row['email']
                    const name = row['name']

                    if (!name) {
                        results.failed++
                        results.errors.push(`Row skipped: No name found`)
                        continue
                    }

                    // Try to find existing customer by email if provided
                    let existingCustomer = null
                    if (email) {
                        existingCustomer = await tenantPrisma.customer.findFirst({
                            where: { email }
                        })
                    }

                    if (existingCustomer) {
                        // Update existing
                        await tenantPrisma.customer.update({
                            where: { id: existingCustomer.id },
                            data: {
                                name: row['name'],
                                phone: row['phone'] || null,
                                address: row['address'] || null,
                                taxId: row['taxId'] || row['nit'] || null,
                                tags: row['tags'] || null,
                                notes: row['notes'] || null
                            }
                        })
                    } else {
                        // Create new
                        await tenantPrisma.customer.create({
                            data: {
                                name: row['name'],
                                email: row['email'] || null,
                                phone: row['phone'] || null,
                                address: row['address'] || null,
                                taxId: row['taxId'] || row['nit'] || null,
                                tags: row['tags'] || null,
                                notes: row['notes'] || null
                            }
                        })
                    }
                    results.success++
                } catch (e: any) {
                    if (e.code === 'P2002') {
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
                        results.errors.push(`Row skipped: No SKU/code found for ${row['name'] || 'unknown'}`)
                        continue
                    }

                    await tenantPrisma.product.upsert({
                        where: { sku: String(sku) },
                        update: {
                            name: row['name'],
                            price: parseFloat(row['price'] || 0),
                            cost: parseFloat(row['cost'] || 0),
                            description: row['description'] || null,
                            brand: row['brand'] || null,
                            category: row['category'] || null,
                            barcode: row['barcode'] || null,
                            taxRate: parseFloat(row['taxRate'] || 0)
                        },
                        create: {
                            sku: String(sku),
                            name: row['name'],
                            price: parseFloat(row['price'] || 0),
                            cost: parseFloat(row['cost'] || 0),
                            description: row['description'] || null,
                            brand: row['brand'] || null,
                            category: row['category'] || null,
                            barcode: row['barcode'] || null,
                            taxRate: parseFloat(row['taxRate'] || 0)
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
