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
                            taxRate: parseFloat(row['taxRate'] || 0),
                            productType: row['productType'] || 'RETAIL',
                            enableRecipeConsumption: Boolean(row['enableRecipeConsumption'])
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
                            taxRate: parseFloat(row['taxRate'] || 0),
                            productType: row['productType'] || 'RETAIL',
                            enableRecipeConsumption: Boolean(row['enableRecipeConsumption'])
                        }
                    })
                    results.success++
                } catch (e: any) {
                    results.failed++
                    results.errors.push(`Error on ${row['name']}: ${e.message}`)
                }
            }
        } else if (entityType === 'settings') {
            const row = data[0]
            if (row) {
                try {
                    // Remove system fields to prevent conflicts
                    const { id, tenantId: tId, createdAt, updatedAt, ...settingsData } = row

                    await prisma.tenantSettings.upsert({
                        where: { tenantId },
                        update: settingsData,
                        create: {
                            tenantId,
                            ...settingsData
                        }
                    })
                    results.success = 1
                } catch (e: any) {
                    results.failed = 1
                    results.errors.push(`Error updating settings: ${e.message}`)
                }
            }
        } else if (entityType === 'sales') {
            // Group deeply by invoiceNumber
            const invoicesMap = new Map<string, any[]>()
            for (const row of data) {
                const num = String(row['invoiceNumber'])
                if (!invoicesMap.has(num)) invoicesMap.set(num, [])
                invoicesMap.get(num)!.push(row)
            }

            for (const [number, rows] of invoicesMap.entries()) {
                try {
                    const firstRow = rows[0]
                    if (!firstRow) continue

                    // Basic Invoice Data
                    const issueDate = firstRow['date'] ? new Date(firstRow['date']) : new Date()
                    const status = firstRow['status'] || 'PAID'
                    const total = parseFloat(firstRow['total'] || 0)

                    // Find Customer
                    let customerId = null
                    // Try by TaxID
                    if (firstRow['customerTaxId']) {
                        const c = await tenantPrisma.customer.findFirst({ where: { taxId: String(firstRow['customerTaxId']) } })
                        if (c) customerId = c.id
                    }
                    // Try by Name if not found
                    if (!customerId && firstRow['customerName'] || firstRow['customer']) {
                        const name = String(firstRow['customerName'] || firstRow['customer'])
                        const c = await tenantPrisma.customer.findFirst({ where: { name } })
                        if (c) customerId = c.id
                        else {
                            // Create minimal customer
                            const newC = await tenantPrisma.customer.create({
                                data: {
                                    name,
                                    taxId: firstRow['customerTaxId'] ? String(firstRow['customerTaxId']) : null,
                                    email: firstRow['customerEmail'] ? String(firstRow['customerEmail']) : null,
                                }
                            })
                            customerId = newC.id
                        }
                    }

                    if (!customerId) {
                        results.failed++
                        results.errors.push(`Skipped Invoice ${number}: No customer found/created`)
                        continue
                    }

                    // Check if invoice exists
                    const existingInv = await tenantPrisma.invoice.findUnique({ where: { number: String(number) } })
                    if (existingInv) {
                        // Skip if exists
                        // results.errors.push(`Skipped Invoice ${number}: Already exists`) 
                        // Silent skip is better for bulk restores usually, but let's count as failed/warn
                        results.failed++
                        continue
                    }

                    // Create Invoice
                    await tenantPrisma.invoice.create({
                        data: {
                            number: String(number),
                            customerId,
                            issuedAt: issueDate,
                            status: status,
                            total: total,
                            subtotal: total, // Simplified
                            tax: 0, // Simplified
                            items: {
                                create: await Promise.all(rows.map(async (row: any) => {
                                    // Find Product
                                    let productId = null
                                    if (row['sku']) {
                                        const p = await tenantPrisma.product.findUnique({ where: { sku: String(row['sku']) } })
                                        if (p) productId = p.id
                                    }
                                    // If no product found by SKU, try name
                                    if (!productId && (row['productName'] || row['product'])) {
                                        const pName = String(row['productName'] || row['product'])
                                        const p = await tenantPrisma.product.findFirst({ where: { name: pName } })
                                        if (p) productId = p.id
                                    }

                                    // If still no product, we optionally create a dummy or skip item. 
                                    // For restore, assuming products imported first. If not found, create a placeholder?
                                    // Let's create a "Generic" product if missing to preserve the record
                                    if (!productId) {
                                        // Check if "Genérico Importado" exists
                                        let generic = await tenantPrisma.product.findFirst({ where: { sku: 'GEN-IMPORT' } })
                                        if (!generic) {
                                            generic = await tenantPrisma.product.create({
                                                data: {
                                                    name: 'Producto Importado Genérico',
                                                    sku: 'GEN-IMPORT',
                                                    price: 0,
                                                    productType: 'SERVICE'
                                                }
                                            })
                                        }
                                        productId = generic.id
                                    }

                                    return {
                                        productId,
                                        quantity: parseFloat(row['quantity'] || 1),
                                        unitPrice: parseFloat(row['price'] || 0),
                                        subtotal: parseFloat(row['subtotal'] || row['price'] || 0),
                                        taxRate: 0,
                                        unitCost: 0
                                    }
                                }))
                            }
                        }
                    })
                    results.success++
                } catch (e: any) {
                    results.failed++
                    results.errors.push(`Error creating Invoice ${number}: ${e.message}`)
                }
            }
        }

        return NextResponse.json(results)

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
